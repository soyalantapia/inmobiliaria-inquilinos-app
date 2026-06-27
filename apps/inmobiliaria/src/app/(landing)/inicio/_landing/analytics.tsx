'use client';

import { useEffect } from 'react';
import type { PostHog } from 'posthog-js';

/**
 * Analítica de la landing (PostHog), env-gated y de carga diferida.
 *
 * No se carga nada hasta después de montar (no toca el LCP) y SOLO si está
 * `NEXT_PUBLIC_POSTHOG_KEY`. Sin la key, todo es no-op: la landing anda igual.
 * Para encenderlo: crear cuenta gratis en PostHog y setear en el service front
 * de Railway `NEXT_PUBLIC_POSTHOG_KEY` (y opcional `NEXT_PUBLIC_POSTHOG_HOST`).
 */

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

let ph: PostHog | null = null;

/** Capturá un evento. No-op si PostHog no está cargado (sin key). */
export function track(event: string, props?: Record<string, unknown>): void {
  try {
    ph?.capture(event, props);
  } catch {
    /* noop */
  }
}

/** ¿Hay analítica activa? (para decidir si corremos el A/B sin ensuciar SSR). */
export const analyticsEnabled = Boolean(KEY);

/**
 * Variante del experimento A/B del headline, 50/50, persistida por visitante.
 * Solo se asigna si hay analítica (si no, todos ven la variante ganadora A y no
 * hay flash). El valor viaja como super-property en todos los eventos.
 */
export function getHeroVariant(): 'A' | 'B' {
  if (!KEY || typeof window === 'undefined') return 'A';
  try {
    const k = 'ml:hero-variant';
    let v = window.localStorage.getItem(k);
    if (v !== 'A' && v !== 'B') {
      v = Math.random() < 0.5 ? 'A' : 'B';
      window.localStorage.setItem(k, v);
    }
    return v as 'A' | 'B';
  } catch {
    return 'A';
  }
}

export function AnalyticsProvider() {
  useEffect(() => {
    if (!KEY) return;
    let cancelled = false;

    import('posthog-js')
      .then(({ default: posthog }) => {
        if (cancelled) return;
        posthog.init(KEY, {
          api_host: HOST,
          capture_pageview: true,
          capture_pageleave: true,
          person_profiles: 'identified_only',
          loaded: (p) => p.register({ hero_variant: getHeroVariant() }),
        });
        ph = posthog;
        track('landing_view');
      })
      .catch(() => {});

    // Profundidad de scroll: 25/50/75/100% una sola vez cada uno.
    const hit = new Set<number>();
    const onScroll = () => {
      const el = document.documentElement;
      const max = el.scrollHeight - window.innerHeight;
      if (max <= 0) return;
      const pct = Math.round((el.scrollTop / max) * 100);
      for (const m of [25, 50, 75, 100]) {
        if (pct >= m && !hit.has(m)) {
          hit.add(m);
          track('scroll_depth', { depth: m });
        }
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelled = true;
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  return null;
}
