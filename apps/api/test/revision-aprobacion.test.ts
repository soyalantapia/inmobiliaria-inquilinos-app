import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';

/**
 * El preview de "qué va a pasar al aprobar" no puede mentir: se compara contra
 * lo que efectivamente queda después de aprobar. Si divergen, la pantalla de
 * control estaría anunciando una cosa y el sistema haciendo otra — y lo que se
 * anuncia es plata que el sistema da por cobrada.
 */

let app: FastifyInstance;
let tokenCarga: string;
let tokenAdmin: string;

beforeAll(async () => {
  const prisma = new PrismaClient();
  await seedBase(prisma);
  await prisma.$disconnect();
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  const loginCarga = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { email: 'camila@delsol.com', password: 'delsol123' },
  });
  tokenCarga = loginCarga.json().token;
  const loginAdmin = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: { email: 'roberto@delsol.com', password: 'delsol123' },
  });
  tokenAdmin = loginAdmin.json().token;
});

afterAll(async () => {
  await app.close();
});

// El seed (prisma/seed.ts) no deja NINGUNA propiedad en estado DISPONIBLE (prp_001
// a prp_005 están ALQUILADA, prp_006 está EN_EDICION) y GET /propiedades no filtra
// por query string (ignora ?estado=...) — devuelve todo el listado del tenant. Por
// eso, en vez de depender del seed, creamos una propiedad libre por test.
let contador = 0;
async function propiedadDisponible(): Promise<string> {
  contador += 1;
  const res = await app.inject({
    method: 'POST',
    url: '/propiedades',
    headers: { authorization: `Bearer ${tokenAdmin}` },
    payload: {
      direccion: `Test revision-aprobacion ${contador}`,
      ciudad: 'CABA',
      provincia: 'Buenos Aires',
      tipo: 'DEPARTAMENTO',
      propietarios: [{ propietarioId: 'own_001', porcentaje: 100 }],
    },
  });
  expect(res.statusCode, `crear propiedad ${contador}: ${res.body}`).toBeLessThan(300);
  return res.json().id;
}

describe('revisionAprobacion — preview de qué pasa al aprobar', () => {
  it('el preview coincide con lo que realmente se aplica al aprobar', async () => {
    const hoy = new Date();
    const inicio = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - 4, 1));
    const fin = new Date(Date.UTC(hoy.getUTCFullYear() + 1, hoy.getUTCMonth(), 1));
    const per = (n: number) => {
      const d = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - n, 1));
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    };

    // Lo carga CARGA => queda BORRADOR + pendienteAprobacion
    const alta = await app.inject({
      method: 'POST',
      url: '/contratos',
      headers: { authorization: `Bearer ${tokenCarga}` },
      payload: {
        propiedadId: await propiedadDisponible(),
        inquilino: { nombre: 'Revision', apellido: 'Preview' },
        monto: 100000,
        montoExpensas: 20000,
        tipoContrato: 'ALQUILER_Y_EXPENSAS',
        fechaInicio: inicio.toISOString(),
        fechaFin: fin.toISOString(),
        diaPago: 10,
        indiceAjuste: 'ICL',
        frecuenciaAjusteMeses: 12,
        periodosAnteriores: [
          // moraManual en LOS TRES estados: PAGADO es el caso Critical — según
          // aplicarEstadoInicial (estado-inicial-contrato.ts) la rama PAGADO NUNCA
          // toca montoPunitorioManual (la mora queda congelada en 0), así que este
          // 9999 NO se tiene que ver reflejado en ningún lado del preview ni de lo
          // persistido. PARCIAL y ADEUDA sí la aplican.
          { periodo: per(4), estado: 'PAGADO', moraManual: 9999 },
          { periodo: per(3), estado: 'PARCIAL', montoPagado: 50000, moraManual: 1500 },
          { periodo: per(2), estado: 'ADEUDA', moraManual: 2000 },
        ],
      },
    });
    // POST /contratos no setea 201 explícito (default de Fastify = 200), igual que
    // el resto de la suite (alta-contrato-integracion.test.ts usa toBeLessThan(300)).
    expect(alta.statusCode, alta.body).toBeLessThan(300);
    const contratoId = alta.json().id as string;

    // 1) El ADMIN lee el preview
    const det = await app.inject({
      method: 'GET',
      url: `/contratos/${contratoId}`,
      headers: { authorization: `Bearer ${tokenAdmin}` },
    });
    expect(det.statusCode).toBe(200);
    const rev = det.json().revisionAprobacion;
    expect(rev).toBeTruthy();
    expect(rev.aprobacionId).toEqual(expect.any(String));
    expect(rev.periodosDeclarados).toHaveLength(3);

    // 2) Se aprueba
    const ap = await app.inject({
      method: 'POST',
      url: `/aprobaciones/${rev.aprobacionId}/aprobar`,
      headers: { authorization: `Bearer ${tokenAdmin}` },
      payload: { comentario: 'Revisado, va' },
    });
    expect(ap.statusCode, ap.body).toBe(200);

    // 3) Lo anunciado tiene que coincidir con lo aplicado — contra el estado
    // REALMENTE persistido, no contra una constante calculada a mano: si algún día
    // cambia el monto/expensas del contrato de prueba, el test sigue siendo válido.
    const prisma = new PrismaClient();
    const liqs = await prisma.liquidacion.findMany({ where: { contratoId } });
    const pagos = await prisma.pago.findMany({ where: { contratoId } });
    await prisma.$disconnect();

    expect(liqs).toHaveLength(rev.alAprobar.cuotasAGenerar);

    const liqPorPeriodo = new Map(liqs.map((l) => [l.periodo, l]));
    const pagadoPorPeriodo = new Map<string, number>();
    for (const p of pagos) {
      pagadoPorPeriodo.set(p.periodo, (pagadoPorPeriodo.get(p.periodo) ?? 0) + Number(p.monto));
    }

    const conciliadoReal = pagos.reduce((s, p) => s + Number(p.monto), 0);
    expect(conciliadoReal).toBeCloseTo(rev.alAprobar.conciliado.monto, 2);

    // conciliado = PAGADO (per(4)) + lo pagado del PARCIAL (per(3)): 2 períodos.
    // deudaInicial = el remanente del PARCIAL (per(3)) + el ADEUDA (per(2)): 2
    // períodos — el PARCIAL cuenta en LOS DOS lados (invariante documentado en
    // resumenRevisionAprobacion).
    expect(rev.alAprobar.conciliado.periodos).toBe(2);
    expect(rev.alAprobar.deudaInicial.periodos).toBe(2);

    // Capital de deudaInicial contra las liquidaciones que quedaron REALMENTE sin
    // cubrir en la DB (montoTotal real - lo realmente pagado), no un número tipeado.
    const liqParcial = liqPorPeriodo.get(per(3));
    const liqAdeuda = liqPorPeriodo.get(per(2));
    if (!liqParcial || !liqAdeuda) throw new Error('faltan liquidaciones esperadas en la DB');
    const remanenteParcialReal =
      Number(liqParcial.montoTotal) - (pagadoPorPeriodo.get(per(3)) ?? 0);
    const capitalEsperado = remanenteParcialReal + Number(liqAdeuda.montoTotal);
    expect(rev.alAprobar.deudaInicial.capital).toBeCloseTo(capitalEsperado, 2);

    // Mora: PAGADO (per(4)) tiene que quedar en 0 (aplicarEstadoInicial no la
    // aplica ahí) — este es el caso Critical. PARCIAL y ADEUDA sí la aplican, y el
    // preview tiene que anunciar SOLO esas dos, nunca la del período PAGADO.
    const liqPagado = liqPorPeriodo.get(per(4));
    if (!liqPagado) throw new Error('falta la liquidación PAGADO esperada en la DB');
    expect(Number(liqPagado.montoPunitorioManual ?? 0)).toBe(0);
    expect(Number(liqParcial.montoPunitorioManual)).toBe(1500);
    expect(Number(liqAdeuda.montoPunitorioManual)).toBe(2000);
    expect(rev.alAprobar.deudaInicial.mora).toBeCloseTo(1500 + 2000, 2);
  });

  it('un contrato ya activo no trae revisionAprobacion', async () => {
    const hoy = new Date();
    const alta = await app.inject({
      method: 'POST',
      url: '/contratos',
      headers: { authorization: `Bearer ${tokenAdmin}` }, // ADMIN activa directo
      payload: {
        propiedadId: await propiedadDisponible(),
        inquilino: { nombre: 'Sin', apellido: 'Revision' },
        monto: 100000,
        fechaInicio: new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), 1)).toISOString(),
        fechaFin: new Date(Date.UTC(hoy.getUTCFullYear() + 1, hoy.getUTCMonth(), 1)).toISOString(),
        diaPago: 10,
        indiceAjuste: 'ICL',
        frecuenciaAjusteMeses: 12,
      },
    });
    expect(alta.statusCode, alta.body).toBeLessThan(300);
    const det = await app.inject({
      method: 'GET',
      url: `/contratos/${alta.json().id}`,
      headers: { authorization: `Bearer ${tokenAdmin}` },
    });
    expect(det.json().revisionAprobacion).toBeUndefined();
  });

  it('periodosAnterioresPendientes corrupto en la DB no rompe el preview (200, no 500)', async () => {
    // POST /contratos valida periodosAnteriores con el mismo Zod que
    // PeriodosAnterioresSchema, así que no hay forma de mandar un Json corrupto vía
    // la API. Simulamos una fila legacy / corrupción de datos escribiendo directo
    // en la columna, como haría una migración vieja o una edición manual en la DB.
    const hoy = new Date();
    const alta = await app.inject({
      method: 'POST',
      url: '/contratos',
      headers: { authorization: `Bearer ${tokenCarga}` },
      payload: {
        propiedadId: await propiedadDisponible(),
        inquilino: { nombre: 'Json', apellido: 'Corrupto' },
        monto: 100000,
        fechaInicio: new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - 1, 1)).toISOString(),
        fechaFin: new Date(Date.UTC(hoy.getUTCFullYear() + 1, hoy.getUTCMonth(), 1)).toISOString(),
        diaPago: 10,
        indiceAjuste: 'ICL',
        frecuenciaAjusteMeses: 12,
        // Sin periodosAnteriores: lo corrompemos después, directo en la DB.
      },
    });
    expect(alta.statusCode, alta.body).toBeLessThan(300);
    const contratoId = alta.json().id as string;

    const prisma = new PrismaClient();
    await prisma.contrato.update({
      where: { id: contratoId },
      // No es un array (PeriodosAnterioresSchema espera z.array(...)) → falla el
      // safeParse, exactamente el caso "columna con contenido que no pasa el schema".
      data: { periodosAnterioresPendientes: { esto: 'no es un array' } },
    });
    await prisma.$disconnect();

    const det = await app.inject({
      method: 'GET',
      url: `/contratos/${contratoId}`,
      headers: { authorization: `Bearer ${tokenAdmin}` },
    });
    expect(det.statusCode).toBe(200);
    const rev = det.json().revisionAprobacion;
    expect(rev).toBeTruthy();
    // Degrada a "no hay períodos declarados" en vez de tirar 500 — el resto del
    // preview (cuotas a generar) no depende de este Json y sigue andando.
    expect(rev.periodosDeclarados).toEqual([]);
    expect(rev.alAprobar.deudaInicial).toEqual({ periodos: 0, capital: 0, mora: 0 });
    expect(rev.alAprobar.cuotasAGenerar).toBeGreaterThan(0);
  });

  it('un período ADEUDA sin moraManual anuncia la mora real del esquema, no $0', async () => {
    // Reproduce el bug i-mora-preview: no declarar moraManual NO significa "sin
    // mora" — significa "mora automática del esquema del contrato", que
    // aplicarEstadoInicial deja devengando on-read (calcularMora). El preview
    // tiene que anunciar esa misma mora, no $0.
    const hoy = new Date();
    const inicio = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - 4, 1));
    const fin = new Date(Date.UTC(hoy.getUTCFullYear() + 1, hoy.getUTCMonth(), 1));
    const per = (n: number) => {
      const d = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - n, 1));
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    };

    const alta = await app.inject({
      method: 'POST',
      url: '/contratos',
      headers: { authorization: `Bearer ${tokenCarga}` },
      payload: {
        propiedadId: await propiedadDisponible(),
        inquilino: { nombre: 'SinMoraManual', apellido: 'Preview' },
        monto: 100000,
        tipoContrato: 'ALQUILER',
        fechaInicio: inicio.toISOString(),
        fechaFin: fin.toISOString(),
        diaPago: 10,
        indiceAjuste: 'ICL',
        frecuenciaAjusteMeses: 12,
        moraTipo: 'PORCENTAJE_DIARIO',
        moraValor: 0.5,
        periodosAnteriores: [
          // SIN moraManual — el caso que la UI produce cuando la operadora vacía
          // el campo "Mora acumulada" (contratos/nuevo/page.tsx: moraManual se
          // omite del payload si el input queda vacío).
          { periodo: per(3), estado: 'ADEUDA' },
          { periodo: per(2), estado: 'ADEUDA' },
        ],
      },
    });
    expect(alta.statusCode, alta.body).toBeLessThan(300);
    const contratoId = alta.json().id as string;

    const detAntes = await app.inject({
      method: 'GET',
      url: `/contratos/${contratoId}`,
      headers: { authorization: `Bearer ${tokenAdmin}` },
    });
    expect(detAntes.statusCode).toBe(200);
    const rev = detAntes.json().revisionAprobacion;
    expect(rev).toBeTruthy();
    const moraAnunciada = rev.alAprobar.deudaInicial.mora;

    const ap = await app.inject({
      method: 'POST',
      url: `/aprobaciones/${rev.aprobacionId}/aprobar`,
      headers: { authorization: `Bearer ${tokenAdmin}` },
      payload: { comentario: 'Revisado, va' },
    });
    expect(ap.statusCode, ap.body).toBe(200);

    // Mora REAL: la que GET /contratos/:id calcula on-read (calcularMora) para
    // esas mismas liquidaciones, ya aprobadas — la fuente de verdad de lo que el
    // sistema va a cobrar, no un número tipeado a mano.
    const detDespues = await app.inject({
      method: 'GET',
      url: `/contratos/${contratoId}`,
      headers: { authorization: `Bearer ${tokenAdmin}` },
    });
    expect(detDespues.statusCode).toBe(200);
    const liquidaciones = detDespues.json().liquidaciones as Array<{
      periodo: string;
      montoPunitorio: number;
    }>;
    const moraReal = liquidaciones
      .filter((l) => l.periodo === per(3) || l.periodo === per(2))
      .reduce((s, l) => s + l.montoPunitorio, 0);

    // Sanity: si esto da 0, el test no prueba nada (los períodos no estarían
    // devengando mora real y el assert de abajo pasaría por las razones
    // equivocadas).
    expect(moraReal).toBeGreaterThan(0);
    expect(moraAnunciada).toBeCloseTo(moraReal, 2);
  });
});
