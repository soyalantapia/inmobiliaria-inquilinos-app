import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireProfesionalVisita } from '../auth/guards.js';
import { urlEsDelTenant } from './uploads.js';

/**
 * Flujo del profesional asignado a un reclamo, vía link mágico (/p/:token en
 * la app inquilino). El profesional NO tiene cuenta ni password: el token
 * opaco de `VisitaProfesional.token` es el link que le manda la inmobiliaria
 * (WhatsApp/SMS). Al abrirlo (GET público), canjeamos el token por un JWT
 * corto (`kind: 'profesional'`) que habilita el resto de las acciones —
 * incluida la subida de fotos por POST /uploads, que ya acepta cualquier JWT
 * con `inmobiliariaId` (ver tenantDe() en uploads.ts).
 *
 * Máquina de estados (VisitaProfesional.estado): ASIGNADO → CONFIRMADA →
 * EN_CAMINO → LISTO. Cada transición registra un ReclamoEvento (VISITA_*)
 * para que la inmobiliaria vea el progreso en la timeline del reclamo.
 */

const ORDEN_ESTADO = { ASIGNADO: 0, CONFIRMADA: 1, EN_CAMINO: 2, LISTO: 3 } as const;
type EstadoVisita = keyof typeof ORDEN_ESTADO;

export async function visitasPublicasRoutes(app: FastifyInstance): Promise<void> {
  // GET /visitas-publicas/:token — PÚBLICO (sin bearer): valida el token opaco
  // del link mágico y devuelve la info de la visita + un JWT de sesión corto
  // para las acciones siguientes.
  app.get('/visitas-publicas/:token', async (request, reply) => {
    const { token } = request.params as { token: string };
    const visita = await prisma.visitaProfesional.findUnique({
      where: { token },
      include: {
        profesional: { select: { nombre: true, categoria: true, telefono: true } },
        reclamo: {
          select: {
            id: true,
            categoria: true,
            urgencia: true,
            descripcion: true,
            fotoUrl: true,
            propiedad: { select: { direccion: true, ciudad: true } },
            contrato: {
              select: { inquilinoTitular: { select: { nombre: true, apellido: true, telefono: true } } },
            },
          },
        },
      },
    });
    if (!visita) return reply.code(404).send({ message: 'Link inválido o vencido' });

    const sesion = app.jwt.sign(
      { kind: 'profesional', visitaId: visita.id, inmobiliariaId: visita.inmobiliariaId, profesionalId: visita.profesionalId },
      { expiresIn: '14d' },
    );

    const titular = visita.reclamo.contrato.inquilinoTitular;
    return {
      sesion,
      visita: {
        id: visita.id,
        estado: visita.estado,
        fechaVisita: visita.fechaVisita,
        confirmadaAt: visita.confirmadaAt,
        enCaminoAt: visita.enCaminoAt,
        listoAt: visita.listoAt,
        notaFinal: visita.notaFinal,
        montoCobrado: visita.montoCobrado,
        fotoAntes: visita.fotoAntes,
        fotoDespues: visita.fotoDespues,
        profesional: visita.profesional,
      },
      reclamo: {
        id: visita.reclamo.id,
        categoria: visita.reclamo.categoria,
        urgencia: visita.reclamo.urgencia,
        descripcion: visita.reclamo.descripcion,
        fotoUrl: visita.reclamo.fotoUrl,
        direccion: visita.reclamo.propiedad?.direccion ?? null,
        ciudad: visita.reclamo.propiedad?.ciudad ?? null,
        inquilino: titular ? `${titular.nombre} ${titular.apellido ?? ''}`.trim() : null,
        inquilinoTelefono: titular?.telefono ?? null,
      },
    };
  });

  /** Aplica una transición si la visita está en un estado previo válido; si ya
   * está en el estado destino (o más adelante), es idempotente (200 sin
   * volver a aplicar). Si falta un paso anterior, 409 con mensaje claro. */
  async function transicionar(
    visitaId: string,
    desde: EstadoVisita,
    hacia: EstadoVisita,
    data: Record<string, unknown>,
    reply: FastifyReply,
  ): Promise<boolean> {
    const res = await prisma.visitaProfesional.updateMany({
      where: { id: visitaId, estado: desde },
      data,
    });
    if (res.count > 0) return true;
    const actual = await prisma.visitaProfesional.findUnique({ where: { id: visitaId }, select: { estado: true } });
    if (actual && ORDEN_ESTADO[actual.estado] >= ORDEN_ESTADO[hacia]) {
      // Ya está en este estado o más adelante (doble-tap / reintento) → OK.
      return true;
    }
    await reply.code(409).send({
      message:
        hacia === 'CONFIRMADA'
          ? 'Esta visita ya no está pendiente de confirmar.'
          : hacia === 'EN_CAMINO'
            ? 'Confirmá la visita antes de marcar que vas en camino.'
            : 'Marcá que vas en camino antes de dar la visita por terminada.',
    });
    return false;
  }

  app.post('/visitas-publicas/confirmar', async (request, reply) => {
    const acc = await requireProfesionalVisita(request, reply);
    if (!acc) return;
    const body = z.object({ fechaVisita: z.coerce.date().optional() }).safeParse(request.body ?? {});
    if (!body.success) return reply.code(400).send({ message: 'Fecha de visita inválida' });
    const ok = await transicionar(
      acc.visitaId,
      'ASIGNADO',
      'CONFIRMADA',
      { estado: 'CONFIRMADA', confirmadaAt: new Date(), ...(body.data.fechaVisita ? { fechaVisita: body.data.fechaVisita } : {}) },
      reply,
    );
    if (!ok) return;
    const [visita, prof] = await Promise.all([
      prisma.visitaProfesional.findUnique({ where: { id: acc.visitaId } }),
      prisma.profesional.findUnique({ where: { id: acc.profesionalId }, select: { nombre: true } }),
    ]);
    await prisma.reclamoEvento.create({
      data: {
        inmobiliariaId: acc.inmobiliariaId,
        reclamoId: visita!.reclamoId,
        tipo: 'VISITA_CONFIRMADA',
        autor: prof?.nombre ?? 'Profesional',
        contenido: body.data.fechaVisita ? `Confirmó la visita para el ${body.data.fechaVisita.toLocaleDateString('es-AR')}` : 'Confirmó la visita',
      },
    });
    return visita;
  });

  app.post('/visitas-publicas/en-camino', async (request, reply) => {
    const acc = await requireProfesionalVisita(request, reply);
    if (!acc) return;
    const ok = await transicionar(acc.visitaId, 'CONFIRMADA', 'EN_CAMINO', { estado: 'EN_CAMINO', enCaminoAt: new Date() }, reply);
    if (!ok) return;
    const [visita, prof] = await Promise.all([
      prisma.visitaProfesional.findUnique({ where: { id: acc.visitaId } }),
      prisma.profesional.findUnique({ where: { id: acc.profesionalId }, select: { nombre: true } }),
    ]);
    await prisma.reclamoEvento.create({
      data: {
        inmobiliariaId: acc.inmobiliariaId,
        reclamoId: visita!.reclamoId,
        tipo: 'VISITA_EN_CAMINO',
        autor: prof?.nombre ?? 'Profesional',
        contenido: 'Va en camino',
      },
    });
    return visita;
  });

  const fotosSchema = z.object({
    fotoAntes: z.string().optional(),
    fotoDespues: z.string().optional(),
  });

  app.put('/visitas-publicas/fotos', async (request, reply) => {
    const acc = await requireProfesionalVisita(request, reply);
    if (!acc) return;
    const body = fotosSchema.safeParse(request.body ?? {});
    if (!body.success) return reply.code(400).send({ message: 'Datos de foto inválidos' });
    if (body.data.fotoAntes && !urlEsDelTenant(body.data.fotoAntes, acc.inmobiliariaId)) {
      return reply.code(400).send({ message: 'Foto (antes) inválida' });
    }
    if (body.data.fotoDespues && !urlEsDelTenant(body.data.fotoDespues, acc.inmobiliariaId)) {
      return reply.code(400).send({ message: 'Foto (después) inválida' });
    }
    const data: Record<string, string> = {};
    if (body.data.fotoAntes) data.fotoAntes = body.data.fotoAntes;
    if (body.data.fotoDespues) data.fotoDespues = body.data.fotoDespues;
    if (Object.keys(data).length === 0) return reply.code(400).send({ message: 'Mandá al menos una foto' });
    return prisma.visitaProfesional.update({ where: { id: acc.visitaId }, data });
  });

  const listoSchema = z.object({
    notaFinal: z.string().trim().min(1).max(1000),
    montoCobrado: z.number().nonnegative().optional(),
  });

  app.post('/visitas-publicas/listo', async (request, reply) => {
    const acc = await requireProfesionalVisita(request, reply);
    if (!acc) return;
    const body = listoSchema.safeParse(request.body ?? {});
    if (!body.success) return reply.code(400).send({ message: 'Contanos brevemente qué se hizo' });
    const ok = await transicionar(
      acc.visitaId,
      'EN_CAMINO',
      'LISTO',
      { estado: 'LISTO', listoAt: new Date(), notaFinal: body.data.notaFinal, ...(body.data.montoCobrado != null ? { montoCobrado: body.data.montoCobrado } : {}) },
      reply,
    );
    if (!ok) return;
    const [visita, prof] = await Promise.all([
      prisma.visitaProfesional.findUnique({ where: { id: acc.visitaId } }),
      prisma.profesional.findUnique({ where: { id: acc.profesionalId }, select: { nombre: true } }),
    ]);
    await prisma.reclamoEvento.create({
      data: {
        inmobiliariaId: acc.inmobiliariaId,
        reclamoId: visita!.reclamoId,
        tipo: 'VISITA_LISTO',
        autor: prof?.nombre ?? 'Profesional',
        contenido: body.data.notaFinal,
      },
    });
    // Reputación REAL: al terminar el trabajo cerramos el reclamo (RESUELTO), imputamos
    // el costo que declaró el profesional y sumamos el trabajo a su track record. Antes
    // el /listo dejaba la visita en LISTO pero NO cerraba el reclamo ni tocaba cantTrabajos
    // /ultimoTrabajo (quedaban congelados) → la reputación del panel era ficticia.
    // IDEMPOTENTE: el updateMany condicionado por estado no-terminal solo pega la primera
    // vez; un doble-tap del /listo (o un reintento) no re-cierra ni re-cuenta.
    const cerrado = await prisma.reclamo.updateMany({
      where: {
        id: visita!.reclamoId,
        inmobiliariaId: acc.inmobiliariaId,
        estado: { notIn: ['RESUELTO', 'CERRADO', 'RECHAZADO'] },
      },
      data: {
        estado: 'RESUELTO',
        resueltoAt: new Date(),
        ...(visita!.montoCobrado != null ? { costoTrabajo: visita!.montoCobrado } : {}),
      },
    });
    if (cerrado.count > 0) {
      await prisma.profesional.update({
        where: { id: acc.profesionalId },
        data: { cantTrabajos: { increment: 1 }, ultimoTrabajo: new Date() },
      });
    }
    return visita;
  });
}
