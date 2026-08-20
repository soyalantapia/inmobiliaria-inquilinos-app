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
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
  /** Acota la rendición a UNA moneda. Obligatoria cuando el dueño cobró en varias. */
  moneda?: 'ARS' | 'USD';
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
  // Ingresos extra de caja del período que SUMAN al neto (default 0).
  totalIngresos?: string | number;
  montoNeto: string | number;
  metodo: RendirInput['metodo'];
  notas: string | null;
  /**
   * Cuándo se rindió de verdad. Acá decía `createdAt?: string`, un campo que el modelo
   * `Rendicion` NO tiene: el API devuelve la fila cruda de Prisma, que trae `rendidoAt`. Como
   * `createdAt` llegaba siempre `undefined`, las dos pantallas que lo consumen caían al
   * fallback `${periodo}-01` y mostraban el día 1 del período como fecha de pago. Una
   * rendición de julio hecha el 12 de agosto se veía como 1 de julio — que es el dato con el
   * que alguien contesta "¿cuándo le pagaste a Silvana?".
   */
  rendidoAt: string;
  /**
   * La moneda EN QUE SE RINDIÓ. Se persiste desde la migración `20260819220000`.
   *
   * Este tipo no la declaraba, así que todo el panel caía al default pesos de `formatMonto`:
   * la misma rendición se leía "US$ 1.104" en el portal del dueño y "$ 1.104" en la pantalla
   * de Camila, que es la que le dicta el número por teléfono. Es el mismo bug que se cerró del
   * lado del portal, todavía abierto del lado de adentro.
   *
   * Opcional para no romper una respuesta vieja cacheada; los lectores caen a 'ARS', que es lo
   * que la columna tiene por default.
   */
  moneda?: 'ARS' | 'USD';
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

/**
 * Lista de rendiciones ya hechas (GET /rendiciones), key ['rendiciones'] — la
 * misma que invalida `rendir`. Antes el panel de propietarios leía el estado
 * "rendido" SOLO de localStorage (vacío en prod) → tras rendir, al refrescar el
 * dueño volvía a aparecer "Por rendir" y el historial mostraba $0. Con esto el
 * estado sale del server y persiste.
 */
export function useRendicionesList(): { rendiciones: RendicionApi[]; cargando: boolean } {
  const q = useQuery({
    queryKey: ['rendiciones'],
    queryFn: async () => {
      await ensureApiSession();
      return apiFetch<RendicionApi[]>('/rendiciones');
    },
    enabled: apiEnabled,
    staleTime: 30_000,
  });
  return { rendiciones: q.data ?? [], cargando: q.isPending };
}
