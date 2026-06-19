'use client';

/**
 * Capa unificada de auth OTP: si hay backend (NEXT_PUBLIC_API_URL), el flujo
 * pega al API y guarda el JWT; si no, cae al flujo localStorage de siempre.
 * En ambos casos se persiste la MISMA sesión local (InquilinoSesion) para que
 * el resto de la app siga funcionando sin cambios.
 */

import { ApiError, apiEnabled, apiFetch, setToken } from './api/client';
import {
  SEGUNDOS_COOLDOWN,
  guardarSesion,
  iniciarSesionDemo,
  resolverInquilinoLocal,
  solicitarCodigo,
  verificarCodigo,
  type InquilinoSesion,
  type SolicitarCodigoResultado,
  type VerificarCodigoResultado,
} from './auth-otp';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function solicitarCodigoUnificado(email: string): Promise<SolicitarCodigoResultado> {
  if (!apiEnabled) return solicitarCodigo(email);

  const emailNorm = email.trim().toLowerCase();
  if (!EMAIL_RE.test(emailNorm)) return { ok: false, motivo: 'Email inválido' };
  try {
    await apiFetch('/auth/otp/request', {
      method: 'POST',
      body: JSON.stringify({ email: emailNorm }),
    });
  } catch (e) {
    // Server respondió con error → lo informamos. Server inalcanzable (red) →
    // caemos al flujo local para no romper el dev/demo sin backend.
    if (e instanceof ApiError) return { ok: false, motivo: 'No pudimos enviar el código. Probá de nuevo.' };
    return solicitarCodigo(email);
  }
  return {
    ok: true,
    email: emailNorm,
    // El código real viaja por email/log del server. Mientras el server esté en
    // DEMO_MODE acepta 000000 — lo mostramos en el banner demo del login.
    codigo: '000000',
    cooldownHasta: Date.now() + SEGUNDOS_COOLDOWN * 1000,
  };
}

export async function verificarCodigoUnificado(
  email: string,
  codigo: string,
): Promise<VerificarCodigoResultado> {
  if (!apiEnabled) return verificarCodigo(email, codigo);

  const emailNorm = email.trim().toLowerCase();
  try {
    const r = await apiFetch<{ token: string; nombre: string }>('/auth/otp/verify', {
      method: 'POST',
      body: JSON.stringify({ email: emailNorm, code: codigo.replace(/\s/g, '') }),
    });
    setToken(r.token);
    const sesion: InquilinoSesion = {
      ...resolverInquilinoLocal(emailNorm),
      loggeadoAt: new Date().toISOString(),
    };
    guardarSesion(sesion);
    return { ok: true, sesion };
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      return { ok: false, motivo: 'Código inválido o vencido. Pedí uno nuevo.' };
    }
    if (e instanceof ApiError) {
      return { ok: false, motivo: 'No pudimos verificar el código. Probá de nuevo.' };
    }
    // API inalcanzable → flujo local (el código local que generó el fallback)
    return verificarCodigo(email, codigo);
  }
}

// ===== Co-inquilino: aceptar la invitación por link =====

export interface CoInvitacionDetalle {
  nombre: string;
  relacion: string;
  permiso: 'VER' | 'PAGAR' | 'COMPLETO';
  estado: 'PENDIENTE' | 'ACEPTADO';
  direccion: string;
  ciudad: string;
  inmobiliaria: string;
}

/** Detalle público de la invitación (para la pantalla del link). */
export async function leerInvitacionCoInquilino(token: string): Promise<CoInvitacionDetalle> {
  return apiFetch<CoInvitacionDetalle>(`/co-invitacion/${encodeURIComponent(token)}`);
}

/** Acepta la invitación, guarda la sesión del co-inquilino y la devuelve. */
export async function aceptarInvitacionCoInquilino(token: string): Promise<InquilinoSesion> {
  const r = await apiFetch<{
    token: string;
    nombre: string;
    email: string;
    permiso: 'VER' | 'PAGAR' | 'COMPLETO';
    contratoId: string;
    direccion: string;
    ciudad: string;
  }>(`/co-invitacion/${encodeURIComponent(token)}/aceptar`, { method: 'POST' });
  setToken(r.token);
  const partes = r.nombre.trim().split(' ');
  const sesion: InquilinoSesion = {
    email: r.email ?? '',
    nombre: partes[0] ?? r.nombre,
    apellido: partes.slice(1).join(' '),
    direccion: r.direccion ?? '',
    contratoId: r.contratoId ?? '',
    esInvitado: true,
    esCoInquilino: true,
    permiso: r.permiso,
    loggeadoAt: new Date().toISOString(),
  };
  guardarSesion(sesion);
  return sesion;
}

/** Demo (?demo=1): sesión local de Mariela siempre; si hay API, también su JWT. */
export function iniciarSesionDemoUnificada(): InquilinoSesion {
  const sesion = iniciarSesionDemo();
  if (apiEnabled) {
    void apiFetch<{ token: string }>('/auth/demo', { method: 'POST' })
      .then((r) => setToken(r.token))
      .catch(() => {
        // sin backend disponible la demo local sigue andando
      });
  }
  return sesion;
}
