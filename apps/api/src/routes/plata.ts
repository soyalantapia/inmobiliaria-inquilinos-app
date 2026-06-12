import type { FastifyInstance, FastifyReply } from 'fastify';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireInquilino, requireUsuario } from '../auth/guards.js';

/**
 * Fase 3 — La plata: liquidaciones, validación de pagos informados, caja de
 * gastos, rendiciones (que CONSUMEN los gastos y los marcan descontados — el
 * loop que en el front mock quedaba huérfano) y aprobaciones con PIN.
 */

async function verificarPin(userId: string, pin: string | undefined, reply: FastifyReply): Promise<boolean> {
  if (!pin) {
    await reply.code(400).send({ message: 'Esta acción requiere tu PIN de seguridad' });
    return false;
  }
  const u = await prisma.usuario.findUnique({ where: { id: userId } });
  if (!u?.pinHash || !bcrypt.compareSync(pin, u.pinHash)) {
    await reply.code(403).send({ message: 'PIN incorrecto' });
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
    return prisma.liquidacion.findMany({
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

    const pago = await prisma.pago.findFirst({ where: { id, inmobiliariaId: u.inmobiliariaId } });
    if (!pago) return reply.code(404).send({ message: 'Pago inexistente' });
    if (pago.estado !== 'INFORMADO') return reply.code(409).send({ message: 'El pago ya fue decidido' });

    const [pagoOk] = await prisma.$transaction([
      prisma.pago.update({
        where: { id },
        data: { estado: 'CONCILIADO', decididoPorId: u.userId, decididoAt: new Date() },
      }),
      prisma.liquidacion.update({
        where: { id: pago.liquidacionId },
        data: { estado: 'PAGADO', fechaPago: pago.fechaTransferencia, metodoPago: 'TRANSFERENCIA' },
      }),
    ]);
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

    return prisma.pago.update({
      where: { id },
      data: { estado: 'RECHAZADO', observacion: body.data.observacion, decididoPorId: u.userId, decididoAt: new Date() },
    });
  });

  // Inquilino informa un pago sobre su liquidación
  app.post('/pagos/informar', async (request, reply) => {
    const inq = await requireInquilino(request, reply);
    if (!inq) return;
    if (!inq.contratoId) return reply.code(400).send({ message: 'No tenés un contrato activo' });
    const body = z
      .object({
        liquidacionId: z.string(),
        monto: z.number().positive(),
        metodo: z.enum(['TRANSFERENCIA', 'MERCADOPAGO', 'EFECTIVO', 'CHEQUE']),
        nroOperacion: z.string().optional(),
        fechaTransferencia: z.string(),
        nota: z.string().optional(),
      })
      .safeParse(request.body ?? {});
    if (!body.success) return reply.code(400).send({ message: 'Datos del pago incompletos' });

    const liq = await prisma.liquidacion.findFirst({
      where: { id: body.data.liquidacionId, contratoId: inq.contratoId },
    });
    if (!liq) return reply.code(404).send({ message: 'Liquidación inexistente' });
    if (liq.estado === 'PAGADO') return reply.code(409).send({ message: 'Esta liquidación ya está paga' });

    return prisma.pago.create({
      data: {
        inmobiliariaId: inq.inmobiliariaId,
        contratoId: inq.contratoId,
        liquidacionId: liq.id,
        periodo: liq.periodo,
        tipo: Number(liq.montoTotal) === body.data.monto ? 'TOTAL' : 'PARCIAL',
        monto: body.data.monto,
        montoLiqTotal: liq.montoTotal,
        metodo: body.data.metodo,
        nroOperacion: body.data.nroOperacion,
        fechaTransferencia: new Date(body.data.fechaTransferencia),
        notaInquilino: body.data.nota,
      },
    });
  });

  // Liquidaciones del inquilino logueado (para informar pagos / comprobantes)
  app.get('/mis-liquidaciones', async (request, reply) => {
    const inq = await requireInquilino(request, reply);
    if (!inq) return;
    if (!inq.contratoId) return [];
    return prisma.liquidacion.findMany({
      where: { contratoId: inq.contratoId },
      orderBy: { periodo: 'desc' },
    });
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
        fecha: z.string(),
        proveedor: z.string().optional(),
      })
      .safeParse(request.body ?? {});
    if (!body.success) return reply.code(400).send({ message: 'Datos del gasto incompletos' });

    const prop = await prisma.propiedad.findFirst({ where: { id: body.data.propiedadId, inmobiliariaId: u.inmobiliariaId } });
    if (!prop) return reply.code(404).send({ message: 'Propiedad inexistente' });
    const usuario = await prisma.usuario.findUnique({ where: { id: u.userId } });

    return prisma.movimientoCaja.create({
      data: {
        inmobiliariaId: u.inmobiliariaId,
        propiedadId: prop.id,
        contratoId: prop.contratoActualId,
        tipo: 'GASTO',
        categoria: body.data.categoria,
        descripcion: body.data.descripcion,
        monto: body.data.monto,
        fecha: new Date(body.data.fecha),
        proveedor: body.data.proveedor,
        cargadoPor: usuario ? `${usuario.nombre} ${usuario.apellido}`.trim() : 'Panel',
      },
    });
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

    const yaRendida = await prisma.rendicion.findUnique({
      where: { propietarioId_periodo: { propietarioId, periodo } },
    });
    if (yaRendida) return reply.code(409).send({ message: `El período ${periodo} ya está rendido a este propietario` });

    // Bruto: liquidaciones PAGADAS del período de los contratos de sus propiedades × participación
    let montoBruto = 0;
    const propIds = owner.participaciones.map((p) => p.propiedadId);
    const liqsPagadas = await prisma.liquidacion.findMany({
      where: {
        inmobiliariaId: u.inmobiliariaId,
        periodo,
        estado: 'PAGADO',
        contrato: { propiedadId: { in: propIds }, modoCobranza: 'INMOBILIARIA' },
      },
      include: { contrato: { select: { propiedadId: true } } },
    });
    for (const liq of liqsPagadas) {
      const part = owner.participaciones.find((p) => p.propiedadId === liq.contrato.propiedadId);
      montoBruto += Number(liq.montoTotal) * ((part?.porcentaje ?? 100) / 100);
    }
    if (montoBruto === 0) return reply.code(409).send({ message: `No hay cobros del período ${periodo} para rendir` });

    // Gastos pendientes de sus propiedades × participación
    const gastosPend = await prisma.movimientoCaja.findMany({
      where: { inmobiliariaId: u.inmobiliariaId, propiedadId: { in: propIds }, tipo: 'GASTO', descontadoEnRendicion: false },
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

    // Transacción: crear rendición + snapshots + marcar gastos DESCONTADOS
    const rendicion = await prisma.$transaction(async (tx) => {
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
      if (gastosData.length > 0) {
        await tx.gastoRendido.createMany({ data: gastosData.map((g) => ({ ...g, rendicionId: r.id })) });
        await tx.movimientoCaja.updateMany({
          where: { id: { in: gastosPend.map((g) => g.id) } },
          data: { descontadoEnRendicion: true, rendicionId: r.id },
        });
      }
      return r;
    });

    return reply.code(201).send(rendicion);
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

      const apr = await prisma.aprobacion.findFirst({ where: { id, inmobiliariaId: u.inmobiliariaId } });
      if (!apr) return reply.code(404).send({ message: 'Aprobación inexistente' });
      if (apr.estado !== 'PENDIENTE') return reply.code(409).send({ message: 'Ya fue decidida' });

      const updated = await prisma.aprobacion.update({
        where: { id },
        data: {
          estado: accion === 'aprobar' ? 'APROBADA' : 'RECHAZADA',
          aprobadoPorId: u.userId,
          aprobadoAt: new Date(),
          comentarioAprobador: body.comentario,
        },
      });
      // Si es un contrato cargado, al aprobar pasa a ACTIVO / al rechazar queda BORRADOR sin pendiente
      if (apr.tipo === 'CONTRATO_CARGADO') {
        await prisma.contrato.update({
          where: { id: apr.entidadId },
          data:
            accion === 'aprobar'
              ? { estado: 'ACTIVO', pendienteAprobacion: false, aprobadoAt: new Date() }
              : { pendienteAprobacion: false },
        });
      }
      return updated;
    });
  }
}
