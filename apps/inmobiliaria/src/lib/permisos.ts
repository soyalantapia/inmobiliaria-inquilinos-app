/**
 * Matriz de roles + permisos del panel — RE-EXPORT de `@llave/shared`.
 *
 * POR QUÉ ES UN RE-EXPORT Y NO UNA COPIA:
 * este archivo era un duplicado literal de `packages/shared/src/permisos.ts`, y las dos
 * copias DIVERGIERON: el panel había agregado `configuracion.ver` y el backend no lo
 * tenía. O sea que la UI y el server aplicaban matrices distintas — el panel decidía
 * qué mostrar con una tabla y `requireUsuario` autorizaba con otra. Es exactamente el
 * tipo de deriva que produce "dos usuarias con el mismo rol ven cosas distintas" y que
 * hace imposible razonar sobre permisos.
 *
 * Ahora hay UNA sola matriz. Si hace falta una capacidad nueva, se agrega en
 * `packages/shared/src/permisos.ts` y la ven las dos puntas.
 *
 * Se mantiene este módulo (en vez de cambiar los ~7 imports de `@/lib/permisos`) para
 * que el path de import siga siendo el mismo y el cambio no toque call sites.
 */
export {
  CAPACIDADES,
  GRUPO_LABEL,
  ROLES_ORDEN,
  ROL_DESCRIPCION,
  ROL_LABEL,
  contratoQuedaPendiente,
  requiereAprobacion,
  requierePinPara,
  rolTienePermiso,
} from '@llave/shared/permisos';
export type { Capacidad, DefinicionCapacidad, Rol } from '@llave/shared/permisos';
