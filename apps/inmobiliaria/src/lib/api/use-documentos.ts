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
import { useCallback, useEffect, useState } from 'react';
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

export function useDocsContrato(contratoId: string): {
  docs: DocContrato[];
  hidratado: boolean;
  /** `true` si la consulta falló: "0 documentos" NO significa expediente vacío. */
  error?: boolean;
  deApi: boolean;
  subir: (input: NuevoDocInput) => Promise<void>;
  eliminar: (doc: DocContrato) => Promise<void>;
} {
  const [docs, setDocs] = useState<DocContrato[]>([]);
  const [hidratado, setHidratado] = useState(false);
  /** `true` si la consulta fallo: "0 documentos" NO significa que el expediente este vacio. */
  const [error, setError] = useState(false);

  const recargar = useCallback(async () => {
    if (!apiEnabled) {
      setDocs(listarDocsContrato(contratoId));
      setHidratado(true);
      return;
    }
    try {
      const filas = await apiFetch<DocApi[]>(`/contratos/${contratoId}/documentos`);
      setDocs(filas.map(mapDoc));
      setError(false);
    } catch {
      // El `catch { setDocs([]) }` mudo hacía que el panel imprimiera "Documentos cargados:
      // 0 de 6 requeridos" con badge 0% sobre un expediente que TIENE el contrato firmado y el
      // DNI subidos. El operador le pedía al inquilino papeles que ya había entregado, o los
      // volvía a subir duplicados.
      setDocs([]);
      setError(true);
    } finally {
      setHidratado(true);
    }
  }, [contratoId]);

  useEffect(() => {
    void recargar();
  }, [recargar]);

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
        setDocs(listarDocsContrato(contratoId));
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
        setDocs(listarDocsContrato(contratoId));
        return;
      }
      await apiFetch(`/contratos/${contratoId}/documentos/${doc.id}`, { method: 'DELETE' });
      await recargar();
    },
    [contratoId, recargar],
  );

  return { docs, hidratado, error, deApi: apiEnabled, subir, eliminar };
}
