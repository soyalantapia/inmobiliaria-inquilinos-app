'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Star } from 'lucide-react';
import { Button } from '@llave/ui/button';
import { Card, CardContent } from '@llave/ui/card';
import { cn } from '@llave/ui/cn';
import { Textarea } from '@llave/ui/textarea';
import { toast } from '@llave/ui/use-toast';
import { guardarRating, obtenerRating, type RatingReclamo } from '@/lib/ratings-storage';

const ETIQUETAS: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: 'Muy mal',
  2: 'Mal',
  3: 'Regular',
  4: 'Bien',
  5: '¡Excelente!',
};

export function RatingReclamoCard({ reclamoId }: { reclamoId: string }) {
  const [rating, setRating] = useState<RatingReclamo | null>(null);
  const [seleccion, setSeleccion] = useState<1 | 2 | 3 | 4 | 5 | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [comentario, setComentario] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    setRating(obtenerRating(reclamoId));
  }, [reclamoId]);

  // Si ya calificó, mostramos el ack
  if (rating) {
    return (
      <Card className="border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/40 dark:bg-emerald-900/10">
        <CardContent className="space-y-2 p-5">
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4" />
            <p className="text-xs font-semibold uppercase tracking-wide">Gracias por calificar</p>
          </div>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <Star
                key={n}
                className={cn(
                  'h-5 w-5',
                  n <= rating.estrellas
                    ? 'fill-amber-400 text-amber-400'
                    : 'text-muted-foreground/30',
                )}
              />
            ))}
            <span className="ml-2 text-sm font-medium">
              {ETIQUETAS[rating.estrellas]}
            </span>
          </div>
          {rating.comentario && (
            <p className="rounded-md bg-background/60 p-3 text-sm italic text-muted-foreground">
              &ldquo;{rating.comentario}&rdquo;
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  const enviar = async () => {
    if (!seleccion) return;
    setEnviando(true);
    await new Promise((r) => setTimeout(r, 400));
    const nuevo: RatingReclamo = {
      reclamoId,
      estrellas: seleccion,
      comentario: comentario.trim() || null,
      enviadoAt: new Date().toISOString(),
    };
    guardarRating(nuevo);
    setRating(nuevo);
    setEnviando(false);
    toast({
      title: '¡Gracias por tu opinión!',
      description: 'Ayudás a que la inmobiliaria mejore.',
    });
  };

  return (
    <Card className="space-y-4 p-5">
      <div className="space-y-1">
        <h3 className="text-base font-semibold">¿Cómo te trataron?</h3>
        <p className="text-xs text-muted-foreground">
          Tu calificación es anónima para el operador pero la inmobiliaria la usa para
          mejorar.
        </p>
      </div>

      <div className="flex flex-col items-center gap-2 py-2">
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => {
            const activo = (hover ?? seleccion ?? 0) >= n;
            return (
              <button
                key={n}
                type="button"
                onClick={() => setSeleccion(n as 1 | 2 | 3 | 4 | 5)}
                onMouseEnter={() => setHover(n)}
                onMouseLeave={() => setHover(null)}
                className="p-1 transition-transform hover:scale-110"
                aria-label={`${n} estrellas`}
              >
                <Star
                  className={cn(
                    'h-8 w-8 transition-colors',
                    activo
                      ? 'fill-amber-400 text-amber-400'
                      : 'text-muted-foreground/30',
                  )}
                />
              </button>
            );
          })}
        </div>
        <p
          className={cn(
            'text-xs font-medium',
            seleccion || hover ? 'text-foreground' : 'text-muted-foreground',
          )}
        >
          {hover
            ? ETIQUETAS[hover as 1 | 2 | 3 | 4 | 5]
            : seleccion
              ? ETIQUETAS[seleccion]
              : 'Tocá una estrella'}
        </p>
      </div>

      {seleccion !== null && (
        <div className="space-y-2 animate-fade-in">
          <label htmlFor="rating-comentario" className="text-xs font-medium text-muted-foreground">
            Contanos más (opcional)
          </label>
          <Textarea
            id="rating-comentario"
            aria-describedby="rating-comentario-count"
            placeholder="Ej: El plomero llegó puntual y dejó todo limpio."
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            rows={3}
            maxLength={300}
          />
          <p id="rating-comentario-count" className="text-right text-[10px] text-muted-foreground">
            {comentario.length}/300
          </p>
        </div>
      )}

      <Button
        size="lg"
        className="w-full"
        disabled={seleccion === null || enviando}
        onClick={enviar}
      >
        {enviando ? 'Enviando…' : 'Enviar calificación'}
      </Button>
    </Card>
  );
}
