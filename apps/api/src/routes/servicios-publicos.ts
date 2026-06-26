import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireUsuario } from '../auth/guards.js';

/**
 * Servicios públicos (LUZ/GAS/AGUA/...) por PROPIEDAD, lado inmobiliaria.
 *
 * El inquilino YA los lee de la tabla real `ServicioPublico` (GET /servicios en
 * inquilino-mundo.ts, filtra por la propiedad de su contrato), pero el panel los
 * cargaba SOLO en localStorage → en prod el inquilino nunca veía lo que la inmo
 * cargaba (loop roto). Acá el panel escribe de verdad:
 *   - GET    /propiedades/:propiedadId/servicios        lista (propiedades.ver)
 *   - PUT    /propiedades/:propiedadId/servicios/:tipo   upsert (propiedades.crear)
 *   - DELETE /propiedades/:propiedadId/servicios/:tipo   borra (propiedades.crear)
 *
 * Upsert por la unique @@unique([propiedadId, tipo]). Todo scopeado por la
 * inmobiliaria del usuario (la propiedad tiene que ser suya).
 */

const TIPO = z.enum(['LUZ', 'GAS', 'AGUA', 'INTERNET', 'ABL', 'CABLE']);

const upsertSchema = z.object({
  distribuidora: z.string().trim().min(1).max(120),
  nis: z.string().trim().min(1).max(120),
  numeroMedidor: z.string().trim().max(120).optional(),
  titular: z.string().trim().max(200).optional(),
  observaciones: z.string().trim().max(500).optional(),
  consumoPromedioMensual: z.number().nonnegative().optional(),
});

type ServicioRow = {
  id: string;
  inmobiliariaId: string;
  propiedadId: string;
  tipo: string;
  distribuidora: string;
  nis: string;
  numeroMedidor: string | null;
  titular: string | null;
  observaciones: string | null;
  consumoPromedioMensual: { toString(): string } | number | null;
  actualizadoAt: Date;
};

function serializar(s: ServicioRow) {
  return {
    ...s,
    consumoPromedioMensual: s.consumoPromedioMensual != null ? Number(s.consumoPromedioMensual) : null,
    actualizadoAt: s.actualizadoAt.toISOString(),
  };
}

export async function serviciosPublicosRoutes(app: FastifyInstance): Promise<void> {
  // Verifica que la propiedad exista y sea de la inmobiliaria del usuario.
  async function propiedadDelTenant(
    propiedadId: string,
    inmobiliariaId: string,
    reply: FastifyReply,
  ): Promise<boolean> {
    const prp = await prisma.propiedad.findFirst({
      where: { id: propiedadId, inmobiliariaId },
      select: { id: true },
    });
    if (!prp) {
      await reply.code(404).send({ message: 'Propiedad no encontrada' });
      return false;
    }
    return true;
  }

  // GET — lista de servicios de la propiedad.
  app.get('/propiedades/:propiedadId/servicios', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'propiedades.ver');
    if (!u) return;
    const { propiedadId } = request.params as { propiedadId: string };
    if (!(await propiedadDelTenant(propiedadId, u.inmobiliariaId, reply))) return;
    const servicios = await prisma.servicioPublico.findMany({
      where: { propiedadId },
      orderBy: { tipo: 'asc' },
    });
    return servicios.map((s) => serializar(s as ServicioRow));
  });

  // PUT — alta o edición de un servicio (upsert por tipo).
  app.put('/propiedades/:propiedadId/servicios/:tipo', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'propiedades.crear');
    if (!u) return;
    const { propiedadId, tipo: tipoRaw } = request.params as { propiedadId: string; tipo: string };
    const tipoParsed = TIPO.safeParse(tipoRaw);
    if (!tipoParsed.success) return reply.code(400).send({ message: 'Tipo de servicio inválido' });
    if (!(await propiedadDelTenant(propiedadId, u.inmobiliariaId, reply))) return;
    const parsed = upsertSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: 'Datos inválidos', detalle: parsed.error.flatten() });
    }
    const b = parsed.data;
    const datos = {
      distribuidora: b.distribuidora,
      nis: b.nis,
      numeroMedidor: b.numeroMedidor ?? null,
      titular: b.titular ?? null,
      observaciones: b.observaciones ?? null,
      consumoPromedioMensual: b.consumoPromedioMensual ?? null,
    };
    const servicio = await prisma.servicioPublico.upsert({
      where: { propiedadId_tipo: { propiedadId, tipo: tipoParsed.data } },
      create: { inmobiliariaId: u.inmobiliariaId, propiedadId, tipo: tipoParsed.data, ...datos },
      update: datos,
    });
    return serializar(servicio as ServicioRow);
  });

  // DELETE — saca un servicio (idempotente: deleteMany no falla si no está).
  app.delete('/propiedades/:propiedadId/servicios/:tipo', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'propiedades.crear');
    if (!u) return;
    const { propiedadId, tipo: tipoRaw } = request.params as { propiedadId: string; tipo: string };
    const tipoParsed = TIPO.safeParse(tipoRaw);
    if (!tipoParsed.success) return reply.code(400).send({ message: 'Tipo de servicio inválido' });
    if (!(await propiedadDelTenant(propiedadId, u.inmobiliariaId, reply))) return;
    await prisma.servicioPublico.deleteMany({ where: { propiedadId, tipo: tipoParsed.data } });
    return { ok: true };
  });
}
