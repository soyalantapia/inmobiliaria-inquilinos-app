'use client';

/**
 * Alta auto-servicio de inmobiliaria contra el API.
 * POST /auth/registro → { token, nombre, rol }. Ante éxito persiste el token
 * para que el panel quede logueado inmediatamente.
 */

import { apiFetch, setToken, ApiError } from './client';

export interface RegistroInmobiliaria {
  nombre: string;
  email: string;
  telefono: string;
  ciudad: string;
  provincia: string;
}

export interface RegistroAdmin {
  nombre: string;
  apellido: string;
  password: string;
}

export interface RegistroBody {
  inmobiliaria: RegistroInmobiliaria;
  admin: RegistroAdmin;
}

export interface RegistroResult {
  nombre: string;
  rol: string;
}

/**
 * Crea la cuenta y deja la sesión iniciada (guarda el JWT).
 * @throws Error con mensaje claro si el email ya está registrado (409) o si el
 *         server rechaza los datos / falla la conexión.
 */
export async function registrar(body: RegistroBody): Promise<RegistroResult> {
  try {
    const res = await apiFetch<{ token: string; nombre: string; rol: string }>('/auth/registro', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    setToken(res.token);
    return { nombre: res.nombre, rol: res.rol };
  } catch (err) {
    if (err instanceof ApiError && err.status === 409) {
      throw new Error('Ya existe una cuenta con ese email');
    }
    if (err instanceof ApiError && err.status === 400) {
      throw new Error(err.message || 'Revisá los datos: algún campo es inválido.');
    }
    throw new Error('No se pudo crear la cuenta. Revisá tu conexión y probá de nuevo.');
  }
}
