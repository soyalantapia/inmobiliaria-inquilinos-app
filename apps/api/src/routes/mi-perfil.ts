import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireInquilino } from '../auth/guards.js';
import { urlEsDelTenant, borrarArchivoSubido } from './uploads.js';

/**
 * Catálogo fijo de documentos que la inmobiliaria espera del inquilino (DNI,
 * recibos, garante). Mismo catálogo que usaba el demo (documentos-storage.ts
 * del lado inquilino) — se auto-provisiona por tenant la primera vez que se
 * pide GET /mis-documentos (idempotente vía @@unique([inmobiliariaId, codigo])).
 */
const CATALOGO_SLOTS = [
  { codigo: 'dni-frente', categoria: 'IDENTIDAD', titulo: 'DNI · frente', descripcion: 'Foto del frente del DNI, legible y vigente.', requerido: true },
  { codigo: 'dni-dorso', categoria: 'IDENTIDAD', titulo: 'DNI · dorso', descripcion: 'Foto del dorso del DNI, con código de barras visible.', requerido: true },
  { codigo: 'recibo-1', categoria: 'INGRESOS', titulo: 'Recibo de sueldo · último mes', descripcion: 'PDF firmado o foto del recibo más reciente.', requerido: true },
  { codigo: 'recibo-2', categoria: 'INGRESOS', titulo: 'Recibo de sueldo · anterior', descripcion: 'El del mes inmediatamente anterior.', requerido: true },
  { codigo: 'cert-laboral', categoria: 'INGRESOS', titulo: 'Certificación laboral', descripcion: 'Carta de RR.HH. con antigüedad y remuneración.', requerido: false },
  { codigo: 'garante-escritura', categoria: 'GARANTE', titulo: 'Escritura del garante', descripcion: 'Copia simple del título de propiedad.', requerido: true },
  { codigo: 'garante-recibo', categoria: 'GARANTE', titulo: 'Recibo de sueldo del garante', descripcion: 'El último recibo del garante.', requerido: true },
] as const;

export async function miPerfilRoutes(app: FastifyInstance): Promise<void> {
  // ===== Avatar =====

  // Datos mínimos de perfil que no viajan en /auth/me del inquilino (avatar).
  app.get('/mis-datos', async (request, reply) => {
    const inq = await requireInquilino(request, reply);
    if (!inq) return;
    const i = await prisma.inquilino.findUnique({
      where: { id: inq.inquilinoId },
      select: { imageUrl: true },
    });
    if (!i) return reply.code(404).send({ message: 'Inquilino inexistente' });
    return { imageUrl: i.imageUrl };
  });

  // Avatar del inquilino (foto de perfil en /uploads del tenant). Mismo patrón
  // que PUT /me/avatar del panel: imageUrl null/'' saca la foto; al reemplazar
  // se libera el archivo anterior del Volume (best effort).
  app.put('/mis-datos/avatar', async (request, reply) => {
    const inq = await requireInquilino(request, reply);
    if (!inq) return;
    const body = z.object({ imageUrl: z.string().nullable() }).safeParse(request.body ?? {});
    if (!body.success) return reply.code(400).send({ message: 'Avatar inválido' });
    const nueva = body.data.imageUrl || null;
    if (nueva && !urlEsDelTenant(nueva, inq.inmobiliariaId)) {
      return reply.code(400).send({ message: 'Avatar inválido' });
    }
    const actual = await prisma.inquilino.findUnique({ where: { id: inq.inquilinoId }, select: { imageUrl: true } });
    if (!actual) return reply.code(404).send({ message: 'Inquilino inexistente' });
    await prisma.inquilino.update({ where: { id: inq.inquilinoId }, data: { imageUrl: nueva } });
    if (actual.imageUrl && actual.imageUrl !== nueva) {
      await borrarArchivoSubido(actual.imageUrl, inq.inmobiliariaId);
    }
    return { imageUrl: nueva };
  });

  // ===== Documentos =====

  // Auto-provisiona el catálogo de slots para ESTA inmobiliaria si todavía no
  // existe (idempotente: @@unique([inmobiliariaId, codigo]) + skipDuplicates).
  async function asegurarSlots(inmobiliariaId: string): Promise<void> {
    await prisma.slotDocumento.createMany({
      data: CATALOGO_SLOTS.map((s) => ({ inmobiliariaId, ...s })),
      skipDuplicates: true,
    });
  }

  app.get('/mis-documentos', async (request, reply) => {
    const inq = await requireInquilino(request, reply);
    if (!inq) return;
    await asegurarSlots(inq.inmobiliariaId);
    const [slots, documentos] = await Promise.all([
      prisma.slotDocumento.findMany({ where: { inmobiliariaId: inq.inmobiliariaId }, orderBy: { codigo: 'asc' } }),
      prisma.documento.findMany({
        where: { inmobiliariaId: inq.inmobiliariaId, inquilinoId: inq.inquilinoId },
        orderBy: { subidoAt: 'desc' },
      }),
    ]);
    const porSlot = new Map(documentos.filter((d) => d.slotId).map((d) => [d.slotId as string, d]));
    return {
      slots: slots.map((s) => ({ ...s, documento: porSlot.get(s.id) ?? null })),
      libres: documentos.filter((d) => !d.slotId),
    };
  });

  const crearDocSchema = z.object({
    slotId: z.string().optional(),
    nombre: z.string().trim().min(1).max(300),
    tipoMime: z.string().trim().min(1).max(120),
    tamanioBytes: z.number().int().nonnegative(),
    archivoUrl: z.string().trim().min(1).max(500),
    vencimiento: z.string().optional(),
  });

  app.post('/mis-documentos', async (request, reply) => {
    const inq = await requireInquilino(request, reply);
    if (!inq) return;
    const parsed = crearDocSchema.safeParse(request.body ?? {});
    if (!parsed.success) return reply.code(400).send({ message: 'Datos del documento incompletos' });
    const b = parsed.data;
    if (!urlEsDelTenant(b.archivoUrl, inq.inmobiliariaId)) {
      return reply.code(400).send({ message: 'archivoUrl inválido' });
    }
    let categoria: 'IDENTIDAD' | 'INGRESOS' | 'GARANTE' | 'OTRO' = 'OTRO';
    let slotId: string | null = null;
    if (b.slotId) {
      const slot = await prisma.slotDocumento.findFirst({
        where: { id: b.slotId, inmobiliariaId: inq.inmobiliariaId },
      });
      if (!slot) return reply.code(404).send({ message: 'Slot de documento inexistente' });
      categoria = slot.categoria;
      slotId = slot.id;
      // Reemplazar: el slot es 1 documento vigente por inquilino — se borra
      // el anterior (DB + archivo del Volume) antes de crear el nuevo.
      const previo = await prisma.documento.findFirst({
        where: { inmobiliariaId: inq.inmobiliariaId, inquilinoId: inq.inquilinoId, slotId: slot.id },
      });
      if (previo) {
        await prisma.documento.delete({ where: { id: previo.id } });
        await borrarArchivoSubido(previo.archivoUrl, inq.inmobiliariaId);
      }
    }
    const doc = await prisma.documento.create({
      data: {
        inmobiliariaId: inq.inmobiliariaId,
        inquilinoId: inq.inquilinoId,
        categoria,
        nombre: b.nombre,
        tipoMime: b.tipoMime,
        tamanioBytes: b.tamanioBytes,
        archivoUrl: b.archivoUrl,
        vencimiento: b.vencimiento ? new Date(b.vencimiento) : null,
        slotId,
      },
    });
    return reply.code(201).send(doc);
  });

  app.delete('/mis-documentos/:id', async (request, reply) => {
    const inq = await requireInquilino(request, reply);
    if (!inq) return;
    const { id } = request.params as { id: string };
    const doc = await prisma.documento.findFirst({
      where: { id, inmobiliariaId: inq.inmobiliariaId, inquilinoId: inq.inquilinoId },
    });
    if (!doc) return reply.code(404).send({ message: 'Documento inexistente' });
    await prisma.documento.delete({ where: { id: doc.id } });
    await borrarArchivoSubido(doc.archivoUrl, inq.inmobiliariaId);
    return reply.send({ ok: true });
  });
}
