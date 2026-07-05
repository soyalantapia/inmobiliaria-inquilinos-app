export type PinResultado = { ok: true } | { ok: false; code: 400 | 403 | 429; message: string };

/**
 * PIN ELIMINADO de la plataforma (decisión de producto): ninguna acción requiere PIN.
 *
 * Se mantiene la firma para no romper los callers (plata / operacion / core /
 * resúmenes-bancarios, que llaman a esto a través de sus wrappers `verificarPin`),
 * pero SIEMPRE aprueba. Las acciones sensibles siguen protegidas por rol/capacidad
 * (requireUsuario + la capacidad correspondiente) y por el aislamiento multi-tenant.
 */
export async function verificarPinUsuario(_userId: string, _pin: string | undefined): Promise<PinResultado> {
  return { ok: true };
}
