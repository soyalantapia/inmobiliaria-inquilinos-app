'use client';

import { useMemo } from 'react';
import { ArrowUpRight, TrendingUp } from 'lucide-react';
import { Card } from '@llave/ui/card';
import { cn } from '@llave/ui/cn';
import { contratoMock, hitosContratoMock } from '@/lib/mock-data';
import { formatMonto } from '@/lib/format';

// Mini-gráfico SVG con la evolución del alquiler en el contrato.
// Lee los hitos AJUSTE_APLICADO + INICIO + AJUSTE_FUTURO y arma una línea.
// No usamos recharts para mantener el bundle chico — es un poly simple.

interface PuntoSerie {
  fecha: string;
  monto: number;
  label: string;
  futuro?: boolean;
}

// Parsea el detalle "$X → $Y" para extraer Y. Para el INICIO usa "Alquiler
// inicial: $X". Si no parsea, devuelve null. El detalle usa formato AR
// con puntos como separador de miles ("$405.000"), por eso quitamos puntos
// antes de hacer Number().
function parsearMonto(detalle?: string): number | null {
  if (!detalle) return null;
  const matches = detalle.match(/\$([\d.]+)/g);
  if (!matches || matches.length === 0) return null;
  const ultimo = matches[matches.length - 1]!;
  const limpio = ultimo.replace(/[$.]/g, '');
  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
}

export function HistorialAjustes() {
  const serie = useMemo<PuntoSerie[]>(() => {
    const puntos: PuntoSerie[] = [];
    for (const h of hitosContratoMock) {
      if (h.tipo === 'INICIO') {
        const monto = parsearMonto(h.detalle);
        if (monto) puntos.push({ fecha: h.fecha, monto, label: 'Inicial' });
      } else if (h.tipo === 'AJUSTE_APLICADO') {
        const monto = parsearMonto(h.detalle);
        if (monto) puntos.push({ fecha: h.fecha, monto, label: 'Ajuste' });
      } else if (h.tipo === 'AJUSTE_FUTURO') {
        // Estimamos +15% del último
        const ultimo = puntos[puntos.length - 1]?.monto ?? contratoMock.montoActual;
        puntos.push({
          fecha: h.fecha,
          monto: Math.round(ultimo * 1.15),
          label: 'Estimado',
          futuro: true,
        });
      }
    }
    return puntos;
  }, []);

  if (serie.length < 2) return null;

  const max = Math.max(...serie.map((p) => p.monto));
  const min = Math.min(...serie.map((p) => p.monto));
  const rango = Math.max(max - min, 1);

  // Coordenadas: ancho 100, alto 60. Padding 4 abajo/arriba.
  const W = 100;
  const H = 60;
  const PAD = 6;
  const puntos = serie.map((p, i) => {
    const x = (i / (serie.length - 1)) * W;
    const y = PAD + (1 - (p.monto - min) / rango) * (H - 2 * PAD);
    return { x, y, ...p };
  });

  // Segmentos: separamos los que cruzan a futuro para dashearlos
  const polyPasado = puntos
    .filter((p) => !p.futuro)
    .map((p) => `${p.x},${p.y}`)
    .join(' ');

  const polyFuturo = (() => {
    const idx = puntos.findIndex((p) => p.futuro);
    if (idx < 1) return '';
    const prev = puntos[idx - 1]!;
    const futuros = [prev, ...puntos.slice(idx).filter((p) => p.futuro)];
    return futuros.map((p) => `${p.x},${p.y}`).join(' ');
  })();

  // Variación total
  const primero = serie[0]!.monto;
  const ultimoActual = [...serie].reverse().find((s) => !s.futuro)?.monto ?? primero;
  const variacion = Math.round(((ultimoActual - primero) / primero) * 100);

  return (
    <Card className="space-y-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Evolución del alquiler</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Desde el inicio hasta hoy
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">
          <ArrowUpRight className="h-3 w-3" />
          {variacion}%
        </div>
      </div>

      {/* SVG line chart */}
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-32 w-full"
          preserveAspectRatio="none"
          role="img"
          aria-label={`Evolución del alquiler: de ${formatMonto(primero)} a ${formatMonto(ultimoActual)}, variación total ${variacion}%`}
        >
          {/* Grid horizontal */}
          {[0.25, 0.5, 0.75].map((p) => (
            <line
              key={p}
              x1="0"
              x2={W}
              y1={PAD + p * (H - 2 * PAD)}
              y2={PAD + p * (H - 2 * PAD)}
              stroke="currentColor"
              strokeWidth="0.2"
              className="text-muted-foreground/20"
            />
          ))}

          {/* Línea pasada */}
          {polyPasado && (
            <polyline
              points={polyPasado}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-primary"
            />
          )}

          {/* Línea futura */}
          {polyFuturo && (
            <polyline
              points={polyFuturo}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="2 2"
              className="text-primary/50"
            />
          )}

          {/* Puntos */}
          {puntos.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r="1.6"
              className={cn(p.futuro ? 'fill-primary/50' : 'fill-primary')}
            />
          ))}
        </svg>
      </div>

      {/* Resumen de una línea — los detalles por hito ya viven en la
          "Línea de tiempo" más abajo. Antes la tabla repetía 4 filas que el
          inquilino tenía que cruzar con la timeline para entender. */}
      <div className="space-y-1 border-t pt-3 text-xs">
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Empezaste a</span>
          <span className="font-medium tabular-nums">
            {formatMonto(primero)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Hoy pagás</span>
          <span className="font-semibold tabular-nums">
            {formatMonto(ultimoActual)}
          </span>
        </div>
      </div>
    </Card>
  );
}
