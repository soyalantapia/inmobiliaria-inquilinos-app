import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireUsuario } from '../auth/guards.js';
import { borrarArchivoSubido, urlEsDelTenant } from './uploads.js';

/**
 * Documentos del expediente de un contrato (lado inmobiliaria): DNI titular y
 * garantes, recibos, contrato firmado, convenio/pagarés, fotos de WhatsApp, etc.
 *
 * Antes esto vivía SOLO en localStorage del panel (dataUrl base64, por browser).
 * Acá es una tabla real `DocumentoContrato` + archivo real en el Volume:
 *   - GET    /contratos/:contratoId/documentos        lista (contratos.ver)
 *   - POST   /contratos/:contratoId/documentos        crea  (contratos.crear)
 *   - DELETE /contratos/:contratoId/documentos/:docId borra (contratos.crear)
 *
 * El archivo se sube primero a POST /uploads (devuelve la url); acá guardamos
 * esa url + los metadatos. Todo scopeado por inmobiliaria del usuario.
 */

const TIPO_DOC = z.enum([
  'CONTRATO_FIRMADO',
  'DNI_TITULAR_FRENTE',
  'DNI_TITULAR_DORSO',
  'DNI_GARANTE_FRENTE',
  'DNI_GARANTE_DORSO',
  'RECIBO_SUELDO',
  'CONVENIO_DESOCUPACION',
  'PAGARE',
  'FOTO_WHATSAPP',
  'OTRO',
]);

const crearSchema = z.object({
  tipo: TIPO_DOC,
  etiqueta: z.string().trim().min(1).max(200),
  garanteIndex: z.number().int().positive().max(20).optional(),
  periodoLiquidacion: z.string().trim().max(20).optional(),
  nombreArchivo: z.string().trim().min(1).max(300),
  tipoMime: z.string().trim().min(1).max(120),
  tamanioBytes: z.number().int().nonnegative(),
  archivoUrl: z.string().trim().min(1).max(500),
});

export async function documentosRoutes(app: FastifyInstance): Promise<void> {
  // Verifica que el contrato exista y sea de la inmobiliaria del usuario.
  // Devuelve true si OK; si no, ya respondió 404 y devuelve false.
  async function contratoDelTenant(
    contratoId: string,
    inmobiliariaId: string,
    reply: import('fastify').FastifyReply,
  ): Promise<boolean> {
    const contrato = await prisma.contrato.findFirst({
      where: { id: contratoId, inmobiliariaId },
      select: { id: true },
    });
    if (!contrato) {
      await reply.code(404).send({ message: 'Contrato no encontrado' });
      return false;
    }
    return true;
  }

  // GET /contratos/:contratoId/documentos — lista del expediente.
  app.get('/contratos/:contratoId/documentos', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'contratos.ver');
    if (!u) return;
    const { contratoId } = request.params as { contratoId: string };
    if (!(await contratoDelTenant(contratoId, u.inmobiliariaId, reply))) return;

    const docs = await prisma.documentoContrato.findMany({
      where: { contratoId, inmobiliariaId: u.inmobiliariaId },
      orderBy: { subidoAt: 'desc' },
    });
    return docs.map((d) => ({
      ...d,
      subidoAt: d.subidoAt.toISOString(),
    }));
  });

  // POST /contratos/:contratoId/documentos — anexa un documento ya subido.
  app.post('/contratos/:contratoId/documentos', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'contratos.crear');
    if (!u) return;
    const { contratoId } = request.params as { contratoId: string };
    if (!(await contratoDelTenant(contratoId, u.inmobiliariaId, reply))) return;

    const parsed = crearSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: 'Datos inválidos', detalle: parsed.error.flatten() });
    }
    const b = parsed.data;
    // archivoUrl tiene que ser un /uploads de ESTA inmobiliaria (no externa/ajena).
    if (!urlEsDelTenant(b.archivoUrl, u.inmobiliariaId)) {
      return reply.code(400).send({ message: 'archivoUrl inválido' });
    }
    const doc = await prisma.documentoContrato.create({
      data: {
        inmobiliariaId: u.inmobiliariaId,
        contratoId,
        tipo: b.tipo,
        etiqueta: b.etiqueta,
        garanteIndex: b.garanteIndex ?? null,
        periodoLiquidacion: b.periodoLiquidacion ?? null,
        nombreArchivo: b.nombreArchivo,
        tipoMime: b.tipoMime,
        tamanioBytes: b.tamanioBytes,
        archivoUrl: b.archivoUrl,
        subidoPor: u.userId,
      },
    });
    return reply.code(201).send({ ...doc, subidoAt: doc.subidoAt.toISOString() });
  });

  // DELETE /contratos/:contratoId/documentos/:docId — saca del expediente + borra el archivo.
  app.delete('/contratos/:contratoId/documentos/:docId', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'contratos.crear');
    if (!u) return;
    const { contratoId, docId } = request.params as { contratoId: string; docId: string };
    // findFirst por las tres claves: nadie borra documentos de otra inmobiliaria
    // ni de otro contrato aunque adivine el id.
    const doc = await prisma.documentoContrato.findFirst({
      where: { id: docId, contratoId, inmobiliariaId: u.inmobiliariaId },
    });
    if (!doc) return reply.code(404).send({ message: 'Documento no encontrado' });

    await prisma.documentoContrato.delete({ where: { id: doc.id } });
    // Best effort: liberamos el archivo del Volume (tenant-scopeado).
    await borrarArchivoSubido(doc.archivoUrl, u.inmobiliariaId);
    // 200 + JSON (no 204): el apiFetch del panel hace res.json() siempre.
    return reply.send({ ok: true });
  });

  // GET /contratos/:contratoId/documentos-inquilino — lectura (solo panel) de los
  // documentos que el INQUILINO subió desde su app (DNI, recibos, garante; ver
  // POST /mis-documentos en mi-perfil.ts). Distinto de DocumentoContrato (arriba),
  // que es el expediente que carga la inmobiliaria.
  app.get('/contratos/:contratoId/documentos-inquilino', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'contratos.ver');
    if (!u) return;
    const { contratoId } = request.params as { contratoId: string };
    const contrato = await prisma.contrato.findFirst({
      where: { id: contratoId, inmobiliariaId: u.inmobiliariaId },
      select: { inquilinoTitular: { select: { id: true } } },
    });
    if (!contrato) return reply.code(404).send({ message: 'Contrato no encontrado' });
    if (!contrato.inquilinoTitular) return [];
    const documentos = await prisma.documento.findMany({
      where: { inmobiliariaId: u.inmobiliariaId, inquilinoId: contrato.inquilinoTitular.id },
      include: { slot: { select: { titulo: true, categoria: true } } },
      orderBy: { subidoAt: 'desc' },
    });
    return documentos.map((d) => ({ ...d, subidoAt: d.subidoAt.toISOString(), vencimiento: d.vencimiento?.toISOString() ?? null }));
  });
}
