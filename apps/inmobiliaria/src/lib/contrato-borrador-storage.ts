'use client';

import { getToken } from './api/client';

export interface BorradorContrato {
  /**
   * Versión del ESQUEMA del borrador, no de los datos. Se sube cuando cambia la
   * numeración de los pasos o se agrega/quita un campo que rompe la restauración.
   *
   * Una versión vieja NO se descarta: se MIGRA (ver `migrarBorrador`). Descartarla
   * significaba que una operadora con un alta a medias —propiedad, inquilino, DNI,
   * fechas, montos— la perdía entera con sólo abrir la pantalla después del deploy,
   * sin un aviso: la lectura devolvía null, el diálogo de "tenés un contrato a medio
   * cargar" no aparecía, y el autosave escribía el formulario vacío encima. Y todo
   * eso para un cambio de esquema donde el ÚNICO campo incompatible era `paso`.
   */
  version: number;
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

export const VERSION_BORRADOR = 3;

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

/**
 * Lleva un borrador viejo al esquema actual. Lo único que cambia entre versiones
 * es la NUMERACIÓN de los pasos: los datos son idénticos y no hay nada que tirar.
 * Lo que sí hay que cuidar es no restaurar a alguien en un paso que ya significa
 * otra cosa — un borrador guardado en "Confirmar" que reaparece en "Períodos
 * anteriores" es exactamente el problema que esta función existe para evitar.
 *
 * Las tres numeraciones que pueden estar guardadas en un navegador:
 *
 *   v1 (sin campo `version`, lo que hay HOY en producción)
 *     1 Propiedad · 2 Inquilino · 3 Términos · 4 Períodos anteriores · 5 Confirmar
 *
 *   v2 (la que escribió el alta en pasos antes de este merge)
 *     1 Propiedad · 2 Inquilino · 3 Plazo y salida · 4 Dinero · 5 Períodos · 6 Confirmar
 *
 *   v3 (ACTUAL: el alta en pasos + los pasos de expediente de la deuda histórica)
 *     1 Propiedad · 2 Inquilino · 3 Plazo y salida · 4 Dinero · 5 Períodos anteriores
 *     · 6 Documentación · 7 Servicios · 8 Confirmar
 *
 * Devuelve null sólo si el borrador es de una versión que no sabemos migrar (futura,
 * o tan vieja que no la contemplamos): ahí sí es preferible descartarlo antes que
 * restaurar a alguien en el paso equivocado con datos de otra estructura.
 */
const PASOS_V1_A_V3: Record<number, number> = {
  1: 1, // Propiedad
  2: 2, // Inquilino
  3: 3, // Términos → Plazo y salida (la primera mitad: primero el plazo, después el dinero)
  4: 5, // Períodos anteriores
  5: 8, // Confirmar. Documentación y Servicios son NUEVOS y opcionales: quien ya
  //      había llegado al final vuelve al final, y llega a los pasos nuevos desde
  //      el stepper. Mandarlo a 5 lo devolvía al medio del formulario sin motivo.
};

const PASOS_V2_A_V3: Record<number, number> = {
  1: 1, // Propiedad
  2: 2, // Inquilino
  3: 3, // Plazo y salida
  4: 4, // Dinero
  5: 5, // Períodos anteriores
  6: 8, // Confirmar (mismo criterio que arriba)
};

function migrarBorrador(parsed: Partial<BorradorContrato>): BorradorContrato | null {
  const version = typeof parsed.version === 'number' ? parsed.version : 1;
  if (version === VERSION_BORRADOR) return parsed as BorradorContrato;
  const mapa = version === 1 ? PASOS_V1_A_V3 : version === 2 ? PASOS_V2_A_V3 : null;
  if (!mapa) return null;
  const pasoViejo = typeof parsed.paso === 'number' ? parsed.paso : 1;
  // Un paso fuera de la numeración conocida (dato corrupto) arranca de cero en vez
  // de caer en un `else` que lo deposite en cualquier lado.
  const paso = mapa[pasoViejo] ?? 1;
  return { ...(parsed as BorradorContrato), version: VERSION_BORRADOR, paso };
}

export function leerBorradorContrato(namespace: string): BorradorContrato | null {
  if (typeof window === 'undefined') return null;
  try {
    const key = `llave-inmo:contrato-borrador:v1:${namespace}`;
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<BorradorContrato> | null;
    if (!parsed || typeof parsed !== 'object') return null;
    return migrarBorrador(parsed);
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
