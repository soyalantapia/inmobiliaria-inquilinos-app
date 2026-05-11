'use client';

import { useMemo, useState } from 'react';
import { Check, Copy, MessageCircle, Share2 } from 'lucide-react';
import { Button } from '@llave/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@llave/ui/dialog';
import { toast } from '@llave/ui/use-toast';
import { generarGaranteToken } from '@/lib/garante-token';

// CTA + modal para compartir el contrato con el garante. Genera un token con
// vigencia de 30 días, arma la URL y ofrece copiar al portapapeles o
// disparar WhatsApp con un mensaje pre-armado.

export function CompartirGarante({
  contratoId,
  nombreInquilino,
  direccion,
}: {
  contratoId: string;
  nombreInquilino: string;
  direccion: string;
}) {
  const [open, setOpen] = useState(false);
  const [copiado, setCopiado] = useState(false);

  // El token se genera una vez por apertura del dialog para no exponer múltiples.
  const url = useMemo(() => {
    if (!open) return '';
    const token = generarGaranteToken(contratoId, 30);
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/garantes/${token}`;
  }, [open, contratoId]);

  const mensajeWA = `Hola! Soy ${nombreInquilino}. Te comparto el estado de mi contrato de alquiler en ${direccion} — podés consultarlo sin cuenta acá: ${url}`;

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      toast({ title: 'Link copiado' });
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      toast({ title: 'No pudimos copiar', variant: 'destructive' });
    }
  };

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Share2 className="h-3.5 w-3.5" />
        Compartir con garante
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Compartir con tu garante</DialogTitle>
            <DialogDescription>
              Link de sólo lectura, válido por 30 días. Tu garante puede ver el estado del contrato
              sin necesidad de crear cuenta.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="rounded-md border bg-muted/40 p-3">
              <p className="break-all text-xs font-mono text-muted-foreground">{url}</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="outline" className="flex-1" onClick={copiar}>
                {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copiado ? 'Copiado' : 'Copiar link'}
              </Button>
              <Button asChild className="flex-1">
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(mensajeWA)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MessageCircle className="h-4 w-4" />
                  Enviar por WhatsApp
                </a>
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              El garante sólo verá: dirección, fechas, monto actual, índice de ajuste y datos de tu
              garantía. No expone datos personales tuyos ni de pagos.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
