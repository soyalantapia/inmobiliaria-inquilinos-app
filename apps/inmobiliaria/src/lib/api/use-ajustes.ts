'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiEnabled, apiFetch } from './client';
import { ensureApiSession } from './session';

export interface AjusteAlquiler {
  id: string;
  montoAnterior: string | number;
  montoNuevo: string | number;
  periodoDesde: string;
  motivo: string | null;
  createdAt: string;
}

/** Historial de ajustes del alquiler de un contrato. */
export function useAjustes(contratoId: string): { ajustes: AjusteAlquiler[]; disponible: boolean } {
  const q = useQuery({
    queryKey: ['ajustes', contratoId],
    queryFn: async () => {
      await ensureApiSession();
      return apiFetch<AjusteAlquiler[]>(`/contratos/${contratoId}/ajustes`);
    },
    enabled: apiEnabled && !!contratoId,
    staleTime: 30_000,
  });
  return { ajustes: apiEnabled ? (q.data ?? []) : [], disponible: apiEnabled };
}

/** Reemplaza los dueños y sus % de una propiedad (PUT /propiedades/:id/participaciones).
 *  El server valida que sumen 100, sin duplicados y con propietarios del tenant. */
export function useEditarParticipaciones(propiedadId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (participaciones: { propietarioId: string; porcentaje: number }[]) => {
      await ensureApiSession();
      return apiFetch(`/propiedades/${propiedadId}/participaciones`, {
        method: 'PUT',
        body: JSON.stringify({ participaciones }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['propiedad', propiedadId] });
      qc.invalidateQueries({ queryKey: ['propiedades'] });
      qc.invalidateQueries({ queryKey: ['propietarios'] });
    },
  });
}

/** Ajustar el alquiler: nuevo canon + desde qué período. Actualiza el contrato y las
 *  cuotas futuras impagas, y registra el ajuste en el historial. */
export function useAjustarAlquiler(contratoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { montoNuevo: number; periodoDesde: string; motivo?: string }) => {
      await ensureApiSession();
      return apiFetch<{ liquidacionesActualizadas: number; montoNuevo: number }>(
        `/contratos/${contratoId}/ajustar`,
        { method: 'POST', body: JSON.stringify(input) },
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ajustes', contratoId] });
      qc.invalidateQueries({ queryKey: ['contrato', contratoId] });
      qc.invalidateQueries({ queryKey: ['contratos'] });
      // El ajuste re-escribe el monto de las cuotas futuras impagas: sin invalidar el
      // listado, el panel seguía mostrando —y COBRANDO— el canon viejo hasta que la cache
      // expiraba. El resto de las mutaciones de plata (use-pagos.ts) ya lo invalidaba.
      qc.invalidateQueries({ queryKey: ['liquidaciones'] });
      qc.invalidateQueries({ queryKey: ['pagos'] });
    },
  });
}

export interface DeudaHistoricaInput {
  propiedadId: string;
  personaId?: string;
  inquilino: {
    nombre: string;
    apellido?: string;
    email?: string;
    telefono?: string;
    dni?: string;
  };
  monto: number;
  moneda: 'ARS' | 'USD';
  montoExpensas?: number;
  fechaInicio: string;
  fechaFin: string;
  diaPago: number;
}

export interface DeudaHistoricaCreada {
  id: string;
  personaId: string;
  periodosAdeudados: number;
}

/**
 * Carga la deuda de un inquilino que YA SE FUE (POST /contratos/historico).
 *
 * Crea un contrato FINALIZADO que NO ocupa la propiedad, así que se puede usar
 * sobre una propiedad que hoy está alquilada a otro. Invalida la propiedad (su
 * historial cambia) y las personas (la deuda entra en la ficha del moroso, que
 * es lo que enciende el semáforo si mañana lo quieren volver a alquilar).
 */
export function useCargarDeudaHistorica(propiedadId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: DeudaHistoricaInput) => {
      await ensureApiSession();
      return apiFetch<DeudaHistoricaCreada>('/contratos/historico', {
        method: 'POST',
        body: JSON.stringify(input),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['propiedad', propiedadId] });
      qc.invalidateQueries({ queryKey: ['contratos'] });
      qc.invalidateQueries({ queryKey: ['personas'] });
    },
  });
}

export interface ExpensasCambiadas {
  contrato: { id: string; montoExpensas: string | number | null; tipoContrato: string };
  liquidacionesReajustadas: number;
  tipoContrato: string;
  sinCambios?: boolean;
}

/**
 * Cambia el monto de expensas de un contrato (PATCH /contratos/:id/expensas).
 *
 * Hasta T-21-N1-N1 esto no existía: `montoExpensas` se escribía una sola vez, en
 * el alta, y las expensas suben todos los meses. Para corregirlas había que
 * rehacer el contrato entero.
 *
 * Invalida también ['contrato', id] y las liquidaciones: el cambio re-devenga
 * las cuotas futuras impagas, así que lo que la pantalla está mostrando queda
 * viejo en el mismo instante.
 */
export function useCambiarExpensas(contratoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { montoExpensas: number; motivo?: string }) => {
      await ensureApiSession();
      return apiFetch<ExpensasCambiadas>(`/contratos/${contratoId}/expensas`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contrato', contratoId] });
      qc.invalidateQueries({ queryKey: ['contratos'] });
      qc.invalidateQueries({ queryKey: ['liquidaciones'] });
      qc.invalidateQueries({ queryKey: ['pagos'] });
    },
  });
}
