'use client';

import { useEffect, useState } from 'react';
import { Check, Download, Plus, Share, Smartphone } from 'lucide-react';
import { Button } from '@llave/ui/button';
import { Card } from '@llave/ui/card';
import { cn } from '@llave/ui/cn';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@llave/ui/dialog';
import { toast } from '@llave/ui/use-toast';
import { useInstalarApp } from '@/lib/instalar-app';

/** Pasos para "agregar a inicio" en iPhone (Safari no instala por botón). */
export function InstruccionesIOSDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-primary" />
            Descargar en iPhone
          </DialogTitle>
          <DialogDescription>
            En 2 pasos la agregás a tu pantalla de inicio (desde Safari):
          </DialogDescription>
        </DialogHeader>
        <ol className="space-y-3 text-sm">
          <li className="flex items-center gap-3">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
              1
            </span>
            <span className="flex flex-wrap items-center gap-1">
              Tocá <Share className="inline h-4 w-4 text-primary" /> <strong>Compartir</strong> en
              la barra de Safari.
            </span>
          </li>
          <li className="flex items-center gap-3">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
              2
            </span>
            <span className="flex flex-wrap items-center gap-1">
              Elegí <Plus className="inline h-4 w-4 text-primary" />{' '}
              <strong>Agregar a inicio</strong> y confirmá.
            </span>
          </li>
        </ol>
        <Button onClick={() => onOpenChange(false)} className="w-full">
          <Check className="h-4 w-4" />
          Entendido
        </Button>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Botón "Descargar app". Instala la PWA: nativo en Android/Chrome, instrucciones
 * en iPhone, y un hint del menú del navegador como último recurso. Se oculta solo
 * si la app ya está instalada (corriendo en modo standalone).
 */
export function InstalarAppBoton({
  className,
  full,
  variant = 'default',
}: {
  className?: string;
  full?: boolean;
  variant?: 'default' | 'outline';
}) {
  // Evita mismatch de hidratación: en SSR no sabemos si está instalada.
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);
  const { instalada, instalar } = useInstalarApp();
  const [iosOpen, setIosOpen] = useState(false);

  if (!montado || instalada) return null;

  const onClick = async () => {
    const r = await instalar();
    if (r === 'ios') setIosOpen(true);
    else if (r === 'instalada')
      toast({ title: '¡Listo!', description: 'Ya tenés la app en tu pantalla de inicio.' });
    else if (r === 'no-disponible')
      toast({
        title: 'Instalá desde el menú del navegador',
        description: 'Abrí el menú (⋮) y tocá "Instalar app" o "Agregar a pantalla de inicio".',
      });
  };

  return (
    <>
      <Button variant={variant} onClick={onClick} className={cn('gap-2', full && 'w-full', className)}>
        <Download className="h-4 w-4" />
        Descargar app
      </Button>
      <InstruccionesIOSDialog open={iosOpen} onOpenChange={setIosOpen} />
    </>
  );
}

/** Card persistente para /cuenta: "Descargá la app en tu celular" + botón. */
export function DescargarAppCard() {
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);
  const { instalada } = useInstalarApp();

  // Si ya está instalada, no tiene sentido ofrecer descargarla.
  if (!montado || instalada) return null;

  return (
    <Card className="flex flex-col gap-3 border-primary/20 bg-primary/5 p-5 sm:flex-row sm:items-center">
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
        <Smartphone className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">Descargá la app en tu celular</p>
        <p className="text-xs text-muted-foreground">
          La tenés en tu pantalla de inicio y entrás directo, sin abrir el navegador.
        </p>
      </div>
      <InstalarAppBoton className="shrink-0" />
    </Card>
  );
}
