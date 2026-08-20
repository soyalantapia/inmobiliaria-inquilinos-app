/**
 * La porción de alquiler de lo cobrado — ahora una sola vez, en `@llave/shared`.
 *
 * Este archivo nació acá cuando el KPI del dashboard prorrateaba contra un total que ya traía la
 * mora sumada y le mostraba a la inmobiliaria menos alquiler cobrado del que la rendición
 * realmente pagaba. En ese momento la regla estaba escrita **cuatro** veces: las tres del server
 * y ésta.
 *
 * Se mudó a `packages/shared` porque una regla de plata copiada en cuatro lados no se sostiene
 * con disciplina — el documento de invariantes daba las copias por coincidentes, verificado
 * leyendo, y la lectura no vio justamente la que había derivado.
 *
 * Se conserva el re-export para no tocar los call sites ni sus tests, y porque el nombre local
 * ya está en uso en el panel.
 */
export { porcionAlquilerCobrada, type ProrrateoParams } from '@llave/shared/prorrateo';
