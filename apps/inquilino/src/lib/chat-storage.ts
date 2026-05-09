'use client';

import type { MensajeChat } from './types';

const STORAGE_VERSION = 1;
const KEY_PREFIX = 'llave:chat';

interface ChatPayload {
  v: number;
  mensajes: MensajeChat[];
}

const buildKey = (contratoId: string) => `${KEY_PREFIX}:${contratoId}`;

export function leerChat(contratoId: string): MensajeChat[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(buildKey(contratoId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ChatPayload;
    if (parsed.v !== STORAGE_VERSION) return null;
    return parsed.mensajes;
  } catch {
    return null;
  }
}

export function guardarChat(contratoId: string, mensajes: MensajeChat[]): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: ChatPayload = { v: STORAGE_VERSION, mensajes };
    window.localStorage.setItem(buildKey(contratoId), JSON.stringify(payload));
  } catch {
    // localStorage lleno o bloqueado — silencioso por ahora, Sentry lo agarra después
  }
}

export function limpiarChat(contratoId: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(buildKey(contratoId));
}
