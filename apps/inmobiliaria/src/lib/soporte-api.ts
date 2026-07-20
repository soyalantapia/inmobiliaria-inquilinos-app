// Fetchers para la vista Soporte: consumen /api/soporte/* del backend de My Alquiler
// (que hace proxy a Sonar). El front NUNCA habla a Sonar directo.

import { apiFetch, apiEnabled } from '@/lib/api/client';

export type SoporteStatus = 'open' | 'resolved' | 'ignored' | 'snoozed';
export type SoporteSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface SoporteIssueListItem {
  id: string;
  title: string;
  kind: string;
  status: SoporteStatus;
  severity: SoporteSeverity;
  occurrenceCount: number;
  usersAffected: number;
  firstSeenAt: string;
  lastSeenAt: string;
  release: string | null;
  route: string | null;
  environment: string;
  assignedTo: string | null;
}

export interface SoporteOccurrence {
  id: string;
  createdAt: string;
  environment: string;
  route: string | null;
  release: string | null;
  reportedBy: string | null;
  sessionId: string | null;
  correlationId: string | null;
  payload: unknown;
  serverContext: unknown;
}

export interface SoporteEvent {
  id: string;
  type: string;
  actorUserId: string | null;
  fromStatus: string | null;
  toStatus: string | null;
  note: string | null;
  createdAt: string;
}

export interface SoporteIssueDetail extends SoporteIssueListItem {
  fingerprint: string;
  context: unknown;
  resolvedAt: string | null;
  muteUntil: string | null;
  occurrences: SoporteOccurrence[];
  events: SoporteEvent[];
  project: { id: string; slug: string; name: string };
}

export interface SoporteProject {
  id: string;
  slug: string;
  name: string;
  counts: { open: number; total: number };
}

export type SoporteConfig =
  | { configured: false }
  | { configured: true; project: SoporteProject };

export interface PatchSoporteBody {
  status?: SoporteStatus;
  severity?: SoporteSeverity;
  note?: string;
  snoozeHours?: number;
}

export const soporteHabilitado = (): boolean => apiEnabled;

export const getSoporteConfig = (): Promise<SoporteConfig> =>
  apiFetch('/api/soporte/config');

export const listarIssues = (q: {
  status?: SoporteStatus;
  severity?: SoporteSeverity;
  limit?: number;
}): Promise<{ issues: SoporteIssueListItem[] }> => {
  const params = new URLSearchParams();
  if (q.status) params.set('status', q.status);
  if (q.severity) params.set('severity', q.severity);
  if (q.limit) params.set('limit', String(q.limit));
  const qs = params.toString();
  return apiFetch(`/api/soporte/issues${qs ? `?${qs}` : ''}`);
};

export const getIssue = (id: string): Promise<{ issue: SoporteIssueDetail }> =>
  apiFetch(`/api/soporte/issues/${encodeURIComponent(id)}`);

export const patchIssue = (
  id: string,
  body: PatchSoporteBody,
): Promise<{ ok: boolean }> =>
  apiFetch(`/api/soporte/issues/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
