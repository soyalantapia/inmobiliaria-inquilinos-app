/**
 * Lo que la card de ganancia tiene que mostrar arriba, cuando la propiedad tuvo contratos
 * en más de una moneda.
 *
 * EL DEFECTO. `GET /propiedades/:id/ganancias` devuelve `total` y `moneda`, y la card los
 * pintaba bajo los rótulos «Ya ganado (rendido)» y «Proyección total». Pero ese `total` **no
 * es el total**: es el de la moneda principal nada más. Lo dice el propio comentario del
 * endpoint, y hay un test de la API que lo afirma:
 *
 * > `expect(body.total.ganado).not.toBeCloseTo(suma, 2)`
 *
 * Una propiedad que estuvo alquilada en pesos y después en dólares mostraba la comisión de
 * una sola de las dos, con la palabra «total» al lado. No es un número roto —es un número
 * creíble, más chico que el real, sin nada que avise—. El desglose completo ya viajaba en
 * `totalesPorMoneda`; el panel lo tiraba porque su tipo ni lo declaraba.
 *
 * POR QUÉ ES UNA FUNCIÓN Y NO DOS LÍNEAS ADENTRO DEL JSX. Porque el panel no tiene tests de
 * componentes —a propósito: `vitest.config.ts` corre en `node` y lo explica—, así que lo que
 * no sea una función pura no lo prueba nadie. Y hay un error que el tipo no atrapa: mapear
 * `proyeccion` donde va `ganado`. Los dos son `number`. Acá se prueba una vez.
 */
import type { Moneda } from './types';
import { formatTotalPorMoneda } from './format';

export interface TotalGanancia {
  moneda: Moneda;
  ganado: number;
  proyeccion: number;
}

export function gananciaParaMostrar(totales: readonly TotalGanancia[]): {
  ganado: string;
  proyeccion: string;
} {
  return {
    ganado: formatTotalPorMoneda(totales.map((t) => ({ monto: t.ganado, moneda: t.moneda }))),
    proyeccion: formatTotalPorMoneda(totales.map((t) => ({ monto: t.proyeccion, moneda: t.moneda }))),
  };
}
