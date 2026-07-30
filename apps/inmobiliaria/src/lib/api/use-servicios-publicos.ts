'use client';

/**
 * Servicios públicos por propiedad (panel inmo). En prod (NEXT_PUBLIC_API_URL)
 * van contra el CRUD real (/propiedades/:id/servicios) → la misma tabla
 * `ServicioPublico` que LEE el inquilino en GET /servicios. Antes el panel
 * escribía solo en localStorage → el inquilino nunca veía lo cargado (loop roto).
 * En demo cae al localStorage de servicios-publicos-storage, intacto.
 */
import { useCallback, useEffect, useState } from 'react';
import { apiEnabled, apiFetch } from './client';
import {
  type DatosServicio,
  type PagadorServicio,
  type TipoServicio,
  guardarServicio,
  leerServiciosDe,
} from '@/lib/servicios-publicos-storage';

interface ServicioApi {
  id: string;
  tipo: TipoServicio;
  distribuidora: string;
  nis: string;
  numeroMedidor: string | null;
  titular: string | null;
  observaciones: string | null;
  consumoPromedioMensual: number | null;
  pagador?: PagadorServicio | null;
  actualizadoAt: string;
}

function mapServicio(s: ServicioApi): DatosServicio {
  return {
    tipo: s.tipo,
    distribuidora: s.distribuidora,
    nis: s.nis,
    numeroMedidor: s.numeroMedidor ?? undefined,
    titular: s.titular ?? undefined,
    observaciones: s.observaciones ?? undefined,
    consumoPromedioMensual: s.consumoPromedioMensual ?? undefined,
    pagador: s.pagador ?? 'INQUILINO',
    actualizadoAt: s.actualizadoAt,
  };
}

export function useServiciosPublicos(propiedadId: string): {
  servicios: DatosServicio[];
  hidratado: boolean;
  /** true = la carga FALLÓ (≠ "no hay servicios"). El panel no debe dejar editar a ciegas. */
  error: boolean;
  guardar: (input: DatosServicio) => Promise<void>;
} {
  const [servicios, setServicios] = useState<DatosServicio[]>([]);
  const [hidratado, setHidratado] = useState(false);
  // Un GET que falla NO es 'no hay servicios cargados': si se muestran igual, el operador
  // completa el formulario creyendo que está vacío y PISA los datos reales del servidor.
  const [error, setError] = useState(false);

  const recargar = useCallback(async () => {
    if (!apiEnabled) {
      setServicios(leerServiciosDe(propiedadId));
      setHidratado(true);
      return;
    }
    try {
      const filas = await apiFetch<ServicioApi[]>(`/propiedades/${propiedadId}/servicios`);
      setServicios(filas.map(mapServicio));
      setError(false);
    } catch {
      setServicios([]);
      setError(true);
    } finally {
      setHidratado(true);
    }
  }, [propiedadId]);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  const guardar = useCallback(
    async (input: DatosServicio) => {
      if (!apiEnabled) {
        guardarServicio(propiedadId, input);
        setServicios(leerServiciosDe(propiedadId));
        return;
      }
      await apiFetch(`/propiedades/${propiedadId}/servicios/${input.tipo}`, {
        method: 'PUT',
        body: JSON.stringify({
          distribuidora: input.distribuidora,
          nis: input.nis,
          ...(input.numeroMedidor ? { numeroMedidor: input.numeroMedidor } : {}),
          ...(input.titular ? { titular: input.titular } : {}),
          ...(input.observaciones ? { observaciones: input.observaciones } : {}),
          ...(input.consumoPromedioMensual != null
            ? { consumoPromedioMensual: input.consumoPromedioMensual }
            : {}),
          ...(input.pagador ? { pagador: input.pagador } : {}),
        }),
      });
      await recargar();
    },
    [propiedadId, recargar],
  );

  return { servicios, hidratado, error, guardar };
}
