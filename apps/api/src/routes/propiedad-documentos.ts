import type { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';
import { requireUsuario } from '../auth/guards.js';

/**
 * Documentos de una propiedad a lo largo de su vida: los DocumentoContrato de TODOS sus
 * contratos (actual + históricos), etiquetados con el inquilino de cada uno. Reemplaza
 * el placeholder "Próximamente" de la ficha en modo API. Sin migración; archivo aparte
 * (no toca documentos.ts, que tiene el CRUD por contrato).
 */
export async function propiedadDocumentosRoutes(app: FastifyInstance) {
  app.get('/propiedades/:id/documentos', async (request, reply) => {
    const u = await requireUsuario(request, reply);
    if (!u) return;
    const { id } = request.params as { id: string };

    const propiedad = await prisma.propiedad.findFirst({
      where: { id, inmobiliariaId: u.inmobiliariaId },
      select: { id: true },
    });
    if (!propiedad) return reply.code(404).send({ message: 'Propiedad inexistente' });

    const contratos = await prisma.contrato.findMany({
      where: { propiedadId: id, inmobiliariaId: u.inmobiliariaId },
      select: { id: true, inquilinoTitular: { select: { nombre: true, apellido: true } } },
    });
    const nombre = new Map(
      contratos.map((c) => [
        c.id,
        c.inquilinoTitular
          ? `${c.inquilinoTitular.nombre ?? ''} ${c.inquilinoTitular.apellido ?? ''}`.trim()
          : '',
      ]),
    );
    const contratoIds = contratos.map((c) => c.id);
    if (contratoIds.length === 0) return { documentos: [] };

    const docs = await prisma.documentoContrato.findMany({
      where: { contratoId: { in: contratoIds }, inmobiliariaId: u.inmobiliariaId },
      select: {
        id: true,
        contratoId: true,
        tipo: true,
        etiqueta: true,
        nombreArchivo: true,
        tipoMime: true,
        tamanioBytes: true,
        archivoUrl: true,
        subidoAt: true,
      },
      orderBy: { subidoAt: 'desc' },
    });

    return {
      documentos: docs.map((d) => ({
        ...d,
        inquilino: nombre.get(d.contratoId) ?? '',
      })),
    };
  });
}
