'use client';

/**
 * Documentos del expediente de un contrato. En prod (NEXT_PUBLIC_API_URL) van
 * contra el CRUD real (/contratos/:id/documentos) + archivo en el Volume; en
 * demo caen al localStorage de contrato-documentos-storage, intacto.
 *
 * El panel renderiza `DocContrato` con `dataUrl` para el <img>/<a>. En prod no
 * hay dataUrl: mapeamos `archivoUrl` (/uploads/...) a una URL servible con el
 * token en query (un <img>/<a> no manda el header Authorization).
 */
import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { API_URL, apiEnabled, apiFetch, getToken, subirArchivo } from './client';
import {
  type DocContrato,
  type TipoDocContrato,
  eliminarDocContrato,
  guardarDocContrato,
  leerArchivoComoDataUrl,
  listarDocsContrato,
} from '@/lib/contrato-documentos-storage';

interface DocApi {
  id: string;
  contratoId: string;
  tipo: TipoDocContrato;
  etiqueta: string;
  garanteIndex: number | null;
  periodoLiquidacion: string | null;
  nombreArchivo: string;
  tipoMime: string;
  tamanioBytes: number;
  archivoUrl: string;
  subidoAt: string;
  subidoPor: string;
}

/** URL servible del archivo: el token va en query porque <img>/<a> no mandan header. */
function urlServible(archivoUrl: string): string {
  const token = getToken();
  return `${API_URL}${archivoUrl}${token ? `?token=${encodeURIComponent(token)}` : ''}`;
}

function mapDoc(d: DocApi): DocContrato {
  return {
    id: d.id,
    contratoId: d.contratoId,
    tipo: d.tipo,
    etiqueta: d.etiqueta,
    garanteIndex: d.garanteIndex ?? undefined,
    periodoLiquidacion: d.periodoLiquidacion ?? undefined,
    nombreArchivo: d.nombreArchivo,
    tipoMime: d.tipoMime,
    tamanioBytes: d.tamanioBytes,
    dataUrl: urlServible(d.archivoUrl),
    subidoAt: d.subidoAt,
    subidoPor: d.subidoPor,
  };
}

export interface NuevoDocInput {
  file: File;
  tipo: TipoDocContrato;
  etiqueta: string;
  garanteIndex?: number;
  periodoLiquidacion?: string;
}

/** Una sola definición de la clave: la usan la consulta y la invalidación. */
const keyDocs = (contratoId: string) => ['docs-contrato', contratoId] as const;

/**
 * El expediente se lee desde DOS lugares a la vez —el badge del tab
 * "Documentos" y el panel de adentro— y por eso vive en la caché de
 * react-query y no en un `useState` propio de cada instancia: con estado local,
 * subir un papel actualizaba el checklist y dejaba el badge con el número
 * viejo hasta recargar la página. Dos números distintos del mismo expediente
 * es exactamente lo que este trabajo vino a sacar.
 */
export function useDocsContrato(contratoId: string): {
  docs: DocContrato[];
  hidratado: boolean;
  deApi: boolean;
  subir: (input: NuevoDocInput) => Promise<void>;
  eliminar: (doc: DocContrato) => Promise<void>;
} {
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: keyDocs(contratoId),
    queryFn: async (): Promise<DocContrato[]> => {
      if (!apiEnabled) return listarDocsContrato(contratoId);
      try {
        const filas = await apiFetch<DocApi[]>(`/contratos/${contratoId}/documentos`);
        return filas.map(mapDoc);
      } catch {
        // Un expediente que no se pudo leer no puede tapar la pantalla del
        // contrato: se muestra vacío y el panel sigue dejando subir.
        return [];
      }
    },
    enabled: !!contratoId,
    staleTime: 15_000,
  });

  const recargar = useCallback(
    () => qc.invalidateQueries({ queryKey: keyDocs(contratoId) }),
    [qc, contratoId],
  );

  const subir = useCallback(
    async (input: NuevoDocInput) => {
      if (!apiEnabled) {
        const dataUrl = await leerArchivoComoDataUrl(input.file);
        guardarDocContrato({
          id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          contratoId,
          tipo: input.tipo,
          etiqueta: input.etiqueta,
          garanteIndex: input.garanteIndex,
          periodoLiquidacion: input.periodoLiquidacion,
          nombreArchivo: input.file.name,
          tipoMime: input.file.type || 'application/octet-stream',
          tamanioBytes: input.file.size,
          dataUrl,
          subidoAt: new Date().toISOString(),
          subidoPor: 'admin',
        });
        await recargar();
        return;
      }
      const subido = await subirArchivo(input.file);
      await apiFetch(`/contratos/${contratoId}/documentos`, {
        method: 'POST',
        body: JSON.stringify({
          tipo: input.tipo,
          etiqueta: input.etiqueta,
          ...(input.garanteIndex != null ? { garanteIndex: input.garanteIndex } : {}),
          ...(input.periodoLiquidacion ? { periodoLiquidacion: input.periodoLiquidacion } : {}),
          nombreArchivo: subido.nombreArchivo,
          tipoMime: subido.tipoMime,
          tamanioBytes: subido.tamanioBytes,
          archivoUrl: subido.url,
        }),
      });
      await recargar();
    },
    [contratoId, recargar],
  );

  const eliminar = useCallback(
    async (doc: DocContrato) => {
      if (!apiEnabled) {
        eliminarDocContrato(doc.contratoId, doc.id);
        await recargar();
        return;
      }
      await apiFetch(`/contratos/${contratoId}/documentos/${doc.id}`, { method: 'DELETE' });
      await recargar();
    },
    [contratoId, recargar],
  );

  return {
    docs: q.data ?? [],
    // `isPending` solo baja cuando la consulta terminó, con datos o con el
    // array vacío del catch: el panel espera esto para no pintar un "0 de 6"
    // que un instante después cambia.
    hidratado: !q.isPending,
    deApi: apiEnabled,
    subir,
    eliminar,
  };
}
