/**
 * El prefijo que marca un `Pago` en RECHAZADO como **reversión interna**, no como un
 * comprobante que el inquilino mandó y le rebotó.
 *
 * POR QUÉ EXISTE UN PREFIJO. El esquema tiene un solo estado `RECHAZADO` para dos cosas que no
 * se parecen en nada:
 *
 *   - **El inquilino mandó un comprobante y no era válido.** Es culpa suya y cuenta como tal.
 *   - **La inmobiliaria dio de baja un cobro que ella misma había registrado** —lo cargó mal, o
 *     el extracto bancario confirmó la plata por otra vía—. No es culpa del inquilino y no
 *     puede contar como si lo fuera.
 *
 * Lo segundo se marca poniéndole este prefijo a la `observacion`, y el resto del sistema lo lee
 * para tratarlo distinto: no baja el nivel de buen pagador del certificado, el feed dice "la
 * inmobiliaria revirtió un cobro" en vez de "tu comprobante fue rechazado", y la observación
 * —que es una nota interna— no se le muestra.
 *
 * POR QUÉ ESTÁ ACÁ Y NO COMO STRING SUELTO. Estaba escrito a mano en tres lugares
 * (`plata.ts` dos veces, `inquilino-mundo.ts` una) y eso ya falló: cuando la conciliación por
 * extracto bancario empezó a cerrar avisos de pago (`resumenes-bancarios.ts`), su autor no tenía
 * cómo saber que existía la convención. El resultado, en producción: a un inquilino cuyo pago el
 * BANCO había confirmado se le mostraba "Tu pago fue rechazado", se le publicaba en el feed con
 * severidad crítica, se le filtraba la nota interna y se le bajaba el nivel del certificado.
 *
 * Si aparece otro lugar que anule un cobro propio, tiene que usar `observacionDeReversion`.
 */
export const PREFIJO_REVERSION_INTERNA = 'Anulado tras conciliar:';

/** Arma la observación de una reversión interna, con el prefijo puesto. */
export function observacionDeReversion(motivo: string): string {
  return `${PREFIJO_REVERSION_INTERNA} ${motivo}`;
}

/** ¿Este pago RECHAZADO es una reversión de la inmobiliaria y no un rechazo al inquilino? */
export function esReversionInterna(observacion: string | null | undefined): boolean {
  return (observacion ?? '').startsWith(PREFIJO_REVERSION_INTERNA);
}
