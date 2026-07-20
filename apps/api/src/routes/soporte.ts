// Soporte (Bugs): proxy server-a-server a Sonar. Gateado por requireUsuario —
// cualquier miembro autenticado del panel puede ver los tickets de error. Las credenciales
// de Sonar viven solo en Railway (lib/sonar.ts); el front consume /api/soporte/* con
// su JWT normal de My Alquiler.

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
  // Estado de configuración + proyecto con conteos (para el header). No falla si Sonar no
  // está seteado: devuelve { configured: false } y el front muestra un empty state amable.
  app.get('/api/soporte/config', async (request, reply) => {
    const user = await requireUsuario(request, reply);
    if (!user) return;
    if (!sonarConfigured()) return { configured: false as const };
    const project = await sonarProjectOverview();
    return { configured: true as const, project };
  });

  app.get('/api/soporte/issues', async (request, reply) => {
    const user = await requireUsuario(request, reply);
    if (!user) return;
    const q = listQuery.parse(request.query);
    const issues = await sonarListIssues(q);
    return { issues };
  });

  app.get('/api/soporte/issues/:id', async (request, reply) => {
    const user = await requireUsuario(request, reply);
    if (!user) return;
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const issue = await sonarGetIssue(id);
    return { issue };
  });

  app.patch('/api/soporte/issues/:id', async (request, reply) => {
    const user = await requireUsuario(request, reply);
    if (!user) return;
    const { id } = z.object({ id: z.string().min(1) }).parse(request.params);
    const body = patchBody.parse(request.body);
    return sonarPatchIssue(id, body);
  });
}
