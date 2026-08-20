'use client';

import { Card } from '@llave/ui/card';
import { money, periodoLargo } from '@/lib/format';
import type { RendicionPortal } from '@/lib/api';

/**
 * Cuánto le entró al dueño, arriba de todo.
 *
 * La pestaña listaba las rendiciones una por una y no había NINGÚN total. La primera pregunta
 * de un propietario —y la única que le hace el contador— es "cuánto me depositaron este año", y
 * para contestarla había que sumar a mano las tarjetas de la pantalla.
 *
 * SE AGRUPA POR MONEDA Y NUNCA SE SUMAN ENTRE SÍ. Un dueño puede tener una unidad en pesos y
 * otra en dólares: cada una se rinde por separado (el backend rechaza con 409 mezclarlas en un
 * mismo período) y sumarlas acá sería inventar un número que no existe. Es el mismo criterio
 * que el cierre de caja, que expone `porMoneda` en vez de un total único.
 *
 * EL EJE ES LA FECHA DE DEPÓSITO, no el período liquidado: "cuánto me entró en 2026" es una
 * pregunta de caja, y es la que le sirve al contador. Un período de diciembre rendido en enero
 * cuenta en enero, que es cuando la plata se movió.
 */

interface Corte {
  moneda: 'ARS' | 'USD';
  esteAnio: { total: number; cantidad: number };
  anteriores: { total: number; cantidad: number };
  ultima: string | null;
  /** El `rendidoAt` de esa última, para poder compararla. No se muestra. */
  ultimaAt: string | null;
}

export function cortarPorMoneda(rendiciones: RendicionPortal[], anio: number): Corte[] {
  const por = new Map<string, Corte>();
  for (const r of rendiciones) {
    const m = r.moneda ?? 'ARS';
    let c = por.get(m);
    if (!c) {
      c = { moneda: m, esteAnio: { total: 0, cantidad: 0 }, anteriores: { total: 0, cantidad: 0 }, ultima: null, ultimaAt: null };
      por.set(m, c);
    }
    const esDelAnio = new Date(r.rendidoAt).getFullYear() === anio;
    const balde = esDelAnio ? c.esteAnio : c.anteriores;
    balde.total = Math.round((balde.total + r.teDepositamos) * 100) / 100;
    balde.cantidad += 1;
    // "La última" se decide por FECHA DE DEPÓSITO, igual que el total de arriba, y no por el
    // orden en que vino la lista.
    //
    // El server ordena por `periodo desc` y recién después por `rendidoAt desc`, así que
    // quedarse con la primera que se ve asume que los dos órdenes coinciden. No siempre: un
    // período viejo rendido tarde —una puesta al día— llega DESPUÉS en la lista y ANTES en el
    // tiempo. El rótulo terminaba nombrando un período que no fue el último movimiento de
    // plata, abajo de un número que sí cuenta por fecha de depósito.
    //
    // Sólo cuenta si cayó en el año de la tarjeta: si no, decía "la última, diciembre 2025"
    // abajo de un total que dice "te depositamos en 2026".
    if (esDelAnio && (!c.ultimaAt || r.rendidoAt > c.ultimaAt)) {
      c.ultima = r.periodo;
      c.ultimaAt = r.rendidoAt;
    }
  }
  // Los pesos primero: es la moneda del 99% de los contratos y la que el dueño espera arriba.
  return [...por.values()].sort((a, b) => (a.moneda === 'ARS' ? -1 : b.moneda === 'ARS' ? 1 : 0));
}

export function ResumenPagos({ rendiciones }: { rendiciones: RendicionPortal[] }) {
  const anio = new Date().getFullYear();
  const cortes = cortarPorMoneda(rendiciones, anio);
  if (cortes.length === 0) return null;

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {cortes.map((c) => (
        <Card key={c.moneda} className="space-y-1 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Te depositamos en {anio}
            {cortes.length > 1 && ` · ${c.moneda === 'USD' ? 'dólares' : 'pesos'}`}
          </p>
          <p className="text-2xl font-semibold tabular-nums">{money(c.esteAnio.total, c.moneda)}</p>
          <p className="text-xs text-muted-foreground">
            {c.esteAnio.cantidad === 0
              ? 'Todavía no hubo rendiciones este año.'
              : `${c.esteAnio.cantidad} ${c.esteAnio.cantidad === 1 ? 'rendición' : 'rendiciones'}${
                  c.ultima ? ` · la última, ${periodoLargo(c.ultima).toLowerCase()}` : ''
                }`}
          </p>
          {c.anteriores.cantidad > 0 && (
            <p className="text-xs text-muted-foreground">
              Antes de {anio}: {money(c.anteriores.total, c.moneda)} en {c.anteriores.cantidad}{' '}
              {c.anteriores.cantidad === 1 ? 'rendición' : 'rendiciones'}.
            </p>
          )}
        </Card>
      ))}
    </div>
  );
}
