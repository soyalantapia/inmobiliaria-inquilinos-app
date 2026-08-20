/**
 * Barrer TODO el estado local del usuario que se va.
 *
 * POR QUÉ EXISTE. En el mostrador de Camila una máquina la usan varias personas. El panel
 * guarda un montón de cosas del tenant y de la sesión en `localStorage` bajo el prefijo
 * `llave-inmo:` —caja, cierres, conciliación, rendiciones, aprobaciones, auditoría, el borrador
 * de contrato a medio cargar, las sociedades, el rol de sesión…— y hasta ahora el logout
 * limpiaba **una sola** de esas claves.
 *
 * El comentario que había en `cerrarSesion` describía el bug exacto que eso causó: *"el
 * siguiente que entraba heredaba la razón social y el CUIT del anterior y los imprimía en sus
 * PDF de cobranza"*. Se arregló esa clave y quedaron las demás.
 *
 * Se barre por PREFIJO y no por lista a propósito: una lista enumerada envejece mal, y el modo
 * de fallo de olvidarse una es justamente el que ya pasó.
 *
 * NO toca `llave:auth:token` (otro prefijo, sin guion): quién decide sobre el token es el
 * caller, porque el conmutador lo REEMPLAZA y el logout lo BORRA.
 */
const PREFIJO = 'llave-inmo:';

export function limpiarEstadoDeSesion(): void {
  if (typeof window === 'undefined') return;
  try {
    // Se juntan las claves ANTES de borrar: mutar el storage mientras se lo recorre por índice
    // saltea elementos, y saltearse una es exactamente el bug que esto viene a cerrar.
    const aBorrar: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(PREFIJO)) aBorrar.push(k);
    }
    for (const k of aBorrar) window.localStorage.removeItem(k);
  } catch {
    // localStorage puede tirar (modo privado, cuota). No poder limpiar no puede impedir que
    // alguien cierre sesión o cambie de usuario: el hard nav de después igual descarta la
    // memoria, que es la mitad del problema.
  }
}
