'use client';

import { useEffect, useState } from 'react';
import {
  ArrowRight,
  CreditCard,
  Sparkles,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@llave/ui/button';
import { cn } from '@llave/ui/cn';

const STORAGE_KEY = 'llave:onboarding-completed:v1';

interface Slide {
  icon: LucideIcon;
  iconBg: string;
  titulo: string;
  descripcion: string;
  bullets: string[];
}

const SLIDES: Slide[] = [
  {
    icon: CreditCard,
    iconBg: 'from-primary to-primary/70',
    titulo: 'Pagás tu alquiler en un toque',
    descripcion: 'Sin pasar por el home banking ni anotar números de cuenta.',
    bullets: [
      'Vemos el monto exacto del mes',
      'Te recordamos antes del vencimiento',
      'Subís el comprobante y listo',
    ],
  },
  {
    icon: Sparkles,
    iconBg: 'from-fuchsia-500 to-purple-600',
    titulo: 'Chateás con tu contrato',
    descripcion: 'El Broker es una IA que lee tus cláusulas y te responde al instante.',
    bullets: [
      'Aumentos, depósito, mascotas, vencimiento',
      'Cita la cláusula exacta que aplica',
      'Te deriva a la inmobiliaria si hace falta',
    ],
  },
  {
    icon: Wrench,
    iconBg: 'from-amber-500 to-orange-600',
    titulo: 'Reportás problemas en segundos',
    descripcion: 'Plomería, electricidad, cerradura — todo desde la app.',
    bullets: [
      'Sumás foto y descripción rápida',
      'Seguís el estado en tiempo real',
      'Chateás con el operador asignado',
    ],
  },
];

export function Onboarding() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const completado = window.localStorage.getItem(STORAGE_KEY);
      if (!completado) setOpen(true);
    } catch {
      // ignore
    }
  }, []);

  const cerrar = () => {
    setOpen(false);
    try {
      window.localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    } catch {
      // ignore
    }
  };

  const siguiente = () => {
    if (step < SLIDES.length - 1) setStep(step + 1);
    else cerrar();
  };

  // Bloquear scroll del body cuando está abierto
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  const slide = SLIDES[step]!;
  const Icon = slide.icon;
  const esUltimo = step === SLIDES.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex animate-fade-in flex-col items-center justify-center bg-background/95 p-6 backdrop-blur md:p-10">
      {/* Botón saltar arriba a la derecha */}
      <button
        onClick={cerrar}
        className="absolute right-4 top-4 rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label="Saltar onboarding"
      >
        <X className="h-5 w-5" />
      </button>

      <div className="w-full max-w-md space-y-6 text-center">
        {/* Ícono grande */}
        <div
          className={cn(
            'mx-auto grid h-24 w-24 place-items-center rounded-3xl bg-gradient-to-br text-white shadow-xl md:h-32 md:w-32',
            slide.iconBg,
          )}
        >
          <Icon className="h-12 w-12 md:h-16 md:w-16" strokeWidth={1.5} />
        </div>

        {/* Texto */}
        <div className="space-y-3">
          <h2 className="text-2xl font-bold leading-tight md:text-3xl">{slide.titulo}</h2>
          <p className="text-sm text-muted-foreground md:text-base">{slide.descripcion}</p>
        </div>

        {/* Bullets */}
        <ul className="space-y-2 text-left">
          {slide.bullets.map((b, i) => (
            <li key={i} className="flex items-start gap-3 text-sm">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span>{b}</span>
            </li>
          ))}
        </ul>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 pt-2">
          {SLIDES.map((_, i) => (
            <span
              key={i}
              className={cn(
                'h-1.5 rounded-full transition-all',
                i === step ? 'w-8 bg-primary' : 'w-1.5 bg-muted',
              )}
            />
          ))}
        </div>

        {/* CTA */}
        <div className="space-y-2 pt-2">
          <Button size="xl" className="w-full" onClick={siguiente}>
            {esUltimo ? 'Empezar' : 'Siguiente'}
            <ArrowRight className="h-4 w-4" />
          </Button>
          {!esUltimo && (
            <button
              onClick={cerrar}
              className="block w-full py-2 text-center text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              Saltar tour
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
