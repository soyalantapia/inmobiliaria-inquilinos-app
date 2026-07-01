import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { exigirContratoActivo, requireContratoAcceso, requireInquilino, requireUsuario } from '../auth/guards.js';
import { verificarPinUsuario } from '../auth/pin.js';
import { devengarTodosLosTenants, generarLiquidacionesContrato, marcarLiquidacionesVencidas } from '../lib/liquidaciones.js';
import { conSaldo, montoPagadoPorLiquidacion } from '../lib/saldos.js';
import { registrarEvento } from '../lib/auditoria.js';
import { enviarInvitacionInquilino } from '../mailer.js';
import { urlEsDelTenant } from './uploads.js';

/**
 * Fase 3 — La plata: liquidaciones, validación de pagos informados, caja de
 * gastos, rendiciones (que CONSUMEN los gastos y los marcan descontados — el
 * loop que en el front mock quedaba huérfano) y aprobaciones con PIN.
 */

// Delega en verificarPinUsuario (auth/pin.ts), que agrega bloqueo anti-fuerza-
// bruta (lockout tras N intentos). Acá solo traducimos el resultado a la reply.
async function verificarPin(userId: string, pin: string | undefined, reply: FastifyReply): Promise<boolean> {
  const r = await verificarPinUsuario(userId, pin);
  if (!r.ok) {
    await reply.code(r.code).send({ message: r.message });
    return false;
  }
  return true;
}

export async function plataRoutes(app: FastifyInstance) {
  // ===== Liquidaciones =====
  app.get('/liquidaciones', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'pagos.ver');
    if (!u) return;
    const q = z
      .object({ periodo: z.string().optional(), estado: z.enum(['PENDIENTE', 'PAGADO', 'PARCIAL', 'VENCIDO']).optional() })
      .parse(request.query ?? {});
    const liqs = await prisma.liquidacion.findMany({
      where: { inmobiliariaId: u.inmobiliariaId, ...(q.periodo ? { periodo: q.periodo } : {}), ...(q.estado ? { estado: q.estado } : {}) },
      include: {
        contrato: {
          select: {
            id: true,
            propiedad: { select: { direccion: true } },
            inquilinoTitular: { select: { nombre: true, apellido: true } },
          },
        },
      },
      orderBy: { fechaVencimiento: 'desc' },
    });
    // montoPagado/saldo (suma de conciliados) para que las vistas puedan mostrar
    // lo cobrado de un PARCIAL, no sólo el estado.
    const pagado = await montoPagadoPorLiquidacion(liqs.map((l) => l.id));
    return liqs.map((l) => conSaldo(l, pagado));
  });

  // Devenga (top-up) las liquidaciones de meses futuros de TODOS los contratos
  // ACTIVO del tenant. computarLiquidacionesContrato genera hasta "el mes que
  // viene inclusive"; sin un disparo periódico, un contrato se queda sin
  // liquidaciones a partir del 2º mes (no hay nada que cobrar). Es IDEMPOTENTE
  // (skipDuplicates sobre @@unique([contratoId,periodo])) → se puede llamar
  // cuantas veces se quiera. Hoy lo dispara un botón del panel; mañana un cron de
  // Railway puede pegarle a este mismo endpoint sin cambiar el código (sólo habrá
  // que darle una credencial de servicio para autenticarse).
  app.post('/liquidaciones/devengar', async (request, reply) => {
    const u = await requireUsuario(request, reply);
    if (!u) return;
    if (u.rol !== 'ADMIN' && u.rol !== 'OPERADOR') {
      return reply.code(403).send({ message: 'Necesitás permiso de Admin u Operador para generar liquidaciones' });
    }
    const contratos = await prisma.contrato.findMany({
      where: { inmobiliariaId: u.inmobiliariaId, estado: 'ACTIVO' },
      select: {
        id: true,
        inmobiliariaId: true,
        monto: true,
        montoExpensas: true,
        moneda: true,
        fechaInicio: true,
        fechaFin: true,
        diaPago: true,
      },
    });
    let liquidacionesNuevas = 0;
    for (const c of contratos) {
      // Una llamada idempotente por contrato (cada generar es su propio
      // createMany skipDuplicates). No hace falta una tx global: nada se corrompe
      // si falla a la mitad, y un reintento completa lo que falte.
      liquidacionesNuevas += await generarLiquidacionesContrato(prisma, c);
    }
    // Marca vencidas las liquidaciones del tenant cuyo vencimiento ya pasó (mora).
    const liquidacionesVencidas = await marcarLiquidacionesVencidas(prisma, u.inmobiliariaId);
    return { contratosProcesados: contratos.length, liquidacionesNuevas, liquidacionesVencidas };
  });

  // Disparo GLOBAL del devengo (TODAS las inmobiliarias). Lo usa un cron externo
  // o un trigger manual: se autentica con un secreto compartido (header
  // x-cron-secret) porque un scheduler no tiene sesión de usuario. El back además
  // corre este mismo devengo solo, in-process (ver cron.ts), así que esto es el
  // camino externo/redundante. Idempotente.
  app.post('/internal/cron/devengar', async (request, reply) => {
    const secret = process.env.CRON_SECRET;
    const provisto = request.headers['x-cron-secret'];
    // Sin secreto configurado el endpoint queda cerrado (nunca abierto por defecto).
    if (!secret || provisto !== secret) {
      return reply.code(401).send({ message: 'No autorizado' });
    }
    return devengarTodosLosTenants(prisma);
  });

  // Cierre de caja del día: lo COBRADO (pagos conciliados) en una fecha + la
  // comisión de la inmobiliaria sobre el alquiler cobrado. Es la "rendición de
  // caja diaria" que pidió la inmobiliaria. Solo lectura. La comisión va SOLO
  // sobre el alquiler (no las expensas) y se prorratea en pagos parciales.
  app.get('/caja/cierre', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'caja.ver');
    if (!u) return;
    const q = z
      .object({ fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'fecha debe ser YYYY-MM-DD').optional() })
      .parse(request.query ?? {});
    // Día en hora de Argentina (UTC-3): el rango en UTC es [fecha 03:00Z, +24h).
    const arNow = new Date(Date.now() - 3 * 3600 * 1000);
    const fecha = q.fecha ?? arNow.toISOString().slice(0, 10);
    const desde = new Date(`${fecha}T03:00:00.000Z`);
    const hasta = new Date(desde.getTime() + 24 * 3600 * 1000);

    const pagos = await prisma.pago.findMany({
      where: {
        inmobiliariaId: u.inmobiliariaId,
        estado: 'CONCILIADO',
        decididoAt: { gte: desde, lt: hasta },
        // SOLO contratos de cobranza por inmobiliaria: en PROPIETARIO_DIRECTO la
        // inmo no cobra ni gana comisión, así que esos pagos no van al cierre del
        // día (mismo filtro que /rendiciones). Antes inflaban cobrado + comisión.
        contrato: { modoCobranza: 'INMOBILIARIA' },
      },
      include: {
        liquidacion: { select: { montoAlquiler: true, montoTotal: true, periodo: true, moneda: true } },
        contrato: {
          select: {
            propiedad: {
              select: {
                direccion: true,
                participaciones: {
                  select: { porcentaje: true, propietario: { select: { comisionPct: true } } },
                },
              },
            },
            inquilinoTitular: { select: { nombre: true, apellido: true } },
          },
        },
      },
      orderBy: { decididoAt: 'asc' },
    });

    let cobrado = 0;
    let comision = 0;
    // Buckets por moneda: sumar ARS+USD en un mismo total no tiene sentido. El
    // total plano de abajo sólo es correcto si hay UNA sola moneda; para el caso
    // mixto exponemos porMoneda + multiMoneda y el front muestra el desglose.
    const buckets = new Map<string, { moneda: string; cobrado: number; comision: number; cantidad: number }>();
    const bucket = (m: string) => {
      let b = buckets.get(m);
      if (!b) { b = { moneda: m, cobrado: 0, comision: 0, cantidad: 0 }; buckets.set(m, b); }
      return b;
    };
    const items = pagos.map((p) => {
      const monto = Number(p.monto);
      cobrado += monto;
      const moneda = p.liquidacion?.moneda ?? 'ARS';
      const liqTotal = Number(p.liquidacion?.montoTotal ?? 0);
      const liqAlq = Number(p.liquidacion?.montoAlquiler ?? 0);
      // Porción de alquiler dentro del pago (proporcional: cubre parciales y
      // excluye las expensas, sobre las que NO se cobra comisión).
      const alquilerPortion = liqTotal > 0 ? monto * (liqAlq / liqTotal) : 0;
      // Tasa de comisión ponderada por la participación de cada dueño de la propiedad.
      const parts = p.contrato?.propiedad?.participaciones ?? [];
      const tasa = parts.reduce(
        (s, x) => s + (x.porcentaje / 100) * ((x.propietario?.comisionPct ?? 0) / 100),
        0,
      );
      // Redondeo a CENTAVOS (no a peso entero) para cuadrar con la rendición, que
      // persiste comisión en Decimal(14,2). Antes el cierre redondeaba a peso
      // entero por pago → drift de centavos al reconciliar cierre vs rendición.
      const comisionPago = Math.round(alquilerPortion * tasa * 100) / 100;
      comision += comisionPago;
      const b = bucket(moneda);
      b.cobrado += monto;
      b.comision += comisionPago;
      b.cantidad += 1;
      const inq = p.contrato?.inquilinoTitular;
      return {
        id: p.id,
        inquilino: inq ? `${inq.nombre} ${inq.apellido ?? ''}`.trim() : '—',
        direccion: p.contrato?.propiedad?.direccion ?? '—',
        periodo: p.liquidacion?.periodo ?? p.periodo,
        monto,
        moneda,
        comision: comisionPago,
        metodo: p.metodo,
        hora: p.decididoAt,
      };
    });

    // Totales redondeados a centavos: cobrado/comision acumulan floats; sin esto
    // la suma podía arrastrar artefactos binarios (0.1+0.2) en el JSON.
    const porMoneda = [...buckets.values()].map((b) => ({
      moneda: b.moneda,
      cobrado: Math.round(b.cobrado * 100) / 100,
      comision: Math.round(b.comision * 100) / 100,
      cantidad: b.cantidad,
    }));
    return {
      fecha,
      // Totales planos: correctos con una sola moneda; con multiMoneda el front
      // debe usar porMoneda (sumar ARS+USD acá no significaría nada).
      cobrado: Math.round(cobrado * 100) / 100,
      comision: Math.round(comision * 100) / 100,
      cantidad: items.length,
      multiMoneda: porMoneda.length > 1,
      porMoneda,
      pagos: items,
    };
  });

  // ===== Pagos informados (bandeja a validar) =====
  app.get('/pagos', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'pagos.ver');
    if (!u) return;
    const q = z.object({ estado: z.enum(['INFORMADO', 'CONCILIADO', 'RECHAZADO']).optional() }).parse(request.query ?? {});
    return prisma.pago.findMany({
      where: { inmobiliariaId: u.inmobiliariaId, ...(q.estado ? { estado: q.estado } : {}) },
      include: {
        contrato: {
          select: {
            id: true,
            propiedad: { select: { direccion: true } },
            inquilinoTitular: { select: { nombre: true, apellido: true } },
          },
        },
        liquidacion: { select: { id: true, periodo: true, montoTotal: true, estado: true } },
      },
      orderBy: { informadoAt: 'desc' },
    });
  });

  app.post('/pagos/:id/validar', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'pago.conciliar');
    if (!u) return;
    const { id } = request.params as { id: string };
    const body = z.object({ pin: z.string().optional() }).parse(request.body ?? {});
    if (!(await verificarPin(u.userId, body.pin, reply))) return;

    const pago = await prisma.pago.findFirst({
      where: { id, inmobiliariaId: u.inmobiliariaId },
      include: { contrato: { select: { estado: true } } },
    });
    if (!pago) return reply.code(404).send({ message: 'Pago inexistente' });
    if (pago.estado !== 'INFORMADO') return reply.code(409).send({ message: 'El pago ya fue decidido' });
    // No conciliar un pago cuyo contrato ya no está ACTIVO: `informar` bloquea los
    // pagos nuevos sobre un contrato finalizado (exigirContratoActivo), pero un pago
    // INFORMADO viejo podía validarse DESPUÉS de finalizar el contrato, reabriendo
    // el ciclo de plata de un contrato muerto (marca la liq PAGADO, entra a
    // rendición). Lo cortamos acá con un 409 claro.
    if (pago.contrato && pago.contrato.estado !== 'ACTIVO') {
      return reply.code(409).send({
        message: 'El contrato ya no está activo — no se puede conciliar este pago. Revisá el estado del contrato.',
      });
    }

    // Atómico:
    //  1) La transición INFORMADO→CONCILIADO se hace con updateMany condicionado
    //     (WHERE estado='INFORMADO'). Si otra request (validar/rechazar) ya lo
    //     decidió, count=0 → 409. Cierra la carrera de doble-decisión.
    //  2) La liquidación pasa a PAGADO SÓLO si la suma de pagos conciliados llega
    //     al total; si es un pago parcial, queda PARCIAL. Antes un pago parcial la
    //     marcaba PAGADO → el inquilino no podía pagar el resto y al propietario
    //     se le acreditaba el monto completo (no el realmente cobrado).
    const pagoOk = await prisma.$transaction(async (tx) => {
      const upd = await tx.pago.updateMany({
        where: { id, estado: 'INFORMADO' },
        data: { estado: 'CONCILIADO', decididoPorId: u.userId, decididoAt: new Date() },
      });
      if (upd.count === 0) return null;
      const agg = await tx.pago.aggregate({
        where: { liquidacionId: pago.liquidacionId, estado: 'CONCILIADO' },
        _sum: { monto: true },
      });
      const cobrado = Number(agg._sum.monto ?? 0);
      // Total AUTORITATIVO de la liquidación (montoLiqTotal del pago es nullable;
      // Number(null)=0 marcaría PAGADO siempre). H-2: incluimos inmobiliariaId en
      // ambas ops para que un ID de liquidación ajeno no pueda operar cross-tenant.
      const liq = await tx.liquidacion.findFirst({
        where: { id: pago.liquidacionId, inmobiliariaId: u.inmobiliariaId },
        select: { montoTotal: true },
      });
      const total = Number(liq?.montoTotal ?? pago.montoLiqTotal ?? 0);
      await tx.liquidacion.updateMany({
        where: { id: pago.liquidacionId, inmobiliariaId: u.inmobiliariaId },
        data:
          total > 0 && cobrado >= total
            ? {
                estado: 'PAGADO',
                fechaPago: pago.fechaTransferencia,
                // Método REAL del pago (no hardcodear): MetodoPagoInformado incluye
                // CHEQUE, que no existe en MetodoPago → lo mapeamos a TRANSFERENCIA.
                metodoPago:
                  pago.metodo === 'MERCADOPAGO' ? 'MERCADOPAGO' : pago.metodo === 'EFECTIVO' ? 'EFECTIVO' : 'TRANSFERENCIA',
              }
            : { estado: 'PARCIAL' },
      });
      // El pago que CIERRA el ciclo (con parciales previos) queda etiquetado TOTAL,
      // no PARCIAL → el toast del panel no muestra un saldo restante falso.
      if (total > 0 && cobrado >= total) {
        await tx.pago.updateMany({ where: { id, tipo: 'PARCIAL' }, data: { tipo: 'TOTAL' } });
      }
      // Devolvemos el pago DENTRO de la tx: si el findUnique fallara afuera, el
      // estado ya estaría cambiado y el cliente vería un error engañoso.
      return tx.pago.findUnique({ where: { id } });
    });
    if (!pagoOk) return reply.code(409).send({ message: 'El pago ya fue decidido' });
    await registrarEvento({
      inmobiliariaId: u.inmobiliariaId,
      tipo: 'PAGO_CONCILIADO',
      autorId: u.userId,
      rolAutor: u.rol,
      entidadId: pagoOk.id,
      entidadDescripcion: `Pago ${pagoOk.periodo} · $${Number(pagoOk.monto)}`,
    });
    return pagoOk;
  });

  app.post('/pagos/:id/rechazar', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'pago.rechazar');
    if (!u) return;
    const { id } = request.params as { id: string };
    const body = z.object({ pin: z.string().optional(), observacion: z.string().min(5) }).safeParse(request.body ?? {});
    if (!body.success) return reply.code(400).send({ message: 'Contale al inquilino por qué se rechaza (mínimo 5 caracteres)' });
    if (!(await verificarPin(u.userId, body.data.pin, reply))) return;

    const pago = await prisma.pago.findFirst({ where: { id, inmobiliariaId: u.inmobiliariaId } });
    if (!pago) return reply.code(404).send({ message: 'Pago inexistente' });
    if (pago.estado !== 'INFORMADO') return reply.code(409).send({ message: 'El pago ya fue decidido' });

    // Atómico (igual que validar): WHERE estado='INFORMADO' garantiza que sólo
    // una decisión (validar o rechazar) gane ante requests concurrentes. El
    // findUnique va DENTRO de la tx para no devolver un error engañoso si fallara
    // después de haber cambiado el estado.
    const pagoOk = await prisma.$transaction(async (tx) => {
      const upd = await tx.pago.updateMany({
        where: { id, estado: 'INFORMADO' },
        data: { estado: 'RECHAZADO', observacion: body.data.observacion, decididoPorId: u.userId, decididoAt: new Date() },
      });
      if (upd.count === 0) return null;
      return tx.pago.findUnique({ where: { id } });
    });
    if (!pagoOk) return reply.code(409).send({ message: 'El pago ya fue decidido' });
    await registrarEvento({
      inmobiliariaId: u.inmobiliariaId,
      tipo: 'PAGO_RECHAZADO',
      autorId: u.userId,
      rolAutor: u.rol,
      entidadId: pagoOk.id,
      entidadDescripcion: `Pago ${pagoOk.periodo} · $${Number(pagoOk.monto)}`,
      detalle: body.data.observacion,
    });
    return pagoOk;
  });

  // Anular (revertir) un pago YA CONCILIADO: un cobro validado por error o una
  // transferencia que rebotó. Antes un CONCILIADO era terminal (no había forma de
  // deshacerlo) → la inmo quedaba con una liquidación PAGADO falsa que entraba a
  // rendición. Devuelve el pago a no-cobrado (reusa RECHAZADO con observación
  // "Anulado…" para no migrar el enum) y RECOMPUTA la liquidación
  // (PAGADO→PARCIAL/PENDIENTE/VENCIDO según lo que quede conciliado). Tras anular,
  // el inquilino puede volver a informar (la liq deja de estar paga).
  app.post('/pagos/:id/anular', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'pago.conciliar');
    if (!u) return;
    const { id } = request.params as { id: string };
    const body = z.object({ pin: z.string().optional(), observacion: z.string().min(5) }).safeParse(request.body ?? {});
    if (!body.success) return reply.code(400).send({ message: 'Contá por qué se anula el pago (mínimo 5 caracteres)' });
    if (!(await verificarPin(u.userId, body.data.pin, reply))) return;

    const pago = await prisma.pago.findFirst({ where: { id, inmobiliariaId: u.inmobiliariaId } });
    if (!pago) return reply.code(404).send({ message: 'Pago inexistente' });
    if (pago.estado !== 'CONCILIADO') return reply.code(409).send({ message: 'Solo se puede anular un pago ya conciliado' });

    const observacion = `Anulado tras conciliar: ${body.data.observacion}`;
    const pagoOk = await prisma.$transaction(async (tx) => {
      // updateMany condicionado (WHERE estado='CONCILIADO'): cierra la carrera de
      // doble-anulación o anular-mientras-otro-opera. count=0 → 409.
      const upd = await tx.pago.updateMany({
        where: { id, estado: 'CONCILIADO' },
        data: { estado: 'RECHAZADO', observacion, decididoPorId: u.userId, decididoAt: new Date() },
      });
      if (upd.count === 0) return null;
      // Recalcular la liquidación con lo que QUEDA conciliado (incluye inmobiliariaId
      // en ambas ops: un ID ajeno no puede operar cross-tenant).
      const liq = await tx.liquidacion.findFirst({
        where: { id: pago.liquidacionId, inmobiliariaId: u.inmobiliariaId },
        select: { montoTotal: true, fechaVencimiento: true },
      });
      const agg = await tx.pago.aggregate({
        where: { liquidacionId: pago.liquidacionId, estado: 'CONCILIADO' },
        _sum: { monto: true },
      });
      const cobrado = Number(agg._sum.monto ?? 0);
      const total = Number(liq?.montoTotal ?? 0);
      const vencida = liq ? new Date(liq.fechaVencimiento) < new Date() : false;
      // Sigue PAGADO sólo si OTROS conciliados cubren el total; si no, PARCIAL
      // (queda algo) o PENDIENTE/VENCIDO (no queda nada). Al dejar de estar PAGADO
      // limpiamos fechaPago/metodoPago para no dejar un "pagado" fantasma.
      const nuevoEstado = total > 0 && cobrado >= total ? 'PAGADO' : cobrado > 0 ? 'PARCIAL' : vencida ? 'VENCIDO' : 'PENDIENTE';
      await tx.liquidacion.updateMany({
        where: { id: pago.liquidacionId, inmobiliariaId: u.inmobiliariaId },
        data:
          nuevoEstado === 'PAGADO'
            ? { estado: 'PAGADO' }
            : { estado: nuevoEstado, fechaPago: null, metodoPago: null },
      });
      return tx.pago.findUnique({ where: { id } });
    });
    if (!pagoOk) return reply.code(409).send({ message: 'El pago ya no estaba conciliado' });
    await registrarEvento({
      inmobiliariaId: u.inmobiliariaId,
      tipo: 'PAGO_REVERTIDO',
      autorId: u.userId,
      rolAutor: u.rol,
      entidadId: pagoOk.id,
      entidadDescripcion: `Pago ${pagoOk.periodo} · $${Number(pagoOk.monto)}`,
      detalle: body.data.observacion,
    });
    return pagoOk;
  });

  // Inquilino o CUALQUIER co-inquilino del contrato (incluido permiso VER) informa
  // un pago. Decisión del dueño (2026-06-21): pagar el alquiler no se restringe —
  // cualquier miembro del contrato puede hacerlo (el tier PAGAR ya no aplica acá).
  app.post('/pagos/informar', async (request, reply) => {
    const inq = await requireContratoAcceso(request, reply, 'VER');
    if (!inq) return;
    if (!inq.contratoId) return reply.code(400).send({ message: 'No tenés un contrato activo' });
    // P10: un contrato finalizado/borrador no acepta pagos nuevos (aunque el JWT siga vivo).
    if (!(await exigirContratoActivo(inq.contratoId, inq.inmobiliariaId, reply))) return;
    const body = z
      .object({
        liquidacionId: z.string(),
        monto: z.number().positive(),
        metodo: z.enum(['TRANSFERENCIA', 'MERCADOPAGO', 'EFECTIVO', 'CHEQUE']),
        nroOperacion: z.string().optional(),
        // coerce.date rechaza strings que no son fecha (antes new Date('xxx') =
        // Invalid Date hacía explotar el create con 500 en una acción de plata).
        fechaTransferencia: z.coerce.date(),
        nota: z.string().optional(),
        // Comprobante REAL subido a /uploads (Railway Volume). Antes el archivo
        // nunca llegaba al backend (solo metadatos) → la inmo no podía verlo.
        comprobanteUrl: z.string().optional(),
        comprobanteFileName: z.string().optional(),
        comprobanteMime: z.string().optional(),
        comprobanteSize: z.number().int().nonnegative().optional(),
      })
      .safeParse(request.body ?? {});
    if (!body.success) return reply.code(400).send({ message: 'Datos del pago incompletos' });
    // El comprobante, si viene, tiene que ser un archivo /uploads de ESTA
    // inmobiliaria (no una url externa ni de otro tenant).
    if (body.data.comprobanteUrl && !urlEsDelTenant(body.data.comprobanteUrl, inq.inmobiliariaId)) {
      return reply.code(400).send({ message: 'Comprobante inválido' });
    }

    const liq = await prisma.liquidacion.findFirst({
      where: { id: body.data.liquidacionId, contratoId: inq.contratoId },
    });
    if (!liq) return reply.code(404).send({ message: 'Liquidación inexistente' });
    if (liq.estado === 'PAGADO') return reply.code(409).send({ message: 'Esta liquidación ya está paga' });
    // El monto informado no puede superar el saldo pendiente (total − conciliados):
    // antes, al volver a pagar un parcial, se podía informar más que lo que faltaba.
    const aggConc = await prisma.pago.aggregate({
      where: { liquidacionId: liq.id, estado: 'CONCILIADO' },
      _sum: { monto: true },
    });
    const saldoPendiente = Number(liq.montoTotal) - Number(aggConc._sum.monto ?? 0);
    // Carrera: liq.estado pudo leerse stale como PARCIAL mientras un /validar
    // concurrente ya concilió el total → saldo 0. No dejamos informar sobre una
    // liquidación efectivamente paga (el check de estado=PAGADO de arriba no la agarra).
    if (saldoPendiente <= 0) {
      return reply.code(409).send({ message: 'Esta liquidación ya está paga' });
    }
    if (body.data.monto > saldoPendiente) {
      return reply.code(400).send({ message: 'El monto supera el saldo pendiente de esta liquidación' });
    }

    // Evitar doble-informe: si ya hay un pago INFORMADO esperando validación,
    // no creamos otro (el inquilino no veía el estado "pendiente de validación"
    // en prod y cada toque del botón insertaba otra fila Pago en la bandeja).
    const yaInformado = await prisma.pago.findFirst({
      where: { liquidacionId: liq.id, estado: 'INFORMADO' },
    });
    if (yaInformado) {
      return reply
        .code(409)
        .send({ message: 'Ya informaste un pago de este mes; esperá que la inmobiliaria lo valide.' });
    }

    try {
      return await prisma.pago.create({
        data: {
          inmobiliariaId: inq.inmobiliariaId,
          contratoId: inq.contratoId,
          liquidacionId: liq.id,
          periodo: liq.periodo,
          // TOTAL si el monto CIERRA el saldo pendiente (no si iguala el total
          // original): un pago que salda el remanente tras un parcial previo debe
          // nacer TOTAL, no PARCIAL. saldoPendiente = montoTotal − conciliados.
          tipo: body.data.monto >= saldoPendiente ? 'TOTAL' : 'PARCIAL',
          monto: body.data.monto,
          montoLiqTotal: liq.montoTotal,
          metodo: body.data.metodo,
          nroOperacion: body.data.nroOperacion,
          fechaTransferencia: body.data.fechaTransferencia,
          notaInquilino: body.data.nota,
          comprobanteUrl: body.data.comprobanteUrl,
          comprobanteFileName: body.data.comprobanteFileName,
          comprobanteMime: body.data.comprobanteMime,
          comprobanteSize: body.data.comprobanteSize,
        },
      });
    } catch (e) {
      // Carrera de doble-informe concurrente (dos requests pasan el findFirst de
      // arriba a la vez): el índice parcial único (un solo INFORMADO por
      // liquidación) la corta con P2002 → mismo 409 amigable que el caso secuencial.
      if (e && typeof e === 'object' && (e as { code?: string }).code === 'P2002') {
        return reply
          .code(409)
          .send({ message: 'Ya informaste un pago de este mes; esperá que la inmobiliaria lo valide.' });
      }
      throw e;
    }
  });

  // Liquidaciones del inquilino logueado (para informar pagos / comprobantes)
  app.get('/mis-liquidaciones', async (request, reply) => {
    const inq = await requireContratoAcceso(request, reply);
    if (!inq) return;
    if (!inq.contratoId) return [];
    const liqs = await prisma.liquidacion.findMany({
      where: { contratoId: inq.contratoId },
      orderBy: { periodo: 'desc' },
    });
    // CLAVE (bugs 1/3): sin montoPagado/saldo el inquilino veía SIEMPRE el
    // montoTotal completo, aunque hubiera informado/conciliado un parcial. Ahora
    // exponemos cuánto se pagó (conciliado) y el saldo real por liquidación.
    const pagado = await montoPagadoPorLiquidacion(liqs.map((l) => l.id));
    return liqs.map((l) => conSaldo(l, pagado));
  });

  // ===== Caja de gastos =====
  app.get('/caja/movimientos', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'caja.ver');
    if (!u) return;
    return prisma.movimientoCaja.findMany({
      where: { inmobiliariaId: u.inmobiliariaId },
      include: { propiedad: { select: { id: true, direccion: true } } },
      orderBy: { fecha: 'desc' },
    });
  });

  app.post('/caja/movimientos', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'gasto.caja.cargar');
    if (!u) return;
    const body = z
      .object({
        propiedadId: z.string(),
        categoria: z.enum(['PLOMERIA', 'ELECTRICIDAD', 'GAS', 'CERRAJERIA', 'PINTURA', 'EXPENSAS', 'MATERIALES', 'OTRO']),
        descripcion: z.string().min(3),
        monto: z.number().positive(),
        // coerce.date rechaza strings no-fecha (igual que fechaTransferencia):
        // antes new Date('xxx')=Invalid Date hacía explotar el create con 500.
        fecha: z.coerce.date(),
        // El front manda null cuando el proveedor queda vacío: aceptar null además de undefined.
        proveedor: z.string().nullable().optional(),
      })
      .safeParse(request.body ?? {});
    if (!body.success) return reply.code(400).send({ message: 'Datos del gasto incompletos' });

    const prop = await prisma.propiedad.findFirst({ where: { id: body.data.propiedadId, inmobiliariaId: u.inmobiliariaId } });
    if (!prop) return reply.code(404).send({ message: 'Propiedad inexistente' });
    const usuario = await prisma.usuario.findUnique({ where: { id: u.userId } });

    const mov = await prisma.movimientoCaja.create({
      data: {
        inmobiliariaId: u.inmobiliariaId,
        propiedadId: prop.id,
        contratoId: prop.contratoActualId,
        tipo: 'GASTO',
        categoria: body.data.categoria,
        descripcion: body.data.descripcion,
        monto: body.data.monto,
        fecha: body.data.fecha,
        proveedor: body.data.proveedor,
        cargadoPor: usuario ? `${usuario.nombre} ${usuario.apellido}`.trim() : 'Panel',
      },
    });
    await registrarEvento({
      inmobiliariaId: u.inmobiliariaId,
      tipo: 'GASTO_CAJA_CARGADO',
      autorId: u.userId,
      rolAutor: u.rol,
      entidadId: mov.id,
      entidadDescripcion: `Gasto ${body.data.categoria} · $${body.data.monto} · ${body.data.descripcion}`,
    });
    return mov;
  });

  app.delete('/caja/movimientos/:id', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'caja.eliminar');
    if (!u) return;
    const { id } = request.params as { id: string };
    const body = z.object({ pin: z.string().optional() }).parse(request.body ?? {});
    if (!(await verificarPin(u.userId, body.pin, reply))) return;
    // 404 vs 409: distinguimos "no existe" de "ya rendido" con una lectura previa,
    // pero el borrado en sí es ATÓMICO (deleteMany WHERE descontadoEnRendicion=false):
    // si una rendición concurrente toma el gasto entre el check y el delete, el
    // count queda en 0 y devolvemos 409 (antes el delete lo borraba igual y dejaba
    // la rendición apuntando a un gasto inexistente).
    const mov = await prisma.movimientoCaja.findFirst({
      where: { id, inmobiliariaId: u.inmobiliariaId },
      select: { descontadoEnRendicion: true },
    });
    if (!mov) return reply.code(404).send({ message: 'Movimiento inexistente' });
    const res = await prisma.movimientoCaja.deleteMany({
      where: { id, inmobiliariaId: u.inmobiliariaId, descontadoEnRendicion: false },
    });
    if (res.count === 0) {
      return reply.code(409).send({ message: 'Ya fue descontado en una rendición — no se puede eliminar' });
    }
    await registrarEvento({
      inmobiliariaId: u.inmobiliariaId,
      tipo: 'GASTO_CAJA_ELIMINADO',
      autorId: u.userId,
      rolAutor: u.rol,
      entidadId: id,
      entidadDescripcion: 'Gasto de caja eliminado',
    });
    return { ok: true };
  });

  // ===== Rendiciones (cierra el loop caja→rendición) =====
  app.get('/rendiciones', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'pagos.ver');
    if (!u) return;
    const q = z.object({ propietarioId: z.string().optional() }).parse(request.query ?? {});
    return prisma.rendicion.findMany({
      where: { inmobiliariaId: u.inmobiliariaId, ...(q.propietarioId ? { propietarioId: q.propietarioId } : {}) },
      include: { gastos: true, propietario: { select: { nombre: true, apellido: true } } },
      orderBy: { periodo: 'desc' },
    });
  });

  app.post('/rendiciones', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'rendicion.confirmar');
    if (!u) return;
    const body = z
      .object({
        propietarioId: z.string(),
        periodo: z.string().regex(/^\d{4}-\d{2}$/),
        metodo: z.enum(['TRANSFERENCIA', 'MERCADOPAGO', 'EFECTIVO']).default('TRANSFERENCIA'),
        pin: z.string().optional(),
        notas: z.string().optional(),
      })
      .safeParse(request.body ?? {});
    if (!body.success) return reply.code(400).send({ message: 'Datos de la rendición incompletos' });
    if (!(await verificarPin(u.userId, body.data.pin, reply))) return;

    const { propietarioId, periodo } = body.data;
    const owner = await prisma.propietario.findFirst({
      where: { id: propietarioId, inmobiliariaId: u.inmobiliariaId },
      include: { participaciones: { include: { propiedad: true } } },
    });
    if (!owner) return reply.code(404).send({ message: 'Propietario inexistente' });
    if (!owner.cbuAlias) return reply.code(409).send({ message: 'El propietario no tiene CBU cargado — pedíselo antes de rendir' });

    // Bruto INCREMENTAL: alquiler COBRADO hasta ahora (PAGADO + PARCIAL conciliado)
    // de las propiedades del dueño, × participación, MENOS lo ya rendido de cada
    // liquidación. Así un mes se rinde en varias tandas (a medida que entran los
    // parciales) sin doble-rendir. Antes tomaba sólo estado=PAGADO (mes completo) y
    // el @@unique impedía rendir dos veces → el parcial cobrado no llegaba al dueño.
    const propIds = owner.participaciones.map((p) => p.propiedadId);
    const liqsCobradas = await prisma.liquidacion.findMany({
      where: {
        inmobiliariaId: u.inmobiliariaId,
        periodo,
        estado: { in: ['PAGADO', 'PARCIAL'] },
        contrato: { propiedadId: { in: propIds }, modoCobranza: 'INMOBILIARIA' },
      },
      include: {
        contrato: { select: { propiedadId: true, propiedad: { select: { direccion: true } } } },
      },
    });
    // Una sola moneda por rendición (la Rendicion guarda un monto). Si mezcla → 409.
    const monedas = [...new Set(liqsCobradas.map((l) => l.moneda))];
    if (monedas.length > 1) {
      return reply.code(409).send({
        message: `Este propietario tiene cobros en varias monedas (${monedas.join(', ')}) en ${periodo}. Rendí cada moneda por separado (hoy la rendición es de una sola moneda).`,
      });
    }
    // Cobrado (suma de pagos CONCILIADO) por liq + lo YA rendido a ESTE dueño por liq.
    const cobradoMap = await montoPagadoPorLiquidacion(liqsCobradas.map((l) => l.id));
    const prevRend = await prisma.alquilerRendido.groupBy({
      by: ['liquidacionId'],
      where: { liquidacionId: { in: liqsCobradas.map((l) => l.id) }, rendicion: { propietarioId } },
      _sum: { monto: true },
    });
    const yaRendMap = new Map(prevRend.map((r) => [r.liquidacionId, Number(r._sum.monto ?? 0)]));

    let montoBruto = 0;
    const alquilerData: {
      inmobiliariaId: string;
      liquidacionId: string;
      periodo: string;
      monto: number;
      participacion: number;
      propiedadId: string;
      direccion: string;
    }[] = [];
    for (const liq of liqsCobradas) {
      const part = owner.participaciones.find((p) => p.propiedadId === liq.contrato.propiedadId);
      const porcentaje = part?.porcentaje ?? 100;
      const total = Number(liq.montoTotal);
      // Porción de ALQUILER dentro de lo cobrado (excluye expensas/punitorios,
      // proporcional para cubrir parciales). Comisión y neto van sobre el alquiler.
      const alquilerCobrado = total > 0 ? (cobradoMap.get(liq.id) ?? 0) * (Number(liq.montoAlquiler) / total) : 0;
      const parteOwner = alquilerCobrado * (porcentaje / 100);
      const yaRend = yaRendMap.get(liq.id) ?? 0;
      const rendible = Math.round((parteOwner - yaRend) * 100) / 100;
      if (rendible <= 0) continue; // ya se rindió todo lo cobrado de esta liq a este dueño
      montoBruto += rendible;
      alquilerData.push({
        inmobiliariaId: u.inmobiliariaId,
        liquidacionId: liq.id,
        periodo,
        monto: rendible,
        participacion: porcentaje,
        propiedadId: liq.contrato.propiedadId,
        direccion: liq.contrato.propiedad?.direccion ?? '—',
      });
    }
    montoBruto = Math.round(montoBruto * 100) / 100;
    if (montoBruto <= 0) {
      return reply.code(409).send({ message: `No hay cobros nuevos del período ${periodo} para rendir a este propietario` });
    }

    // Gastos pendientes — SOLO del período que se rinde y SOLO de las propiedades
    // que aportaron ingreso a esta rendición (las que tienen liquidación PAGADA del
    // período). Antes descontaba gastos de CUALQUIER propiedad del dueño (p.ej. una
    // solo-expensas, que no aporta alquiler) del neto de sus propiedades de alquiler.
    // (Decisión del dueño 2026-06-21: cada propiedad se rinde por su cuenta.)
    const propIdsConIngreso = [...new Set(liqsCobradas.map((l) => l.contrato.propiedadId))];
    const inicioPeriodo = new Date(`${periodo}-01T00:00:00.000Z`);
    const finPeriodo = new Date(inicioPeriodo);
    finPeriodo.setUTCMonth(finPeriodo.getUTCMonth() + 1);
    const gastosPend = await prisma.movimientoCaja.findMany({
      where: {
        inmobiliariaId: u.inmobiliariaId,
        propiedadId: { in: propIdsConIngreso },
        tipo: 'GASTO',
        descontadoEnRendicion: false,
        fecha: { gte: inicioPeriodo, lt: finPeriodo },
      },
      include: { propiedad: { select: { direccion: true } } },
    });

    const comisionMonto = montoBruto * (owner.comisionPct / 100);
    let totalGastos = 0;
    const gastosData = gastosPend.map((g) => {
      const part = owner.participaciones.find((p) => p.propiedadId === g.propiedadId);
      const porcentaje = part?.porcentaje ?? 100;
      const parteOwner = Number(g.monto) * (porcentaje / 100);
      totalGastos += parteOwner;
      return {
        inmobiliariaId: u.inmobiliariaId,
        refId: g.id,
        tipo: 'CAJA' as const,
        fecha: g.fecha,
        descripcion: g.descripcion,
        proveedor: g.proveedor,
        monto: parteOwner,
        montoTotal: g.monto,
        participacion: porcentaje,
        propiedadId: g.propiedadId,
        direccion: g.propiedad.direccion,
      };
    });
    const montoNeto = montoBruto - comisionMonto - totalGastos;
    // Si los gastos adelantados + comisión superan lo cobrado, el neto daría
    // negativo (el propietario "debería" plata). No emitimos una rendición
    // negativa: el operador tiene que resolverlo a mano (cobrar primero o ajustar).
    if (montoNeto < 0) {
      return reply.code(409).send({
        message: 'Los gastos adelantados y la comisión superan lo cobrado este período. Revisá los gastos antes de rendir.',
      });
    }

    // Transacción: crear rendición + snapshots + marcar gastos DESCONTADOS.
    // El updateMany de gastos es un LOCK condicionado (WHERE descontadoEnRendicion
    // =false): si otra rendición concurrente ya tomó alguno, el count no cuadra y
    // abortamos toda la transacción (antes dos rendiciones simultáneas podían
    // descontar el mismo gasto dos veces).
    let rendicion;
    try {
      rendicion = await prisma.$transaction(async (tx) => {
        const r = await tx.rendicion.create({
          data: {
            inmobiliariaId: u.inmobiliariaId,
            propietarioId,
            periodo,
            montoBruto,
            comisionPct: owner.comisionPct,
            comisionMonto,
            totalGastos,
            montoNeto,
            metodo: body.data.metodo,
            notas: body.data.notas,
          },
        });
        // Registramos cuánto ALQUILER se rindió de cada liquidación en ESTA tanda.
        // La próxima rendición del período resta estas filas → no doble-rinde.
        if (alquilerData.length > 0) {
          await tx.alquilerRendido.createMany({
            data: alquilerData.map((a) => ({ ...a, rendicionId: r.id })),
          });
        }
        if (gastosData.length > 0) {
          // Cobranza compartida (propiedad con varios dueños): cada gasto se rinde
          // por PARTES (cada dueño descuenta su participación). Sumamos lo ya
          // rendido por OTROS dueños y marcamos el gasto como descontado-total SOLO
          // cuando las partes cubren el monto completo. Antes se marcaba entero tras
          // la primera parte → en propiedades multi-dueño el resto de los dueños
          // nunca recibía su descuento y la inmobiliaria absorbía la diferencia.
          const ids = gastosPend.map((g) => g.id);
          const previas = await tx.gastoRendido.groupBy({
            by: ['refId'],
            where: { refId: { in: ids }, tipo: 'CAJA' },
            _sum: { monto: true },
          });
          const yaRendido = new Map(previas.map((p) => [p.refId, Number(p._sum.monto ?? 0)]));
          await tx.gastoRendido.createMany({ data: gastosData.map((g) => ({ ...g, rendicionId: r.id })) });
          // El gasto queda descontado-total cuando (lo ya rendido + esta parte)
          // cubre el monto completo; si no, sigue PENDIENTE para los demás dueños.
          const idsCompletos = gastosData
            .filter((g) => (yaRendido.get(g.refId) ?? 0) + Number(g.monto) >= Number(g.montoTotal) - 0.01)
            .map((g) => g.refId);
          if (idsCompletos.length > 0) {
            await tx.movimientoCaja.updateMany({
              where: { id: { in: idsCompletos }, descontadoEnRendicion: false },
              data: { descontadoEnRendicion: true, rendicionId: r.id },
            });
          }
        }
        return r;
      });
    } catch (e) {
      // Ya no hay unique (propietarioId, periodo): la rendición es incremental y el
      // anti-doble se hace por lo ya rendido de cada liquidación (AlquilerRendido) +
      // el updateMany condicionado de gastos. Si algo choca, propagamos el error.
      throw e;
    }

    await registrarEvento({
      inmobiliariaId: u.inmobiliariaId,
      tipo: 'PROPIETARIO_RENDIDO',
      autorId: u.userId,
      rolAutor: u.rol,
      entidadId: rendicion.id,
      entidadDescripcion: `Rendición ${body.data.periodo} a propietario ${body.data.propietarioId} · neto $${Number(rendicion.montoNeto)}`,
    });
    return reply.code(201).send(rendicion);
  });

  // Anular/deshacer una rendición: la borra y deja los gastos otra vez PENDIENTES
  // para la próxima. No se movió plata real (la rendición es un registro), así que
  // es reversible. Requiere PIN, igual que rendir.
  app.post('/rendiciones/:id/anular', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'rendicion.confirmar');
    if (!u) return;
    const { id } = request.params as { id: string };
    const body = z.object({ pin: z.string().optional() }).parse(request.body ?? {});
    if (!(await verificarPin(u.userId, body.pin, reply))) return;
    const r = await prisma.rendicion.findFirst({ where: { id, inmobiliariaId: u.inmobiliariaId } });
    if (!r) return reply.code(404).send({ message: 'Rendición inexistente' });
    try {
      await prisma.$transaction(async (tx) => {
        // H-3: inmobiliariaId en los deletes/updates para que un id ajeno no opere
        // cross-tenant aunque la verificación previa ya lo garantice por FK.
        await tx.movimientoCaja.updateMany({ where: { rendicionId: id, inmobiliariaId: u.inmobiliariaId }, data: { descontadoEnRendicion: false, rendicionId: null } });
        await tx.gastoRendido.deleteMany({ where: { rendicionId: id } });
        // Lock atómico: el deleteMany condicionado es el lock. Dos anulaciones
        // concurrentes pasan el findFirst de arriba a la vez; sólo la primera
        // borra la fila (count 1), la segunda ve count 0 → 409 (antes daba 404
        // por el P2025 de rendicion.delete sobre una fila ya borrada).
        const del = await tx.rendicion.deleteMany({ where: { id, inmobiliariaId: u.inmobiliariaId } });
        if (del.count === 0) throw new Error('YA_ANULADA');
      });
    } catch (e) {
      if (e instanceof Error && e.message === 'YA_ANULADA') {
        return reply.code(409).send({ message: 'La rendición ya fue anulada' });
      }
      throw e;
    }
    return { ok: true };
  });

  // ===== Aprobaciones (no-monetarias, con PIN) =====
  app.get('/aprobaciones', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'contratos.ver');
    if (!u) return;
    return prisma.aprobacion.findMany({
      where: { inmobiliariaId: u.inmobiliariaId },
      include: { cargadoPor: { select: { nombre: true, apellido: true, rol: true } } },
      orderBy: { cargadoAt: 'desc' },
    });
  });

  for (const accion of ['aprobar', 'rechazar'] as const) {
    app.post(`/aprobaciones/:id/${accion}`, async (request, reply) => {
      const u = await requireUsuario(request, reply, 'contrato.aprobar');
      if (!u) return;
      const { id } = request.params as { id: string };
      const body = z
        .object({ pin: z.string().optional(), comentario: z.string().optional() })
        .parse(request.body ?? {});
      if (accion === 'rechazar' && !(body.comentario && body.comentario.trim().length >= 5)) {
        return reply.code(400).send({ message: 'Indicá el motivo del rechazo (mínimo 5 caracteres)' });
      }
      if (!(await verificarPin(u.userId, body.pin, reply))) return;

      // TODO atómico en una sola transacción: el updateMany condicionado por
      // estado='PENDIENTE' es el lock (solo la primera request gana), y la
      // activación del contrato + devengo van en la MISMA tx. Antes el update de
      // la aprobación y el del contrato eran awaits sueltos: si el segundo fallaba
      // (P2025, contrato borrado), la aprobación quedaba decidida pero el contrato
      // sin activar (commit parcial + falso error), y dos requests concurrentes
      // pasaban ambas el pre-check.
      const result = await prisma.$transaction(async (tx) => {
        const apr = await tx.aprobacion.findFirst({ where: { id, inmobiliariaId: u.inmobiliariaId } });
        if (!apr) return { http: 404 as const };
        const lock = await tx.aprobacion.updateMany({
          where: { id, inmobiliariaId: u.inmobiliariaId, estado: 'PENDIENTE' },
          data: {
            estado: accion === 'aprobar' ? 'APROBADA' : 'RECHAZADA',
            aprobadoPorId: u.userId,
            aprobadoAt: new Date(),
            comentarioAprobador: body.comentario,
          },
        });
        if (lock.count === 0) return { http: 409 as const };
        // Si es un contrato cargado, al aprobar pasa a ACTIVO / al rechazar queda BORRADOR sin pendiente.
        // H-4: updateMany con inmobiliariaId para defensa en profundidad (apr ya
        // está scoped pero el contrato.update usaría sólo el PK sin esa garantía).
        if (apr.tipo === 'CONTRATO_CARGADO') {
          await tx.contrato.updateMany({
            where: { id: apr.entidadId, inmobiliariaId: u.inmobiliariaId },
            data:
              accion === 'aprobar'
                ? { estado: 'ACTIVO', pendienteAprobacion: false, aprobadoAt: new Date() }
                : { pendienteAprobacion: false },
          });
          // Al aprobar, el contrato se activa → reclamar la propiedad + devengar
          // sus liquidaciones, IGUAL que POST /contratos (core.ts). Antes este path
          // activaba el contrato pero NUNCA reclamaba la propiedad: quedaba
          // DISPONIBLE para siempre y dos BORRADOR sobre la misma propiedad (p.ej.
          // cnt_006 + cnt_008) podían activarse ambos. El claim atómico
          // (WHERE contratoActualId=null) es a la vez la corrección (propiedad→
          // ALQUILADA) y el lock anti-doble-activación.
          if (accion === 'aprobar') {
            const contratoActualizado = await tx.contrato.findUniqueOrThrow({ where: { id: apr.entidadId } });
            const claim = await tx.propiedad.updateMany({
              where: { id: contratoActualizado.propiedadId, inmobiliariaId: u.inmobiliariaId, contratoActualId: null },
              data: { contratoActualId: contratoActualizado.id, estado: 'ALQUILADA' },
            });
            if (claim.count === 0) throw new Error('PROP_OCUPADA');
            await generarLiquidacionesContrato(tx, contratoActualizado);
          }
          if (accion === 'rechazar') {
            // El borrador rechazado se descarta: borramos el inquilino que se creó
            // para él. Si no, su email queda tomado (@@unique [inmobiliariaId,email])
            // y bloquea para siempre volver a cargar un contrato con ese inquilino.
            // El contrato queda BORRADOR-rechazado (inquilinoTitular pasa a null, ya
            // manejado por los mappers); no genera liquidaciones ni reclamó propiedad.
            // Antes de borrar el inquilino hay que borrar sus hijos con FK requerida
            // (sin onDelete → Restrict por default): CodigoOtp / AnuncioAcuse /
            // Documento / CertificadoInquilino. Si el inquilino abrió la PWA y pidió
            // un OTP (crea un CodigoOtp), el deleteMany tiraría P2003 → rollback → la
            // aprobación volvía a PENDIENTE y no se podía rechazar nunca más.
            const inqs = await tx.inquilino.findMany({
              where: { contratoId: apr.entidadId, inmobiliariaId: u.inmobiliariaId },
              select: { id: true },
            });
            const inqIds = inqs.map((i) => i.id);
            if (inqIds.length > 0) {
              await tx.codigoOtp.deleteMany({ where: { inquilinoId: { in: inqIds } } });
              await tx.anuncioAcuse.deleteMany({ where: { inquilinoId: { in: inqIds } } });
              await tx.documento.deleteMany({ where: { inquilinoId: { in: inqIds } } });
              await tx.certificadoInquilino.deleteMany({ where: { inquilinoId: { in: inqIds } } });
              await tx.inquilino.deleteMany({ where: { id: { in: inqIds } } });
            }
          }
        }
        // Mismo shape que GET /aprobaciones: el front mapea cargadoPor.nombre.
        const updated = await tx.aprobacion.findUniqueOrThrow({
          where: { id },
          include: { cargadoPor: { select: { nombre: true, apellido: true, rol: true } } },
        });
        return { http: 200 as const, updated };
      }).catch((e: unknown) => {
        // PROP_OCUPADA: al aprobar, la propiedad ya fue reclamada por otro contrato
        // (carrera o un segundo BORRADOR sobre la misma propiedad). El throw hizo
        // rollback TOTAL → la aprobación vuelve a PENDIENTE. Lo mapeamos a 409 acá
        // porque el handler global no mapea un Error genérico (caería en 500).
        if (e instanceof Error && e.message === 'PROP_OCUPADA') return { http: 409 as const, motivo: 'PROP_OCUPADA' as const };
        throw e;
      });
      if (result.http === 404) return reply.code(404).send({ message: 'Aprobación inexistente' });
      if (result.http === 409) {
        return reply
          .code(409)
          .send({ message: 'motivo' in result ? 'La propiedad ya tiene un contrato activo' : 'Ya fue decidida' });
      }
      if (result.updated.tipo === 'CONTRATO_CARGADO') {
        await registrarEvento({
          inmobiliariaId: u.inmobiliariaId,
          tipo: accion === 'aprobar' ? 'CONTRATO_APROBADO' : 'CONTRATO_RECHAZADO',
          autorId: u.userId,
          rolAutor: u.rol,
          entidadId: result.updated.entidadId,
          entidadDescripcion: result.updated.titulo,
        });
        // Al APROBAR, el contrato pasa a ACTIVO → recién ahí le mandamos al
        // inquilino el email de bienvenida/onboarding (los contratos cargados por
        // rol CARGA nacen BORRADOR y no lo reciben en POST /contratos). Best-effort.
        if (accion === 'aprobar') {
          try {
            const contrato = await prisma.contrato.findUnique({
              where: { id: result.updated.entidadId },
              select: {
                propiedad: { select: { direccion: true } },
                inquilinoTitular: { select: { nombre: true, email: true } },
                inmobiliaria: {
                  select: {
                    nombre: true,
                    email: true,
                    telefono: true,
                    direccionCalle: true,
                    direccionAltura: true,
                    direccionCiudad: true,
                    direccionProvincia: true,
                  },
                },
              },
            });
            const inq = contrato?.inquilinoTitular;
            if (inq?.email && contrato?.inmobiliaria) {
              const inmo = contrato.inmobiliaria;
              const direccionInmo = [
                `${inmo.direccionCalle} ${inmo.direccionAltura}`.trim(),
                inmo.direccionCiudad,
                inmo.direccionProvincia,
              ]
                .filter((p) => p && p.trim())
                .join(', ');
              const enviado = await enviarInvitacionInquilino({
                email: inq.email,
                inquilinoNombre: inq.nombre,
                inmobiliaria: {
                  nombre: inmo.nombre,
                  telefono: inmo.telefono,
                  email: inmo.email,
                  direccion: direccionInmo || null,
                },
                propiedadDireccion: contrato.propiedad?.direccion ?? null,
              });
              if (enviado) request.log.info({ email: inq.email }, 'Invitación de inquilino enviada (aprobación)');
            }
          } catch (err) {
            request.log.error(
              { err: (err as Error).message },
              'Invitación de inquilino (aprobación): fallo el envío (no bloquea)',
            );
          }
        }
      }
      return result.updated;
    });
  }
}
