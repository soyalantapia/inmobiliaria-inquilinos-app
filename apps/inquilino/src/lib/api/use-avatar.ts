'use client';

/**
 * Avatar del inquilino (foto de perfil). Feature 100% nueva de producción — no
 * existía ni siquiera en demo (la cuenta solo mostraba iniciales). Por eso acá
 * NO hay fallback a localStorage: en demo `deApi` es false y la pantalla no
 * muestra la posibilidad de subir foto (mismo patrón que otras piezas
 * prod-only de este código).
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiEnabled, apiFetch, subirArchivo, urlDeArchivo } from './client';

const QUERY_KEY = ['mis-datos'] as const;

interface MisDatosApi {
  imageUrl: string | null;
}

export function useAvatar(): {
  imageUrl: string | undefined;
  cargando: boolean;
  deApi: boolean;
  subir: (file: File) => Promise<void>;
  quitar: () => Promise<void>;
} {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => apiFetch<MisDatosApi>('/mis-datos'),
    enabled: apiEnabled,
    staleTime: 30_000,
  });

  if (!apiEnabled) {
    return {
      imageUrl: undefined,
      cargando: false,
      deApi: false,
      subir: async () => {
        throw new Error('Disponible solo con servidor');
      },
      quitar: async () => {
        throw new Error('Disponible solo con servidor');
      },
    };
  }

  const invalidar = () => qc.invalidateQueries({ queryKey: QUERY_KEY });

  return {
    imageUrl: urlDeArchivo(q.data?.imageUrl ?? undefined),
    cargando: q.isPending,
    deApi: true,
    subir: async (file) => {
      const subido = await subirArchivo(file);
      await apiFetch('/mis-datos/avatar', { method: 'PUT', body: JSON.stringify({ imageUrl: subido.url }) });
      await invalidar();
    },
    quitar: async () => {
      await apiFetch('/mis-datos/avatar', { method: 'PUT', body: JSON.stringify({ imageUrl: null }) });
      await invalidar();
    },
  };
}
