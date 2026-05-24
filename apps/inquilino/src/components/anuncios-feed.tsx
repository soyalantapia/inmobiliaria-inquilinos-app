'use client';

import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  ChevronDown,
  Megaphone,
} from 'lucide-react';
import { cn } from '@llave/ui/cn';
import { Badge } from '@llave/ui/badge';
import { Card } from '@llave/ui/card';
import {
  type AnuncioInquilino,
  listarAnunciosParaInquilino,
} from '@/lib/anuncios-cross-app';
import { formatFechaCorta } from '@/lib/format';

export function AnunciosFeed({ compacto = false }: { compacto?: boolean }) {
  const [anuncios, setAnuncios] = useState<AnuncioInquilino[]>([]);
  const [hidratado, setHidratado] = useState(false);

  useEffect(() => {
    setAnuncios(listarAnunciosParaInquilino());
    setHidratado(true);
  }, []);

  if (!hidratado || anuncios.length === 0) return null;

  const aMostrar = compacto ? anuncios.slice(0, 3) : anuncios;
  const urgentes = anuncios.filter((a) => a.prioridad === 'URGENTE').length;
  const importantes = anuncios.filter((a) => a.prioridad === 'IMPORTANTE').length;

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2 px-1">
        <h2 className="flex min-w-0 items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Megaphone className="h-3.5 w-3.5 shrink-0" />
          <span className="line-clamp-1">Anuncios de la inmobiliaria</span>
        </h2>
        {(urgentes > 0 || importantes > 0) && (
          <Badge
            variant={urgentes > 0 ? 'destructive' : 'warning'}
            className="shrink-0 whitespace-nowrap text-[10px]"
          >
            {urgentes > 0
              ? `${urgentes} urgente${urgentes === 1 ? '' : 's'}`
              : `${importantes} importante${importantes === 1 ? '' : 's'}`}
          </Badge>
        )}
      </div>
      <div className="space-y-2">
        {aMostrar.map((a) => (
          <AnuncioRow key={a.id} anuncio={a} />
        ))}
      </div>
    </section>
  );
}

function AnuncioRow({ anuncio }: { anuncio: AnuncioInquilino }) {
  // Anuncio colapsable: por default solo título + 1 línea de preview, click
  // para expandir el cuerpo completo (P2 de la auditoría: 2 anuncios largos
  // consumían demasiado espacio del home).
  const [expandido, setExpandido] = useState(false);
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
  return (
    <Card
      className={`border ${tono.border} ${tono.bg} cursor-pointer transition-colors hover:bg-opacity-100`}
      onClick={() => setExpandido((v) => !v)}
    >
      <div className="flex items-start gap-3 p-3">
        <div
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${tono.icono}`}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-sm font-semibold">{anuncio.titulo}</p>
            {anuncio.prioridad !== 'NORMAL' && (
              <Badge
                variant={anuncio.prioridad === 'URGENTE' ? 'destructive' : 'warning'}
                className="text-[9px]"
              >
                {anuncio.prioridad}
              </Badge>
            )}
          </div>
          <p
            className={cn(
              'text-xs text-muted-foreground',
              expandido ? 'whitespace-pre-line' : 'line-clamp-1',
            )}
          >
            {anuncio.cuerpo}
          </p>
          <p className="mt-1 text-[10px] text-muted-foreground/80">
            {anuncio.enviadoPor} · {formatFechaCorta(anuncio.enviadoAt)}
          </p>
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
