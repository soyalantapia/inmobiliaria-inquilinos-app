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
}

export const VERSION_BORRADOR = 2;

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
 * Lleva un borrador viejo al esquema actual. Hoy sólo hay un salto (v1 → v2), y lo
 * único que cambió fue la numeración de los pasos: "Términos" (3 de 4) se partió en
 * "Plazo y salida" (3) y "Dinero" (4), y "Confirmar" pasó de 4 a 5. Todos los DATOS
 * son idénticos, así que no hay nada que tirar.
 *
 * Devuelve null sólo si el borrador es de una versión que no sabemos migrar (futura,
 * o tan vieja que no la contemplamos): ahí sí es preferible descartarlo antes que
 * restaurar a alguien en el paso equivocado con datos de otra estructura.
 */
function migrarBorrador(parsed: Partial<BorradorContrato>): BorradorContrato | null {
  const version = typeof parsed.version === 'number' ? parsed.version : 1;
  if (version === VERSION_BORRADOR) return parsed as BorradorContrato;
  if (version === 1) {
    const pasoViejo = typeof parsed.paso === 'number' ? parsed.paso : 1;
    // 1→1, 2→2, 3 (Términos)→3 (Plazo y salida: la primera mitad de lo que era
    // Términos, para que pueda revisar el plazo antes del dinero), 4 (Confirmar)→5.
    const paso = pasoViejo <= 2 ? pasoViejo : pasoViejo === 3 ? 3 : 5;
    return { ...(parsed as BorradorContrato), version: VERSION_BORRADOR, paso };
  }
  return null;
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
