'use client';

/**
 * Qué papeles se consideran REQUERIDOS en el expediente de un contrato, y cuáles
 * faltan.
 *
 * Vive acá y no adentro de un componente porque la fórmula la necesitan dos
 * pantallas distintas: el alta (que todavía no tiene `contratoId` y cuenta
 * `File` en memoria) y el detalle del contrato (que cuenta `DocumentoContrato`
 * traídos de la API). Cuando la fórmula estaba incrustada en el panel del
 * detalle —un `4 + garantesCount * 2` suelto— la única forma de reusarla era
 * copiarla, y dos copias de "qué es un expediente completo" se desincronizan en
 * el primer cambio de criterio.
 *
 * No vive en `packages/shared` a propósito: los tipos y las etiquetas salen de
 * `contrato-documentos-storage.ts`, que es del front y lo importa el panel de
 * producción. Subirlo a shared obligaría a mover también ese archivo (y su
 * `'use client'`) y a tocar el build de Next para exponer un subpath nuevo, todo
 * para dos consumidores que están en la misma app.
 *
 * Devuelve la lista NOMBRADA de faltantes, no un conteo: tanto el alta como el
 * detalle tienen que poder decir QUÉ falta, no solo cuántos.
 *
 * Lo que NO decide este módulo: si falta algo, no bloquea nada. El expediente
 * incompleto es el caso normal de la cartera vieja, no un error.
 */

import { TIPO_DOC_LABEL, type TipoDocContrato } from './contrato-documentos-storage';

/** Los papeles que se piden del inquilino titular en cualquier expediente. */
export const DOCS_REQUERIDOS_TITULAR: readonly TipoDocContrato[] = [
  'CONTRATO_FIRMADO',
  'DNI_TITULAR_FRENTE',
  'DNI_TITULAR_DORSO',
  'RECIBO_SUELDO',
] as const;

/**
 * Lo que se pide POR CADA garante.
 *
 * El recibo del garante y la garantía propietaria quedan afuera de los
 * requeridos aunque el panel los ofrezca: qué es obligatorio es una decisión de
 * producto, y hoy la respuesta es "el DNI, nada más". Ampliar esta lista baja el
 * porcentaje de TODOS los expedientes ya cargados.
 */
export const DOCS_REQUERIDOS_POR_GARANTE: readonly TipoDocContrato[] = [
  'DNI_GARANTE_FRENTE',
  'DNI_GARANTE_DORSO',
] as const;

/** Tope de garantes que ofrecen los selectores del alta y del detalle. */
export const MAX_GARANTES = 3;

/** Un papel del expediente, ya identificado y con el nombre que ve la persona. */
export interface DocRequerido {
  tipo: TipoDocContrato;
  /** 1-based. Solo lo llevan los papeles de garante. */
  garanteIndex?: number;
  /** Lo que se muestra en pantalla. Sale de `TIPO_DOC_LABEL`, no se reescribe. */
  etiqueta: string;
  /** Identidad del papel dentro del expediente. Ver `claveDocumento`. */
  clave: string;
}

/**
 * Lo mínimo que hace falta saber de un documento ya cargado para decidir si
 * tapa un requerido. El alta pasa los `File` que eligió la persona; el detalle
 * pasa los `DocContrato` que devolvió la API.
 */
export interface DocPresente {
  tipo: TipoDocContrato;
  garanteIndex?: number | null;
}

export interface ResumenExpediente {
  /** Todos los requeridos, en orden de pantalla. */
  requeridos: DocRequerido[];
  /** Los que todavía no tienen ningún archivo. */
  faltantes: DocRequerido[];
  /** `requeridos.length` — el denominador del "X de Y". */
  total: number;
  /** Cuántos requeridos están cubiertos. */
  presentes: number;
}

/**
 * Identidad de un papel dentro del expediente.
 *
 * El `garanteIndex` entra SIEMPRE que exista, para cualquier tipo: el recibo de
 * sueldo del garante 2 no puede tapar el del titular. El panel lo hacía solo
 * para dos tipos, y por eso el recibo del garante nunca se marcaba como cargado.
 */
export function claveDocumento(tipo: TipoDocContrato, garanteIndex?: number | null): string {
  return garanteIndex != null ? `${tipo}::g${garanteIndex}` : tipo;
}

/** Nombre visible. El sufijo del garante es el mismo que ya usa el panel al subir. */
export function etiquetaDocumento(tipo: TipoDocContrato, garanteIndex?: number | null): string {
  return `${TIPO_DOC_LABEL[tipo]}${garanteIndex != null ? ` · Garante ${garanteIndex}` : ''}`;
}

function requerido(tipo: TipoDocContrato, garanteIndex?: number): DocRequerido {
  return {
    tipo,
    ...(garanteIndex != null ? { garanteIndex } : {}),
    etiqueta: etiquetaDocumento(tipo, garanteIndex),
    clave: claveDocumento(tipo, garanteIndex),
  };
}

/**
 * La lista de requeridos para un expediente con `garantesCount` garantes.
 *
 * `garantesCount` puede ser 0 y eso es válido: hay contratos con seguro de
 * caución y sin ninguna persona garante.
 */
export function documentosRequeridos(garantesCount: number): DocRequerido[] {
  const garantes = Math.max(0, Math.min(MAX_GARANTES, Math.floor(garantesCount || 0)));
  const lista = DOCS_REQUERIDOS_TITULAR.map((t) => requerido(t));
  for (let i = 1; i <= garantes; i++) {
    for (const t of DOCS_REQUERIDOS_POR_GARANTE) lista.push(requerido(t, i));
  }
  return lista;
}

/**
 * Qué falta en el expediente, nombrado.
 *
 * @param presentes documentos ya cargados (API en el detalle, `File` en el alta)
 * @param garantesCount cuántos garantes tiene el contrato
 */
export function faltantesDeExpediente(
  presentes: readonly DocPresente[],
  garantesCount: number,
): ResumenExpediente {
  const cargadas = new Set(presentes.map((d) => claveDocumento(d.tipo, d.garanteIndex)));
  const requeridos = documentosRequeridos(garantesCount);
  const faltantes = requeridos.filter((r) => !cargadas.has(r.clave));
  return {
    requeridos,
    faltantes,
    total: requeridos.length,
    presentes: requeridos.length - faltantes.length,
  };
}

/**
 * "Contrato firmado, Recibo de sueldo y DNI garante · frente · Garante 1".
 *
 * Existe para que las tres pantallas que enumeran faltantes no inventen tres
 * separadores distintos. No baja a minúscula las etiquetas: varias arrancan con
 * sigla (DNI, CUIT) y quedarían mal escritas.
 */
export function enumerarFaltantes(faltantes: readonly DocRequerido[]): string {
  const nombres = faltantes.map((f) => f.etiqueta);
  if (nombres.length === 0) return '';
  if (nombres.length === 1) return nombres[0]!;
  return `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]!}`;
}
