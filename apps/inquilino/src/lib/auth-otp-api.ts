'use client';

/**
 * Capa unificada de auth OTP: si hay backend (NEXT_PUBLIC_API_URL), el flujo
 * pega al API y guarda el JWT; si no, cae al flujo localStorage de siempre.
 * En ambos casos se persiste la MISMA sesión local (InquilinoSesion) para que
 * el resto de la app siga funcionando sin cambios.
 */

import {
  ApiError,
  apiEnabled,
  apiFetch,
  apiFetchPersona,
  setPersonaToken,
  setToken,
} from './api/client';
import {
  SEGUNDOS_COOLDOWN,
  cerrarSesion,
  guardarSesion,
  iniciarSesionDemo,
  leerSesion,
  solicitarCodigo,
  verificarCodigo,
  type InquilinoSesion,
  type SolicitarCodigoResultado,
} from './auth-otp';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Estados posibles del contrato de un alquiler (enum EstadoContrato del API). */
export type EstadoContratoAlquiler = 'BORRADOR' | 'ACTIVO' | 'FINALIZADO' | 'RESCINDIDO';

/** Un alquiler (contrato) de la persona, tal como lo lista el API. */
export interface Alquiler {
  inquilinoId: string;
  nombre: string;
  inmobiliaria: string;
  direccion: string;
  ciudad: string;
  /** El API ya lo manda; puede faltar en respuestas viejas cacheadas. */
  estado?: EstadoContratoAlquiler | null;
}

/**
 * ¿Este alquiler ya terminó? Solo FINALIZADO y RESCINDIDO llevan el cartel:
 * un BORRADOR es un contrato cargado para revisión que todavía no arrancó, y
 * marcarlo como "Finalizado" sería mentirle al inquilino.
 */
export function esAlquilerTerminado(estado: Alquiler['estado']): boolean {
  return estado === 'FINALIZADO' || estado === 'RESCINDIDO';
}

/**
 * Resultado de verificar el OTP en el flujo unificado. Una persona (email) puede
 * tener varios alquileres, así que el OTP ya no entra directo: o entra (1 solo
 * alquiler / flujo local) o pide elegir (varios).
 */
export type VerificarUnificadoResultado =
  | { ok: true; tipo: 'entrar'; sesion: InquilinoSesion }
  | { ok: true; tipo: 'elegir'; alquileres: Alquiler[] }
  | { ok: false; motivo: string };

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
    if (e instanceof ApiError) return { ok: false, motivo: 'No pudimos enviar el código. Probá de nuevo.' };
    // API INALCANZABLE. Acá NO se cae al flujo local, y el motivo es que este catch es
    // código de PRODUCCIÓN por construcción: el guard de `!apiEnabled` de arriba ya sacó al
    // build demo, así que sólo se llega hasta acá con el API real configurado.
    //
    // Lo que pasaba: un `fetch` que rechaza —corte de 3G a mitad del flujo, DNS, CORS mal
    // configurado, el dominio de Railway bloqueado por un adblocker, un portal cautivo que
    // devuelve HTML— caía al OTP de localStorage. Eso genera un código local, lo muestra en
    // pantalla en un banner "Demo", y le arma al inquilino un perfil inventado.
    // Un arreglo previo (0b042656) sacó el `codigo: '000000'` del camino feliz, pero dejó
    // este catch: cerró la puerta y no la ventana.
    return { ok: false, motivo: 'No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.' };
  }
  return {
    ok: true,
    email: emailNorm,
    // En prod el código llega SOLO por email — no lo exponemos en el front (antes
    // devolvíamos '000000' y aparecía el banner demo en producción, confuso).
    cooldownHasta: Date.now() + SEGUNDOS_COOLDOWN * 1000,
  };
}

export async function verificarCodigoUnificado(
  email: string,
  codigo: string,
): Promise<VerificarUnificadoResultado> {
  if (!apiEnabled) return desdeLocal(email, codigo);

  const emailNorm = email.trim().toLowerCase();
  try {
    const r = await apiFetch<{ personaToken: string; alquileres: Alquiler[] }>(
      '/auth/otp/verify',
      {
        method: 'POST',
        body: JSON.stringify({ email: emailNorm, code: codigo.replace(/\s/g, '') }),
      },
    );
    // Entrar con un email REEMPLAZA lo que hubiera en este dispositivo: si quedó
    // la sesión de un co-inquilino (o de otra persona), la descartamos ahora. Sin
    // esto el login se rompía: getPersonaToken borra el persona-token mientras la
    // sesión activa sea de un co-inquilino, así que el token recién emitido moría
    // antes de poder elegir alquiler.
    const previa = leerSesion();
    if (previa && (previa.esCoInquilino === true || previa.email?.toLowerCase() !== emailNorm)) {
      cerrarSesion();
    }
    // Guardamos el persona-token: habilita /elegir y /alquileres (switcher).
    setPersonaToken(r.personaToken);
    if (r.alquileres.length === 0) {
      // No debería pasar (verify exige ≥1 fila para el email), pero defensivo.
      return { ok: false, motivo: 'No encontramos alquileres para este email.' };
    }
    if (r.alquileres.length === 1) {
      // Un solo alquiler → entramos directo, sin pantalla de selección.
      const sesion = await elegirAlquiler(r.alquileres[0]!.inquilinoId, 1);
      return { ok: true, tipo: 'entrar', sesion };
    }
    // Varios → la UI muestra el selector y llama a elegirAlquiler con la elegida.
    return { ok: true, tipo: 'elegir', alquileres: r.alquileres };
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      // El backend devuelve 401 tanto si el código es incorrecto como si venció,
      // sin distinguir. NO ordenamos "Pedí uno nuevo" (la acción de reenvío puede
      // estar bloqueada por el cooldown): pedimos revisar y reintentar, que el
      // usuario SIEMPRE puede hacer de inmediato.
      return { ok: false, motivo: 'Código incorrecto o vencido. Revisá los dígitos e intentá de nuevo.' };
    }
    if (e instanceof ApiError) {
      return { ok: false, motivo: e.message || 'No pudimos verificar el código. Probá de nuevo.' };
    }
    // API inalcanzable. Igual que en `solicitarCodigoUnificado`: NO se cae al flujo local,
    // porque acá ya sabemos que estamos en producción.
    //
    // Y es la mitad más peligrosa de las dos. `desdeLocal` escribe la sesión pero NO toca
    // `llave:auth:token`, mientras que el camino del API sí llama a `cerrarSesion()` cuando
    // el email cambia (arriba, :110-113). O sea que en un dispositivo compartido la persona B
    // entraba con SU email por este fallback, el JWT de A sobrevivía en localStorage, y como
    // todos los hooks leen el token y no la sesión, B veía el contrato, el saldo y los pagos
    // REALES de A con su propio nombre en el header. Hay un botón que lleva justo ahí:
    // `mis-alquileres` manda a `/login?force=1` cuando se le vence el persona-token.
    return { ok: false, motivo: 'No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.' };
  }
}

/** Adapta el flujo local (sin backend) al resultado unificado. */
function desdeLocal(email: string, codigo: string): VerificarUnificadoResultado {
  const r = verificarCodigo(email, codigo);
  return r.ok && r.sesion
    ? { ok: true, tipo: 'entrar', sesion: r.sesion }
    : { ok: false, motivo: r.motivo ?? 'No pudimos verificar el código.' };
}

/**
 * Elige a qué alquiler entrar (con el persona-token del OTP). Persiste el JWT
 * del contrato como token activo + la sesión local con los datos REALES que
 * devuelve el API. `total` = cuántos alquileres tiene la persona (para mostrar
 * el switcher en Cuenta sólo si hay más de uno).
 */
export async function elegirAlquiler(inquilinoId: string, total: number): Promise<InquilinoSesion> {
  const r = await apiFetchPersona<{
    token: string;
    inquilinoId: string;
    email: string;
    nombre: string;
    apellido: string;
    direccion: string;
    ciudad: string;
    contratoId: string;
    inmobiliaria: string;
  }>('/auth/inquilino/elegir', {
    method: 'POST',
    body: JSON.stringify({ inquilinoId }),
  });
  setToken(r.token);
  const sesion: InquilinoSesion = {
    email: r.email,
    nombre: r.nombre,
    apellido: r.apellido,
    direccion: r.direccion,
    contratoId: r.contratoId,
    esInvitado: false,
    loggeadoAt: new Date().toISOString(),
    inquilinoId: r.inquilinoId,
    alquileresCount: total,
  };
  guardarSesion(sesion);
  return sesion;
}

/** Lista los alquileres de la persona (para el switcher). Requiere persona-token. */
export async function listarAlquileres(): Promise<Alquiler[]> {
  const r = await apiFetchPersona<{ alquileres: Alquiler[] }>('/auth/inquilino/alquileres');
  return r.alquileres;
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
  // Si este dispositivo tenía guardado el persona-token de OTRA sesión (ej. el
  // titular se logueó antes acá y no cerró sesión), hay que pisarlo: si no,
  // /mis-alquileres seguiría devolviendo los alquileres de esa otra persona
  // aunque la sesión activa ahora sea la de este co-inquilino. El co-inquilino
  // no tiene (ni debe tener) persona-token propio.
  setPersonaToken(null);
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
