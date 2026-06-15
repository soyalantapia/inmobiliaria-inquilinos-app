'use client';

/**
 * Rendiciones al propietario contra el API real:
 *   POST /rendiciones  → confirma la rendición del período (descuenta gastos,
 *                        marca la liquidación rendida). El monto lo calcula el
 *                        server desde las liquidaciones PAGADAS — acá solo
 *                        mandamos a quién, qué período, el método y el PIN.
 *
 * El PIN lo valida el server (igual que validar/rechazar pagos): el dialog lo
 * recolecta y lo reenvía. En build demo (!apiEnabled) este hook NO se usa: el
 * dialog cae a `rendiciones-storage` como hasta ahora.
 *
 * Sigue el estilo de use-reclamos / use-pagos: ensureApiSession + apiFetch e
 * invalidación de las queries que cambian al rendir.
 */
import { useQueryClient } from '@tanstack/react-query';
import { apiEnabled, apiFetch } from './client';
import { ensureApiSession } from './session';

// Body exacto que espera POST /rendiciones (handler en apps/api/src/routes/plata.ts).
export interface RendirInput {
  propietarioId: string;
  /** Período "YYYY-MM". */
  periodo: string;
  metodo: 'TRANSFERENCIA' | 'MERCADOPAGO' | 'EFECTIVO';
  /** PIN de seguridad — el server lo valida y responde 4xx si es inválido. */
  pin?: string;
  notas?: string;
}

// Shape de la rendición que devuelve el server (201). No la tipamos completa:
// el panel solo necesita confirmar el éxito e invalidar.
export interface RendicionApi {
  id: string;
  propietarioId: string;
  periodo: string;
  montoBruto: string | number;
  comisionPct: number;
  comisionMonto: string | number;
  totalGastos: string | number;
  montoNeto: string | number;
  metodo: RendirInput['metodo'];
  notas: string | null;
}

export interface UseRendiciones {
  /** true cuando pega al API real (no al store demo). */
  deApi: boolean;
  /**
   * Confirma la rendición contra el API. Lanza ApiError si el server rechaza
   * (PIN inválido, sin CBU, ya rendido, sin cobros del período, etc.); el
   * caller muestra el mensaje. Tras el éxito invalida propietarios/liquidaciones.
   */
  rendir: (input: RendirInput) => Promise<RendicionApi>;
}

export function useRendiciones(): UseRendiciones {
  const qc = useQueryClient();

  const invalidar = () => {
    // Rendir cambia el "a recibir" del propietario y consume gastos/liquidaciones.
    void qc.invalidateQueries({ queryKey: ['propietarios'] });
    void qc.invalidateQueries({ queryKey: ['propietario'] });
    void qc.invalidateQueries({ queryKey: ['liquidaciones'] });
    void qc.invalidateQueries({ queryKey: ['rendiciones'] });
    void qc.invalidateQueries({ queryKey: ['caja'] });
  };

  return {
    deApi: apiEnabled,
    rendir: async (input) => {
      await ensureApiSession();
      const rendicion = await apiFetch<RendicionApi>('/rendiciones', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      invalidar();
      return rendicion;
    },
  };
}
