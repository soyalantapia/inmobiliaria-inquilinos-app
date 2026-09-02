'use client';

/**
 * "¿Este usuario puede hacer X?" — una sola forma de preguntarlo en todo el panel.
 *
 * POR QUÉ EXISTE. La pregunta se resolvía a mano, copiando
 * `rolTienePermiso(normalizarRol(me?.rol, 'LECTURA'), 'cap')` en cada pantalla que se acordaba.
 * Las que se acordaron están bien; el problema son las que no, y son muchas:
 *
 *   · "Rendir" al propietario —la acción de plata más grande del mes— se le ofrecía a LECTURA;
 *   · "Resolver" el depósito en custodia, a cuatro roles que no pueden;
 *   · el tacho de un movimiento de caja, en el MISMO archivo que 320 líneas más arriba calcula
 *     bien `puedeAnular` con el comentario *"si no puede, no mostramos el botón: prometerlo para
 *     que el server conteste 403 es peor que no ofrecerlo"*. Gatearon un botón y no el de al lado;
 *   · la ficha de consorcio no consulta el rol **ni una vez** en 800 líneas;
 *   · y la barra del contrato ofrece seis acciones que el server rechaza, una de ellas hasta al
 *     OPERADOR, que es la usuaria típica del panel.
 *
 * Con un hook, la pantalla nueva pregunta bien sin conocer la historia.
 *
 * ── EL DEFAULT, QUE ES LA PARTE QUE IMPORTA ───────────────────────────────────────────────
 * Mientras `/auth/me` no contestó, `me` es `undefined` y el rol cae a `LECTURA`: **se esconde**.
 * Es a propósito, y es la decisión contraria a la que toman los recortes de datos —ahí, con
 * `/auth/me` caído, se muestra igual porque el 403 del server es la frontera real—.
 *
 * Acá la asimetría se justifica sola: esconder un botón un segundo de más sólo cuesta un
 * parpadeo; ofrecerlo cuesta que alguien complete un formulario de plata entero —a veces con
 * PIN— y coma el 403 al final. `meError` sí muestra: si la sesión no se puede consultar, que
 * mande el server y no una suposición del front.
 */
import { useMe } from '@/lib/api/hooks';
import { normalizarRol } from '@/lib/rol-storage';
import type { Rol } from '@llave/shared/permisos';
import { rolTienePermiso, type Capacidad } from '@/lib/permisos';

/**
 * El rol actual, normalizado. Hace falta porque varios endpoints cortan un rol ADENTRO del
 * handler —`if (u.rol === 'CARGA') return 403`— sin que eso se refleje en ninguna capacidad de
 * la matriz: `contratos.crear` incluye a CARGA, y esos endpoints igual lo rechazan.
 *
 * Mientras `/auth/me` no contestó devuelve `LECTURA`, el más restrictivo, por el mismo motivo
 * que `usePuede`.
 */
export function useRolActual(): Rol {
  const { me } = useMe();
  return normalizarRol(me?.rol, 'LECTURA');
}

/** `true` si el usuario puede la capacidad. Mientras carga: `false` (esconde). */
export function usePuede(capacidad: Capacidad): boolean {
  const { me, isError } = useMe();
  if (isError) return true; // que decida el server, no una suposición del front
  return rolTienePermiso(normalizarRol(me?.rol, 'LECTURA'), capacidad);
}

/** Varias capacidades de una, para pantallas con muchos botones. */
export function usePuedeVarias<K extends string>(caps: Record<K, Capacidad>): Record<K, boolean> {
  const { me, isError } = useMe();
  const rol = normalizarRol(me?.rol, 'LECTURA');
  const out = {} as Record<K, boolean>;
  for (const k of Object.keys(caps) as K[]) out[k] = isError || rolTienePermiso(rol, caps[k]);
  return out;
}
