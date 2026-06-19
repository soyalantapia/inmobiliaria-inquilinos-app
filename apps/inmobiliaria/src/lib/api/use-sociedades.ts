'use client';

/**
 * Acceso dual a sociedades: API real en prod (apiEnabled), localStorage en demo.
 * El manager (sociedades-manager.tsx) usa SOLO estas funciones para no ramificar
 * en cada call site. Endpoints: GET/POST/PUT /sociedades, PUT /:id/principal,
 * PATCH /:id (baja / reactivar).
 */
import { apiEnabled, apiFetch } from './client';
import { ensureApiSession } from './session';
import {
  listarSociedades as listarLocal,
  agregarSociedad as agregarLocal,
  actualizarSociedad as actualizarLocal,
  marcarComoPrincipal as principalLocal,
  desactivarSociedad as bajaLocal,
  reactivarSociedad as reactivarLocal,
  type NuevaSociedadInput,
  type Sociedad,
} from '@/lib/sociedades-storage';

interface SociedadApi {
  id: string;
  razonSocial: string;
  nombreComercial: string;
  cuit: string | null;
  condicionFiscal: Sociedad['condicionFiscal'];
  domicilioFiscal: string | null;
  email: string | null;
  telefono: string | null;
  cuentaCobranza: Sociedad['cuentaCobranza'] | null;
  afip: Sociedad['afip'] | null;
  esPrincipal: boolean;
  activa: boolean;
  createdAt: string;
}

function mapSociedad(r: SociedadApi): Sociedad {
  return {
    id: r.id,
    razonSocial: r.razonSocial,
    nombreComercial: r.nombreComercial,
    cuit: r.cuit ?? '',
    condicionFiscal: r.condicionFiscal,
    domicilioFiscal: r.domicilioFiscal ?? '',
    email: r.email ?? '',
    telefono: r.telefono ?? '',
    cuentaCobranza: r.cuentaCobranza ?? undefined,
    afip: r.afip ?? { conectado: false },
    esPrincipal: !!r.esPrincipal,
    activa: !!r.activa,
    createdAt: typeof r.createdAt === 'string' ? r.createdAt.slice(0, 10) : r.createdAt,
  };
}

export async function cargarSociedades(opts: { incluirInactivas?: boolean } = {}): Promise<Sociedad[]> {
  if (!apiEnabled) return listarLocal(opts);
  await ensureApiSession();
  const qs = opts.incluirInactivas ? '?incluirInactivas=true' : '';
  const rows = await apiFetch<SociedadApi[]>(`/sociedades${qs}`);
  return rows.map(mapSociedad);
}

export async function crearSociedad(input: NuevaSociedadInput): Promise<void> {
  if (!apiEnabled) {
    agregarLocal(input);
    return;
  }
  await ensureApiSession();
  await apiFetch('/sociedades', { method: 'POST', body: JSON.stringify(input) });
}

export async function editarSociedad(id: string, cambios: Partial<NuevaSociedadInput>): Promise<void> {
  if (!apiEnabled) {
    actualizarLocal(id, cambios);
    return;
  }
  await ensureApiSession();
  await apiFetch(`/sociedades/${id}`, { method: 'PUT', body: JSON.stringify(cambios) });
}

export async function hacerPrincipal(id: string): Promise<void> {
  if (!apiEnabled) {
    principalLocal(id);
    return;
  }
  await ensureApiSession();
  await apiFetch(`/sociedades/${id}/principal`, { method: 'PUT' });
}

export async function darDeBaja(id: string): Promise<void> {
  if (!apiEnabled) {
    bajaLocal(id);
    return;
  }
  await ensureApiSession();
  await apiFetch(`/sociedades/${id}`, { method: 'PATCH', body: JSON.stringify({}) });
}

export async function reactivar(id: string): Promise<void> {
  if (!apiEnabled) {
    reactivarLocal(id);
    return;
  }
  await ensureApiSession();
  await apiFetch(`/sociedades/${id}`, { method: 'PATCH', body: JSON.stringify({ reactivar: true }) });
}
