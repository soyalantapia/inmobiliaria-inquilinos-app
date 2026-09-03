/**
 * ¿Se puede confiar en que el mail de este propietario le llega a él?
 *
 * DE DÓNDE SALE. `Propietario.email` lo tipea a mano el staff de la inmobiliaria y **nadie lo
 * verifica nunca**. Un mail equivocado no rebota: la rendición «se mandó», el link del portal
 * «se mandó», y del otro lado no hay nadie. T-23-N2-N1 empezó por lo correcto —medir antes de
 * decidir— y agregó `emailVerificadoAt`, que se sella cuando el dueño canjea un OTP: acaba de
 * leer un código que sólo llegó a esa casilla, que es la misma prueba que daría un doble opt-in.
 *
 * EL PROBLEMA ERA QUE NADIE LA LEÍA. La columna existía, tenía migración, se escribía y se
 * invalidaba sola, con tests propios… y no aparecía en ningún tipo del panel ni en ninguna
 * pantalla. O sea que el «primero se mide» que la propia tarea declara no se podía hacer desde
 * el producto: sólo por SQL.
 *
 * CUÁL ES EL CASO QUE IMPORTA. Verificar y entrar son el mismo gesto, así que un dueño que nunca
 * entró tampoco tiene mail verificado — y de ése ya avisa «Nunca entró al portal». El caso que
 * no tenía cómo verse es el otro: **entró alguna vez y DESPUÉS le cambiaron el mail**. Ahí
 * `emailVerificadoAt` se cae sola (`core.ts`, en el PUT del propietario) y queda un dueño que
 * figura como activo, con una casilla que nadie probó nunca. Es exactamente donde vive el typo,
 * y es el único que no se delata solo.
 *
 * POR QUÉ EL RÓTULO DICE «sin confirmar» Y NO «mal». La columna se agregó el 31/08: un dueño
 * que hubiera entrado ANTES de esa migración tendría acceso y no tendría marca, sin que su mail
 * tenga nada de malo. Hoy no hay ninguno —la base de producción no tiene datos de negocio
 * todavía—, pero el rótulo se elige para que siga siendo cierto cuando los haya: lo que se
 * afirma es que **no tenemos prueba** de que esa casilla sea suya, que es verdad en los dos
 * casos. Afirmar más que eso mandaría a la administradora a perseguir a alguien por nada.
 */

export type AccesoDelPropietario =
  /** El backend no manda el dato (o es viejo). No se afirma nada. */
  | 'desconocido'
  /** Nunca entró al portal: hay que reenviarle el link. */
  | 'nunca-entro'
  /** Entró alguna vez, pero el mail que tiene HOY nunca se probó. */
  | 'mail-sin-verificar'
  /** Entró y el mail que tiene hoy es el que usó para entrar. */
  | 'ok';

export function accesoDelPropietario(p: {
  ultimoAccesoAt?: string | null;
  emailVerificadoAt?: string | null;
}): AccesoDelPropietario {
  // `undefined` es "el backend no lo manda". Afirmar que nunca entró sin saberlo haría que la
  // administradora persiga a alguien que sí usa el portal.
  if (p.ultimoAccesoAt === undefined) return 'desconocido';
  if (p.ultimoAccesoAt === null) return 'nunca-entro';
  if (p.emailVerificadoAt === undefined) return 'desconocido';
  if (p.emailVerificadoAt === null) return 'mail-sin-verificar';
  return 'ok';
}
