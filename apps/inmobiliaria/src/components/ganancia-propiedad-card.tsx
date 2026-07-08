'use client';

/**
 * Card "Ganancia de la inmobiliaria" en la ficha de propiedad: el total de la propiedad
 * + cuánto se ganó (rendido) y se proyecta en CADA contrato (actual + históricos).
 * Solo modo API; en demo o sin contratos no renderiza (no fabrica números).
 */
import { Card, CardContent, CardHeader, CardTitle } from '@llave/ui/card';
import { Badge } from '@llave/ui/badge';
import { apiEnabled } from '@/lib/api/client';
import { usePropiedadGanancias } from '@/lib/api/use-propiedad-ganancias';
import { formatMonto } from '@/lib/format';

function titulo(estado: string) {
  return estado.charAt(0) + estado.slice(1).toLowerCase();
}

export function GananciaPropiedadCard({ propiedadId }: { propiedadId: string }) {
  const { ganancias } = usePropiedadGanancias(propiedadId);
  if (!apiEnabled || !ganancias || ganancias.contratos.length === 0) return null;
  const m = ganancias.moneda;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Ganancia de la inmobiliaria
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Ya ganado (rendido)</p>
            <p className="text-lg font-semibold">{formatMonto(ganancias.total.ganado, m)}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Proyección total</p>
            <p className="text-lg font-semibold">{formatMonto(ganancias.total.proyeccion, m)}</p>
          </div>
        </div>

        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Por contrato
          </p>
          <ul role="list" className="divide-y">
            {ganancias.contratos.map((c) => (
              <li key={c.contratoId} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{c.inquilino || '—'}</p>
                  <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Badge variant="outline">{titulo(c.estado)}</Badge>
                    {c.modoCobranza === 'INMOBILIARIA' ? `comisión ${c.tasaComision}%` : 'cobranza directa'}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-semibold">{formatMonto(c.ganado, c.moneda)}</p>
                  <p className="text-[11px] text-muted-foreground">proy. {formatMonto(c.proyeccion, c.moneda)}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          <strong>Ganado</strong> = comisión ya rendida al propietario (congelada). <strong>Proyección</strong> =
          comisión si se cobra todo el alquiler devengado. Los contratos con cobranza directa del propietario
          no generan comisión.
        </p>
      </CardContent>
    </Card>
  );
}
