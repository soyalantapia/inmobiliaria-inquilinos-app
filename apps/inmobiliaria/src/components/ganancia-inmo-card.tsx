'use client';

/**
 * Card "Ganancia de la inmobiliaria" en el detalle del contrato. Muestra la comisión
 * ya rendida (congelada) y la proyección sobre la vida del contrato. Solo en modo API;
 * en demo (o si el contrato es de cobranza directa) no muestra números fabricados.
 */
import { Card, CardContent, CardHeader, CardTitle } from '@llave/ui/card';
import { apiEnabled } from '@/lib/api/client';
import { useContratoGanancia } from '@/lib/api/use-contrato-ganancia';
import { formatMonto } from '@/lib/format';
import type { Moneda } from '@/lib/types';

function Fila({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={bold ? 'font-semibold' : ''}>{value}</span>
    </div>
  );
}

export function GananciaInmoCard({ contratoId, moneda }: { contratoId: string; moneda: Moneda }) {
  const { ganancia } = useContratoGanancia(contratoId);
  // En demo no existe el cálculo; sin datos aún, no renderizamos nada.
  if (!apiEnabled || !ganancia) return null;

  const directo = ganancia.modoCobranza !== 'INMOBILIARIA';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Ganancia de la inmobiliaria
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {directo ? (
          <p className="text-muted-foreground">
            Cobranza directa del propietario: la inmobiliaria no cobra comisión en este contrato.
          </p>
        ) : (
          <>
            <Fila label="Ya ganado (rendido)" value={formatMonto(ganancia.ganado, moneda)} bold />
            <Fila label="Proyección (vida del contrato)" value={formatMonto(ganancia.proyeccion, moneda)} />
            <Fila label="Falta ganar" value={formatMonto(ganancia.faltaGanar, moneda)} />
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Comisión {ganancia.tasaComision}% sobre el alquiler. <strong>Ganado</strong> = comisión
              ya rendida al propietario (congelada). <strong>Proyección</strong> = comisión total si se
              cobra todo el alquiler devengado del contrato.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
