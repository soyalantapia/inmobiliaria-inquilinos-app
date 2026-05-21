// Estado de conciliación de pagos informados por inquilinos.
// El inquilino sube un comprobante en su app → queda como INFORMADO.
// El admin lo valida acá → pasa a CONCILIADO (queda cobrado) o RECHAZADO.
//
// En backend real es una tabla `Pago` con foreign key a Liquidacion y un
// estado tipo `INFORMADO | CONCILIADO | RECHAZADO`. Acá lo mantenemos en
// localStorage del lado inmo para que las acciones del admin sean
// persistentes durante la sesión.

const STORAGE_KEY = 'llave-inmo:conciliacion:v1';

export type EstadoConciliacion = 'INFORMADO' | 'CONCILIADO' | 'RECHAZADO';

export interface AccionConciliacion {
  pagoId: string;
  /**
   * ID de la liquidación a la que apunta el pago. Lo guardamos en la
   * acción para que la app del inquilino pueda detectar la decisión del
   * admin (CONCILIADO / RECHAZADO) sin tener acceso al mapping
   * pagoId → liquidacionId del lado inmo.
   */
  liqId: string | null;
  estado: EstadoConciliacion;
  observacion: string | null;
  decidiSAt: string;
  decidiSPor: string; // nombre del operador
}

function leer(): Record<string, AccionConciliacion> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, AccionConciliacion>) : {};
  } catch {
    return {};
  }
}

function guardar(map: Record<string, AccionConciliacion>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export function estadoDePago(pagoId: string): EstadoConciliacion {
  const accion = leer()[pagoId];
  return accion?.estado ?? 'INFORMADO';
}

export function listarAcciones(): Record<string, AccionConciliacion> {
  return leer();
}

export function conciliarPago(
  pagoId: string,
  operador: string,
  options: { liqId?: string | null; observacion?: string | null } = {},
): void {
  const map = leer();
  map[pagoId] = {
    pagoId,
    liqId: options.liqId ?? null,
    estado: 'CONCILIADO',
    observacion: options.observacion ?? null,
    decidiSAt: new Date().toISOString(),
    decidiSPor: operador,
  };
  guardar(map);
}

export function rechazarPago(
  pagoId: string,
  operador: string,
  observacion: string,
  options: { liqId?: string | null } = {},
): void {
  const map = leer();
  map[pagoId] = {
    pagoId,
    liqId: options.liqId ?? null,
    estado: 'RECHAZADO',
    observacion,
    decidiSAt: new Date().toISOString(),
    decidiSPor: operador,
  };
  guardar(map);
}

/**
 * Devuelve la acción del admin para una liquidación dada (lookup por
 * liqId). Útil para que la app del inquilino pueda mostrar "tu pago fue
 * rechazado" o "tu pago fue confirmado" leyendo el storage del inmo.
 */
export function accionPorLiqId(liqId: string): AccionConciliacion | null {
  const map = leer();
  for (const a of Object.values(map)) {
    if (a.liqId === liqId) return a;
  }
  return null;
}

/**
 * Revierte una conciliación / rechazo previo y vuelve el pago a estado
 * INFORMADO (pendiente de validación). Útil cuando el admin dio OK por
 * error o el inquilino mandó el comprobante equivocado. La auditoría
 * registra quién revirtió y por qué.
 */
export function revertirAccion(
  pagoId: string,
): AccionConciliacion | null {
  const map = leer();
  const prev = map[pagoId];
  if (!prev) return null;
  delete map[pagoId];
  guardar(map);
  return prev;
}
