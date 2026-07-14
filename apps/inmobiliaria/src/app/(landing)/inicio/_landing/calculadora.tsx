'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowRight, Clock, TrendingUp } from 'lucide-react';
import { formatMonto } from '@/lib/format';
import { tramoPara } from '@/lib/plan';
import { track } from './analytics';

/**
 * Calculadora de ahorro de tiempo. Interactiva (el número se mueve con vos) y
 * HONESTA: muestra la asunción a la vista ("~12 min por propiedad al mes") y
 * dice "estimado". No promete una cifra de adopción ni un resultado garantizado;
 * es un estimador transparente, atado al dolor real del ICP (40 hs/mes con Excel).
 */

const MIN_POR_PROP = 12; // min/mes de cobranza + seguimiento + rendición manual

export function Calculadora() {
  const [props, setProps] = useState(60);
  // Valor de la hora EDITABLE (no inventamos un sueldo): el usuario pone el suyo
  // y traducimos las horas ahorradas a plata. Default editable, declarado estimado.
  const [valorHora, setValorHora] = useState(12000);

  const horasMes = Math.round((props * MIN_POR_PROP) / 60);
  const diasAnio = Math.round((horasMes * 12) / 8); // jornadas de 8 hs al año
  const pesosMes = horasMes * (Number.isFinite(valorHora) ? valorHora : 0);
  // Precio por tramo desde la fuente canónica (@/lib/plan) — misma tabla que
  // /precios y el schema. Se muestra al lado del valor del tiempo para comparar
  // la inversión con lo que se ahorra. Hoy es gratis (beta).
  const precio = tramoPara(props).precio;
  // "A favor" = valor del tiempo recuperado menos lo que costaría el plan.
  const aFavor = pesosMes > 0 ? pesosMes - precio : 0;

  return (
    <section className="mx-auto max-w-6xl px-5 py-20 md:px-8 md:py-24">
      <div className="grid items-center gap-10 rounded-[2rem] border border-black/[0.07] bg-white p-7 shadow-[0_30px_80px_-50px_rgba(80,40,160,0.4)] md:grid-cols-2 md:p-12">
        <div>
          <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-primary">Hacé la cuenta</p>
          <h2 className="mt-3 text-[clamp(1.7rem,3.5vw,2.6rem)] font-bold leading-[1.1] tracking-[-0.015em]">
            ¿Cuánto tiempo te come administrar a mano?
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
            Movés la barra con tu cantidad de propiedades. La cuenta asume{' '}
            <strong className="text-foreground">~12 minutos por propiedad al mes</strong> entre cobrar,
            hacer seguimiento y rendir. Es un estimado, no una promesa.
          </p>

          <label htmlFor="calc-props" className="mt-8 block text-sm font-semibold">
            Propiedades que administrás: <span className="tabular-nums text-primary">{props}</span>
          </label>
          <input
            id="calc-props"
            type="range"
            min={5}
            max={500}
            step={5}
            value={props}
            onChange={(e) => setProps(Number(e.target.value))}
            onPointerUp={() => track('calc_used', { props })}
            className="mt-3 w-full accent-[hsl(262_78%_56%)]"
          />
          <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
            <span>5</span>
            <span>500</span>
          </div>

          <label htmlFor="calc-hora" className="mt-6 block text-sm font-semibold">
            Tu hora vale aprox.{' '}
            <span className="text-[11px] font-normal text-muted-foreground">(estimá)</span>
          </label>
          <div className="relative mt-2 max-w-[200px]">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
            <input
              id="calc-hora"
              type="text"
              inputMode="numeric"
              value={valorHora ? valorHora.toLocaleString('es-AR') : ''}
              onChange={(e) => setValorHora(Number(e.target.value.replace(/\D/g, '')) || 0)}
              className="w-full rounded-lg border border-black/[0.1] bg-white py-2 pl-7 pr-3 text-sm tabular-nums outline-none focus:border-primary/50"
            />
          </div>
        </div>

        <div className="rounded-3xl bg-[linear-gradient(135deg,#2a1758_0%,#16092e_100%)] p-8 text-white">
          <div className="flex items-center gap-2 text-violet-200">
            <Clock className="h-4 w-4" />
            <span className="text-[12px] font-semibold uppercase tracking-wide">Te ahorrás, estimado</span>
          </div>
          <p className="mt-4 flex items-baseline gap-2">
            <span className="display text-6xl font-extrabold tabular-nums">{horasMes}</span>
            <span className="text-lg font-medium text-white/70">horas / mes</span>
          </p>
          <p className="mt-2 text-sm text-white/60">
            Son cerca de <strong className="text-white">{diasAnio} jornadas</strong> de 8 horas al año que
            dejás de perder en planillas y WhatsApp.
          </p>
          {/* Comparación tiempo ↔ inversión — el argumento de venta: cuánto vale
              el tiempo que recuperás vs. lo que cuesta el plan según tu cartera. */}
          <div className="mt-6 space-y-2 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            {pesosMes > 0 && (
              <div className="flex items-center justify-between gap-3">
                <span className="text-[13px] text-white/70">Ese tiempo vale</span>
                <span className="display text-xl font-extrabold tabular-nums">
                  {formatMonto(pesosMes)}
                  <span className="text-[12px] font-medium text-white/50"> /mes</span>
                </span>
              </div>
            )}
            <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-2">
              <span className="text-[13px] text-white/70">My Alquiler te cuesta</span>
              <span className="text-right leading-tight">
                <span className="display text-xl font-extrabold tabular-nums text-violet-200">
                  desde {formatMonto(precio)}
                  <span className="text-[12px] font-medium text-white/50"> /mes</span>
                </span>
                <span className="block text-[10.5px] font-semibold uppercase tracking-wide text-emerald-300">
                  Gratis hasta el lanzamiento
                </span>
              </span>
            </div>
          </div>

          {/* Refuerzo SIEMPRE positivo: si el tiempo ahorrado supera el costo,
              mostramos el neto a favor; si no (carteras chicas / hora baja),
              la realidad de la beta —hoy es gratis— para que el costo nunca
              quede solo dominando el default. Ambos casos honestos. */}
          <p className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-400/10 px-3.5 py-2.5 text-[13px] font-semibold text-emerald-300">
            <TrendingUp className="h-4 w-4 shrink-0" />
            {aFavor > 0
              ? `Aun pagándolo, te queda a favor ${formatMonto(aFavor)}/mes de tu tiempo.`
              : 'Hoy es gratis: recuperás ese tiempo sin pagar nada.'}
          </p>

          <p className="mt-3 text-[11px] leading-relaxed text-white/45">
            Estimado, según el valor de hora que pusiste. El precio va según el tamaño de tu
            cartera; las primeras 50 inmobiliarias entran con −20% para siempre.
          </p>
          <Link
            href="/registro"
            onClick={() => track('cta_click', { from: 'calculadora', props })}
            className="mt-7 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#1b1228] transition-transform hover:-translate-y-0.5"
          >
            Recuperá ese tiempo
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
