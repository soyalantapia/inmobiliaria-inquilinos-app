import type { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';
import { requireUsuario } from '../auth/guards.js';

/**
 * Reclamos de una propiedad — incluyendo los de contratos PASADOS (ex-inquilinos).
 *
 * Por qué un endpoint aparte (y no dentro de GET /propiedades/:id): el detalle de
 * propiedad no incluía los reclamos (el front los hardcodeaba en []), así que la
 * pestaña Reclamos salía siempre vacía. Se resuelve acá sin tocar ese endpoint.
 *
 * Se consulta por los CONTRATOS de la propiedad (patrón robusto), no por
 * `Reclamo.propiedadId` — ese campo es opcional y puede quedar en null, así que
 * filtrar por él tendría falsos negativos. Como nada se borra al finalizar un
 * contrato, esto trae los reclamos del inquilino actual y de todos los anteriores.
 */
export async function propiedadReclamosRoutes(app: FastifyInstance) {
  app.get('/propiedades/:id/reclamos', async (request, reply) => {
    const u = await requireUsuario(request, reply);
    if (!u) return;
    const { id } = request.params as { id: string };

    // La propiedad tiene que ser del tenant (aislamiento multi-tenant).
    const propiedad = await prisma.propiedad.findFirst({
      where: { id, inmobiliariaId: u.inmobiliariaId },
      select: { id: true },
    });
    if (!propiedad) return reply.code(404).send({ message: 'Propiedad inexistente' });

    // Todos los contratos de la propiedad (actual + histórico) con su inquilino
    // titular → para etiquetar de quién fue cada reclamo (actual vs ex-inquilino).
    const contratos = await prisma.contrato.findMany({
      where: { propiedadId: id, inmobiliariaId: u.inmobiliariaId },
      select: {
        id: true,
        inquilinoTitular: { select: { nombre: true, apellido: true } },
      },
    });
    const nombrePorContrato = new Map(
      contratos.map((c) => [
        c.id,
        c.inquilinoTitular
          ? `${c.inquilinoTitular.nombre ?? ''} ${c.inquilinoTitular.apellido ?? ''}`.trim()
          : '',
      ]),
    );
    const contratoIds = contratos.map((c) => c.id);
    if (contratoIds.length === 0) return { reclamos: [] };

    const reclamos = await prisma.reclamo.findMany({
      where: { contratoId: { in: contratoIds }, inmobiliariaId: u.inmobiliariaId },
      select: {
        id: true,
        contratoId: true,
        categoria: true,
        descripcion: true,
        urgencia: true,
        estado: true,
        fotoUrl: true,
        resolucion: true,
        resueltoAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      reclamos: reclamos.map((r) => ({
        ...r,
        // Nombre del inquilino del contrato al que pertenece el reclamo.
        inquilino: nombrePorContrato.get(r.contratoId) ?? '',
      })),
    };
  });
}
