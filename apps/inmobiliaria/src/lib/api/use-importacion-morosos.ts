'use client';

/**
 * Importación de MOROSOS HISTÓRICOS (prod).
 *
 * Prima de `use-importacion-cartera`, con una diferencia de forma: el backend es
 * STATELESS (no persiste una importación entre pasos), así que la matriz
 * parseada la sostiene el cliente y viaja de vuelta en validar/confirmar. Por eso
 * acá no hay un `id` que arrastrar.
 *
 * Sin fallback demo: sin API no hay cartera contra la cual matchear direcciones,
 * y una importación de morosos simulada no probaría nada de lo que importa.
 */
import { useQueryClient } from '@tanstack/react-query';
import { apiFetch, API_URL, getToken } from './client';
import { ensureApiSession } from './session';

export interface CampoMorosos {
  key: string;
  label: string;
  requerido: boolean;
}

/** Celda cruda tal como la devuelve el parseo del Excel. */
export type CeldaMoroso = string | number | null;

export interface AnalisisMorosos {
  columnas: string[];
  filas: CeldaMoroso[][];
  mapeoSugerido: Record<string, number>;
  filasDelArchivo: number;
  filasDescartadas: number;
  maxFilas: number;
}

export type EstadoFilaMoroso = 'OK' | 'ADVERTENCIA' | 'ERROR' | 'DUPLICADO';

export interface DatosFilaMoroso {
  direccion: string;
  inquilinoNombre: string;
  inquilinoApellido: string | null;
  inquilinoDni: string | null;
  inquilinoTelefono: string | null;
  debeDesde: string | null;
  debeHasta: string | null;
  monto: number;
  montoExpensas: number | null;
  moneda: 'ARS' | 'USD';
}

export interface FilaMorosoValidada {
  indice: number;
  datos: DatosFilaMoroso;
  estado: EstadoFilaMoroso;
  motivo: string | null;
  propiedadId: string | null;
  /** Cuántas cuotas de deuda va a crear esta fila. */
  meses: number;
  importable: boolean;
}

export interface ValidacionMorosos {
  filas: FilaMorosoValidada[];
  resumen: Record<EstadoFilaMoroso, number>;
}

export interface ResultadoMorosos {
  creadas: number;
  cuotasTotales: number;
  errores: Array<{ fila: number; motivo: string }>;
}

export function useImportacionMorosos(): {
  campos: () => Promise<CampoMorosos[]>;
  analizar: (file: File) => Promise<AnalisisMorosos>;
  validar: (filas: CeldaMoroso[][], mapeo: Record<string, number>) => Promise<ValidacionMorosos>;
  confirmar: (
    filas: CeldaMoroso[][],
    mapeo: Record<string, number>,
    seleccion?: number[],
  ) => Promise<ResultadoMorosos>;
} {
  const qc = useQueryClient();
  return {
    campos: async () => {
      await ensureApiSession();
      return apiFetch<CampoMorosos[]>('/importaciones-morosos/campos');
    },
    analizar: async (file) => {
      await ensureApiSession();
      const token = getToken();
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`${API_URL}/importaciones-morosos/analizar`, {
        method: 'POST',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: fd,
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.message ?? `HTTP ${res.status}`);
      return body;
    },
    validar: async (filas, mapeo) => {
      return apiFetch<ValidacionMorosos>('/importaciones-morosos/validar', {
        method: 'POST',
        body: JSON.stringify({ filas, mapeo }),
      });
    },
    confirmar: async (filas, mapeo, seleccion) => {
      const r = await apiFetch<ResultadoMorosos>('/importaciones-morosos/confirmar', {
        method: 'POST',
        body: JSON.stringify({ filas, mapeo, seleccion }),
      });
      // La deuda histórica impacta la ficha de la Persona y los contratos de la
      // propiedad. `personas` es la que NO invalida la importación de cartera y
      // acá es la que más importa: es donde Camila ve el semáforo del moroso.
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['personas'] }),
        qc.invalidateQueries({ queryKey: ['contratos'] }),
        qc.invalidateQueries({ queryKey: ['propiedades'] }),
        qc.invalidateQueries({ queryKey: ['propiedad'] }),
      ]);
      return r;
    },
  };
}
