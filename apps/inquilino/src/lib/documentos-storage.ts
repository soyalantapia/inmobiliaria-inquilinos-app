// Documentos personales del inquilino que se reutilizan en flujos como
// renovación, mudanza, alta de garantía nueva, etc. En backend real esto vive
// en S3 + tabla Documento con tipo, vencimiento y referencia al usuario.
// Acá guardamos metadata + dataURL en localStorage (limitado a archivos
// chicos para no romper el storage de 5MB).

const STORAGE_KEY = 'llave:documentos:v1';

export type CategoriaDocumento = 'IDENTIDAD' | 'INGRESOS' | 'GARANTE' | 'OTRO';

export interface Documento {
  id: string;
  categoria: CategoriaDocumento;
  nombre: string;
  tipoMime: string;
  tamanioBytes: number;
  dataUrl: string; // base64 mock
  subidoAt: string; // ISO
  vencimiento: string | null; // ISO, opcional
}

export function listarDocumentos(): Documento[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Documento[];
  } catch {
    return [];
  }
}

export function guardarDocumento(doc: Documento): void {
  if (typeof window === 'undefined') return;
  try {
    const lista = listarDocumentos();
    lista.unshift(doc);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lista));
  } catch {
    // ignore
  }
}

export function eliminarDocumento(id: string): void {
  if (typeof window === 'undefined') return;
  try {
    const lista = listarDocumentos().filter((d) => d.id !== id);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lista));
  } catch {
    // ignore
  }
}

export const categoriaLabel: Record<CategoriaDocumento, string> = {
  IDENTIDAD: 'Identidad',
  INGRESOS: 'Ingresos',
  GARANTE: 'Garante',
  OTRO: 'Otros',
};

export const categoriaDescripcion: Record<CategoriaDocumento, string> = {
  IDENTIDAD: 'DNI frente y dorso, pasaporte',
  INGRESOS: 'Recibos de sueldo, certificaciones laborales, monotributo',
  GARANTE: 'Escrituras, recibos del garante, pólizas',
  OTRO: 'Cualquier otro documento útil',
};

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
