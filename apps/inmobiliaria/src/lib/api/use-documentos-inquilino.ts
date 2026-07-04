'use client';

/**
 * Documentos que el INQUILINO subió desde su app (DNI, recibos, garante) —
 * lectura solo-lectura para el panel. Ver POST /mis-documentos (mi-perfil.ts,
 * lado inquilino) y GET /contratos/:contratoId/documentos-inquilino (documentos.ts).
 * No tiene fallback demo: es una vista nueva, prod-only.
 */
import { useQuery } from '@tanstack/react-query';
import { apiEnabled, apiFetch, urlDeArchivo } from './client';
import { ensureApiSession } from './session';

export type CategoriaDocumentoInquilino = 'IDENTIDAD' | 'INGRESOS' | 'GARANTE' | 'OTRO';

export interface DocumentoInquilinoApi {
  id: string;
  categoria: CategoriaDocumentoInquilino;
  nombre: string;
  tipoMime: string;
  tamanioBytes: number;
  archivoUrl: string;
  subidoAt: string;
  vencimiento: string | null;
  slot: { titulo: string; categoria: CategoriaDocumentoInquilino } | null;
}

export interface DocumentoInquilinoView extends Omit<DocumentoInquilinoApi, 'archivoUrl'> {
  url: string | undefined;
}

export function useDocumentosInquilino(contratoId: string | undefined): {
  documentos: DocumentoInquilinoView[];
  cargando: boolean;
} {
  const q = useQuery({
    queryKey: ['documentos-inquilino', contratoId],
    queryFn: async () => {
      await ensureApiSession();
      return apiFetch<DocumentoInquilinoApi[]>(`/contratos/${contratoId}/documentos-inquilino`);
    },
    enabled: apiEnabled && !!contratoId,
    staleTime: 15_000,
  });
  return {
    documentos: (q.data ?? []).map((d) => ({ ...d, url: urlDeArchivo(d.archivoUrl) })),
    cargando: q.isPending,
  };
}
