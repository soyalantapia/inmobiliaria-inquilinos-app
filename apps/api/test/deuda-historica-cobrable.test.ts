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

const PREFIJO_DIRECCION = 'Deuda histórica ';

/**
 * La DB de test es UNA SOLA para los 63 archivos (`fileParallelism: false`) y NO se
 * resetea entre corridas. Esta suite da de alta propiedades y contratos POR ENDPOINT,
 * todos colgados de `own_001`: sin limpiar, el propietario que el seed deja con UNA
 * participación termina con diez, y `core.test.ts` —que corre antes por orden
 * alfabético, pero después de la corrida ANTERIOR— afirma sobre esa lista. Es la forma
 * exacta de rojo que parece una regresión de /propietarios y no lo es.
 *
 * Corre en `beforeAll` Y en `afterAll`: al principio para no arrastrar lo que dejó una
 * corrida interrumpida (y para que el POST /propiedades no choque contra la dirección
 * repetida), al final para no dejarle nada a nadie.
 */
async function limpiar() {
  const props = await prisma.propiedad.findMany({
    where: { direccion: { startsWith: PREFIJO_DIRECCION } },
    select: { id: true },
  });
  const propIds = props.map((p) => p.id);
  if (propIds.length === 0) return;
  const contratos = await prisma.contrato.findMany({
    where: { propiedadId: { in: propIds } },
    select: { id: true },
  });
  const contratoIds = contratos.map((c) => c.id);
  // Las Personas se crean al vuelo en el alta (una por inquilino) y sobreviven al
  // contrato: hay que juntarlas ANTES de borrar los inquilinos que las apuntan.
  const inquilinos = await prisma.inquilino.findMany({
    where: { contratoId: { in: contratoIds } },
    select: { personaId: true },
  });
  const personaIds = inquilinos.map((i) => i.personaId).filter((id): id is string => id != null);
  // Orden por FK: pagos → liquidaciones → ajustes → inquilinos → contratos → propiedades.
  await prisma.pago.deleteMany({ where: { contratoId: { in: contratoIds } } });
  await prisma.liquidacion.deleteMany({ where: { contratoId: { in: contratoIds } } });
  await prisma.ajusteAlquiler.deleteMany({ where: { contratoId: { in: contratoIds } } });
  await prisma.inquilino.deleteMany({ where: { contratoId: { in: contratoIds } } });
  await prisma.propiedad.updateMany({ where: { id: { in: propIds } }, data: { contratoActualId: null } });
  await prisma.contrato.deleteMany({ where: { id: { in: contratoIds } } });
  await prisma.participacionPropietario.deleteMany({ where: { propiedadId: { in: propIds } } });
  await prisma.propiedad.deleteMany({ where: { id: { in: propIds } } });
  if (personaIds.length > 0) await prisma.persona.deleteMany({ where: { id: { in: personaIds } } });
}

beforeAll(async () => {
  prisma = new PrismaClient();
  await seedBase(prisma);
  await limpiar();
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  const login = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { email: 'roberto@delsol.com', password: 'delsol123' },
  });
  token = login.json().token;
});

afterAll(async () => {
  await limpiar();
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
      direccion: `${PREFIJO_DIRECCION}${nombre}`,
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

  it('con TRES vigencias cada tramo va a SU canon (dos o más siguen funcionando)', async () => {
    // El guard nuevo rechaza el historial de UNA sola vigencia. Este test fija que la
    // regla se detiene ahí: con más de dos la cadena de `montoAnterior` sigue armando
    // un tramo por cambio, que es el mecanismo que el guard protege.
    const CANON_MEDIO = 200_000;
    const propiedadId = await crearPropiedadLibre('F1-tres');
    const c = contratoEnCurso();
    const corte1 = c.periodos[3]!;
    const corte2 = c.periodos[6]!;
    const res = await app.inject({
      method: 'POST',
      url: '/contratos',
      headers: auth(),
      payload: {
        ...payloadBase(propiedadId, 'Tres vigencias'),
        vigenciasCanon: [
          { desde: c.periodos[0]!, monto: CANON_VIEJO },
          { desde: corte1, monto: CANON_MEDIO },
          { desde: corte2, monto: MONTO_HOY },
        ],
      },
    });
    expect(res.statusCode, `alta con tres vigencias: ${res.body}`).toBeLessThan(300);
    const contratoId = res.json().id;

    const liqs = await prisma.liquidacion.findMany({
      where: { contratoId },
      select: { periodo: true, montoAlquiler: true },
      orderBy: { periodo: 'asc' },
    });
    const distintos = new Set(liqs.map((l) => Number(l.montoAlquiler)));
    expect([...distintos].sort((a, b) => a - b)).toEqual([CANON_VIEJO, CANON_MEDIO, MONTO_HOY]);
    for (const l of liqs) {
      const esperado =
        l.periodo < corte1 ? CANON_VIEJO : l.periodo < corte2 ? CANON_MEDIO : MONTO_HOY;
      expect(Number(l.montoAlquiler), `canon de ${l.periodo}`).toBe(esperado);
    }
    // Dos CAMBIOS de canon = dos filas de ajuste (la más vieja es el punto de partida).
    const ajustes = await prisma.ajusteAlquiler.findMany({
      where: { contratoId },
      orderBy: { periodoDesde: 'asc' },
    });
    expect(ajustes).toHaveLength(2);
    expect(ajustes.map((a) => a.periodoDesde)).toEqual([corte1, corte2]);
    expect(ajustes.map((a) => Number(a.montoAnterior))).toEqual([CANON_VIEJO, CANON_MEDIO]);
    expect(ajustes.map((a) => Number(a.montoNuevo))).toEqual([CANON_MEDIO, MONTO_HOY]);
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

  /**
   * El P0 que no se veía. Una sola vigencia pasa TODAS las demás reglas (arranca en el
   * inicio del contrato, no es futura, su monto coincide con el del contrato) y sin
   * embargo `ajustesDeVigenciasCanon` —que arranca en `i = 1`— devuelve `[]`: no queda
   * ninguna fila de ajuste, `canonDelPeriodo` no tiene con qué retroceder y los nueve
   * meses viejos se devengan al monto de HOY. Es decir: el operador declara el historial,
   * recibe un 201, y la deuda queda igual de inflada que antes de que existiera el
   * historial. Un 200 mentiroso es peor que un 400.
   */
  it('de UNA SOLA vigencia (sería un 201 que no cambia nada y devenga todo a hoy)', async () => {
    const c = contratoEnCurso();
    const res = await altaCon([{ desde: c.periodos[0]!, monto: MONTO_HOY }]);
    expect(res.statusCode, res.body).toBe(400);
    expect(res.json().message).toMatch(/una sola vigencia/i);
  });

  it('vacío (el historial declarado sin ninguna vigencia)', async () => {
    const res = await altaCon([]);
    expect(res.statusCode, res.body).toBe(400);
    expect(res.json().message).toMatch(/no mandaste ninguna vigencia/i);
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

/**
 * F3 bis — "este mes no debe mora".
 *
 * El wizard PREFILA la mora sugerida en cada mes vencido. El operador que borra ese
 * número está diciendo algo concreto: *este mes no debe punitorio*. El front omitía el
 * campo cuando quedaba vacío, así que `montoPunitorioManual` quedaba en null y
 * `calcularMora` volvía al esquema: el mes que se declaró SIN mora seguía devengándola
 * desde su vencimiento original, y encima creciendo. Un 0 declarado tiene que valer 0.
 *
 * El contraste va DENTRO de la misma alta y con el mismo interruptor en CONGELADA: la
 * única diferencia entre los dos períodos es que uno manda `moraManual: 0` y el otro no
 * manda el campo. Así el test aísla exactamente lo que se arregló ("0" vs "no dije
 * nada") y no el interruptor, que ya lo cubre el describe de arriba.
 */
describe('F3 bis — un 0 declarado es un 0, no un "no dije nada"', () => {
  const ESQUEMA = { tipo: 'PORCENTAJE_DIARIO' as const, valor: 0.5 };
  let alta: { statusCode: number; body: string };
  // Inicializado en '' a propósito: si el alta fallara, los `where` de abajo no
  // matchean nada y los `findFirstOrThrow` explotan, en vez de traer la liquidación
  // de cualquier otro contrato (`contratoId: undefined` en Prisma es "sin filtro").
  let contratoId = '';
  let conCero = '';
  let sinDecir = '';

  beforeAll(async () => {
    const propiedadId = await crearPropiedadLibre('F3-cero');
    const c = contratoEnCurso();
    conCero = c.vencidos[0]!;
    sinDecir = c.vencidos[1]!;
    alta = await app.inject({
      method: 'POST',
      url: '/contratos',
      headers: auth(),
      payload: {
        ...payloadBase(propiedadId, 'Mora cero'),
        moraTipo: 'PORCENTAJE_DIARIO',
        moraValor: 0.5,
        moraHistoricaCongelada: true,
        periodosAnteriores: [
          { periodo: conCero, estado: 'ADEUDA' as const, moraManual: 0 },
          { periodo: sinDecir, estado: 'ADEUDA' as const },
        ],
      },
    });
    if (alta.statusCode < 300) contratoId = alta.json().id;
  });

  it('el endpoint ACEPTA moraManual: 0 (el zod es nonnegative(), no positive())', () => {
    // Si el esquema fuera `positive()`, el 0 que manda el front rebotaría con el 400
    // genérico "Datos del contrato incompletos" y el alta ENTERA se caería. Se afirma
    // corriendo, no leyendo core.ts.
    expect(alta.statusCode, `alta con moraManual 0: ${alta.body}`).toBeLessThan(300);
    expect(contratoId).not.toBe('');
  });

  it('el 0 QUEDA GUARDADO: montoPunitorioManual es 0 y NO null', async () => {
    const liq = await prisma.liquidacion.findFirstOrThrow({ where: { contratoId, periodo: conCero } });
    // El orden de estos dos asertos importa: `Number(null)` también da 0, así que
    // afirmar sólo el número quedaba VERDE con el campo en null — que es el bug entero.
    expect(liq.montoPunitorioManual).not.toBeNull();
    expect(Number(liq.montoPunitorioManual)).toBe(0);
  });

  it('con el 0 guardado el punitorio no corre: sigue en 0 dentro de un año', async () => {
    const liq = await prisma.liquidacion.findFirstOrThrow({ where: { contratoId, periodo: conCero } });
    // Mismo destilado que hace el server al leer (core.ts): Decimal → number, null → null.
    const manual = liq.montoPunitorioManual != null ? Number(liq.montoPunitorioManual) : null;
    const base = Number(liq.montoTotal);
    // Sin esto, un montoTotal 0 haría dar 0 a `calcularMora` por otro motivo y el test
    // pasaría sin probar nada.
    expect(base).toBeGreaterThan(0);
    const enUnAnio = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    expect(calcularMora(base, ESQUEMA, liq.fechaVencimiento, enUnAnio, manual)).toBe(0);
  });

  it('el período que NO declaró mora (misma alta, mismo interruptor) sí sigue corriendo', async () => {
    const liq = await prisma.liquidacion.findFirstOrThrow({ where: { contratoId, periodo: sinDecir } });
    expect(liq.montoPunitorioManual).toBeNull();
    const base = Number(liq.montoTotal);
    const hoy = new Date();
    const enDiezDias = new Date(hoy.getTime() + 10 * 24 * 60 * 60 * 1000);
    const moraHoy = calcularMora(base, ESQUEMA, liq.fechaVencimiento, hoy, null);
    const moraDespues = calcularMora(base, ESQUEMA, liq.fechaVencimiento, enDiezDias, null);
    expect(moraHoy).toBeGreaterThan(0);
    // 10 días más al 0,5% diario = 5% del total. Es el número que el mes con el 0
    // declarado NO tiene que devengar.
    expect(moraDespues - moraHoy).toBeCloseTo(base * 0.05, 2);
  });
});
