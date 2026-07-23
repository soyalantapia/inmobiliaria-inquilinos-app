import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { buildApp } from '../src/app.js';
import { seedBase } from '../prisma/seed.js';

let app: FastifyInstance;
let tokenAdmin: string;
let tokenCarga: string;
// Cliente para setup directo de escenarios (insertar un INFORMADO "colgado", etc.).
const prismaTest = new PrismaClient();

/** Contratos del seed cuyas aserciones dependen de tener SOLO las liquidaciones sembradas. */
const CONTRATOS_SEED = ['cnt_001', 'cnt_002', 'cnt_003', 'cnt_004', 'cnt_005', 'cnt_006'];

/**
 * Borra las liquidaciones que NO son del seed (id cuid, no `liq_*`) de los contratos
 * sembrados.
 *
 * POR QUÉ: el devengo —el cron in-process, `POST /liquidaciones/devengar` y las suites de
 * ajuste/renovación— genera TODOS los períodos desde `fechaInicio` de cada contrato. Para
 * un contrato real eso está bien, pero los contratos del seed arrancan en 2025 y esta suite
 * asume que sólo existen las `liq_*` sembradas. Sin esta limpieza se acumulaban decenas de
 * liquidaciones VENCIDO por corrida y las aserciones se caían de a una: cnt_002 pasaba a
 * VENCIDO, la liq vencida más vieja de Mariela dejaba de ser `liq_001`, y la rendición
 * cambiaba de propiedades-con-ingreso (totalGastos 0). Era estado sucio, no bugs de código:
 * los mismos 3 tests fallaban con el árbol limpio.
 *
 * Ojo con el orden: `Pago` y `AlquilerRendido` apuntan a `Liquidacion` con FK RESTRICT.
 */
async function limpiarLiquidacionesNoSeed(prisma: PrismaClient) {
  const extras = await prisma.liquidacion.findMany({
    where: { contratoId: { in: CONTRATOS_SEED }, NOT: { id: { startsWith: 'liq_' } } },
    select: { id: true },
  });
  if (extras.length === 0) return;
  const ids = extras.map((l) => l.id);
  await prisma.alquilerRendido.deleteMany({ where: { liquidacionId: { in: ids } } });
  await prisma.pago.deleteMany({ where: { liquidacionId: { in: ids } } });
  await prisma.liquidacion.deleteMany({ where: { id: { in: ids } } });
}

/** Devuelve el estado seed mutado por corridas anteriores a su origen. */
async function resetPlata(prisma: PrismaClient) {
  await limpiarLiquidacionesNoSeed(prisma);
  // P10 (al final de este archivo) FINALIZA cnt_001 y el seed upsertea con
  // update:{} (no lo revierte): sin esta cura, la segunda corrida contra la
  // misma DB encontraba a Mariela sin contrato activo y caía en cascada.
  await prisma.contrato.update({ where: { id: 'cnt_001' }, data: { estado: 'ACTIVO' } });
  await prisma.pago.deleteMany({
    where: { id: { notIn: ['pag_001', 'pag_002', 'pag_liq002', 'pag_liq004', 'pag_liq007'] } },
  });
  await prisma.pago.update({
    where: { id: 'pag_001' },
    data: { estado: 'INFORMADO', decididoPorId: null, decididoAt: null, observacion: null },
  });
  // pag_002 (liq_001 de Mariela) queda DECIDIDO: el test "Mariela informa"
  // necesita que su liq VENCIDA no tenga un INFORMADO vivo (un solo INFORMADO
  // por liquidación). En la DB compartida esto lo tapaba el estado residual.
  await prisma.pago.update({
    where: { id: 'pag_002' },
    data: { estado: 'RECHAZADO', observacion: 'Rechazado por la suite para re-informar', decididoAt: new Date() },
  });
  // Los CONCILIADO del seed que alimentan la rendición: algún test los puede
  // anular; volverlos a CONCILIADO + sus liqs a PAGADO para la re-corrida.
  await prisma.pago.updateMany({
    where: { id: { in: ['pag_liq002', 'pag_liq004', 'pag_liq007'] } },
    data: { estado: 'CONCILIADO', observacion: null },
  });
  await prisma.liquidacion.updateMany({
    where: { id: { in: ['liq_002', 'liq_004', 'liq_007'] } },
    data: { estado: 'PAGADO' },
  });
  await prisma.liquidacion.update({
    where: { id: 'liq_005' },
    data: { estado: 'PENDIENTE', fechaPago: null, metodoPago: null },
  });
  // liq_003 la muta la suite de /pagos/manual (cobro manual → PARCIAL/PAGADO).
  await prisma.liquidacion.update({
    where: { id: 'liq_003' },
    data: { estado: 'VENCIDO', fechaPago: null, metodoPago: null },
  });
  await prisma.gastoRendido.deleteMany({ where: { rendicion: { id: { not: 'ren_001' } } } });
  // Los AlquilerRendido cuelgan de la Rendicion con FK RESTRICT: hay que
  // borrarlos ANTES que la rendición. Antes esto no hacía falta porque "rendir
  // Silvana" daba 409 (sin pagos CONCILIADO en el seed no había nada que rendir)
  // y no se creaba ninguna rendición con hijos; ahora el seed trae los cobros
  // conciliados → la rendición se crea de verdad y su borrado tropezaba con el FK.
  await prisma.alquilerRendido.deleteMany({ where: { rendicion: { id: { not: 'ren_001' } } } });
  await prisma.movimientoCaja.updateMany({
    where: { id: { in: ['mov_002', 'mov_003'] } },
    data: { descontadoEnRendicion: false, rendicionId: null },
  });
  await prisma.rendicion.deleteMany({ where: { id: { not: 'ren_001' } } });
  await prisma.aprobacion.update({
    where: { id: 'apr_seed_1' },
    data: { estado: 'PENDIENTE', aprobadoPorId: null, aprobadoAt: null, comentarioAprobador: null },
  });
  await prisma.contrato.update({
    where: { id: 'cnt_006' },
    data: { estado: 'BORRADOR', pendienteAprobacion: true, aprobadoAt: null },
  });
  // Aprobar cnt_006 ocupa su propiedad (prp_006.contratoActualId = cnt_006):
  // sin revertirlo, la 2ª corrida contra la misma DB da 409 PROP_OCUPADA al
  // re-aprobar. cnt_006 vuelve a BORRADOR arriba, así que liberar la propiedad
  // deja el par consistente.
  await prisma.propiedad.update({ where: { id: 'prp_006' }, data: { contratoActualId: null } });
}

beforeAll(async () => {
  const prisma = new PrismaClient();
  await seedBase(prisma);
  await resetPlata(prisma);
  await prisma.$disconnect();
  app = await buildApp({ NODE_ENV: 'test', DEMO_MODE: 'true' });
  const admin = await app.inject({ method: 'POST', url: '/auth/login', payload: { email: 'roberto@delsol.com', password: 'delsol123' } });
  tokenAdmin = admin.json().token;
  const carga = await app.inject({ method: 'POST', url: '/auth/login', payload: { email: 'camila@delsol.com', password: 'delsol123' } });
  tokenCarga = carga.json().token;
});

afterAll(async () => {
  await app.close();
  await prismaTest.$disconnect();
});

const auth = (t: string) => ({ authorization: `Bearer ${t}` });

describe('Contratos con estado de pago derivado', () => {
  it('cnt_001 sale VENCIDO y cnt_002 PAGADO desde liquidaciones reales', async () => {
    const res = await app.inject({ method: 'GET', url: '/contratos', headers: auth(tokenAdmin) });
    const lista = res.json();
    expect(lista.find((c: { id: string }) => c.id === 'cnt_001').estadoPagoActual).toBe('VENCIDO');
    expect(lista.find((c: { id: string }) => c.id === 'cnt_002').estadoPagoActual).toBe('PAGADO');
  });
});

describe('Validación de pagos (permisos)', () => {
  // (El PIN se eliminó de la plataforma: ya no hay test de "PIN incorrecto → 403".
  //  Las acciones sensibles siguen protegidas por rol/capacidad.)
  it('rol CARGA no puede conciliar → 403', async () => {
    const res = await app.inject({ method: 'POST', url: '/pagos/pag_001/validar', headers: auth(tokenCarga), payload: { pin: '1234' } });
    expect(res.statusCode).toBe(403);
  });

  it('rechazar sin observación → 400', async () => {
    const res = await app.inject({ method: 'POST', url: '/pagos/pag_001/rechazar', headers: auth(tokenAdmin), payload: { pin: '1234' } });
    expect(res.statusCode).toBe(400);
  });

  it('validar con PIN ok → pago CONCILIADO + liquidación PAGADA', async () => {
    const res = await app.inject({ method: 'POST', url: '/pagos/pag_001/validar', headers: auth(tokenAdmin), payload: { pin: '1234' } });
    expect(res.statusCode).toBe(200);
    expect(res.json().estado).toBe('CONCILIADO');
    const liqs = await app.inject({ method: 'GET', url: '/liquidaciones?periodo=2026-06', headers: auth(tokenAdmin) });
    const liq5 = liqs.json().find((l: { id: string }) => l.id === 'liq_005');
    expect(liq5.estado).toBe('PAGADO');
  });

  it('volver a validar el mismo pago → 409', async () => {
    const res = await app.inject({ method: 'POST', url: '/pagos/pag_001/validar', headers: auth(tokenAdmin), payload: { pin: '1234' } });
    expect(res.statusCode).toBe(409);
  });

  // El CRÍTICO del cobro mixto (dos co-inquilinos): validar NO debe sobre-cobrar
  // una liquidación que otro cobro ya cubrió. liq_005 quedó PAGADA por pag_001
  // arriba; inyectamos un INFORMADO "colgado" y validarlo debe dar 409.
  it('validar un INFORMADO sobre una liq ya cubierta → 409 (no sobre-cobra)', async () => {
    const colgado = await prismaTest.pago.create({
      data: {
        inmobiliariaId: (await prismaTest.liquidacion.findUniqueOrThrow({ where: { id: 'liq_005' }, select: { inmobiliariaId: true } })).inmobiliariaId,
        contratoId: 'cnt_005',
        liquidacionId: 'liq_005',
        periodo: '2026-06',
        monto: 850000,
        montoLiqTotal: 850000,
        metodo: 'TRANSFERENCIA',
        fechaTransferencia: new Date('2026-06-10'),
        estado: 'INFORMADO',
      },
    });
    const res = await app.inject({ method: 'POST', url: `/pagos/${colgado.id}/validar`, headers: auth(tokenAdmin), payload: { pin: '1234' } });
    expect(res.statusCode).toBe(409);
    expect(res.json().message).toMatch(/ya fue cubierta|supera el saldo/i);
    // El INFORMADO NO se concilió (sigue INFORMADO): no hubo over-cobro.
    const sigue = await prismaTest.pago.findUniqueOrThrow({ where: { id: colgado.id } });
    expect(sigue.estado).toBe('INFORMADO');
    await prismaTest.pago.delete({ where: { id: colgado.id } });
  });
});

describe('Inquilino informa pago', () => {
  it('Mariela informa el pago de su liquidación vencida', async () => {
    const demo = await app.inject({ method: 'POST', url: '/auth/demo' });
    const tk = demo.json().token;
    const mias = await app.inject({ method: 'GET', url: '/mis-liquidaciones', headers: auth(tk) });
    const vencida = mias.json().find((l: { estado: string }) => l.estado === 'VENCIDO');
    expect(vencida.id).toBe('liq_001');

    // Informa el SALDO EXIGIBLE completo (base + mora al día) que devuelve el API,
    // no la base pelada: cnt_001 tiene tasa legacy 0.001%/día, así que a >0 días de
    // atraso liq_001 exige base+mora y pagar solo la base sería PARCIAL. Tomar el
    // monto del propio API hace el test independiente de la fecha en que corre.
    const res = await app.inject({
      method: 'POST',
      url: '/pagos/informar',
      headers: auth(tk),
      payload: { liquidacionId: 'liq_001', monto: Number(vencida.montoTotal), metodo: 'TRANSFERENCIA', nroOperacion: 'TRF-TEST-1', fechaTransferencia: '2026-06-12', nota: 'test' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().estado).toBe('INFORMADO');
    expect(res.json().tipo).toBe('TOTAL');
  });

  // La fecha la elige el inquilino: sin cota, backdatearla esquiva la mora. Los
  // dos guards (futura / anterior al inicio del contrato) corren ANTES del
  // chequeo de "ya informaste", así que dan 400 aunque liq_001 ya tenga informe.
  it('fecha de transferencia FUTURA → 400', async () => {
    const demo = await app.inject({ method: 'POST', url: '/auth/demo' });
    const tk = demo.json().token;
    const res = await app.inject({
      method: 'POST', url: '/pagos/informar', headers: auth(tk),
      payload: { liquidacionId: 'liq_001', monto: 1000, metodo: 'TRANSFERENCIA', fechaTransferencia: '2031-01-01' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toMatch(/futura/i);
  });

  it('fecha de transferencia ANTERIOR al inicio del contrato → 400', async () => {
    const demo = await app.inject({ method: 'POST', url: '/auth/demo' });
    const tk = demo.json().token;
    const res = await app.inject({
      method: 'POST', url: '/pagos/informar', headers: auth(tk),
      payload: { liquidacionId: 'liq_001', monto: 1000, metodo: 'TRANSFERENCIA', fechaTransferencia: '2019-01-01' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toMatch(/anterior al inicio/i);
  });
});

describe('Rendición — el loop caja→rendición', () => {
  it('rendir junio a Silvana: bruto por participación, descuenta gastos y los marca', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/rendiciones',
      headers: auth(tokenAdmin),
      payload: { propietarioId: 'own_002', periodo: '2026-06', metodo: 'TRANSFERENCIA', pin: '1234' },
    });
    expect(res.statusCode).toBe(201);
    const r = res.json();
    // Bruto = porción de ALQUILER de los pagos CONCILIADO (rendición incremental):
    // liq_002 620k (prp_002 100%) + liq_004 720k (prp_004 100%). liq_007 es
    // SOLO_EXPENSAS (montoAlquiler 0) → su cobro NO entra al bruto ni comisiona
    // (regla del dueño: comisión SOLO sobre el alquiler).
    expect(Number(r.montoBruto)).toBe(1_340_000);
    expect(Number(r.comisionMonto)).toBeCloseTo(93_800, 0); // 7% del alquiler cobrado
    expect(Number(r.totalGastos)).toBe(90_500); // mov_002 62k + mov_003 28.5k
    expect(Number(r.montoNeto)).toBeCloseTo(1_155_700, 0);

    // Los gastos quedaron DESCONTADOS y linkeados (lo que el mock nunca cerraba)
    const caja = await app.inject({ method: 'GET', url: '/caja/movimientos', headers: auth(tokenAdmin) });
    const movs = caja.json();
    expect(movs.find((m: { id: string }) => m.id === 'mov_002').descontadoEnRendicion).toBe(true);
    expect(movs.find((m: { id: string }) => m.id === 'mov_003').descontadoEnRendicion).toBe(true);
  });

  it('rendir el mismo período de nuevo → 409', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/rendiciones',
      headers: auth(tokenAdmin),
      payload: { propietarioId: 'own_002', periodo: '2026-06', pin: '1234' },
    });
    expect(res.statusCode).toBe(409);
  });

  it('propietario sin CBU (Federico) → 409 con mensaje claro', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/rendiciones',
      headers: auth(tokenAdmin),
      payload: { propietarioId: 'own_003', periodo: '2026-06', pin: '1234' },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().message).toContain('CBU');
  });
});

// Corre DESPUÉS de la rendición de Silvana (own_002, 2026-06 ya rendido, con
// AlquilerRendido real). Cubre: no anular un pago rendido, anular la rendición
// (el fix del FK RESTRICT), y que tras anular la rendición el pago sí se anula.
describe('Anular rendición y pago rendido', () => {
  it('anular un pago cuya liquidación YA fue rendida → 409', async () => {
    const res = await app.inject({
      method: 'POST', url: '/pagos/pag_liq002/anular', headers: auth(tokenAdmin),
      payload: { pin: '1234', observacion: 'intento anular un pago ya rendido' },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().message).toMatch(/ya fue rendido/i);
  });

  it('anular la rendición (con AlquilerRendido) → 200 y libera los gastos', async () => {
    const rend = await prismaTest.rendicion.findFirstOrThrow({
      where: { propietarioId: 'own_002', periodo: '2026-06' },
    });
    const res = await app.inject({
      method: 'POST', url: `/rendiciones/${rend.id}/anular`, headers: auth(tokenAdmin),
      payload: { pin: '1234' },
    });
    expect(res.statusCode).toBe(200); // antes 500 (FK RESTRICT sobre alquileres_rendidos)
    const caja = await app.inject({ method: 'GET', url: '/caja/movimientos', headers: auth(tokenAdmin) });
    expect(caja.json().find((m: { id: string }) => m.id === 'mov_002').descontadoEnRendicion).toBe(false);
    // No quedaron AlquilerRendido huérfanos de esa rendición.
    expect(await prismaTest.alquilerRendido.count({ where: { rendicionId: rend.id } })).toBe(0);
  });

  it('tras anular la rendición, el pago SÍ se puede anular → 200', async () => {
    const res = await app.inject({
      method: 'POST', url: '/pagos/pag_liq002/anular', headers: auth(tokenAdmin),
      payload: { pin: '1234', observacion: 'ahora sí, la rendición fue anulada' },
    });
    expect(res.statusCode).toBe(200);
  });
});

describe('Alta de gasto en caja', () => {
  it('crea un gasto sin proveedor (proveedor null) → 200 y persiste; luego se puede eliminar', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/caja/movimientos',
      headers: auth(tokenAdmin),
      // proveedor null = caso del form cuando queda vacío (antes daba 400)
      payload: { propiedadId: 'prp_003', categoria: 'CERRAJERIA', descripcion: 'QA alta sin proveedor', monto: 15000, fecha: '2026-06-14', proveedor: null },
    });
    expect(res.statusCode).toBe(200);
    const creado = res.json();
    expect(creado.proveedor).toBeNull();
    expect(Number(creado.monto)).toBe(15000);
    // limpieza: el gasto recién creado no está descontado → se puede eliminar con PIN
    const del = await app.inject({
      method: 'DELETE',
      url: `/caja/movimientos/${creado.id}`,
      headers: auth(tokenAdmin),
      payload: { pin: '1234' },
    });
    expect(del.statusCode).toBe(200);
  });

  // Regresión del bug que Camila reportó en la reunión del 23/07: al agregar el
  // comprobante opcional, el zod quedó en `.optional()` (acepta undefined, RECHAZA
  // null) mientras el form manda null cuando no se adjuntó nada → "Datos del
  // movimiento incompletos" en TODA carga de caja sin comprobante. Mismo caso que
  // el `proveedor: null` de arriba.
  it('crea un gasto sin comprobante (comprobanteUrl null) → 200 y persiste', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/caja/movimientos',
      headers: auth(tokenAdmin),
      payload: {
        propiedadId: 'prp_003',
        categoria: 'PLOMERIA',
        descripcion: 'QA alta sin comprobante',
        monto: 1000,
        fecha: '2026-07-22',
        proveedor: null,
        comprobanteUrl: null,
      },
    });
    expect(res.statusCode).toBe(200);
    const creado = res.json();
    expect(creado.comprobanteUrl).toBeNull();
    const del = await app.inject({
      method: 'DELETE',
      url: `/caja/movimientos/${creado.id}`,
      headers: auth(tokenAdmin),
      payload: { pin: '1234' },
    });
    expect(del.statusCode).toBe(200);
  });
});

describe('Ajuste manual de monto · gate de rol', () => {
  // `contratos.crear` incluye a CARGA y la matriz declara rolesAprobacion:['CARGA'],
  // pero PATCH /monto no lo bloqueaba mientras POST /ajustar sí → era el camino sin
  // control para subir el alquiler (y re-devengar las cuotas futuras).
  it('un usuario CARGA no puede cambiar el monto del contrato → 403', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/contratos/cnt_001/monto',
      headers: auth(tokenCarga),
      payload: { monto: 999999, pin: '1234' },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe('Saldar un cargo del inquilino', () => {
  // Antes esto sólo marcaba saldadoAt: la deuda del inquilino bajaba y la plata no
  // entraba a ningún lado. Ahora deja el ingreso registrado en la caja.
  it('marcar un cargo como cobrado deja un INGRESO_EXTRA en la caja por el mismo monto', async () => {
    const contrato = await prismaTest.contrato.findFirst({
      where: { id: 'cnt_001' },
      select: { id: true, inmobiliariaId: true, propiedadId: true },
    });
    expect(contrato).toBeTruthy();
    const cargo = await prismaTest.cargoContrato.create({
      data: {
        inmobiliariaId: contrato!.inmobiliariaId,
        contratoId: contrato!.id,
        tipo: 'REPARACION',
        concepto: 'QA canilla rota',
        monto: 25000,
        contraDeposito: false,
      },
    });

    const res = await app.inject({
      method: 'POST',
      url: `/cargos/${cargo.id}/saldar`,
      headers: auth(tokenAdmin),
    });
    expect(res.statusCode).toBe(200);

    const mov = await prismaTest.movimientoCaja.findFirst({
      where: { contratoId: contrato!.id, tipo: 'INGRESO_EXTRA', descripcion: { contains: 'QA canilla rota' } },
    });
    expect(mov).toBeTruthy();
    expect(Number(mov!.monto)).toBe(25000);
    expect(mov!.propiedadId).toBe(contrato!.propiedadId);

    // idempotencia: volver a saldar no duplica el ingreso
    await app.inject({ method: 'POST', url: `/cargos/${cargo.id}/saldar`, headers: auth(tokenAdmin) });
    const movs = await prismaTest.movimientoCaja.count({
      where: { contratoId: contrato!.id, tipo: 'INGRESO_EXTRA', descripcion: { contains: 'QA canilla rota' } },
    });
    expect(movs).toBe(1);

    await prismaTest.movimientoCaja.deleteMany({ where: { id: mov!.id } });
    await prismaTest.cargoContrato.deleteMany({ where: { id: cargo.id } });
  });
});

describe('Aprobaciones', () => {
  it('aprobar el contrato de Tomás Bravo → APROBADA + contrato ACTIVO', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/aprobaciones/apr_seed_1/aprobar',
      headers: auth(tokenAdmin),
      payload: { pin: '1234' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().estado).toBe('APROBADA');
    // La respuesta debe traer cargadoPor con el mismo shape que GET /aprobaciones
    // (el front mapea cargadoPor.nombre; sin el include el cliente crasheaba).
    expect(res.json().cargadoPor).toMatchObject({
      nombre: expect.any(String),
      apellido: expect.any(String),
      rol: expect.any(String),
    });
    const contratos = await app.inject({ method: 'GET', url: '/contratos', headers: auth(tokenAdmin) });
    const c6 = contratos.json().find((c: { id: string }) => c.id === 'cnt_006');
    expect(c6.estado).toBe('ACTIVO');
    expect(c6.pendienteAprobacion).toBe(false);
  });

  it('rechazar sin motivo → 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/aprobaciones/apr_seed_3/rechazar',
      headers: auth(tokenAdmin),
      payload: { pin: '1234' },
    });
    expect(res.statusCode).toBe(400);
  });
});

// Cobro MANUAL (efectivo en oficina / "el dueño confirmó que cobró" en cobranza
// directa): el único camino en prod para marcar cobrada una liquidación cuando el
// inquilino no informa por la app. Usa liq_003 (cnt_003, VENCIDO, $510.000) que
// ningún otro test toca; fecha = fechaVencimiento → 0 días de atraso → mora 0
// (determinístico, no depende del día en que corra la suite).
describe('POST /pagos/manual — cobro registrado por la inmobiliaria', () => {
  const FECHA = '2026-06-02'; // = fechaVencimiento de liq_003

  it('rol CARGA no puede → 403', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/pagos/manual',
      headers: auth(tokenCarga),
      payload: { liquidacionId: 'liq_003', monto: 1000, fecha: FECHA, pin: '1234' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('monto que supera el saldo → 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/pagos/manual',
      headers: auth(tokenAdmin),
      payload: { liquidacionId: 'liq_003', monto: 999999999, fecha: FECHA, pin: '1234' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toMatch(/supera el saldo/i);
  });

  it('cobro parcial en efectivo → 201, nace CONCILIADO y la liq queda PARCIAL', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/pagos/manual',
      headers: auth(tokenAdmin),
      payload: { liquidacionId: 'liq_003', monto: 200000, metodo: 'EFECTIVO', fecha: FECHA, nota: 'pagó en la oficina', pin: '1234' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().estado).toBe('CONCILIADO');
    expect(res.json().tipo).toBe('PARCIAL');
    const liqs = await app.inject({ method: 'GET', url: '/liquidaciones?periodo=2026-06', headers: auth(tokenAdmin) });
    const liq3 = liqs.json().find((l: { id: string }) => l.id === 'liq_003');
    expect(liq3.estado).toBe('PARCIAL');
    expect(Number(liq3.montoPagado)).toBe(200000);
  });

  it('cobro del resto → cierra el ciclo: liq PAGADO con metodoPago EFECTIVO', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/pagos/manual',
      headers: auth(tokenAdmin),
      payload: { liquidacionId: 'liq_003', monto: 310000, metodo: 'EFECTIVO', fecha: FECHA, pin: '1234' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().tipo).toBe('TOTAL'); // el pago que CIERRA nace TOTAL
    const liqs = await app.inject({ method: 'GET', url: '/liquidaciones?periodo=2026-06', headers: auth(tokenAdmin) });
    const liq3 = liqs.json().find((l: { id: string }) => l.id === 'liq_003');
    expect(liq3.estado).toBe('PAGADO');
  });

  it('sobre una liq ya paga → 409', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/pagos/manual',
      headers: auth(tokenAdmin),
      payload: { liquidacionId: 'liq_003', monto: 1000, fecha: FECHA, pin: '1234' },
    });
    expect(res.statusCode).toBe(409);
  });
});

// La bandeja GET /pagos ahora decora cada fila con el saldo REAL de la liquidación
// y el modo de cobranza del contrato (antes el panel calculaba el saldo contra
// mocks y no distinguía contratos PROPIETARIO_DIRECTO).
describe('GET /pagos — decoración de liquidación y modo de cobranza', () => {
  it('cada pago trae liquidacion.{montoPagado,saldo} y contrato.modoCobranza', async () => {
    const res = await app.inject({ method: 'GET', url: '/pagos', headers: auth(tokenAdmin) });
    expect(res.statusCode).toBe(200);
    const pagos = res.json();
    expect(pagos.length).toBeGreaterThan(0);
    for (const p of pagos) {
      expect(p.contrato.modoCobranza).toBeDefined();
      expect(p.liquidacion.montoPagado).toBeDefined();
      expect(p.liquidacion.saldo).toBeDefined();
      expect(p.liquidacion.montoPunitorio).toBeDefined();
    }
  });
});

// /mis-liquidaciones ahora expone los pagos del inquilino (estado + motivo de
// rechazo + comprobante): la fuente que la PWA necesitaba para mostrar
// "pendiente de validación" / "rechazado" / "confirmado" en prod.
describe('GET /mis-liquidaciones — pagos[] del inquilino', () => {
  it('cada liquidación trae su lista de pagos con estado y monto numérico', async () => {
    const demo = await app.inject({ method: 'POST', url: '/auth/demo' });
    const tk = demo.json().token;
    const res = await app.inject({ method: 'GET', url: '/mis-liquidaciones', headers: auth(tk) });
    expect(res.statusCode).toBe(200);
    const liqs = res.json();
    expect(liqs.length).toBeGreaterThan(0);
    for (const l of liqs) expect(Array.isArray(l.pagos)).toBe(true);
    // liq_001 tiene pag_002 (INFORMADO del seed, o el estado en que lo dejó la suite)
    const liq1 = liqs.find((l: { id: string }) => l.id === 'liq_001');
    expect(liq1.pagos.length).toBeGreaterThan(0);
    const pago = liq1.pagos.find((p: { id: string }) => p.id === 'pag_002');
    expect(pago).toBeDefined();
    expect(typeof pago.monto).toBe('number');
    expect(['INFORMADO', 'CONCILIADO', 'RECHAZADO']).toContain(pago.estado);
  });
});

// P10: las escrituras del inquilino sobre el contrato exigen contrato ACTIVO.
// El JWT vive 15 días y sobrevive a finalizar el contrato → sin este guard, un
// ex-inquilino seguía informando pagos / subiendo boletas. Va al FINAL del archivo
// porque finaliza cnt_001 (mutación de seed); cada test file re-seedea en beforeAll.
describe('P10 — escritura sobre contrato no-activo', () => {
  it('finalizar cnt_001 y luego informar pago / subir boleta con el JWT viejo → 409', async () => {
    // Token de Mariela (cnt_001) emitido ANTES de finalizar: el JWT lleva el contratoId.
    const demo = await app.inject({ method: 'POST', url: '/auth/demo' });
    const tk = demo.json().token;
    const fin = await app.inject({ method: 'POST', url: '/contratos/cnt_001/finalizar', headers: auth(tokenAdmin) });
    expect(fin.statusCode).toBe(200);

    const pago = await app.inject({
      method: 'POST',
      url: '/pagos/informar',
      headers: auth(tk),
      payload: { liquidacionId: 'liq_001', monto: 1000, metodo: 'TRANSFERENCIA', fechaTransferencia: '2026-06-12' },
    });
    expect(pago.statusCode).toBe(409);
    expect(pago.json().message).toMatch(/no está activo/i);

    const boleta = await app.inject({
      method: 'POST',
      url: '/boletas',
      headers: auth(tk),
      payload: { servicio: 'LUZ', periodo: '2026-06', monto: 5000 },
    });
    expect(boleta.statusCode).toBe(409);
  });
});
