import type { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';
import { requireUsuario } from '../auth/guards.js';

const money = (n: unknown) => Number(n).toLocaleString('es-AR');

interface EventoTimeline {
  fecha: string;
  tipo: string;
  titulo: string;
  detalle: string;
  contratoId: string;
  inquilino: string;
}

/**
 * Línea de tiempo de la propiedad: todos los hitos de TODOS sus contratos (actual +
 * históricos) en orden cronológico. Merge on-read de fuentes que ya existen (contrato,
 * ajustes, renovaciones, reclamos, aviso de egreso). Nada se borra al finalizar un
 * contrato → la historia queda completa. Sin migración; archivo aparte (no toca core.ts).
 */
export async function propiedadTimelineRoutes(app: FastifyInstance) {
  app.get('/propiedades/:id/timeline', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'contratos.ver');
    if (!u) return;
    const { id } = request.params as { id: string };
    const tenant = u.inmobiliariaId;

    const propiedad = await prisma.propiedad.findFirst({
      where: { id, inmobiliariaId: tenant },
      select: { id: true },
    });
    if (!propiedad) return reply.code(404).send({ message: 'Propiedad inexistente' });

    const contratos = await prisma.contrato.findMany({
      where: { propiedadId: id, inmobiliariaId: tenant },
      select: {
        id: true,
        estado: true,
        fechaInicio: true,
        fechaFin: true,
        fechaEfectivaRescision: true,
        motivoRescision: true,
        inquilinoTitular: { select: { nombre: true, apellido: true } },
      },
    });
    const contratoIds = contratos.map((c) => c.id);
    const nombre = new Map(
      contratos.map((c) => [
        c.id,
        c.inquilinoTitular
          ? `${c.inquilinoTitular.nombre ?? ''} ${c.inquilinoTitular.apellido ?? ''}`.trim()
          : '',
      ]),
    );

    const [ajustes, renovaciones, reclamos, intenciones] = contratoIds.length
      ? await Promise.all([
          prisma.ajusteAlquiler.findMany({
            where: { contratoId: { in: contratoIds }, inmobiliariaId: tenant },
            select: { contratoId: true, montoAnterior: true, montoNuevo: true, periodoDesde: true, motivo: true, createdAt: true },
          }),
          prisma.renovacionContrato.findMany({
            where: { contratoId: { in: contratoIds }, inmobiliariaId: tenant },
            select: { contratoId: true, montoAnterior: true, montoNuevo: true, fechaFinNueva: true, createdAt: true },
          }),
          prisma.reclamo.findMany({
            where: { contratoId: { in: contratoIds }, inmobiliariaId: tenant },
            select: { contratoId: true, categoria: true, descripcion: true, createdAt: true, estado: true, resueltoAt: true, resolucion: true },
          }),
          prisma.intencionRenovacion.findMany({
            where: { contratoId: { in: contratoIds }, inmobiliariaId: tenant, fechaEgreso: { not: null } },
            select: { contratoId: true, fechaEgreso: true, decididoAt: true, updatedAt: true },
          }),
        ])
      : [[], [], [], []];

    const eventos: EventoTimeline[] = [];
    const push = (fecha: Date | null, tipo: string, titulo: string, detalle: string, contratoId: string) => {
      if (!fecha) return;
      eventos.push({ fecha: new Date(fecha).toISOString(), tipo, titulo, detalle, contratoId, inquilino: nombre.get(contratoId) ?? '' });
    };

    for (const c of contratos) {
      push(c.fechaInicio, 'CONTRATO_INICIADO', 'Contrato iniciado', nombre.get(c.id) ? `Inquilino: ${nombre.get(c.id)}` : '', c.id);
      if (c.estado === 'RESCINDIDO') {
        push(c.fechaEfectivaRescision ?? c.fechaFin, 'CONTRATO_RESCINDIDO', 'Contrato rescindido', c.motivoRescision ?? '', c.id);
      } else if (c.estado === 'FINALIZADO') {
        push(c.fechaFin, 'CONTRATO_FINALIZADO', 'Contrato finalizado', '', c.id);
      }
    }
    for (const a of ajustes) {
      push(a.createdAt, 'AJUSTE', 'Ajuste de alquiler', `De $${money(a.montoAnterior)} a $${money(a.montoNuevo)} desde ${a.periodoDesde}${a.motivo ? ` · ${a.motivo}` : ''}`, a.contratoId);
    }
    for (const r of renovaciones) {
      push(r.createdAt, 'RENOVACION', 'Renovación de contrato', `Nuevo canon $${money(r.montoNuevo)} · vence ${new Date(r.fechaFinNueva).toISOString().slice(0, 10)}`, r.contratoId);
    }
    for (const rc of reclamos) {
      push(rc.createdAt, 'RECLAMO_ABIERTO', 'Reclamo abierto', rc.descripcion?.slice(0, 120) ?? '', rc.contratoId);
      if (rc.resueltoAt) {
        // `resueltoAt` NO quiere decir "está resuelto": quiere decir "se resolvió alguna vez".
        // Un reclamo reabierto —PERSISTE del inquilino (`operacion.ts:1097`) o
        // `POST /reclamos/:id/reabrir`— vuelve a EN_CURSO CONSERVANDO la fecha a propósito: es
        // el ancla con la que `evaluarSla` reinicia el reloj. Y `/rechazar` tampoco la limpia,
        // así que un resuelto → reabierto → RECHAZADO también llega acá con fecha.
        // Mirando sólo la fecha, el expediente daba por cerrado lo que estaba abierto hoy.
        // El corte por `estado` es el mismo que ya aplican `metricas.ts:200-204` y
        // `plata.ts:2482-2488` para contar reclamos resueltos.
        const cerrado = rc.estado === 'RESUELTO' || rc.estado === 'CERRADO';
        // El hito NO se esconde cuando está reabierto: esa resolución existió y movió plata.
        // Se muestra con su fecha real y contando qué pasó después, que es lo que la operadora
        // necesita leer. La fecha de la reapertura en sí no está en la fila (vive en
        // `ReclamoEvento`), así que se ancla en la resolución y no se inventa un instante.
        push(
          rc.resueltoAt,
          cerrado ? 'RECLAMO_RESUELTO' : 'RECLAMO_REABIERTO',
          cerrado ? 'Reclamo resuelto' : 'Reclamo resuelto y reabierto',
          cerrado
            ? (rc.resolucion?.slice(0, 120) ?? '')
            : `Se reabrió después de esta resolución${rc.resolucion ? `: ${rc.resolucion.slice(0, 120)}` : ''}`,
          rc.contratoId,
        );
      }
    }
    for (const it of intenciones) {
      push(it.decididoAt ?? it.updatedAt, 'AVISO_EGRESO', 'Aviso de egreso del inquilino', it.fechaEgreso ? `Se va el ${new Date(it.fechaEgreso).toISOString().slice(0, 10)}` : '', it.contratoId);
    }

    eventos.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
    return { eventos };
  });
}
