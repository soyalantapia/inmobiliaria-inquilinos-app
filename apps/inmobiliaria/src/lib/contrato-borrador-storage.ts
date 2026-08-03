'use client';

import { getToken } from './api/client';

export interface BorradorContrato {
  paso: number;
  propiedadId: string;
  nombre: string;
  apellido: string;
  email: string;
  telefono: string;
  dni: string;
  personaId: string | null;
  busquedaPersona: string;
  monto: string;
  moneda: string;
  fechaInicio: string;
  fechaFin: string;
  diaPago: string;
  indiceAjuste: string;
  frecuenciaAjusteMeses: string;
  tipoContrato: string;
  montoExpensas: string;
  depositoGarantia: string;
  comisionInmobiliaria: string;
  modoCobranza: string;
  mascotasPermitidas: boolean | null;
  moraSel: string;
  moraValor: string;
  periodosForm: Record<string, { estado: string; montoPagado: string; moraManual: string; moraEditada: boolean }>;
  // Campos nuevos: OPCIONALES a propósito. Un borrador guardado antes de esta
  // versión sigue en localStorage y se lee con el mismo tipo; si fueran
  // obligatorios el restore mentiría sobre lo que hay guardado.
  /** Historial de canon declarado, SIN la última vigencia (esa se deriva del monto). */
  vigenciasPrevias?: Array<{ desde: string; monto: string }>;
  /** Mes desde el que rige el monto actual del contrato. */
  desdeCanonActual?: string;
  moraHistoricaCongelada?: boolean;
  /**
   * Cuántos garantes declaró el paso Documentación. Es lo ÚNICO de ese paso que
   * entra al borrador: los `File` no, porque `JSON.stringify` los serializa como
   * `{}` y al restaurar la pantalla mostraría archivos que ya no existen.
   */
  garantesCount?: number;
}

export function obtenerNamespaceBorrador(): string | null {
  try {
    const token = getToken();
    if (!token) return null;

    const parts = token.split('.');
    if (parts.length !== 3 || !parts[1]) return null;

    // Decodificar payload (base64url)
    let payload = parts[1];
    // Reemplazar caracteres base64url
    payload = payload.replace(/-/g, '+').replace(/_/g, '/');
    // Agregar padding si falta
    const padding = payload.length % 4 === 0 ? '' : '='.repeat(4 - (payload.length % 4));
    payload += padding;

    const decoded = atob(payload);
    const payloadObj = JSON.parse(decoded) as Record<string, unknown>;

    const userId = payloadObj.userId;
    const inmobiliariaId = payloadObj.inmobiliariaId;

    if (typeof userId !== 'string' || !userId || typeof inmobiliariaId !== 'string' || !inmobiliariaId) {
      return null;
    }

    return `${userId}:${inmobiliariaId}`;
  } catch {
    return null;
  }
}

export function leerBorradorContrato(namespace: string): BorradorContrato | null {
  if (typeof window === 'undefined') return null;
  try {
    const key = `llave-inmo:contrato-borrador:v1:${namespace}`;
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as BorradorContrato;
  } catch {
    return null;
  }
}

export function guardarBorradorContrato(namespace: string, datos: BorradorContrato): void {
  if (typeof window === 'undefined') return;
  try {
    const key = `llave-inmo:contrato-borrador:v1:${namespace}`;
    window.localStorage.setItem(key, JSON.stringify(datos));
  } catch {
    // localStorage lleno o deshabilitado — fallback silencioso, el
    // estado React mantiene los cambios para la sesión.
  }
}

export function borrarBorradorContrato(namespace: string): void {
  if (typeof window === 'undefined') return;
  try {
    const key = `llave-inmo:contrato-borrador:v1:${namespace}`;
    window.localStorage.removeItem(key);
  } catch {
    // storage error — silencioso
  }
}
