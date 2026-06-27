import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireInquilino, requireUsuario } from '../auth/guards.js';
import { verificarPinUsuario } from '../auth/pin.js';

/**
 * Fase 4 — Operación: reclamos con SLA calculado en el server, asignación de
 * profesionales, reclamos del inquilino, red de profesionales, consorcios y
 * renovaciones (intención por contrato activo).
 */

// ===== SLA por urgencia (portado de apps/inmobiliaria/src/lib/sla-reclamos.ts) =====
//
// Reglas del feedback: "necesito que el sistema me avise cuando un reclamo se
// está pasando del tiempo razonable para resolver".
//   - EMERGENCIA → 6h · ALTA → 24h · MEDIA → 72h · BAJA → 168h (7 días)
// El estado se calcula contra createdAt y se desactiva si el reclamo ya está
// RESUELTO o CERRADO.

type UrgenciaReclamoSla = 'BAJA' | 'MEDIA' | 'ALTA' | 'EMERGENCIA';
type EstadoReclamoSla = 'ABIERTO' | 'EN_CURSO' | 'RESUELTO' | 'CERRADO' | 'RECHAZADO';
type EstadoSla = 'EN_TIEMPO' | 'PROXIMO_VENCIMIENTO' | 'VENCIDO' | 'RESUELTO';

const SLA_HORAS_POR_URGENCIA: Record<UrgenciaReclamoSla, number> = {
  EMERGENCIA: 6,
  ALTA: 24,
  MEDIA: 72,
  BAJA: 168, // 7 días
};

interface ReclamoParaSla {
  urgencia: UrgenciaReclamoSla;
  estado: EstadoReclamoSla;
  createdAt: Date;
  resueltoAt: Date | null;
}

interface ResumenSla {
  slaEstado: EstadoSla;
  /** Fecha límite para resolver (createdAt + horas del SLA), ISO. */
  slaVencimiento: string;
  slaHorasTranscurridas: number;
  slaHorasLimite: number;
  /** Horas restantes — negativo si ya pasó. */
  slaHorasRestantes: number;
  /** Porcentaje del SLA consumido (0-100+). */
  slaPctConsumido: number;
  /** Frase humana para mostrar. */
  slaTexto: string;
  /** Si conviene mandar alerta (a más del 80%). */
  slaAlertar: boolean;
}

function formatHoras(h: number): string {
  if (h < 1) return `${Math.round(h * 60)}m`;
  if (h < 24) return `${Math.round(h)}h`;
  const dias = h / 24;
  return `${dias.toFixed(dias < 10 ? 1 : 0)}d`;
}

function evaluarSla(reclamo: ReclamoParaSla, ahoraMs = Date.now()): ResumenSla {
  const limite = SLA_HORAS_POR_URGENCIA[reclamo.urgencia];
  const creado = reclamo.createdAt.getTime();

  // Reclamo reabierto por el inquilino (PERSISTE): vuelve a un estado activo
  // conservando resueltoAt como ancla. El reloj del SLA reinicia desde la
  // reapertura —si midiéramos desde createdAt, un reclamo viejo reaparecería
  // como VENCIDO apenas se reabre. Para estados resueltos `inicio` = createdAt.
  const reabierto =
    reclamo.estado !== 'RESUELTO' && reclamo.estado !== 'CERRADO' && reclamo.resueltoAt !== null;
  const inicio = reabierto ? reclamo.resueltoAt!.getTime() : creado;

  const slaVencimiento = new Date(inicio + limite * 3600_000).toISOString();
  const horas = Math.max(0, (ahoraMs - inicio) / 3600_000);
  const restantes = limite - horas;
  const pct = (horas / limite) * 100;

  // RECHAZADO también es terminal: antes caía al check de VENCIDO de abajo y
  // mostraba un SLA atrasado + alerta en falso para un reclamo ya cerrado.
  if (reclamo.estado === 'RESUELTO' || reclamo.estado === 'CERRADO' || reclamo.estado === 'RECHAZADO') {
    const rechazado = reclamo.estado === 'RECHAZADO';
    const dur = reclamo.resueltoAt
      ? Math.max(0, (reclamo.resueltoAt.getTime() - creado) / 3600_000)
      : horas;
    return {
      slaEstado: 'RESUELTO',
      slaVencimiento,
      slaHorasTranscurridas: dur,
      slaHorasLimite: limite,
      slaHorasRestantes: limite - dur,
      slaPctConsumido: (dur / limite) * 100,
      slaTexto: rechazado
        ? 'Reclamo rechazado.'
        : dur <= limite
          ? `Resuelto en ${formatHoras(dur)}, dentro del plazo (${formatHoras(limite)}).`
          : `Resuelto en ${formatHoras(dur)}, ${formatHoras(dur - limite)} más que el plazo.`,
      slaAlertar: false,
    };
  }

  if (restantes < 0) {
    return {
      slaEstado: 'VENCIDO',
      slaVencimiento,
      slaHorasTranscurridas: horas,
      slaHorasLimite: limite,
      slaHorasRestantes: restantes,
      slaPctConsumido: pct,
      slaTexto: `Atrasado hace ${formatHoras(-restantes)} (el plazo para resolver era ${formatHoras(limite)}).`,
      slaAlertar: true,
    };
  }

  if (pct >= 80) {
    return {
      slaEstado: 'PROXIMO_VENCIMIENTO',
      slaVencimiento,
      slaHorasTranscurridas: horas,
      slaHorasLimite: limite,
      slaHorasRestantes: restantes,
      slaPctConsumido: pct,
      slaTexto: `Faltan ${formatHoras(restantes)} para cumplir el plazo.`,
      slaAlertar: true,
    };
  }

  return {
    slaEstado: 'EN_TIEMPO',
    slaVencimiento,
    slaHorasTranscurridas: horas,
    slaHorasLimite: limite,
    slaHorasRestantes: restantes,
    slaPctConsumido: pct,
    slaTexto: `${Math.round(pct)}% del plazo consumido.`,
    slaAlertar: false,
  };
}

/** Adjunta el SLA calculado a un reclamo (cualquier shape que tenga los campos base). */
function conSla<T extends ReclamoParaSla>(reclamo: T): T & ResumenSla {
  return { ...reclamo, ...evaluarSla(reclamo) };
}

// Mismo helper que plata.ts: acciones sensibles piden el PIN del usuario.
// Delega en verificarPinUsuario (auth/pin.ts) → bloqueo anti-fuerza-bruta.
async function verificarPin(userId: string, pin: string | undefined, reply: FastifyReply): Promise<boolean> {
  const r = await verificarPinUsuario(userId, pin);
  if (!r.ok) {
    await reply.code(r.code).send({ message: r.message });
    return false;
  }
  return true;
}

async function nombreUsuario(userId: string): Promise<string> {
  const usuario = await prisma.usuario.findUnique({ where: { id: userId } });
  return usuario ? `${usuario.nombre} ${usuario.apellido}`.trim() : 'Panel';
}

const ESTADOS_CERRADOS = ['RESUELTO', 'CERRADO', 'RECHAZADO'] as const;

// Señal interna para abortar una transacción cuando el reclamo ya cambió de
// estado (carrera): se traduce a 409 en el handler. Evita el doble-cierre y el
// crédito/registro duplicado si dos requests confirman a la vez.
class ConflictoEstadoReclamo extends Error {}

export async function operacionRoutes(app: FastifyInstance) {
  // ===== Reclamos (panel) =====
  app.get('/reclamos', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'reclamos.ver');
    if (!u) return;
    const q = z
      .object({
        estado: z.enum(['ABIERTO', 'EN_CURSO', 'RESUELTO', 'CERRADO', 'RECHAZADO']).optional(),
        urgencia: z.enum(['BAJA', 'MEDIA', 'ALTA', 'EMERGENCIA']).optional(),
      })
      .parse(request.query ?? {});
    const reclamos = await prisma.reclamo.findMany({
      where: {
        inmobiliariaId: u.inmobiliariaId,
        ...(q.estado ? { estado: q.estado } : {}),
        ...(q.urgencia ? { urgencia: q.urgencia } : {}),
      },
      include: {
        propiedad: { select: { id: true, direccion: true, ciudad: true } },
        contrato: {
          select: {
            id: true,
            inquilinoTitular: { select: { id: true, nombre: true, apellido: true, telefono: true } },
          },
        },
        profesional: { select: { id: true, nombre: true, categoria: true, telefono: true, rating: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return reclamos.map(conSla);
  });

  app.get('/reclamos/:id', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'reclamos.ver');
    if (!u) return;
    const { id } = request.params as { id: string };
    const reclamo = await prisma.reclamo.findFirst({
      where: { id, inmobiliariaId: u.inmobiliariaId },
      include: {
        propiedad: { select: { id: true, direccion: true, ciudad: true } },
        contrato: {
          select: {
            id: true,
            inquilinoTitular: { select: { id: true, nombre: true, apellido: true, telefono: true, email: true } },
          },
        },
        profesional: true,
        eventos: { orderBy: { fecha: 'asc' } },
        visita: true,
        confirmacion: true,
        rating: true,
      },
    });
    if (!reclamo) return reply.code(404).send({ message: 'Reclamo inexistente' });
    return conSla(reclamo);
  });

  app.post('/reclamos/:id/asignar', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'profesional.asignar');
    if (!u) return;
    const { id } = request.params as { id: string };
    const body = z.object({ profesionalId: z.string().min(1) }).safeParse(request.body ?? {});
    if (!body.success) return reply.code(400).send({ message: 'Indicá qué profesional querés asignar' });

    const reclamo = await prisma.reclamo.findFirst({ where: { id, inmobiliariaId: u.inmobiliariaId } });
    if (!reclamo) return reply.code(404).send({ message: 'Reclamo inexistente' });
    if ((ESTADOS_CERRADOS as readonly string[]).includes(reclamo.estado)) {
      return reply.code(409).send({ message: 'El reclamo ya está cerrado — no se puede asignar profesional' });
    }
    const prof = await prisma.profesional.findFirst({
      where: { id: body.data.profesionalId, inmobiliariaId: u.inmobiliariaId, activo: true },
    });
    if (!prof) return reply.code(404).send({ message: 'Profesional inexistente o dado de baja' });

    const autor = await nombreUsuario(u.userId);
    try {
      const actualizado = await prisma.$transaction(async (tx) => {
        // Lock atómico (igual que resolver/rechazar): si un resolver/rechazar
        // concurrente cerró el reclamo entre el pre-check y acá, count=0 → 409.
        // Antes el update incondicional asignaba un profesional a un reclamo cerrado.
        const res = await tx.reclamo.updateMany({
          where: { id, estado: { notIn: [...ESTADOS_CERRADOS] } },
          data: { profesionalId: prof.id },
        });
        if (res.count === 0) throw new ConflictoEstadoReclamo('El reclamo ya está cerrado — no se puede asignar profesional');
        await tx.reclamoEvento.create({
          data: {
            inmobiliariaId: u.inmobiliariaId,
            reclamoId: id,
            tipo: 'PROFESIONAL_ASIGNADO',
            autor,
            contenido: `${prof.nombre} (${prof.categoria})`,
          },
        });
        return tx.reclamo.findUniqueOrThrow({ where: { id } });
      });
      return conSla(actualizado);
    } catch (e) {
      if (e instanceof ConflictoEstadoReclamo) return reply.code(409).send({ message: e.message });
      throw e;
    }
  });

  app.post('/reclamos/:id/resolver', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'reclamos.gestionar');
    if (!u) return;
    const { id } = request.params as { id: string };
    const body = z.object({ resolucion: z.string().min(5) }).safeParse(request.body ?? {});
    if (!body.success) return reply.code(400).send({ message: 'Contá cómo se resolvió (mínimo 5 caracteres)' });

    const reclamo = await prisma.reclamo.findFirst({ where: { id, inmobiliariaId: u.inmobiliariaId } });
    if (!reclamo) return reply.code(404).send({ message: 'Reclamo inexistente' });

    const ahora = new Date();
    const autor = await nombreUsuario(u.userId);
    try {
      const actualizado = await prisma.$transaction(async (tx) => {
        // Lock por estado: si otra request ya lo cerró/rechazó/resolvió, count=0 →
        // abortamos. Antes el update era incondicional: resolver y rechazar
        // concurrentes podían commitear ambos y dejar el timeline con eventos
        // contradictorios.
        const res = await tx.reclamo.updateMany({
          where: { id, estado: { notIn: [...ESTADOS_CERRADOS] } },
          data: { estado: 'RESUELTO', resolucion: body.data.resolucion, resueltoAt: ahora },
        });
        if (res.count === 0) throw new ConflictoEstadoReclamo('El reclamo ya fue decidido');
        await tx.reclamoEvento.create({
          data: {
            inmobiliariaId: u.inmobiliariaId,
            reclamoId: id,
            tipo: 'RESUELTO',
            autor,
            contenido: body.data.resolucion,
            fecha: ahora,
          },
        });
        return tx.reclamo.findUniqueOrThrow({ where: { id } });
      });
      return conSla(actualizado);
    } catch (e) {
      if (e instanceof ConflictoEstadoReclamo) return reply.code(409).send({ message: e.message });
      throw e;
    }
  });

  app.post('/reclamos/:id/rechazar', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'reclamos.gestionar');
    if (!u) return;
    const { id } = request.params as { id: string };
    const body = z.object({ motivo: z.string().min(5) }).safeParse(request.body ?? {});
    if (!body.success) return reply.code(400).send({ message: 'Contale al inquilino por qué se rechaza (mínimo 5 caracteres)' });

    const reclamo = await prisma.reclamo.findFirst({ where: { id, inmobiliariaId: u.inmobiliariaId } });
    if (!reclamo) return reply.code(404).send({ message: 'Reclamo inexistente' });

    const autor = await nombreUsuario(u.userId);
    try {
      const actualizado = await prisma.$transaction(async (tx) => {
        const res = await tx.reclamo.updateMany({
          where: { id, estado: { notIn: [...ESTADOS_CERRADOS] } },
          data: { estado: 'RECHAZADO', resolucion: body.data.motivo },
        });
        if (res.count === 0) throw new ConflictoEstadoReclamo('El reclamo ya fue decidido');
        await tx.reclamoEvento.create({
          data: { inmobiliariaId: u.inmobiliariaId, reclamoId: id, tipo: 'RECHAZADO', autor, contenido: body.data.motivo },
        });
        return tx.reclamo.findUniqueOrThrow({ where: { id } });
      });
      return conSla(actualizado);
    } catch (e) {
      if (e instanceof ConflictoEstadoReclamo) return reply.code(409).send({ message: e.message });
      throw e;
    }
  });

  app.post('/reclamos/:id/responder', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'reclamos.gestionar');
    if (!u) return;
    const { id } = request.params as { id: string };
    const body = z.object({ mensaje: z.string().min(1) }).safeParse(request.body ?? {});
    if (!body.success) return reply.code(400).send({ message: 'Escribí el mensaje para el inquilino' });

    const reclamo = await prisma.reclamo.findFirst({ where: { id, inmobiliariaId: u.inmobiliariaId } });
    if (!reclamo) return reply.code(404).send({ message: 'Reclamo inexistente' });

    const autor = await nombreUsuario(u.userId);
    return prisma.reclamoEvento.create({
      data: { inmobiliariaId: u.inmobiliariaId, reclamoId: id, tipo: 'MENSAJE_INMO', autor, contenido: body.data.mensaje },
    });
  });

  // ===== Reclamos del inquilino =====
  app.get('/mis-reclamos', async (request, reply) => {
    const inq = await requireInquilino(request, reply);
    if (!inq) return;
    if (!inq.contratoId) return [];
    const reclamos = await prisma.reclamo.findMany({
      where: { contratoId: inq.contratoId, inmobiliariaId: inq.inmobiliariaId },
      include: {
        eventos: { orderBy: { fecha: 'asc' } },
        profesional: { select: { id: true, nombre: true, telefono: true, categoria: true } },
        confirmacion: { select: { estado: true, fecha: true, comentario: true } },
        rating: { select: { estrellas: true, comentario: true, enviadoAt: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return reclamos.map(conSla);
  });

  app.post('/mis-reclamos', async (request, reply) => {
    const inq = await requireInquilino(request, reply);
    if (!inq) return;
    if (!inq.contratoId) return reply.code(400).send({ message: 'No tenés un contrato activo' });
    const body = z
      .object({
        titulo: z.string().min(3),
        descripcion: z.string().min(5),
        categoria: z.enum(['PLOMERIA', 'ELECTRICIDAD', 'CERRADURA', 'CALEFACCION', 'OTRO']),
        urgencia: z.enum(['BAJA', 'MEDIA', 'ALTA', 'EMERGENCIA']),
        // Foto REAL del problema, subida a /uploads (Railway Volume). Antes la foto
        // se elegía en el browser y nunca llegaba al backend.
        fotoUrl: z.string().optional(),
      })
      .safeParse(request.body ?? {});
    if (!body.success) return reply.code(400).send({ message: 'Datos del reclamo incompletos' });

    const contrato = await prisma.contrato.findFirst({
      where: { id: inq.contratoId, inmobiliariaId: inq.inmobiliariaId },
    });
    if (!contrato) return reply.code(404).send({ message: 'Contrato inexistente' });
    // P10: no se abren reclamos nuevos sobre un contrato finalizado/borrador (las
    // acciones sobre reclamos EXISTENTES —confirmar-resolución, rating— sí siguen).
    if (contrato.estado !== 'ACTIVO') {
      return reply.code(409).send({ message: 'El contrato ya no está activo' });
    }

    const inquilino = await prisma.inquilino.findUnique({ where: { id: inq.inquilinoId } });
    const autor = inquilino ? `${inquilino.nombre} ${inquilino.apellido ?? ''}`.trim() : 'Inquilino';

    // El modelo no tiene campo `titulo`: va como encabezado de la descripción.
    const reclamo = await prisma.$transaction(async (tx) => {
      const r = await tx.reclamo.create({
        data: {
          inmobiliariaId: inq.inmobiliariaId,
          contratoId: contrato.id,
          propiedadId: contrato.propiedadId,
          categoria: body.data.categoria,
          descripcion: `${body.data.titulo} — ${body.data.descripcion}`,
          urgencia: body.data.urgencia,
          estado: 'ABIERTO',
          fotoUrl: body.data.fotoUrl,
        },
      });
      await tx.reclamoEvento.create({
        data: { inmobiliariaId: inq.inmobiliariaId, reclamoId: r.id, tipo: 'CREADO', autor, contenido: null },
      });
      return r;
    });
    return reply.code(201).send(conSla(reclamo));
  });

  // El inquilino ratifica o rechaza el cierre que hizo la inmobiliaria. RESUELTO
  // es un estado "por confirmar": le da agencia al inquilino sobre su propio
  // reclamo (antes era espectador) y elimina la contradicción "Resuelto pero el
  // problema sigue".
  //   - CONFORME → CERRADO. Persistimos ConfirmacionReclamo (reclamoId @unique:
  //     una sola confirmación firme por reclamo) + evento CERRADO.
  //   - PERSISTE → EN_CURSO (reabre, vuelve a la cola activa del panel). NO
  //     creamos ConfirmacionReclamo —es one-shot por el @unique— para no bloquear
  //     una futura confirmación tras un nuevo intento de la inmo; queda como
  //     evento + reapertura, que es repetible.
  app.post('/mis-reclamos/:id/confirmar-resolucion', async (request, reply) => {
    const inq = await requireInquilino(request, reply);
    if (!inq) return;
    if (!inq.contratoId) return reply.code(400).send({ message: 'No tenés un contrato activo' });
    const { id } = request.params as { id: string };
    const body = z
      .object({
        decision: z.enum(['CONFORME', 'PERSISTE']),
        comentario: z.string().trim().max(500).optional(),
      })
      .safeParse(request.body ?? {});
    if (!body.success) return reply.code(400).send({ message: 'Decisión inválida' });
    const comentario = body.data.comentario?.trim() || null;
    if (body.data.decision === 'PERSISTE' && !comentario) {
      return reply.code(400).send({ message: 'Contanos qué sigue pasando' });
    }

    const reclamo = await prisma.reclamo.findFirst({
      where: { id, contratoId: inq.contratoId, inmobiliariaId: inq.inmobiliariaId },
    });
    if (!reclamo) return reply.code(404).send({ message: 'Reclamo inexistente' });
    if (reclamo.estado !== 'RESUELTO') {
      return reply.code(409).send({ message: 'Este reclamo no está esperando tu confirmación' });
    }

    const inquilino = await prisma.inquilino.findUnique({ where: { id: inq.inquilinoId } });
    const autor = inquilino ? `${inquilino.nombre} ${inquilino.apellido ?? ''}`.trim() : 'Inquilino';
    const ahora = new Date();

    try {
      const actualizado = await prisma.$transaction(async (tx) => {
        if (body.data.decision === 'CONFORME') {
          // El updateMany condicional es el lock: solo la primera request que
          // ve estado RESUELTO logra la transición; las demás cuentan 0 → 409.
          const res = await tx.reclamo.updateMany({
            where: { id, estado: 'RESUELTO' },
            data: { estado: 'CERRADO' },
          });
          if (res.count === 0) throw new ConflictoEstadoReclamo('El reclamo ya fue cerrado');
          await tx.confirmacionReclamo.create({
            data: { inmobiliariaId: inq.inmobiliariaId, reclamoId: id, estado: 'CONFORME', comentario, fecha: ahora },
          });
          await tx.reclamoEvento.create({
            data: {
              inmobiliariaId: inq.inmobiliariaId,
              reclamoId: id,
              tipo: 'CERRADO',
              autor,
              contenido: comentario ?? 'El inquilino confirmó que el problema está resuelto.',
              fecha: ahora,
            },
          });
        } else {
          // Conservamos resueltoAt: en EN_CURSO actúa como ANCLA de la reapertura
          // para que el SLA reinicie desde acá (ver evaluarSla). Si lo borráramos,
          // el SLA volvería a medir desde createdAt y el reclamo —creado hace días—
          // reaparecería como VENCIDO al instante en el panel.
          const res = await tx.reclamo.updateMany({
            where: { id, estado: 'RESUELTO' },
            data: { estado: 'EN_CURSO' },
          });
          if (res.count === 0) throw new ConflictoEstadoReclamo('El reclamo ya cambió de estado');
          await tx.reclamoEvento.create({
            data: {
              inmobiliariaId: inq.inmobiliariaId,
              reclamoId: id,
              tipo: 'MENSAJE_INQUILINO',
              autor,
              contenido: `El problema sigue: ${comentario}`,
              fecha: ahora,
            },
          });
        }
        return tx.reclamo.findUniqueOrThrow({
          where: { id },
          include: {
            eventos: { orderBy: { fecha: 'asc' } },
            profesional: { select: { id: true, nombre: true, telefono: true, categoria: true } },
            confirmacion: { select: { estado: true, fecha: true, comentario: true } },
            rating: { select: { estrellas: true, comentario: true, enviadoAt: true } },
          },
        });
      });
      return conSla(actualizado);
    } catch (e) {
      if (e instanceof ConflictoEstadoReclamo) return reply.code(409).send({ message: e.message });
      throw e;
    }
  });

  // Calificación del inquilino del reclamo ya resuelto/cerrado. La lectura
  // agregada ya existe (historial del inquilino en inquilino-mundo.ts) pero
  // hasta ahora solo se escribía en localStorage en la demo → en prod el rating
  // promedio quedaba siempre en 0. Upsert por reclamoId (@unique): se puede
  // re-calificar.
  app.post('/mis-reclamos/:id/rating', async (request, reply) => {
    const inq = await requireInquilino(request, reply);
    if (!inq) return;
    if (!inq.contratoId) return reply.code(400).send({ message: 'No tenés un contrato activo' });
    const { id } = request.params as { id: string };
    const body = z
      .object({
        estrellas: z.number().int().min(1).max(5),
        comentario: z.string().trim().max(300).optional(),
      })
      .safeParse(request.body ?? {});
    if (!body.success) return reply.code(400).send({ message: 'Elegí entre 1 y 5 estrellas' });
    const comentario = body.data.comentario?.trim() || null;

    const reclamo = await prisma.reclamo.findFirst({
      where: { id, contratoId: inq.contratoId, inmobiliariaId: inq.inmobiliariaId },
      select: { id: true, estado: true, profesionalId: true },
    });
    if (!reclamo) return reply.code(404).send({ message: 'Reclamo inexistente' });
    if (reclamo.estado !== 'RESUELTO' && reclamo.estado !== 'CERRADO') {
      return reply.code(409).send({ message: 'Solo podés calificar un reclamo resuelto' });
    }

    const rating = await prisma.ratingReclamo.upsert({
      where: { reclamoId: id },
      create: { inmobiliariaId: inq.inmobiliariaId, reclamoId: id, estrellas: body.data.estrellas, comentario },
      update: { estrellas: body.data.estrellas, comentario },
    });

    // Recalcular el rating PONDERADO del profesional asignado = promedio real de
    // las estrellas de TODOS sus reclamos calificados. Antes profesional.rating
    // quedaba en el valor seed y el ranking del panel (GET /profesionales, ordena
    // por rating) nunca reflejaba las calificaciones reales del inquilino.
    if (reclamo.profesionalId) {
      const agg = await prisma.ratingReclamo.aggregate({
        where: { reclamo: { profesionalId: reclamo.profesionalId } },
        _avg: { estrellas: true },
      });
      await prisma.profesional.update({
        where: { id: reclamo.profesionalId },
        data: { rating: agg._avg.estrellas ?? 0 },
      });
    }

    return { reclamoId: rating.reclamoId, estrellas: rating.estrellas, comentario: rating.comentario, enviadoAt: rating.enviadoAt };
  });

  // ===== Red de profesionales =====
  app.get('/profesionales', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'profesionales.ver');
    if (!u) return;
    const q = z
      .object({
        categoria: z.enum(['PLOMERO', 'ELECTRICISTA', 'GASISTA', 'CERRAJERO', 'PINTOR', 'TECNICO_AC', 'FLETE']).optional(),
        activo: z.enum(['true', 'false']).optional(),
      })
      .parse(request.query ?? {});
    return prisma.profesional.findMany({
      where: {
        inmobiliariaId: u.inmobiliariaId,
        ...(q.categoria ? { categoria: q.categoria } : {}),
        ...(q.activo ? { activo: q.activo === 'true' } : {}),
      },
      orderBy: [{ rating: 'desc' }, { nombre: 'asc' }],
    });
  });

  // ===== Consorcios =====
  // No existe capacidad específica de consorcios en permisos.ts: se usa
  // propiedades.ver (administración de edificios = patrimonio, visible para
  // todos los roles igual que propiedades).
  app.get('/consorcios', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'propiedades.ver');
    if (!u) return;
    return prisma.consorcio.findMany({
      where: { inmobiliariaId: u.inmobiliariaId },
      include: { unidades: { orderBy: { id: 'asc' } } },
      orderBy: { desde: 'asc' },
    });
  });

  app.get('/consorcios/:id', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'propiedades.ver');
    if (!u) return;
    const { id } = request.params as { id: string };
    const consorcio = await prisma.consorcio.findFirst({
      where: { id, inmobiliariaId: u.inmobiliariaId },
      include: {
        unidades: { orderBy: { id: 'asc' } },
        movimientos: { orderBy: { fecha: 'desc' } },
        asambleas: { orderBy: { fecha: 'desc' } },
      },
    });
    if (!consorcio) return reply.code(404).send({ message: 'Consorcio inexistente' });
    return consorcio;
  });

  // ===== Renovaciones =====
  app.get('/renovaciones', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'contratos.ver');
    if (!u) return;
    const contratos = await prisma.contrato.findMany({
      where: { inmobiliariaId: u.inmobiliariaId, estado: 'ACTIVO' },
      select: {
        id: true,
        fechaInicio: true,
        fechaFin: true,
        monto: true,
        moneda: true,
        tipoContrato: true,
        propiedad: { select: { id: true, direccion: true, ciudad: true } },
        inquilinoTitular: { select: { id: true, nombre: true, apellido: true, email: true, telefono: true } },
        intencionRenovacion: true,
      },
      orderBy: { fechaFin: 'asc' },
    });
    const ahora = Date.now();
    return contratos.map((c) => ({
      ...c,
      diasParaVencimiento: Math.ceil((c.fechaFin.getTime() - ahora) / 86_400_000),
    }));
  });

  // Decisión de renovación registrada desde el panel. No hay capacidad
  // específica de renovaciones en permisos.ts: se trata como acción sensible
  // sobre el ciclo de vida del contrato (contrato.aprobar = ADMIN) + PIN,
  // porque pisa la intención declarada por el inquilino.
  app.post('/renovaciones/:contratoId/decision', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'contrato.aprobar');
    if (!u) return;
    const { contratoId } = request.params as { contratoId: string };
    const body = z
      .object({
        decision: z.enum(['RENOVAR', 'NO_RENOVAR', 'PENSANDO', 'SIN_RESPUESTA']),
        notas: z.string().optional(),
        pin: z.string().optional(),
      })
      .safeParse(request.body ?? {});
    if (!body.success) {
      return reply.code(400).send({ message: 'Decisión inválida — usá RENOVAR, NO_RENOVAR, PENSANDO o SIN_RESPUESTA' });
    }
    if (!(await verificarPin(u.userId, body.data.pin, reply))) return;

    const contrato = await prisma.contrato.findFirst({ where: { id: contratoId, inmobiliariaId: u.inmobiliariaId } });
    if (!contrato) return reply.code(404).send({ message: 'Contrato inexistente' });
    if (contrato.estado !== 'ACTIVO') {
      return reply.code(409).send({ message: 'Solo se registra la decisión sobre contratos activos' });
    }

    const decididoAt = body.data.decision === 'SIN_RESPUESTA' ? null : new Date();
    return prisma.intencionRenovacion.upsert({
      where: { contratoId },
      update: { decision: body.data.decision, comentario: body.data.notas ?? null, decididoAt },
      create: {
        inmobiliariaId: u.inmobiliariaId,
        contratoId,
        decision: body.data.decision,
        comentario: body.data.notas ?? null,
        decididoAt,
      },
    });
  });
}
