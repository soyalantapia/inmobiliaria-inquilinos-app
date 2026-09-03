/**

 * Los rótulos del rastro de auditoría, afuera de la pantalla para poder fijarlos con un test.

 *

 * Vivían adentro de `app/(app)/auditoria/page.tsx` y ahí no había forma de chequear que

 * estuvieran completos: doce de los veinticuatro tipos de evento no tenían rótulo y nadie se

 * enteró. El test de al lado los cruza contra el enum de Prisma.

 */



/**
 * Los 24 valores de `TipoEventoAuditoria` en castellano.
 *
 * TIENEN QUE ESTAR TODOS. El render cae a `?? e.tipo`, así que al que falta no se le rompe
 * nada: se le imprime `PROPIETARIO_RENDICION_ANULADA` al operador y listo. Y esta pantalla es
 * justamente adonde va el ADMIN cuando algo no cierra —quién anuló, quién conmutó sesión, quién
 * borró un movimiento—: media docena de eventos en SCREAMING_SNAKE la vuelven ilegible
 * exactamente en el momento en que se la necesita. Faltaban doce.
 *
 * Si se agrega un valor al enum de Prisma, se agrega acá.
 */
export const TIPO_LABEL: Record<string, string> = {
  PAGO_CONCILIADO: 'Pago conciliado',
  PAGO_RECHAZADO: 'Pago rechazado',
  PAGO_REVERTIDO: 'Pago revertido',
  PAGO_MANUAL_CARGADO: 'Pago manual',
  GASTO_CAJA_CARGADO: 'Gasto cargado',
  GASTO_CAJA_ELIMINADO: 'Gasto eliminado',
  PROPIETARIO_RENDIDO: 'Rendición',
  CONTRATO_APROBADO: 'Contrato aprobado',
  CONTRATO_RECHAZADO: 'Contrato rechazado',
  CONTRATO_CARGADO: 'Contrato cargado',
  PROPIEDAD_CARGADA: 'Propiedad cargada',
  EQUIPO_INVITADO: 'Equipo · alta',
  EQUIPO_REMOVIDO: 'Equipo · baja',
  PROPIETARIO_RENDICION_ANULADA: 'Rendición anulada',
  PROPIETARIO_CONFIRMO_RECIBO: 'Propietario confirmó',
  MODO_COBRANZA_CAMBIADO: 'Modo de cobranza',
  PROPIETARIO_CUENTA_CAMBIADA: 'Cuenta del propietario',
  INQUILINO_CONTACTO_CAMBIADO: 'Contacto del inquilino',
  GARANTE_AGREGADO: 'Garante agregado',
  GARANTE_EDITADO: 'Garante editado',
  GARANTE_ELIMINADO: 'Garante eliminado',
  MORA_EDITADA: 'Mora editada',
  MOVIMIENTO_CONSORCIO_ELIMINADO: 'Movimiento de consorcio eliminado',
  RECLAMO_CLASIFICADO: 'Reclamo clasificado',
  PROFESIONAL_ASIGNADO: 'Profesional asignado',
  FACTURA_ARCA_EMITIDA: 'Factura ARCA',
  SESION_CONMUTADA: 'Sesión conmutada',
  CONMUTACION_RECHAZADA: 'Conmutación rechazada',
  PIN_DESBLOQUEADO: 'PIN desbloqueado',
  PIN_ELIMINADO: 'PIN eliminado',
  EQUIPO_REINCORPORADO: 'Equipo · reincorporación',
  EQUIPO_ROL_CAMBIADO: 'Equipo · cambio de rol',
  CONTRATO_DADO_DE_BAJA: 'Contrato dado de baja',
};

export const TIPO_VARIANT: Record<string, 'success' | 'destructive' | 'warning' | 'secondary'> = {
  PAGO_CONCILIADO: 'success',
  PROPIETARIO_RENDIDO: 'success',
  CONTRATO_APROBADO: 'success',
  EQUIPO_INVITADO: 'success',
  EQUIPO_REINCORPORADO: 'success',
  // Ámbar y no verde: un cambio de rol puede SUBIR o BAJAR poder, y la línea que hay que
  // encontrar cuando algo no cierra es la que lo subió. En gris se pierde entre las demás.
  EQUIPO_ROL_CAMBIADO: 'warning',
  PAGO_RECHAZADO: 'destructive',
  GASTO_CAJA_ELIMINADO: 'destructive',
  CONTRATO_RECHAZADO: 'destructive',
  EQUIPO_REMOVIDO: 'destructive',
  // La baja libera la propiedad, borra las cuotas futuras y puede resolver el depósito.
  // Es irreversible: va en rojo, como el resto de lo que deshace.
  CONTRATO_DADO_DE_BAJA: 'destructive',
  // En rojo lo que deshace o borra plata, y lo que es un intento fallido de entrar.
  PROPIETARIO_RENDICION_ANULADA: 'destructive',
  MOVIMIENTO_CONSORCIO_ELIMINADO: 'destructive',
  CONMUTACION_RECHAZADA: 'destructive',
  PIN_ELIMINADO: 'destructive',
  // Borrado duro: `Garante` no tiene baja lógica y el detalle del evento es lo único
  // que queda de lo que la póliza decía.
  GARANTE_ELIMINADO: 'destructive',
  // En amarillo lo que cambia una regla de plata o quién está operando: no está mal, pero es
  // lo que el ADMIN quiere ver de un vistazo cuando revisa el rastro.
  MORA_EDITADA: 'warning',
  MODO_COBRANZA_CAMBIADO: 'warning',
  PROPIETARIO_CUENTA_CAMBIADA: 'warning',
  // El email del inquilino es su credencial: reapuntarlo reapunta el acceso a la app.
  INQUILINO_CONTACTO_CAMBIADO: 'warning',
  GARANTE_EDITADO: 'warning',
  SESION_CONMUTADA: 'warning',
  PIN_DESBLOQUEADO: 'warning',
  PROPIETARIO_CONFIRMO_RECIBO: 'success',
};
