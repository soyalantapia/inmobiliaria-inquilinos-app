'use client';

/**
 * Storage de documentos adjuntos a un contrato — desde el lado de la
 * inmobiliaria. Cubre el pedido recurrente de los pilotos:
 *
 *   1. Subir el DNI del titular (frente + dorso).
 *   2. Sumar tantos garantes como haga falta, con DNI de cada uno.
 *   3. Anexar recibos de sueldo del titular y garantes.
 *   4. Adjuntar las "fotos de WhatsApp" que mandan los inquilinos como
 *      comprobante / prueba (transferencias, ticket, etc.).
 *   5. Guardar el contrato firmado generado en Word/PDF.
 *
 * En backend real esto vive en S3 + tabla `DocumentoContrato`. Acá
 * usamos localStorage por contratoId con dataUrl base64. Tamaño máximo
 * recomendado: 2MB por archivo (quota localStorage ~5MB).
 */

const STORAGE_KEY = 'llave-inmo:contrato-documentos:v1';

export type TipoDocContrato =
  | 'CONTRATO_FIRMADO'
  | 'DNI_TITULAR_FRENTE'
  | 'DNI_TITULAR_DORSO'
  | 'DNI_GARANTE_FRENTE'
  | 'DNI_GARANTE_DORSO'
  | 'RECIBO_SUELDO'
  | 'FOTO_WHATSAPP'
  | 'OTRO';

export interface DocContrato {
  id: string;
  contratoId: string;
  tipo: TipoDocContrato;
  /** Etiqueta libre — útil para distinguir Garante 1 vs Garante 2. */
  etiqueta: string;
  /** Si pertenece a un garante específico, su índice (1, 2, 3…). */
  garanteIndex?: number;
  /** Si está atado a una liquidación específica (ej. recibo de pago). */
  periodoLiquidacion?: string;
  nombreArchivo: string;
  tipoMime: string;
  tamanioBytes: number;
  dataUrl: string;
  subidoAt: string;
  subidoPor: string;
}

type Payload = Record<string, DocContrato[]>;

function read(): Payload {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Payload) : {};
  } catch {
    return {};
  }
}

function write(p: Payload): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch (err) {
    // El localStorage explotó (lo más común: archivo muy grande).
    // Re-tirar para que la UI muestre el toast de error.
    throw err;
  }
}

export function listarDocsContrato(contratoId: string): DocContrato[] {
  return read()[contratoId] ?? [];
}

export function guardarDocContrato(doc: DocContrato): void {
  const all = read();
  const lista = all[doc.contratoId] ?? [];
  lista.unshift(doc);
  all[doc.contratoId] = lista;
  write(all);
}

export function eliminarDocContrato(contratoId: string, docId: string): void {
  const all = read();
  const lista = (all[contratoId] ?? []).filter((d) => d.id !== docId);
  all[contratoId] = lista;
  write(all);
}

export function leerArchivoComoDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function formatTamanio(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export const TIPO_DOC_LABEL: Record<TipoDocContrato, string> = {
  CONTRATO_FIRMADO: 'Contrato firmado',
  DNI_TITULAR_FRENTE: 'DNI titular · frente',
  DNI_TITULAR_DORSO: 'DNI titular · dorso',
  DNI_GARANTE_FRENTE: 'DNI garante · frente',
  DNI_GARANTE_DORSO: 'DNI garante · dorso',
  RECIBO_SUELDO: 'Recibo de sueldo',
  FOTO_WHATSAPP: 'Foto de WhatsApp',
  OTRO: 'Otro documento',
};

export const TAMANIO_MAX = 2 * 1024 * 1024;
