'use client';

import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  ChevronRight,
  Megaphone,
} from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Card } from '@llave/ui/card';
import {
  type AnuncioInquilino,
  listarAnunciosParaInquilino,
} from '@/lib/anuncios-cross-app';
import { formatFecha } from '@/lib/format';

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
      <div className="flex items-center justify-between px-1">
        <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Megaphone className="h-3.5 w-3.5" />
          Anuncios de la inmobiliaria
        </h2>
        {(urgentes > 0 || importantes > 0) && (
          <Badge
            variant={urgentes > 0 ? 'destructive' : 'warning'}
            className="text-[10px]"
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
    <Card className={`flex items-start gap-3 border ${tono.border} ${tono.bg} p-3`}>
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
        <p className="line-clamp-2 text-xs text-muted-foreground">{anuncio.cuerpo}</p>
        <p className="mt-1 text-[10px] text-muted-foreground/80">
          {anuncio.enviadoPor} · {formatFecha(anuncio.enviadoAt)}
        </p>
      </div>
    </Card>
  );
}
