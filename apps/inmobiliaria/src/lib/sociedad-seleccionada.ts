'use client';

/**
 * Sociedad activa en el switcher de la topbar.
 *
 * Quote de Camila en el meeting:
 *   "yo tengo diferentes cajas con diferente alquiler en diferente
 *    localidad y provincia... yo tengo que tener los cinco usuarios
 *    de las cinco cajas, que tengo para que me separe las cajas y
 *    los PDF los morosos"
 *
 * Implementación: en lugar de obligar al admin a tener 5 cuentas
 * separadas, le damos UN selector en la topbar que filtra todo el
 * panel por sociedad. Vista "Todas" o filtrada a una sola.
 *
 * Lo persistimos en localStorage para que cada operador recupere su
 * última selección al volver. Es UI-state, no business state.
 */

const STORAGE_KEY = 'llave-inmo:sociedad-activa:v1';

/** Sentinel para "todas las sociedades". */
export const TODAS_LAS_SOCIEDADES = '__TODAS__' as const;

export type SociedadActivaId = string | typeof TODAS_LAS_SOCIEDADES;

export function leerSociedadActiva(): SociedadActivaId {
  if (typeof window === 'undefined') return TODAS_LAS_SOCIEDADES;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return (raw as SociedadActivaId | null) ?? TODAS_LAS_SOCIEDADES;
  } catch {
    return TODAS_LAS_SOCIEDADES;
  }
}

export function setSociedadActiva(id: SociedadActivaId): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
    // Disparamos un evento custom para que los listeners (KPIs,
    // contadores) puedan reaccionar sin recargar la página.
    window.dispatchEvent(new CustomEvent('llave:sociedad-cambiada', { detail: id }));
  } catch {
    // ignore
  }
}

/**
 * Filtro lógico: ¿una propiedad / contrato / consorcio pertenece a
 * la sociedad activa? Si la activa es "TODAS", siempre devuelve true.
 *
 * Recibe `sociedadId` opcional (lo que tiene la entidad) y compara
 * contra `activa` (lo que está seleccionado en la topbar).
 */
export function matcheaConSociedadActiva(
  entidadSociedadId: string | undefined | null,
  activa: SociedadActivaId,
  /**
   * Si la entidad no tiene sociedad explícita, asumimos la principal.
   * Pasala como `fallback` desde el caller (típicamente
   * sociedadPrincipal().id).
   */
  fallbackPrincipalId: string,
): boolean {
  if (activa === TODAS_LAS_SOCIEDADES) return true;
  const id = entidadSociedadId ?? fallbackPrincipalId;
  return id === activa;
}

/**
 * Hook simple para escuchar cambios de sociedad activa desde
 * componentes. No usa context para mantenerlo liviano — un solo
 * listener por componente que necesita reaccionar.
 *
 * En producción si crece la complejidad, mover a Context API o
 * Zustand. Para la demo este patrón es suficiente.
 */
export function onSociedadCambiada(handler: (id: SociedadActivaId) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const listener = (e: Event) => {
    const detail = (e as CustomEvent<SociedadActivaId>).detail;
    handler(detail);
  };
  window.addEventListener('llave:sociedad-cambiada', listener);
  return () => window.removeEventListener('llave:sociedad-cambiada', listener);
}
