'use client';

/**
 * Sección "Cargos adicionales" del home del inquilino: deuda que NO nace de una
 * liquidación (reparación de un reclamo imputada al inquilino, penalidad por
 * rescisión). Antes esto era write-only: se creaba en el panel pero el inquilino
 * nunca lo veía. No se paga desde la app (no hay checkout por cargo) → se coordina
 * con la inmobiliaria; lo mostramos claro para que sepa qué debe y por qué.
 *
 * Se renderiza sola: si no hay cargos (o está cargando, o es demo) devuelve null,
 * así no ensucia el home ni rompe el modo demo.
 */
import { Card } from '@llave/ui/card';
import { AlertTriangle, Wrench } from 'lucide-react';
import { useMisCargos, type CargoInquilino } from '@/lib/api/use-cargos';
import { formatFechaCorta, formatMonto } from '@/lib/format';

export function CargosAdicionales({ inmobiliaria }: { inmobiliaria?: string }) {
  const { cargos, total, cargando } = useMisCargos();
  if (cargando || cargos.length === 0) return null;
  const moneda = cargos[0]?.moneda ?? 'ARS';

  return (
    <section className="space-y-2 animate-fade-in">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Cargos adicionales
        </h2>
        <span className="text-xs font-bold tabular-nums text-amber-700 dark:text-amber-300">
          {formatMonto(total, moneda)}
        </span>
      </div>
      <Card className="divide-y divide-amber-100 border-amber-200 bg-amber-50/60 dark:divide-amber-900/30 dark:border-amber-900/40 dark:bg-amber-900/10">
        {cargos.map((c) => (
          <CargoRow key={c.id} cargo={c} />
        ))}
        <p className="px-4 py-2.5 text-[11px] leading-snug text-amber-800/80 dark:text-amber-200/80">
          Estos cargos no se pagan desde la app. Coordiná cómo saldarlos con{' '}
          {inmobiliaria ?? 'tu inmobiliaria'}.
        </p>
      </Card>
    </section>
  );
}

function CargoRow({ cargo }: { cargo: CargoInquilino }) {
  const Icon = cargo.origen === 'RESCISION' ? AlertTriangle : Wrench;
  const etiqueta =
    cargo.origen === 'RECLAMO' ? 'Reparación' : cargo.origen === 'RESCISION' ? 'Rescisión' : 'Cargo';
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{cargo.concepto}</p>
        <p className="truncate text-[11px] text-muted-foreground">
          {etiqueta} · {formatFechaCorta(cargo.fecha)}
        </p>
      </div>
      <p className="shrink-0 text-sm font-semibold tabular-nums">
        {formatMonto(cargo.monto, cargo.moneda)}
      </p>
    </div>
  );
}
