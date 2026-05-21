'use client';

import { useEffect, useState } from 'react';
import { Gift, Sparkles, X } from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card, CardContent } from '@llave/ui/card';
import { toast } from '@llave/ui/use-toast';
import {
  activarTrial,
  cancelarTrial,
  diasRestantesTrial,
  leerTrial,
  trialVigente,
  type Trial,
} from '@/lib/trial-storage';
import { formatFecha } from '@/lib/format';

/**
 * Banner que aparece en /configuracion cuando la inmo tiene un trial
 * gratuito vigente. Incluye un dialog para activarlo a mano (modo demo).
 */
export function TrialBanner() {
  const [trial, setTrial] = useState<Trial | null>(null);
  const [hidratado, setHidratado] = useState(false);

  useEffect(() => {
    setTrial(leerTrial());
    setHidratado(true);
  }, []);

  if (!hidratado) return null;

  const vigente = trial && trialVigente(trial);
  const dias = trial ? diasRestantesTrial(trial) : 0;

  if (vigente && trial) {
    return (
      <Card className="border-emerald-300 bg-gradient-to-br from-emerald-50 to-emerald-50/40 dark:border-emerald-900/40 dark:from-emerald-900/20 dark:to-emerald-900/10">
        <CardContent className="flex flex-wrap items-start gap-3 p-5">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-emerald-500 text-white shadow-lg shadow-emerald-500/20">
            <Gift className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-base font-semibold">¡Tenés acceso gratuito!</p>
              <Badge variant="success" className="gap-1 text-[10px]">
                <Sparkles className="h-3 w-3" />
                Trial activo
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {trial.motivo}. Tu trial vence el{' '}
              <strong className="text-foreground">
                {formatFecha(trial.hasta)}
              </strong>{' '}
              ({dias} día{dias === 1 ? '' : 's'} restantes). No se debita nada
              mientras esté activo.
            </p>
            <p className="text-[11px] text-muted-foreground">
              Activado por {trial.activadoPor}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              cancelarTrial();
              setTrial(null);
              toast({ title: 'Trial finalizado' });
            }}
            className="shrink-0 gap-1"
          >
            <X className="h-3 w-3" />
            Finalizar
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Si no hay trial activo, mostramos un toggle compacto para activar (demo)
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-wrap items-center gap-3 p-3 text-xs text-muted-foreground">
        <Gift className="h-4 w-4 text-primary" />
        <span>
          ¿Sos promotor estratégico o llegaste por un convenio especial? Pediles
          a Ventas que te active el trial gratuito.
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto h-7 text-[10px]"
          onClick={() => {
            const nuevo = activarTrial({
              tipo: 'PROMOTOR',
              motivo: 'Trial 6 meses · acuerdo de presentación con CUCICBA',
              meses: 6,
              activadoPor: 'Equipo de ventas My Alquiler',
            });
            setTrial(nuevo);
            toast({
              variant: 'success',
              title: '¡Trial activado!',
              description: 'Tenés 6 meses gratis. Sin compromiso.',
            });
          }}
        >
          Activar trial demo
        </Button>
      </CardContent>
    </Card>
  );
}
