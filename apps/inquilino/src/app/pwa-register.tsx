'use client';

import { useEffect } from 'react';

export function PwaRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') return;
    // Prefijamos el basePath: en GH Pages el SW vive en <basePath>/sw.js; con
    // '/sw.js' (raíz del dominio) daba 404 y la PWA no se registraba ni era
    // instalable. El scope debe coincidir con el basePath. En dev/Railway BP=''.
    const base = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
    navigator.serviceWorker.register(`${base}/sw.js`, { scope: `${base}/` }).catch(() => {
      // sin telemetría en MVP, Sentry lo va a capturar después
    });
  }, []);
  return null;
}
