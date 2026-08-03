import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';
import { enumerarPeriodosContrato } from '@llave/shared/periodos';
import { calcularMora } from '../src/lib/punitorios.js';

/**
 * "Debería tener el trackeo de todo el pasado para poder ir a cobrarle."
 *
 * Tres garantías del alta de un contrato EN CURSO, ejercitadas de punta a punta
 * (POST /contratos → devengo → estado inicial), que es donde el bug vivía:
 *
 *  F1. Cada mes viejo se devenga a SU canon, no al de hoy. En producción los 8
 *      contratos con historia tienen COUNT(DISTINCT montoAlquiler) = 1: uno que
 *      arrancó en 2025-10 tiene sus 12 liquidaciones a $200.000, el precio de hoy.
 *      El operador declara el historial y el sistema lo respeta — o rechaza con
 *      400 el historial que contradice al propio contrato.
 *  F3. La mora de los meses viejos la elige la inmobiliaria por contrato: con el
 *      interruptor en "sigue corriendo" no se congela nada.
 *  + Un período declarado como ADEUDA queda COBRABLE (VENCIDO y sin pago). Esto
 *    no lo cubría ningún test, y es el corazón del requisito.
 */

let app: FastifyInstance;
let token: string;
let prisma: PrismaClient;

beforeAll(async () => {
  prisma = new PrismaClient();
  await seedBase(prisma);
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  const login = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { email: 'roberto@delsol.com', password: 'delsol123' },
  });
  token = login.json().token;
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

const auth = () => ({ authorization: `Bearer ${token}` });

async function crearPropiedadLibre(nombre: string): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/propiedades',
    headers: auth(),
    payload: {
      direccion: `Deuda histórica ${nombre}`,
      ciudad: 'CABA',
      provincia: 'Buenos Aires',
      tipo: 'DEPARTAMENTO',
      propietarios: [{ propietarioId: 'own_001', porcentaje: 100 }],
    },
  });
  expect(res.statusCode, `crear propiedad ${nombre}: ${res.body}`).toBeLessThan(300);
  return res.json().id;
}

const MONTO_HOY = 300_000;
const CANON_VIEJO = 100_000;
const DIA_PAGO = 10;

/**
 * Contrato que arrancó hace 9 meses (día 1, para que el primer período NO se
 * saltee: su vencimiento —día 10— cae después del inicio). Fechas relativas a hoy
 * porque el devengo del back usa `new Date()` real, no inyectable por HTTP.
 */
function contratoEnCurso() {
  const hoy = new Date();
  const inicio = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - 9, 1));
  const fin = new Date(Date.UTC(inicio.getUTCFullYear() + 2, inicio.getUTCMonth(), 1));
  const fechaInicio = inicio.toISOString().slice(0, 10);
  const fechaFin = fin.toISOString().slice(0, 10);
  const periodos = enumerarPeriodosContrato({ fechaInicio, fechaFin, diaPago: DIA_PAGO }, new Date());
  return {
    fechaInicio,
    fechaFin,
    diaPago: DIA_PAGO,
    periodos: periodos.map((p) => p.periodo),
    vencidos: periodos.filter((p) => p.vencido).map((p) => p.periodo),
  };
}

function payloadBase(propiedadId: string, nombre: string) {
  const c = contratoEnCurso();
  return {
    propiedadId,
    inquilino: { nombre },
    monto: MONTO_HOY,
    fechaInicio: c.fechaInicio,
    fechaFin: c.fechaFin,
    diaPago: c.diaPago,
    indiceAjuste: 'ICL' as const,
    frecuenciaAjusteMeses: 12,
  };
}

describe('F1 — el canon de cada mes viejo (vigencias retroactivas)', () => {
  it('con vigenciasCanon, cada liquidación vieja se devenga a SU canon (no al de hoy)', async () => {
    const propiedadId = await crearPropiedadLibre('F1-ok');
    const c = contratoEnCurso();
    // "Desde que arrancó valía $100.000; desde hace 5 meses vale $300.000".
    const corte = c.periodos[5]!;
    const res = await app.inject({
      method: 'POST',
      url: '/contratos',
      headers: auth(),
      payload: {
        ...payloadBase(propiedadId, 'Vigencias OK'),
        vigenciasCanon: [
          { desde: c.periodos[0]!, monto: CANON_VIEJO },
          { desde: corte, monto: MONTO_HOY },
        ],
      },
    });
    expect(res.statusCode, `alta con vigencias: ${res.body}`).toBeLessThan(300);
    const contratoId = res.json().id;

    const liqs = await prisma.liquidacion.findMany({
      where: { contratoId },
      select: { periodo: true, montoAlquiler: true, montoTotal: true },
      orderBy: { periodo: 'asc' },
    });
    expect(liqs.length).toBeGreaterThan(6);
    // Lo que el bug hacía: TODAS al mismo monto. Ahora hay dos precios distintos.
    const distintos = new Set(liqs.map((l) => Number(l.montoAlquiler)));
    expect([...distintos].sort((a, b) => a - b)).toEqual([CANON_VIEJO, MONTO_HOY]);
    for (const l of liqs) {
      const esperado = l.periodo < corte ? CANON_VIEJO : MONTO_HOY;
      expect(Number(l.montoAlquiler), `canon de ${l.periodo}`).toBe(esperado);
      // El total sigue la misma verdad (sin expensas en este contrato).
      expect(Number(l.montoTotal), `total de ${l.periodo}`).toBe(esperado);
    }

    // Rastro auditable: UNA fila de ajuste por CAMBIO de canon, marcada como del alta.
    const ajustes = await prisma.ajusteAlquiler.findMany({ where: { contratoId } });
    expect(ajustes).toHaveLength(1);
    expect(ajustes[0]!.periodoDesde).toBe(corte);
    expect(Number(ajustes[0]!.montoAnterior)).toBe(CANON_VIEJO);
    expect(Number(ajustes[0]!.montoNuevo)).toBe(MONTO_HOY);
    expect(ajustes[0]!.origenAlta).toBe(true);
  });

  it('sin vigenciasCanon el alta queda idéntica a hoy (no regresión)', async () => {
    const propiedadId = await crearPropiedadLibre('F1-sin');
    const res = await app.inject({
      method: 'POST',
      url: '/contratos',
      headers: auth(),
      payload: payloadBase(propiedadId, 'Sin vigencias'),
    });
    expect(res.statusCode, `alta sin vigencias: ${res.body}`).toBeLessThan(300);
    const contratoId = res.json().id;

    const liqs = await prisma.liquidacion.findMany({
      where: { contratoId },
      select: { periodo: true, montoAlquiler: true },
    });
    expect(liqs.length).toBeGreaterThan(6);
    for (const l of liqs) {
      expect(Number(l.montoAlquiler), `canon de ${l.periodo}`).toBe(MONTO_HOY);
    }
    expect(await prisma.ajusteAlquiler.count({ where: { contratoId } })).toBe(0);
  });
});

describe('F1 — un historial que contradice al contrato se rechaza con 400', () => {
  // Todas estas altas tienen que morir ANTES de escribir nada: la propiedad sigue
  // libre al final (si el rechazo llegara después del claim, quedaría ocupada).
  let propiedadId: string;
  beforeAll(async () => {
    propiedadId = await crearPropiedadLibre('F1-400');
  });

  async function altaCon(vigenciasCanon: Array<{ desde: string; monto: number }>) {
    return app.inject({
      method: 'POST',
      url: '/contratos',
      headers: auth(),
      payload: { ...payloadBase(propiedadId, 'Vigencias inválidas'), vigenciasCanon },
    });
  }

  it('desordenadas', async () => {
    const c = contratoEnCurso();
    const res = await altaCon([
      { desde: c.periodos[5]!, monto: CANON_VIEJO },
      { desde: c.periodos[0]!, monto: MONTO_HOY },
    ]);
    expect(res.statusCode, res.body).toBe(400);
    expect(res.json().message).toMatch(/de la más vieja a la más nueva/i);
  });

  it("con 'desde' repetido", async () => {
    const c = contratoEnCurso();
    const res = await altaCon([
      { desde: c.periodos[0]!, monto: CANON_VIEJO },
      { desde: c.periodos[0]!, monto: MONTO_HOY },
    ]);
    expect(res.statusCode, res.body).toBe(400);
    expect(res.json().message).toMatch(/repetida/i);
  });

  it('anterior a fechaInicio', async () => {
    const c = contratoEnCurso();
    const inicio = new Date(`${c.periodos[0]!}-01T00:00:00.000Z`);
    const antes = new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth() - 1, 1))
      .toISOString()
      .slice(0, 7);
    const res = await altaCon([
      { desde: antes, monto: CANON_VIEJO },
      { desde: c.periodos[5]!, monto: MONTO_HOY },
    ]);
    expect(res.statusCode, res.body).toBe(400);
    expect(res.json().message).toMatch(/anterior al inicio del contrato/i);
  });

  it('posterior al mes en curso (eso es un ajuste futuro, no historial)', async () => {
    const c = contratoEnCurso();
    // El último período enumerado es el MES QUE VIENE: ya no es historia.
    const futuro = c.periodos[c.periodos.length - 1]!;
    const res = await altaCon([
      { desde: c.periodos[0]!, monto: CANON_VIEJO },
      { desde: futuro, monto: MONTO_HOY },
    ]);
    expect(res.statusCode, res.body).toBe(400);
    expect(res.json().message).toMatch(/posterior al mes en curso/i);
  });

  it('cuya última vigencia no coincide con el monto del contrato', async () => {
    const c = contratoEnCurso();
    const res = await altaCon([
      { desde: c.periodos[0]!, monto: CANON_VIEJO },
      { desde: c.periodos[5]!, monto: MONTO_HOY - 50_000 },
    ]);
    expect(res.statusCode, res.body).toBe(400);
    expect(res.json().message).toMatch(/tienen que coincidir/i);
  });

  it('ninguno de los rechazos dejó basura: la propiedad sigue libre y sin contrato', async () => {
    const prop = await prisma.propiedad.findUniqueOrThrow({ where: { id: propiedadId } });
    expect(prop.contratoActualId).toBeNull();
    expect(await prisma.contrato.count({ where: { propiedadId } })).toBe(0);
    expect(await prisma.ajusteAlquiler.count({ where: { contrato: { propiedadId } } })).toBe(0);
  });
});

describe('la deuda declarada es COBRABLE', () => {
  it('un período en ADEUDA queda VENCIDO y sin ningún pago', async () => {
    const propiedadId = await crearPropiedadLibre('ADEUDA');
    const c = contratoEnCurso();
    // Los 3 meses más viejos se adeudan; el resto se declara pagado fuera del sistema.
    const adeudados = c.vencidos.slice(0, 3);
    const res = await app.inject({
      method: 'POST',
      url: '/contratos',
      headers: auth(),
      payload: {
        ...payloadBase(propiedadId, 'Con deuda vieja'),
        periodosAnteriores: c.vencidos.map((periodo) => ({
          periodo,
          estado: adeudados.includes(periodo) ? ('ADEUDA' as const) : ('PAGADO' as const),
        })),
      },
    });
    expect(res.statusCode, `alta con deuda: ${res.body}`).toBeLessThan(300);
    const contratoId = res.json().id;

    const liqs = await prisma.liquidacion.findMany({
      where: { contratoId, periodo: { in: adeudados } },
      select: { id: true, periodo: true, estado: true, montoTotal: true },
    });
    expect(liqs).toHaveLength(adeudados.length);
    for (const l of liqs) {
      expect(l.estado, `estado de ${l.periodo}`).toBe('VENCIDO');
      // Sin pago sintético: la plata NO entró, es deuda exigible de verdad.
      expect(await prisma.pago.count({ where: { liquidacionId: l.id } }), `pagos de ${l.periodo}`).toBe(0);
    }
    // Y los declarados pagados sí cerraron (el contraste que hace útil lo de arriba).
    const pagadas = await prisma.liquidacion.count({ where: { contratoId, estado: 'PAGADO' } });
    expect(pagadas).toBe(c.vencidos.length - adeudados.length);
  });
});

describe('F3 — interruptor de mora de los meses viejos', () => {
  const MORA_DECLARADA = 5_000;

  async function altaConMora(nombre: string, moraHistoricaCongelada: boolean | undefined) {
    const propiedadId = await crearPropiedadLibre(nombre);
    const c = contratoEnCurso();
    const adeudado = c.vencidos[0]!;
    const res = await app.inject({
      method: 'POST',
      url: '/contratos',
      headers: auth(),
      payload: {
        ...payloadBase(propiedadId, nombre),
        moraTipo: 'PORCENTAJE_DIARIO',
        moraValor: 0.5,
        ...(moraHistoricaCongelada != null ? { moraHistoricaCongelada } : {}),
        periodosAnteriores: [{ periodo: adeudado, estado: 'ADEUDA' as const, moraManual: MORA_DECLARADA }],
      },
    });
    expect(res.statusCode, `alta ${nombre}: ${res.body}`).toBeLessThan(300);
    return { contratoId: res.json().id as string, periodo: adeudado };
  }

  it('por default ("sigue corriendo") no congela nada: montoPunitorioManual queda null', async () => {
    const { contratoId, periodo } = await altaConMora('F3-corre', undefined);
    const contrato = await prisma.contrato.findUniqueOrThrow({ where: { id: contratoId } });
    expect(contrato.moraHistoricaCongelada).toBe(false);

    const liq = await prisma.liquidacion.findFirstOrThrow({ where: { contratoId, periodo } });
    expect(liq.montoPunitorioManual).toBeNull();

    // Y con el manual en null la mora la calcula el esquema: crece con los días.
    const esquema = { tipo: 'PORCENTAJE_DIARIO' as const, valor: 0.5 };
    const base = Number(liq.montoTotal);
    const hoy = new Date();
    const enDiezDias = new Date(hoy.getTime() + 10 * 24 * 60 * 60 * 1000);
    const moraHoy = calcularMora(base, esquema, liq.fechaVencimiento, hoy, liq.montoPunitorioManual);
    const moraDespues = calcularMora(base, esquema, liq.fechaVencimiento, enDiezDias, liq.montoPunitorioManual);
    expect(moraHoy).toBeGreaterThan(0);
    expect(moraDespues).toBeGreaterThan(moraHoy);
    // 10 días más al 0,5% diario = 5% del total (la mora es lineal).
    expect(moraDespues - moraHoy).toBeCloseTo(base * 0.05, 2);
  });

  it('con el interruptor en "congelada" sí se guarda el monto declarado y deja de crecer', async () => {
    const { contratoId, periodo } = await altaConMora('F3-congela', true);
    const contrato = await prisma.contrato.findUniqueOrThrow({ where: { id: contratoId } });
    expect(contrato.moraHistoricaCongelada).toBe(true);

    const liq = await prisma.liquidacion.findFirstOrThrow({ where: { contratoId, periodo } });
    expect(Number(liq.montoPunitorioManual)).toBe(MORA_DECLARADA);

    const esquema = { tipo: 'PORCENTAJE_DIARIO' as const, valor: 0.5 };
    const base = Number(liq.montoTotal);
    const enUnAnio = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    expect(calcularMora(base, esquema, liq.fechaVencimiento, enUnAnio, liq.montoPunitorioManual)).toBe(
      MORA_DECLARADA,
    );
  });
});
