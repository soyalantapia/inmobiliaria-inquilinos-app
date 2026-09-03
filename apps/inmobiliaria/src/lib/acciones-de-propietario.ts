/**
 * Qué se puede hacer con un propietario: eliminarlo, darlo de baja, o nada.
 *
 * EL DEFECTO QUE ESTO CIERRA (T-01-N1-N7). `PATCH /propietarios/:id/activo` está construido,
 * autenticado, con su 409 de cobranza directa y con `requirePropietario` revalidando `activo` en
 * cada request para cortar la sesión abierta. **Ningún archivo del panel lo llamaba.** O sea que
 * la capacidad existía y nadie podía ejercerla.
 *
 * Y la ficha empeoraba la lectura: el único botón destructivo, «Eliminar», aparece sólo cuando el
 * propietario NO tiene propiedades — y el backend además exige que no tenga contratos ni
 * rendiciones. Sirve para limpiar un alta duplicada, que es justo el caso que no importa. Al
 * dueño que VENDIÓ su departamento —el que tiene historial, el que hay que sacar del portal— la
 * pantalla no le ofrecía nada.
 *
 * Importa desde que el portal del propietario está sirviendo en producción: la baja lógica es lo
 * que le corta el acceso a un ex-dueño. Hasta ahora la única forma era borrarle el email a mano
 * desde la ficha —un efecto lateral de otra cosa, sin documentar, que nadie sabe—.
 *
 * VIVE APARTE DE LA PANTALLA para que la regla se pueda poner en rojo: cuál de los dos botones
 * sale es una decisión, no una condición suelta adentro de un JSX.
 */

export type AccionPropietario = 'ELIMINAR' | 'DAR_DE_BAJA' | 'REACTIVAR';

export interface EstadoPropietario {
  /** Propiedades en las que participa. Con al menos una, el DELETE del backend no procede. */
  propiedades: number;
  /** `false` = ya está dado de baja. `undefined` en la demo, que no modela el campo. */
  activo?: boolean;
}

/**
 * La acción destructiva que corresponde ofrecer, o `null` si no hay ninguna.
 *
 * Las dos son distintas y no se reemplazan:
 *   · ELIMINAR borra la fila. Sólo procede sin historial — limpiar una carga duplicada.
 *   · DAR_DE_BAJA conserva el historial contable y le corta el acceso al portal.
 *
 * Nunca se ofrecen las dos juntas: mostrar «Eliminar» y «Dar de baja» al lado obliga a elegir
 * entre dos palabras parecidas con consecuencias muy distintas, y la que suena más suave es la
 * que borra.
 */
export function accionDePropietario(e: EstadoPropietario): AccionPropietario | null {
  if (e.activo === false) return 'REACTIVAR';
  if (e.propiedades === 0) return 'ELIMINAR';
  return 'DAR_DE_BAJA';
}

/** El texto del diálogo de confirmación. Dice qué pasa y qué NO pasa. */
export function textoDeBaja(nombre: string, activo: boolean): { titulo: string; descripcion: string; boton: string } {
  if (!activo) {
    return {
      titulo: `¿Reactivar a ${nombre}?`,
      descripcion: 'Vuelve a aparecer en tu cartera y recupera el acceso a su portal.',
      boton: 'Reactivar',
    };
  }
  return {
    titulo: `¿Dar de baja a ${nombre}?`,
    // Lo que se promete acá tiene que ser cierto: el historial NO se toca, y el corte de acceso
    // es inmediato porque `requirePropietario` revalida `activo` en cada request (no espera a
    // que venza el token de 7 días).
    descripcion:
      'Pierde el acceso a su portal en el momento y deja de recibir avisos. Su historial de ' +
      'rendiciones y liquidaciones queda intacto, y podés reactivarlo cuando quieras.',
    boton: 'Dar de baja',
  };
}
