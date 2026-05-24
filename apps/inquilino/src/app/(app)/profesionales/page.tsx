'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Droplets,
  Flame,
  KeyRound,
  Paintbrush,
  ShieldCheck,
  Snowflake,
  Star,
  Truck,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card } from '@llave/ui/card';
import { cn } from '@llave/ui/cn';
import { NavBar } from '@/components/nav-bar';
import {
  type CategoriaProfesional,
  profesionalCategoriaLabel,
  profesionalesMock,
} from '@/lib/mock-data';
import { formatFecha } from '@/lib/format';

const iconoCategoria: Record<CategoriaProfesional, LucideIcon> = {
  PLOMERO: Droplets,
  ELECTRICISTA: Zap,
  GASISTA: Flame,
  CERRAJERO: KeyRound,
  PINTOR: Paintbrush,
  TECNICO_AC: Snowflake,
  FLETE: Truck,
};

type Filtro = 'TODOS' | CategoriaProfesional;

export default function ProfesionalesPage() {
  const [filtro, setFiltro] = useState<Filtro>('TODOS');
  const [soloVerificados, setSoloVerificados] = useState(false);

  const lista = useMemo(() => {
    let l = profesionalesMock;
    if (filtro !== 'TODOS') l = l.filter((p) => p.categoria === filtro);
    if (soloVerificados) l = l.filter((p) => p.verificado);
    return [...l].sort((a, b) => b.rating - a.rating);
  }, [filtro, soloVerificados]);

  // Categorías que tienen al menos 1
  const categorias: Filtro[] = ['TODOS', ...(
    Array.from(new Set(profesionalesMock.map((p) => p.categoria))) as CategoriaProfesional[]
  )];

  return (
    <>
      <header className="flex items-center gap-3 p-5 md:px-8">
        <Button size="icon" variant="ghost" asChild>
          <Link href="/cuenta">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1 min-w-0">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Tu red</p>
          <h1 className="text-xl font-semibold md:text-2xl">Profesionales</h1>
        </div>
      </header>

      <main className="flex-1 space-y-5 px-5 pb-6 md:px-8">
        {/* Disclaimer condensado: lo crítico va arriba en una línea ("no los
            contactes vos"); el detalle se mantiene corto y el CTA "creá un
            reclamo" sigue en línea. Antes ocupaba 4 líneas de texto que el
            inquilino tendía a saltearse. */}
        <Card className="border-amber-300 bg-amber-50/60 p-3 dark:border-amber-900/40 dark:bg-amber-950/30">
          <div className="flex items-start gap-3 text-xs">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" />
            <p>
              <span className="font-medium">Solo de referencia — no los contactes vos.</span>{' '}
              <span className="text-muted-foreground">
                Para reparaciones,{' '}
                <Link
                  href="/reclamos/nuevo"
                  className="font-medium text-primary underline-offset-2 hover:underline"
                >
                  creá un reclamo
                </Link>{' '}
                y la inmobiliaria coordina la visita.
              </span>
            </p>
          </div>
        </Card>

        {/* Filtros */}
        <div className="space-y-2">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {categorias.map((c) => (
              <button
                key={c}
                onClick={() => setFiltro(c)}
                className={cn(
                  'shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                  filtro === c
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background hover:bg-muted/40',
                )}
              >
                {c === 'TODOS' ? 'Todos' : profesionalCategoriaLabel[c]}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={soloVerificados}
              onChange={(e) => setSoloVerificados(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-border"
            />
            Sólo verificados por la inmobiliaria
          </label>
        </div>

        {/* Lista */}
        {lista.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-sm font-medium">No encontramos profesionales</p>
            <p className="text-xs text-muted-foreground">
              Probá quitar los filtros o pedile a tu inmobiliaria una recomendación.
            </p>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {lista.map((p) => {
              const Icon = iconoCategoria[p.categoria];
              return (
                <Card key={p.id} className="space-y-3 p-4">
                  <div className="flex items-start gap-3">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-medium leading-tight">{p.nombre}</p>
                        {p.verificado && (
                          <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {profesionalCategoriaLabel[p.categoria]} · {p.zona}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-xs">
                    <div className="flex items-center gap-1">
                      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      <span className="font-medium tabular-nums">{p.rating.toFixed(1)}</span>
                    </div>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-muted-foreground">
                      {p.cantTrabajos} trabajo{p.cantTrabajos === 1 ? '' : 's'}
                    </span>
                    {p.ultimoTrabajo && (
                      <>
                        <span className="text-muted-foreground">·</span>
                        <span className="truncate text-muted-foreground">
                          últ. {formatFecha(p.ultimoTrabajo)}
                        </span>
                      </>
                    )}
                  </div>

                  {p.notas && (
                    <p className="rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">
                      {p.notas}
                    </p>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        <Card className="space-y-2 border-dashed p-4 text-xs">
          <p className="font-medium">¿Querés recomendar a alguien?</p>
          <p className="text-muted-foreground">
            Si trabajaste con alguien que la rompió, contale a tu inmobiliaria. Si pasa la
            verificación, lo agregan a la red.
          </p>
        </Card>
      </main>

      <NavBar />
    </>
  );
}
