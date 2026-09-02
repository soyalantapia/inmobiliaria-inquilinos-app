/**
 * Un piso de tiempo para los RECHAZOS de login, para que el reloj no diga lo que el mensaje
 * calla.
 *
 * EL ATAQUE. Un endpoint de verificación puede contestar siempre lo mismo —"código inválido"—
 * y delatar igual si el email existe, por lo que TARDA: el camino del email inexistente hace
 * menos queries y vuelve antes. Medido en el portal del propietario el 20/08 con un código
 * equivocado en los dos casos: **703 ms contra 253 ms**. El ataque es de dos pasos: pedir el
 * código (200, no dice nada) y después mandar cualquiera y cronometrar.
 *
 * POR QUÉ UN PISO Y NO IGUALAR EL TRABAJO. Se probó primero con una query señuelo: bajó de 451
 * a 259 ms de spread y ahí se estancó, porque igualar costos de I/O es perseguir un número que
 * depende de la red, del pool y del planner. Un piso fijo no depende de nada de eso: si el
 * handler tardó menos, espera; si tardó más, no espera. Plano por construcción y verificable
 * con un cronómetro.
 *
 * SÓLO EN LOS RECHAZOS. El camino feliz no necesita padding: para llegar hay que saber un
 * código válido, y quien lo sabe ya sabe que el email existe.
 *
 * VIVE ACÁ Y NO ADENTRO DE UN HANDLER porque el portal del propietario lo tenía y el login del
 * inquilino no — la misma clase de agujero, en el endpoint hermano, sin arreglar. Una copia
 * más era garantizar que volvieran a divergir.
 */
export const PISO_RECHAZO_MS = 900;

/** Espera hasta completar el piso, contando desde `desde` (un `process.hrtime.bigint()`). */
export async function esperarPisoDeRechazo(desde: bigint, piso = PISO_RECHAZO_MS): Promise<void> {
  const transcurrido = Number(process.hrtime.bigint() - desde) / 1e6;
  if (transcurrido < piso) {
    await new Promise((r) => setTimeout(r, piso - transcurrido));
  }
}
