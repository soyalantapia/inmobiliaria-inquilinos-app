'use client';

import { useState } from 'react';
import { Check, Sparkles, X } from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@llave/ui/dialog';
import { toast } from '@llave/ui/use-toast';

interface PlanInfo {
  nombre: string;
  bullet: string;
  precio: string;
  features: string[];
  destacado?: boolean;
  cta: string;
}

const PLANES: PlanInfo[] = [
  {
    nombre: 'Starter',
    bullet: 'Hasta 10 propiedades',
    precio: '$50.000 / mes',
    features: [
      'Gestión de contratos + reclamos',
      'Multi-sociedad',
      'Liquidaciones automáticas',
      'Soporte por mail',
    ],
    cta: 'Tu plan actual',
  },
  {
    nombre: 'Growth',
    bullet: 'Hasta 50 propiedades',
    precio: '$100.000 / mes',
    features: [
      'Todo Starter +',
      'Negociador IA al renovar',
      'Validador por resumen de cuenta',
      'PDF de morosos por sociedad',
      'Soporte prioritario WhatsApp',
    ],
    cta: 'Subir a Growth',
  },
  {
    nombre: 'Pro',
    bullet: 'Hasta 250 propiedades',
    precio: '$350.000 / mes',
    destacado: true,
    features: [
      'Todo Growth +',
      'Marca blanca (tu logo y dominio)',
      'Sub-cuentas para sucursales',
      'API REST de integración',
      'Onboarding 1:1 + capacitación equipo',
      'Account manager dedicado',
    ],
    cta: 'Subir a Pro',
  },
  {
    nombre: 'Enterprise',
    bullet: '+250 propiedades',
    precio: 'A medida',
    features: [
      'Todo Pro +',
      'SLA 99.9% con penalidades contractuales',
      'Cumplimiento ISO 27001',
      'Servidores dedicados',
      'Integración con sus sistemas (Bind, AFIP, BCRA)',
      'Migración asistida por nuestro equipo',
    ],
    cta: 'Hablar con ventas',
  },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Nombre del plan vigente para resaltarlo. */
  planActual?: string;
}

/**
 * Dialog comparador de planes que abre desde /configuracion → tab Plan.
 * Muestra Starter / Growth / Pro / Enterprise con bullets de qué incluye
 * cada uno. El plan actual del usuario queda resaltado.
 */
export function CompararPlanesDialog({ open, onOpenChange, planActual = 'Starter' }: Props) {
  const [contactando, setContactando] = useState(false);

  const accionPlan = async (plan: PlanInfo) => {
    if (plan.nombre === planActual) {
      onOpenChange(false);
      return;
    }
    setContactando(true);
    // Simulación: en producción mandaría email/Slack al equipo de Ventas.
    await new Promise((r) => setTimeout(r, 500));
    setContactando(false);
    toast({
      variant: 'success',
      title: plan.nombre === 'Enterprise' ? 'Te contactamos en 24 hs' : `Listo, te subimos a ${plan.nombre}`,
      description:
        plan.nombre === 'Enterprise'
          ? 'Tu account manager te escribe por WhatsApp para armar la propuesta.'
          : 'El cambio se aplica en la próxima factura. No interrumpe la operación.',
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Comparar planes
          </DialogTitle>
          <DialogDescription>
            Elegí el plan que mejor acompañe el crecimiento de tu cartera. Podés cambiar cuando
            quieras y el ajuste prorratea en la próxima factura.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {PLANES.map((p) => {
            const esActual = p.nombre === planActual;
            return (
              <div
                key={p.nombre}
                className={`relative flex flex-col rounded-lg border p-4 ${
                  p.destacado
                    ? 'border-primary/40 bg-primary/5 ring-1 ring-primary/30'
                    : esActual
                      ? 'border-emerald-300 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-900/10'
                      : ''
                }`}
              >
                {p.destacado && (
                  <Badge className="absolute -top-2 right-3 bg-primary text-primary-foreground">
                    Recomendado
                  </Badge>
                )}
                {esActual && (
                  <Badge variant="success" className="absolute -top-2 right-3">
                    Tu plan
                  </Badge>
                )}
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    {p.nombre}
                  </p>
                  <p className="mt-1 text-lg font-bold">{p.precio}</p>
                  <p className="text-xs text-muted-foreground">{p.bullet}</p>
                </div>
                <ul role="list" className="my-4 space-y-2 text-xs">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-1.5">
                      <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  variant={p.destacado ? 'default' : esActual ? 'ghost' : 'outline'}
                  size="sm"
                  className="mt-auto"
                  onClick={() => accionPlan(p)}
                  disabled={contactando || esActual}
                >
                  {esActual ? 'Tu plan actual' : contactando ? 'Procesando…' : p.cta}
                </Button>
              </div>
            );
          })}
        </div>

        <div className="flex items-start gap-2 rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
          <X className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>
            Sin permanencia: si bajás de plan o cancelás, no cobramos penalidades. La rebaja
            arranca en el siguiente ciclo de facturación.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
