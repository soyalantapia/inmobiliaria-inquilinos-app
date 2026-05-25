'use client';

/**
 * Overrides locales para Propietarios del mock. Igual patrón que
 * propiedades-overrides-storage: el dato base vive en mock-data.ts, y
 * las ediciones del usuario quedan como PATCH en localStorage que se
 * mezcla al renderizar. En producción se reemplaza por API real.
 *
 * Cubre 3 flujos:
 *  1. Datos básicos (nombre, apellido, cuit, email, teléfono, cbuAlias, notas)
 *  2. Conexión AFIP (afip.conectado=true + condición fiscal + punto venta)
 *  3. Cuenta de cobranza directa (banco, titular, cbu, alias, cuit)
 */

import type { ArcaConfig, CuentaCobranzaDirecta, Propietario } from './types';

const STORAGE_KEY = 'llave-inmo:propietarios-overrides:v1';

export interface PropietarioOverride {
  nombre?: string;
  apellido?: string;
  cuit?: string;
  email?: string;
  telefono?: string;
  cbuAlias?: string | null;
  notas?: string | null;
  afip?: ArcaConfig;
  cuentaCobranza?: CuentaCobranzaDirecta;
}

type Store = Record<string, PropietarioOverride>;

function read(): Store {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    return {};
  }
}

function write(store: Store) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function leerOverride(propietarioId: string): PropietarioOverride {
  return read()[propietarioId] ?? {};
}

/** Merge + persist + emit evento 'propietario-actualizado'. */
export function guardarOverride(propietarioId: string, patch: PropietarioOverride): void {
  const store = read();
  store[propietarioId] = { ...store[propietarioId], ...patch };
  write(store);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('propietario-actualizado', { detail: { propietarioId } }),
    );
  }
}

export function aplicarOverride(base: Propietario): Propietario {
  const patch = leerOverride(base.id);
  return {
    ...base,
    ...(patch.nombre !== undefined ? { nombre: patch.nombre } : {}),
    ...(patch.apellido !== undefined ? { apellido: patch.apellido } : {}),
    ...(patch.cuit !== undefined ? { cuit: patch.cuit } : {}),
    ...(patch.email !== undefined ? { email: patch.email } : {}),
    ...(patch.telefono !== undefined ? { telefono: patch.telefono } : {}),
    ...(patch.cbuAlias !== undefined ? { cbuAlias: patch.cbuAlias } : {}),
    ...(patch.notas !== undefined ? { notas: patch.notas } : {}),
    ...(patch.afip !== undefined ? { afip: patch.afip } : {}),
    ...(patch.cuentaCobranza !== undefined ? { cuentaCobranza: patch.cuentaCobranza } : {}),
  };
}
