'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarHeart, CheckCircle2, ChevronRight, Clock, XCircle } from 'lucide-react';
import { Button } from '@llave/ui/button';
import { Card } from '@llave/ui/card';
import { cn } from '@llave/ui/cn';
import {
  decisionLabel,
  leerRenovacion,
  type EstadoRenovacion,
} from '@/lib/renovacion-storage';
import { formatDuracion } from '@/lib/format';

// Banner contextual que aparece en /contrato según cuánto falta para el fin.
// - >365 días: tono neutro, "te avisamos cuando se acerque"
// - 90-365 días: tono atento, "es buen momento para decidir"
// - <=90 días: tono urgente, "ya tendrías que decidir"
// Si el inquilino ya marcó una decisión, mostramos el resumen y permitimos
// editar.

export function RenovacionBanner({
  contratoId,
  diasHastaFin,
}: {
  contratoId: string;
  diasHastaFin: number;
}) {
  const [estado, setEstado] = useState<EstadoRenovacion | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setEstado(leerRenovacion(contratoId));
    setHydrated(true);
  }, [contratoId]);

  // Antes de hidratar no renderizamos para evitar mismatch
  if (!hydrated) return null;

  // Si ya decidió, mostramos el resumen
  if (estado) {
    const icon =
      estado.decision === 'RENOVAR' ? (
        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
      ) : estado.decision === 'NO_RENOVAR' ? (
        <XCircle className="h-5 w-5 text-amber-600" />
      ) : (
        <Clock className="h-5 w-5 text-blue-600" />
      );
    return (
      <Card className="flex items-center gap-3 border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/30">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-background">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{decisionLabel(estado.decision)}</p>
          <p className="truncate text-xs text-muted-foreground">
            Avisaste a la inmobiliaria el {new Date(estado.decidiSAt).toLocaleDateString('es-AR')}
          </p>
        </div>
        <Button size="sm" variant="ghost" asChild>
          <Link href="/contrato/renovacion">Cambiar</Link>
        </Button>
      </Card>
    );
  }

  // No decidió todavía: banner según urgencia
  const duracion = formatDuracion(diasHastaFin);

  if (diasHastaFin <= 90) {
    return (
      <Card className="space-y-3 border-amber-300 bg-amber-50 p-5 dark:border-amber-900/60 dark:bg-amber-950/30">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-amber-500 text-white">
            <CalendarHeart className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold">Tu contrato vence en {duracion}</p>
            <p className="text-xs text-muted-foreground">
              Por ley necesitás avisar con anticipación si vas a renovar o irte. Decidí ahora.
            </p>
          </div>
        </div>
        <Button asChild className="w-full sm:w-auto">
          <Link href="/contrato/renovacion">
            Decidir renovación
            <ChevronRight className="h-4 w-4" />
          </Link>
        </Button>
      </Card>
    );
  }

  if (diasHastaFin <= 365) {
    return (
      <Card className="flex items-center gap-3 border-primary/20 bg-primary/5 p-4">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
          <CalendarHeart className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Faltan {duracion} para que termine tu contrato</p>
          <p className="text-xs text-muted-foreground">
            Es buen momento para empezar a pensarlo. ¿Renovás?
          </p>
        </div>
        <Button size="sm" variant="outline" asChild>
          <Link href="/contrato/renovacion">Decidir</Link>
        </Button>
      </Card>
    );
  }

  // >365: nota muy suave, sin CTA fuerte
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 rounded-lg border border-dashed bg-muted/30 px-4 py-3',
      )}
    >
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Clock className="h-3.5 w-3.5" />
        <span>
          Te avisaremos sobre la renovación cuando falten 12 meses ({duracion} todavía).
        </span>
      </div>
      <Link
        href="/contrato/renovacion"
        className="shrink-0 text-xs font-medium text-primary hover:underline"
      >
        Adelantar
      </Link>
    </div>
  );
}
