'use client';

import { TrendingDown, TrendingUp, Minus, Gauge } from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Card, CardContent } from '@llave/ui/card';
import {
  NIVEL_COLOR,
  NIVEL_LABEL,
  type ResumenScoring,
} from '@/lib/scoring-inquilino';

interface Props {
  scoring: ResumenScoring;
  /** Tamaño compacto sin breakdown — para tablas / listados. */
  compacto?: boolean;
}

export function ScoringInquilinoCard({ scoring, compacto = false }: Props) {
  if (compacto) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${NIVEL_COLOR[scoring.nivel]}`}
      >
        <Gauge className="h-3 w-3" />
        {scoring.score}
        <span className="opacity-70">· {NIVEL_LABEL[scoring.nivel]}</span>
      </span>
    );
  }

  const TendIcon =
    scoring.tendencia > 0 ? TrendingUp : scoring.tendencia < 0 ? TrendingDown : Minus;
  const tendColor =
    scoring.tendencia > 0
      ? 'text-emerald-600'
      : scoring.tendencia < 0
        ? 'text-destructive'
        : 'text-muted-foreground';

  return (
    <Card className={NIVEL_COLOR[scoring.nivel]}>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-14 w-14 place-items-center rounded-md bg-background/80 text-3xl font-bold tabular-nums">
              {scoring.score}
            </div>
            <div>
              <p className="text-sm font-semibold">Scoring del inquilino</p>
              <p className="text-xs text-muted-foreground">
                {scoring.inquilino} · ponderado sobre 100 puntos.
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge variant="outline" className="bg-background/80 text-xs">
              {NIVEL_LABEL[scoring.nivel]}
            </Badge>
            <span className={`inline-flex items-center gap-1 text-xs ${tendColor}`}>
              <TendIcon className="h-3 w-3" />
              {scoring.tendencia > 0 ? '+' : ''}
              {scoring.tendencia} vs mes anterior
            </span>
          </div>
        </div>

        <div className="space-y-2">
          {scoring.factores.map((f) => {
            const barColor =
              f.puntaje >= 85
                ? 'bg-emerald-500'
                : f.puntaje >= 70
                  ? 'bg-primary'
                  : f.puntaje >= 55
                    ? 'bg-amber-500'
                    : 'bg-destructive';
            return (
              <div key={f.factor} className="rounded-md border bg-background/60 p-2.5">
                <div className="flex items-baseline justify-between gap-3 text-xs">
                  <div>
                    <p className="font-medium">{f.label}</p>
                    <p className="text-[10px] text-muted-foreground">
                      Aporta {f.aporte} / {f.peso} pts · puntaje {f.puntaje}/100
                    </p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums">
                    {f.puntaje}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full transition-all ${barColor}`}
                    style={{ width: `${f.puntaje}%` }}
                  />
                </div>
                <p className="mt-1 text-[11px] italic text-muted-foreground">
                  {f.explicacion}
                </p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
