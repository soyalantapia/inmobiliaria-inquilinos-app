// Soporte (Bugs): proxy server-a-server a Sonar. Las credenciales de Sonar viven solo en
// Railway (lib/sonar.ts); el front consume /api/soporte/* con su JWT normal de My Alquiler.
//
// ⚠️ NO es un feature por inquilino: Sonar es UN proyecto global para todo MyAlquiler, así
// que sus tickets mezclan a todos los tenants. El acceso exige capacidad Y pertenecer al
// allowlist `SOPORTE_TENANT_IDS` (ver requireSoporte abajo). Fail-closed.

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  sonarConfigured,
  sonarProjectOverview,
  sonarListIssues,
  sonarGetIssue,
  sonarPatchIssue,
} from '../lib/sonar.js';
import { requireUsuario } from '../auth/guards.js';

const StatusZ = z.enum(['open', 'resolved', 'ignored', 'snoozed']);
const SeverityZ = z.enum(['critical', 'high', 'medium', 'low']);

const listQuery = z.object({
  status: StatusZ.optional(),
  severity: SeverityZ.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

const patchBody = z.object({
  status: StatusZ.optional(),
  severity: SeverityZ.optional(),
  note: z.string().max(2000).optional(),
  snoozeHours: z.coerce.number().int().min(1).max(24 * 30).optional(),
});

export async function soporteRoutes(app: FastifyInstance) {
  // LEER usa 'auditoria.ver' (ADMIN + LECTURA): la misma capacidad con la que el sidebar
  // gatea el link, así la API y la nav no se contradicen (antes cualquier rol entraba por
  // URL directa aunque no viera el link).
  // MUTAR usa 'equipo.gestionar' (solo ADMIN): cerrar o ignorar un ticket decide si un bug
  // se sigue mirando; no es para un rol de sola lectura.
  const VER = 'auditoria.ver' as const;
  const GESTIONAR = 'equipo.gestionar' as const;

  // FRONTERA DE TENANT (P0 de la auditoría 21/07). Sonar es UN proyecto global para todo
  // MyAlquiler: sus tickets mezclan a TODAS las inmobiliarias, con la PII de sus inquilinos
  // (nombre, email y el texto libre del reporte, que suele describir su situación de pago).
  // La capacidad sola no era una frontera: `auditoria.ver` la tiene cualquier ADMIN, y como
  // `/auth/registro` es alta pública, cualquiera con un email se registraba y leía los
  // tickets de todos los tenants. Por eso el acceso se restringe al operador del SaaS vía
  // allowlist explícita, y es FAIL-CLOSED: sin `SOPORTE_TENANT_IDS` no entra nadie.
  const tenantHabilitado = (inmobiliariaId: string) =>
    app.env.SOPORTE_TENANT_IDS.includes(inmobiliariaId);

  /** requireUsuario + frontera de tenant. Devuelve null si ya respondió 401/403. */
  const requireSoporte = async (
    request: Parameters<typeof requireUsuario>[0],
    reply: Parameters<typeof requireUsuario>[1],
    capacidad: typeof VER | typeof GESTIONAR,
  ) => {
    const user = await requireUsuario(request, reply, capacidad);
    if (!user) return null;
    if (!tenantHabilitado(user.inmobiliariaId)) {
      await reply.code(403).send({ message: 'Soporte no está habilitado para esta cuenta' });
      return null;
    }
    return user;
  };

  // Estado de configuración + proyecto con conteos (para el header). No falla si Sonar no
  // está seteado: devuelve { configured: false } y el front muestra un empty state amable.
  app.get('/api/soporte/config', async (request, reply) => {
    const user = await requireUsuario(request, reply, VER);
    if (!user) return;
    // Tenant no habilitado: degradamos al mismo empty state que "Sonar sin configurar"
    // en vez de un 403. Así la pantalla no rompe y no revelamos si Sonar existe.
    if (!tenantHabilitado(user.inmobiliariaId)) return { configured: false as const };
    if (!sonarConfigured()) return { configured: false as const };
    const project = await sonarProjectOverview();
    return { configured: true as const, project };
  });

  app.get('/api/soporte/issues', async (request, reply) => {
    const user = await requireSoporte(request, reply, VER);
    if (!user) return;
    const q = listQuery.parse(request.query);
    const issues = await sonarListIssues(q);
    return { issues };
  });

  app.get('/api/soporte/issues/:id', async (request, reply) => {
    const user = await requireSoporte(request, reply, VER);
    if (!user) return;
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const issue = await sonarGetIssue(id);
    return { issue };
  });

  app.patch('/api/soporte/issues/:id', async (request, reply) => {
    const user = await requireSoporte(request, reply, GESTIONAR);
    if (!user) return;
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const body = patchBody.parse(request.body);
    // Rastro del actor: Sonar registra el cambio contra el BOT (un solo usuario para todo
    // MyAlquiler), así que sin esto el timeline no dice quién lo tocó. Lo dejamos en la nota,
    // que es lo único que Sonar persiste por evento. Usamos los ids del JWT (no el email:
    // no viaja en el token, y además evitamos meter PII en un ticket compartido).
    const firma = `[${user.rol} ${user.userId} · inmo ${user.inmobiliariaId}]`;
    const note = body.note ? `${body.note} ${firma}` : firma;
    return sonarPatchIssue(id, { ...body, note });
  });
}
