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
 *
 * SÍ TOCA LAS CLAVES DEL PORTAL DEL PROPIETARIO, y eso es nuevo. El portal se sirve como
 * `/propietario` de este MISMO host (ver `work-agent/02-DEPLOY.md`), así que comparte origen y
 * comparte `localStorage`. En el mostrador compartido eso significa: Camila le muestra a un
 * dueño su rendición, el dueño entra con su OTP, Camila cierra sesión —y el token del dueño
 * sigue ahí SIETE DÍAS, porque el barrido sólo miraba `llave-inmo:`—. El siguiente que abra
 * `/propietario` en esa máquina entra como él: ve sus rendiciones, su comisión y la morosidad
 * de sus inquilinos.
 *
 * Acá sí se borra el token del portal junto con lo demás: a diferencia del panel, no hay ningún
 * caller que lo administre. Cerrar sesión en el mostrador tiene que significar "terminé, pasa
 * el que sigue" para las dos puertas.
 */
const PREFIJOS = ['llave-inmo:', 'myalquiler-propietario:'] as const;

export function limpiarEstadoDeSesion(): void {
  if (typeof window === 'undefined') return;
  try {
    // Se juntan las claves ANTES de borrar: mutar el storage mientras se lo recorre por índice
    // saltea elementos, y saltearse una es exactamente el bug que esto viene a cerrar.
    const aBorrar: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && PREFIJOS.some((pre) => k.startsWith(pre))) aBorrar.push(k);
    }
    for (const k of aBorrar) window.localStorage.removeItem(k);
  } catch {
    // localStorage puede tirar (modo privado, cuota). No poder limpiar no puede impedir que
    // alguien cierre sesión o cambie de usuario: el hard nav de después igual descarta la
    // memoria, que es la mitad del problema.
  }
}
