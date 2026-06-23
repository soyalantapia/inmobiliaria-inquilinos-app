'use client';

import { useEffect, useReducer } from 'react';

/**
 * Estado de instalación de la PWA, como SINGLETON de módulo.
 *
 * Por qué singleton: `beforeinstallprompt` se dispara UNA sola vez por carga de
 * página. Si cada componente lo escuchara por su cuenta (como hacía el banner
 * viejo en un useEffect), el botón "Descargar" de /cuenta no tendría el evento
 * si éste ya se disparó mientras el inquilino estaba en otra pantalla. Acá lo
 * capturamos a nivel módulo (apenas carga el bundle) y lo compartimos con todas
 * las pantallas vía suscripción.
 */

interface BIPEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BIPEvent | null = null;
let instalada = false;
const subs = new Set<() => void>();
const notify = () => subs.forEach((f) => f());

function chequearInstalada(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

if (typeof window !== 'undefined') {
  instalada = chequearInstalada();
  window.addEventListener('beforeinstallprompt', (e) => {
    // Evitamos el mini-infobar nativo de Chrome para mostrar NUESTRO botón.
    e.preventDefault();
    deferred = e as BIPEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    instalada = true;
    notify();
  });
}

/** iOS Safari no dispara beforeinstallprompt → instalación por instrucciones. */
export function esIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  // Excluimos Chrome/Firefox/Edge en iOS (no pueden "agregar a inicio").
  const iPhone = /iPhone|iPad|iPod/i.test(ua) && !/CriOS|FxiOS|EdgiOS/i.test(ua);
  // iPadOS 13+ se reporta como Mac con pantalla táctil.
  const iPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return iPhone || iPadOS;
}

export type ResultadoInstall = 'instalada' | 'rechazada' | 'ios' | 'no-disponible';

/** Lanza la instalación: nativa (Android/Chrome) o señaliza iOS/no-disponible. */
export async function lanzarInstall(): Promise<ResultadoInstall> {
  if (deferred) {
    await deferred.prompt();
    const choice = await deferred.userChoice.catch(() => ({ outcome: 'dismissed' as const }));
    deferred = null;
    notify();
    return choice.outcome === 'accepted' ? 'instalada' : 'rechazada';
  }
  if (esIOS()) return 'ios';
  return 'no-disponible';
}

/** Hook reactivo: re-renderiza cuando aparece el prompt o se instala la app. */
export function useInstalarApp(): {
  instalada: boolean;
  tieneNativo: boolean;
  ios: boolean;
  instalar: () => Promise<ResultadoInstall>;
} {
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    subs.add(force);
    return () => {
      subs.delete(force);
    };
  }, []);
  return { instalada, tieneNativo: deferred !== null, ios: esIOS(), instalar: lanzarInstall };
}
