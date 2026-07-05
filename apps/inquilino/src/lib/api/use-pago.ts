'use client';

/**
 * Pago / checkout del inquilino contra el API.
 *
 * - `useLiquidacion(liqId)` deriva de `useMisLiquidaciones()` (mismo origen:
 *   API en prod, `liquidacionesMock` en la demo offline) y devuelve la liq
 *   puntual que pide la pantalla de detalle / checkout.
 * - `useInformarPago()` cablea la mutación real `POST /pagos/informar`
 *   (handler en apps/api/src/routes/plata.ts) e invalida `['mis-liquidaciones']`
 *   para que el estado de la liq se refresque tras informar.
 *
 * Lo que NO tiene endpoint para el inquilino (historial de parciales,
 * decisión del inmo sobre cada pago, lectura por IA del comprobante) sigue
 * viviendo en el store local y se gatea a `!apiEnabled`: en la demo offline
 * mantiene toda la riqueza; en prod no se inventan datos que el API no expone.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiEnabled, apiFetch } from './client';
import { useMisLiquidaciones } from './hooks';
import type { Liquidacion, PagoDeLiquidacion } from '@/lib/types';
import type { PagoInformado } from '@/lib/pago-storage';

/** Liquidación puntual por id, derivada de la lista del inquilino. */
export function useLiquidacion(liqId: string): {
  liquidacion: Liquidacion | null;
  cargando: boolean;
  isError: boolean;
  deApi: boolean;
} {
  const { liquidaciones, cargando, isError, deApi } = useMisLiquidaciones();
  // Mientras carga todavía no sabemos si existe: liquidacion=null + cargando.
  const liquidacion = liquidaciones.find((l) => l.id === liqId) ?? null;
  return { liquidacion, cargando, isError, deApi };
}

/**
 * Adapta un pago del API (`liq.pagos`) al shape local `PagoInformado` que ya
 * consumen las cards del detalle y el checkout (nacieron para el store de la
 * demo offline). Así las pantallas muestran el historial real de prod sin
 * duplicar componentes. El comprobante real vive en el backend
 * (`comprobanteUrl`), no como dataUrl local: quien quiera abrirlo debe pasar
 * por `urlDeArchivo` (token por query).
 */
export function pagoApiALocal(p: PagoDeLiquidacion, liqId: string): PagoInformado {
  return {
    v: 1,
    id: p.id,
    liqId,
    tipo: p.tipo,
    estado: p.estado,
    monto: p.monto,
    nroOperacion: p.nroOperacion,
    comprobanteFileName: p.comprobanteFileName,
    comprobanteDataUrl: null,
    comprobanteSize: 0,
    comprobanteMime: p.comprobanteMime ?? '',
    enviadoAt: p.informadoAt,
    // Autoría real del pago (solo prod): quién de los co-inquilinos lo informó.
    // undefined en la demo → la etiqueta no se muestra.
    autor: p.autor,
  };
}

/** Método de pago que entiende el API (`POST /pagos/informar`). */
export type MetodoPagoInformar =
  | 'TRANSFERENCIA'
  | 'MERCADOPAGO'
  | 'EFECTIVO'
  | 'CHEQUE';

export interface InformarPagoInput {
  liquidacionId: string;
  /** Monto efectivamente transferido (parcial o total). */
  monto: number;
  metodo: MetodoPagoInformar;
  nroOperacion?: string | null;
  /** ISO; el API lo castea a Date. */
  fechaTransferencia: string;
  nota?: string | null;
  /** Comprobante REAL ya subido a /uploads (Railway Volume). */
  comprobanteUrl?: string;
  comprobanteFileName?: string;
  comprobanteMime?: string;
  comprobanteSize?: number;
}

/**
 * Forma del `Pago` que devuelve el API al informar. Sólo tipamos lo que
 * eventualmente podríamos leer; el resto de campos del row se ignoran.
 */
export interface PagoInformadoApi {
  id: string;
  liquidacionId: string;
  periodo: string;
  tipo: 'TOTAL' | 'PARCIAL';
  monto: string | number;
  metodo: MetodoPagoInformar;
  nroOperacion: string | null;
  fechaTransferencia: string;
  estado: 'INFORMADO' | 'CONCILIADO' | 'RECHAZADO';
}

/**
 * Mutación para informar un pago. En prod hace el POST real e invalida la
 * lista de liquidaciones (la liq puede pasar a PAGADO/PARCIAL del lado del
 * inmo cuando concilie). En la demo offline `apiEnabled` es false y el
 * llamador NO debe usar esta mutación — usa el `pago-storage` local.
 */
export function useInformarPago() {
  const qc = useQueryClient();
  return useMutation<PagoInformadoApi, Error, InformarPagoInput>({
    mutationFn: (input) => {
      const body: Record<string, unknown> = {
        liquidacionId: input.liquidacionId,
        monto: input.monto,
        metodo: input.metodo,
        fechaTransferencia: input.fechaTransferencia,
      };
      // El API valida con z.string().optional(): mandamos sólo si hay valor.
      if (input.nroOperacion) body.nroOperacion = input.nroOperacion;
      if (input.nota) body.nota = input.nota;
      if (input.comprobanteUrl) {
        body.comprobanteUrl = input.comprobanteUrl;
        body.comprobanteFileName = input.comprobanteFileName;
        body.comprobanteMime = input.comprobanteMime;
        body.comprobanteSize = input.comprobanteSize;
      }
      return apiFetch<PagoInformadoApi>('/pagos/informar', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['mis-liquidaciones'] });
    },
  });
}

/** Re-export por conveniencia para las pantallas de pago. */
export { apiEnabled };
