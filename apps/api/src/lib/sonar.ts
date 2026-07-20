// Cliente de Sonar (error-reporting propio) para el proxy de Soporte del admin.
// El front NUNCA habla con Sonar directo: pega a /api/soporte/* del backend, y ESTE
// módulo autentica server-a-server contra Sonar. Así el secreto de login vive solo en
// Railway (nunca en el bundle) y todo queda scopeado al proyecto myalquiler.
//
// Sonar no expone API-key de gestión: los endpoints de tickets son JWT. Minteamos el
// JWT vía POST /auth/dev-login con un usuario project_admin SCOPEADO a myalquiler
// (no el owner cross-app) y lo cacheamos (dura 7 días). Se refresca por antigüedad o
// ante un 401.

/** Limpia env vars: comillas de más y espacios. */
function envClean(v?: string): string {
  return (v ?? '').trim().replace(/^["']+|["']+$/g, '').trim();
}

const API_URL = () => envClean(process.env.SONAR_API_URL).replace(/\/$/, '');
const LOGIN_EMAIL = () => envClean(process.env.SONAR_LOGIN_EMAIL);
const LOGIN_SECRET = () => envClean(process.env.SONAR_LOGIN_SECRET);
// Override opcional del id de proyecto; si falta se descubre vía /v1/projects (el bot
// scopeado a myalquiler ve SOLO ese proyecto, así que projects[0] siempre es correcto).
const PROJECT_ID_ENV = () => envClean(process.env.SONAR_PROJECT_ID);

export function sonarConfigured(): boolean {
  return !!(API_URL() && LOGIN_EMAIL() && LOGIN_SECRET());
}

/** Error con statusCode que el setErrorHandler de Fastify pasa tal cual. `expose: true`
 *  porque el mensaje describe al servicio EXTERNO (Sonar) — no filtra internals nuestros —
 *  y el front necesita distinguir "soporte caído/no configurado" de un bug del API. */
function sonarErr(statusCode: number, message: string): Error {
  const err = new Error(message) as Error & { statusCode: number; expose: boolean };
  err.statusCode = statusCode;
  err.expose = true;
  return err;
}

/** 503 limpio cuando faltan credenciales. */
function assertConfigured(): void {
  if (!sonarConfigured()) {
    throw sonarErr(503, 'Soporte (Sonar) no está configurado.');
  }
}

// ── Caché de token (module-level, sobrevive entre requests). El JWT dura 7 días; lo
//    refrescamos a los 6 para no cortar a mitad de una sesión de trabajo. ──
let tokenCache: { token: string; mintedAt: number } | null = null;
const TOKEN_TTL_MS = 6 * 24 * 60 * 60 * 1000;
const SONAR_TIMEOUT_MS = 10_000;

// Dedup del mint: N requests concurrentes con el token vencido dispararían N logins
// contra Sonar. Todas esperan la MISMA promesa en vuelo.
let mintInFlight: Promise<string> | null = null;

async function mintToken(): Promise<string> {
  if (mintInFlight) return mintInFlight;
  mintInFlight = doMint().finally(() => {
    mintInFlight = null;
  });
  return mintInFlight;
}

async function doMint(): Promise<string> {
  const res = await fetch(`${API_URL()}/auth/dev-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: LOGIN_EMAIL(), secret: LOGIN_SECRET() }),
    signal: AbortSignal.timeout(SONAR_TIMEOUT_MS),
  }).catch(() => null);
  if (!res) throw sonarErr(502, 'No se pudo comunicar con el servicio de soporte.');
  if (!res.ok) {
    // 401 = secreto/email mal; 503 = login deshabilitado en Sonar.
    throw sonarErr(502, `Autenticación con el servicio de soporte falló (${res.status}).`);
  }
  const data = (await res.json().catch(() => ({}))) as { token?: string };
  if (!data.token) throw sonarErr(502, 'El servicio de soporte no devolvió token.');
  tokenCache = { token: data.token, mintedAt: Date.now() };
  return data.token;
}

async function getToken(force = false): Promise<string> {
  if (!force && tokenCache && Date.now() - tokenCache.mintedAt < TOKEN_TTL_MS)
    return tokenCache.token;
  return mintToken();
}

/** Fetch autenticado contra Sonar. Ante 401 invalida el token y reintenta UNA vez
 *  (cubre expiración/rotación). Cualquier no-2xx no recuperable → 502 tipado. */
async function sonarFetch<T>(
  path: string,
  init: { method: string; body?: unknown } = { method: 'GET' },
): Promise<T> {
  assertConfigured();
  // Timeout: sin esto una request colgada a Sonar mantiene ocupado un handler de Fastify
  // hasta que el socket muera solo. Soporte es una pantalla secundaria: mejor fallar rápido.
  const call = async (token: string): Promise<Response | null> =>
    fetch(`${API_URL()}${path}`, {
      method: init.method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      signal: AbortSignal.timeout(SONAR_TIMEOUT_MS),
      ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
    }).catch(() => null);

  let res = await call(await getToken());
  if (res && res.status === 401) {
    // Drenamos el body del intento fallido: si no, el socket queda a medio leer y el
    // agente HTTP no lo devuelve al pool.
    await res.text().catch(() => undefined);
    res = await call(await getToken(true)); // token vencido → re-mintear
  }
  if (!res) throw sonarErr(502, 'No se pudo comunicar con el servicio de soporte.');
  if (!res.ok) {
    const detail = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
    const msg =
      detail.message ?? detail.error ?? `Error del servicio de soporte (${res.status}).`;
    if (res.status === 404) throw sonarErr(404, 'Ticket no encontrado.');
    throw sonarErr(502, msg);
  }
  return (await res.json()) as T;
}

// ── Descubrimiento del proyecto myalquiler (id cacheado). ──
let projectIdCache: string | null = null;

interface SonarProjectSummary {
  id: string;
  slug: string;
  name: string;
  status: string;
  counts: { open: number; total: number };
}

/** Proyecto myalquiler con sus conteos FRESCOS (para el header). Cachea solo el id. */
export async function sonarProjectOverview(): Promise<SonarProjectSummary> {
  const { projects } = await sonarFetch<{ projects: SonarProjectSummary[] }>('/v1/projects');
  const envId = PROJECT_ID_ENV();
  // Sin id explícito caemos al slug ANTES que a projects[0]: si el bot dejara de estar
  // scopeado (o se lo promoviera a owner) vería otros proyectos del portfolio, y tomar el
  // primero significaría leer —y escribir— tickets de OTRO producto.
  const project =
    (envId ? projects.find((p) => p.id === envId) : undefined) ??
    projects.find((p) => p.slug === 'myalquiler') ??
    (projects.length === 1 ? projects[0] : undefined);
  if (!project)
    throw sonarErr(502, 'No se encontró el proyecto en el servicio de soporte.');
  projectIdCache = project.id;
  return project;
}

async function getProjectId(): Promise<string> {
  if (projectIdCache) return projectIdCache;
  const envId = PROJECT_ID_ENV();
  if (envId) {
    projectIdCache = envId;
    return envId;
  }
  return (await sonarProjectOverview()).id;
}

// ── Shapes de tickets ──
export interface SonarIssueListItem {
  id: string;
  title: string;
  kind: string;
  status: string;
  severity: string;
  occurrenceCount: number;
  usersAffected: number;
  firstSeenAt: string;
  lastSeenAt: string;
  release: string | null;
  route: string | null;
  environment: string;
  assignedTo: string | null;
}

export interface SonarIssueDetail extends SonarIssueListItem {
  fingerprint: string;
  context: unknown;
  resolvedAt: string | null;
  muteUntil: string | null;
  occurrences: {
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
  }[];
  events: {
    id: string;
    type: string;
    actorUserId: string | null;
    fromStatus: string | null;
    toStatus: string | null;
    note: string | null;
    createdAt: string;
  }[];
  project: { id: string; slug: string; name: string };
}

export interface ListIssuesQuery {
  status?: string;
  severity?: string;
  limit?: number;
}

export async function sonarListIssues(q: ListIssuesQuery): Promise<SonarIssueListItem[]> {
  const projectId = await getProjectId();
  const params = new URLSearchParams();
  if (q.status) params.set('status', q.status);
  if (q.severity) params.set('severity', q.severity);
  params.set('limit', String(q.limit ?? 100));
  const { issues } = await sonarFetch<{ issues: SonarIssueListItem[] }>(
    `/v1/projects/${projectId}/issues?${params.toString()}`,
  );
  return issues;
}

export async function sonarGetIssue(id: string): Promise<SonarIssueDetail> {
  const { issue } = await sonarFetch<{ issue: SonarIssueDetail }>(
    `/v1/issues/${encodeURIComponent(id)}`,
  );
  return issue;
}

export interface PatchIssueBody {
  status?: string;
  severity?: string;
  note?: string;
  snoozeHours?: number;
}

export async function sonarPatchIssue(
  id: string,
  body: PatchIssueBody,
): Promise<{ ok: boolean; issue?: unknown }> {
  return sonarFetch<{ ok: boolean; issue?: unknown }>(
    `/v1/issues/${encodeURIComponent(id)}`,
    { method: 'PATCH', body },
  );
}
