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
  observacion: string | null = null,
): void {
  const map = leer();
  map[pagoId] = {
    pagoId,
    estado: 'CONCILIADO',
    observacion,
    decidiSAt: new Date().toISOString(),
    decidiSPor: operador,
  };
  guardar(map);
}

export function rechazarPago(
  pagoId: string,
  operador: string,
  observacion: string,
): void {
  const map = leer();
  map[pagoId] = {
    pagoId,
    estado: 'RECHAZADO',
    observacion,
    decidiSAt: new Date().toISOString(),
    decidiSPor: operador,
  };
  guardar(map);
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
