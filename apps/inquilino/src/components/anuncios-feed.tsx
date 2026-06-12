'use client';

import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  Check,
  ChevronDown,
  Megaphone,
} from 'lucide-react';
import { cn } from '@llave/ui/cn';
import { Badge } from '@llave/ui/badge';
import { Card } from '@llave/ui/card';
import { type AnuncioInquilino } from '@/lib/anuncios-cross-app';
import { type Acuse } from '@/lib/anuncios-acuses';
import { useMisAnuncios } from '@/lib/api/hooks';
import { formatFechaCorta } from '@/lib/format';

export function AnunciosFeed({ compacto = false }: { compacto?: boolean }) {
  const { anuncios, acuses, marcarLeido, marcarEnterado, hidratado } = useMisAnuncios();

  if (!hidratado || anuncios.length === 0) return null;

  const aMostrar = compacto ? anuncios.slice(0, 3) : anuncios;
  const noLeidos = anuncios.filter((a) => !acuses[a.id]?.leidoAt).length;

  const abrir = (id: string) => {
    void marcarLeido(id);
  };
  const confirmar = (id: string) => {
    void marcarEnterado(id);
  };

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2 px-1">
        <h2 className="flex min-w-0 items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Megaphone className="h-3.5 w-3.5 shrink-0" />
          <span className="line-clamp-1">Anuncios de la inmobiliaria</span>
        </h2>
        {noLeidos > 0 && (
          <Badge className="shrink-0 whitespace-nowrap text-[10px]">
            {noLeidos} sin leer
          </Badge>
        )}
      </div>
      <div className="space-y-2">
        {aMostrar.map((a) => (
          <AnuncioRow
            key={a.id}
            anuncio={a}
            acuse={acuses[a.id]}
            onAbrir={() => abrir(a.id)}
            onEnterado={() => confirmar(a.id)}
          />
        ))}
      </div>
    </section>
  );
}

function AnuncioRow({
  anuncio,
  acuse,
  onAbrir,
  onEnterado,
}: {
  anuncio: AnuncioInquilino;
  acuse?: Acuse;
  onAbrir: () => void;
  onEnterado: () => void;
}) {
  // Anuncio colapsable: por default solo título + preview, click para expandir.
  const [expandido, setExpandido] = useState(false);
  const noLeido = !acuse?.leidoAt;
  const confirmado = !!acuse?.confirmadoAt;

  const tono =
    anuncio.prioridad === 'URGENTE'
      ? {
          border: 'border-destructive/40',
          bg: 'bg-destructive/5',
          icono: 'bg-destructive text-destructive-foreground',
          IconComp: AlertTriangle,
        }
      : anuncio.prioridad === 'IMPORTANTE'
        ? {
            border: 'border-amber-300/60',
            bg: 'bg-amber-50/60 dark:bg-amber-900/10',
            icono: 'bg-amber-500 text-white',
            IconComp: Bell,
          }
        : {
            border: 'border-primary/20',
            bg: 'bg-primary/5',
            icono: 'bg-primary text-primary-foreground',
            IconComp: Megaphone,
          };
  const Icon = tono.IconComp;

  const toggle = () => {
    if (!expandido) onAbrir(); // abrir = marcar leído
    setExpandido((v) => !v);
  };

  return (
    <Card
      className={cn(
        'cursor-pointer border transition-colors',
        tono.border,
        tono.bg,
        noLeido && 'ring-1 ring-primary/30',
      )}
      onClick={toggle}
    >
      <div className="flex items-start gap-3 p-3">
        <div
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${tono.icono}`}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {noLeido && (
              <span
                className="h-2 w-2 shrink-0 rounded-full bg-primary"
                aria-label="Sin leer"
              />
            )}
            <p className={cn('text-sm', noLeido ? 'font-bold' : 'font-semibold')}>
              {anuncio.titulo}
            </p>
            {anuncio.prioridad !== 'NORMAL' && (
              <Badge
                variant={anuncio.prioridad === 'URGENTE' ? 'destructive' : 'warning'}
                className="text-[9px]"
              >
                {anuncio.prioridad}
              </Badge>
            )}
          </div>
          {/* line-clamp-2 para preview; expandido muestra todo. */}
          <p
            className={cn(
              'text-xs text-muted-foreground',
              expandido ? 'whitespace-pre-line' : 'line-clamp-2',
            )}
          >
            {anuncio.cuerpo}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[10px] text-muted-foreground/80">
              {anuncio.enviadoPor} · {formatFechaCorta(anuncio.enviadoAt)}
            </p>
            {confirmado ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600">
                <Check className="h-3 w-3" /> Enterado
              </span>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEnterado();
                }}
                className="inline-flex items-center gap-1 rounded-full border border-primary/40 px-2.5 py-0.5 text-[10px] font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
              >
                <Check className="h-3 w-3" /> Enterado
              </button>
            )}
          </div>
        </div>
        <ChevronDown
          className={cn(
            'mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform',
            expandido && 'rotate-180',
          )}
        />
      </div>
    </Card>
  );
}
