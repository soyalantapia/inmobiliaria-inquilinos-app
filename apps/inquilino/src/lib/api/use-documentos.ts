'use client';

/**
 * Documentos del inquilino (DNI, recibos, garante): API real si hay
 * NEXT_PUBLIC_API_URL (GET/POST/DELETE /mis-documentos), localStorage si no
 * (demo intacta). Unifica ambos detrás del mismo shape { slots, libres } que
 * ya renderiza la pantalla.
 */
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { apiEnabled, apiFetch, subirArchivo, urlDeArchivo } from './client';
import {
  type CategoriaDocumento,
  type Documento as DocumentoDemo,
  type SlotDocumento as SlotDemo,
  SLOTS_DOCUMENTOS,
  eliminarDocumento as eliminarDocumentoLocal,
  guardarDocumento as guardarDocumentoLocal,
  leerArchivoComoDataUrl,
  listarDocumentos,
} from '@/lib/documentos-storage';

export interface DocumentoView {
  id: string;
  categoria: CategoriaDocumento;
  nombre: string;
  tipoMime: string;
  tamanioBytes: number;
  url: string; // dataUrl (demo) o urlDeArchivo (prod)
  subidoAt: string;
  vencimiento: string | null;
  slotId?: string;
}

export interface SlotView {
  id: string;
  categoria: CategoriaDocumento;
  titulo: string;
  descripcion: string;
  requerido: boolean;
  documento: DocumentoView | null;
}

interface DocumentoApi {
  id: string;
  categoria: CategoriaDocumento;
  nombre: string;
  tipoMime: string;
  tamanioBytes: number;
  archivoUrl: string;
  subidoAt: string;
  vencimiento: string | null;
  slotId: string | null;
}

interface SlotApi {
  id: string;
  codigo: string;
  categoria: CategoriaDocumento;
  titulo: string;
  descripcion: string;
  requerido: boolean;
  documento: DocumentoApi | null;
}

interface MisDocumentosApi {
  slots: SlotApi[];
  libres: DocumentoApi[];
}

const QUERY_KEY = ['mis-documentos'] as const;

function mapDocApi(d: DocumentoApi): DocumentoView {
  return {
    id: d.id,
    categoria: d.categoria,
    nombre: d.nombre,
    tipoMime: d.tipoMime,
    tamanioBytes: d.tamanioBytes,
    url: urlDeArchivo(d.archivoUrl) ?? d.archivoUrl,
    subidoAt: d.subidoAt,
    vencimiento: d.vencimiento,
    slotId: d.slotId ?? undefined,
  };
}

function mapDocDemo(d: DocumentoDemo): DocumentoView {
  return {
    id: d.id,
    categoria: d.categoria,
    nombre: d.nombre,
    tipoMime: d.tipoMime,
    tamanioBytes: d.tamanioBytes,
    url: d.dataUrl,
    subidoAt: d.subidoAt,
    vencimiento: d.vencimiento,
    slotId: d.slotId,
  };
}

export function useDocumentos(): {
  slots: SlotView[];
  libres: DocumentoView[];
  cargando: boolean;
  deApi: boolean;
  subir: (file: File, slotId?: string) => Promise<void>;
  eliminar: (id: string) => Promise<void>;
} {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => apiFetch<MisDocumentosApi>('/mis-documentos'),
    enabled: apiEnabled,
    staleTime: 10_000,
  });

  if (!apiEnabled) {
    const documentos = listarDocumentos();
    const porSlot = new Map(documentos.filter((d) => d.slotId).map((d) => [d.slotId as string, d]));
    const slots: SlotView[] = SLOTS_DOCUMENTOS.map((s: SlotDemo) => ({
      id: s.id,
      categoria: s.categoria,
      titulo: s.titulo,
      descripcion: s.descripcion,
      requerido: s.requerido,
      documento: porSlot.has(s.id) ? mapDocDemo(porSlot.get(s.id) as DocumentoDemo) : null,
    }));
    return {
      slots,
      libres: documentos.filter((d) => !d.slotId).map(mapDocDemo),
      cargando: false,
      deApi: false,
      subir: async (file, slotId) => {
        const slot = slotId ? SLOTS_DOCUMENTOS.find((s) => s.id === slotId) : undefined;
        const previo = slot ? porSlot.get(slot.id) : undefined;
        if (previo) eliminarDocumentoLocal(previo.id);
        const dataUrl = await leerArchivoComoDataUrl(file);
        guardarDocumentoLocal({
          id: `doc_${Date.now()}`,
          categoria: slot?.categoria ?? 'OTRO',
          nombre: file.name,
          tipoMime: file.type || 'application/octet-stream',
          tamanioBytes: file.size,
          dataUrl,
          subidoAt: new Date().toISOString(),
          vencimiento: null,
          slotId: slot?.id,
        });
      },
      eliminar: async (id) => {
        eliminarDocumentoLocal(id);
      },
    };
  }

  const invalidar = () => qc.invalidateQueries({ queryKey: QUERY_KEY });

  return {
    slots: (q.data?.slots ?? []).map((s) => ({
      id: s.id,
      categoria: s.categoria,
      titulo: s.titulo,
      descripcion: s.descripcion,
      requerido: s.requerido,
      documento: s.documento ? mapDocApi(s.documento) : null,
    })),
    libres: (q.data?.libres ?? []).map(mapDocApi),
    cargando: q.isPending,
    deApi: true,
    subir: async (file, slotId) => {
      const subido = await subirArchivo(file);
      await apiFetch('/mis-documentos', {
        method: 'POST',
        body: JSON.stringify({
          slotId,
          nombre: subido.nombreArchivo,
          tipoMime: subido.tipoMime,
          tamanioBytes: subido.tamanioBytes,
          archivoUrl: subido.url,
        }),
      });
      await invalidar();
    },
    eliminar: async (id) => {
      await apiFetch(`/mis-documentos/${id}`, { method: 'DELETE' });
      await invalidar();
    },
  };
}
