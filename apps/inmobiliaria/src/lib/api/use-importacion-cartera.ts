'use client';

/**
 * Migración de cartera REAL (prod): sube la planilla, mapea columnas (flexible)
 * y confirma la importación (crea propiedades + inquilinos + contratos). Sin
 * fallback demo — el dialog demo (migracion-masiva-dialog) sigue con su mock.
 */
import { useQueryClient } from '@tanstack/react-query';
import { apiFetch, API_URL, getToken } from './client';
import { ensureApiSession } from './session';

export interface CampoImportacion {
  key: string;
  label: string;
  requerido: boolean;
}

export interface SubidaImportacion {
  id: string;
  columnas: string[];
  filasPreview: string[][];
  totalFilas: number;
  mapeoSugerido: Record<string, number>;
}

export type EstadoFilaImport = 'OK' | 'ADVERTENCIA' | 'ERROR' | 'DUPLICADO';

export interface FilaValidada {
  fila: number;
  datos: {
    direccion: string;
    inquilino: string;
    dni: string | null;
    email: string | null;
    telefono: string | null;
    propietario: string | null;
    monto: number;
    moneda: string;
    fechaInicio: string | null;
    fechaFin: string | null;
  };
  estado: EstadoFilaImport;
  motivo: string | null;
}

export interface ValidacionImportacion {
  filas: FilaValidada[];
  resumen: Record<string, number>;
}

export interface ResultadoImportacion {
  creadas: number;
  errores: Array<{ fila: number; motivo: string }>;
}

export function useImportacionCartera(): {
  campos: () => Promise<CampoImportacion[]>;
  subir: (file: File) => Promise<SubidaImportacion>;
  guardarMapeo: (id: string, mapeo: Record<string, number>) => Promise<ValidacionImportacion>;
  confirmar: (id: string, filas?: number[]) => Promise<ResultadoImportacion>;
} {
  const qc = useQueryClient();
  return {
    campos: async () => {
      await ensureApiSession();
      return apiFetch<CampoImportacion[]>('/importaciones-cartera/campos');
    },
    subir: async (file) => {
      await ensureApiSession();
      const token = getToken();
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`${API_URL}/importaciones-cartera`, {
        method: 'POST',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: fd,
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.message ?? `HTTP ${res.status}`);
      return body;
    },
    guardarMapeo: async (id, mapeo) => {
      return apiFetch<ValidacionImportacion>(`/importaciones-cartera/${id}/mapeo`, {
        method: 'PUT',
        body: JSON.stringify({ mapeo }),
      });
    },
    confirmar: async (id, filas) => {
      const r = await apiFetch<ResultadoImportacion>(`/importaciones-cartera/${id}/confirmar`, {
        method: 'POST',
        body: JSON.stringify({ filas }),
      });
      // Refrescamos las listas afectadas por el alta masiva.
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['propiedades'] }),
        qc.invalidateQueries({ queryKey: ['contratos'] }),
        qc.invalidateQueries({ queryKey: ['propietarios'] }),
      ]);
      return r;
    },
  };
}
