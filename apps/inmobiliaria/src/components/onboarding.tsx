'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarHeart,
  CheckCircle2,
  CreditCard,
  FileText,
  HardHat,
  LayoutDashboard,
  Settings,
  Sparkles,
  Users,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@llave/ui/button';
import { cn } from '@llave/ui/cn';

// Tutorial guiado paso a paso del panel inmobiliaria. Misma mecánica que en
// el inquilino: se muestra la primera vez, se persiste en localStorage,
// /configuracion lo puede relanzar.

const STORAGE_KEY = 'llave-inmo:onboarding-completed:v1';
const RELAUNCH_EVENT = 'llave-inmo:onboarding-relaunch';

interface Step {
  icon: LucideIcon;
  iconBg: string;
  titulo: string;
  descripcion: string;
  bullets: string[];
  cta?: { label: string; href: string };
}

const STEPS: Step[] = [
  {
    icon: Sparkles,
    iconBg: 'from-fuchsia-500 to-purple-600',
    titulo: '¡Bienvenido a My Alquiler!',
    descripcion: 'Te muestro las funciones principales del panel en 1 minuto.',
    bullets: [
      'Pensado para inmobiliarias que gestionan alquileres',
      'Tus inquilinos pagan y reclaman desde su app',
      'Podés saltar este tour cuando quieras',
    ],
  },
  {
    icon: LayoutDashboard,
    iconBg: 'from-primary to-primary/70',
    titulo: 'Inicio: foto del negocio',
    descripcion: 'Métricas, alertas y agenda de los próximos 14 días.',
    bullets: [
      'Cobrado del mes y mora actual',
      'Próximos vencimientos y ajustes',
      'Qué necesita tu atención hoy',
    ],
    cta: { label: 'Ver inicio', href: '/' },
  },
  {
    icon: Building2,
    iconBg: 'from-blue-500 to-indigo-600',
    titulo: 'Propiedades como entidad central',
    descripcion: 'Todo gira alrededor de la propiedad: contrato, inquilino, propietario, reclamos.',
    bullets: [
      'Filtrá por Alquiladas / Disponibles / Problemas',
      'Cargá nuevas propiedades (te avisamos del costo extra)',
      'Cada propiedad tiene resumen, inquilino y propietarios',
    ],
    cta: { label: 'Ver propiedades', href: '/propiedades' },
  },
  {
    icon: FileText,
    iconBg: 'from-cyan-500 to-blue-600',
    titulo: 'Contratos con todo el detalle',
    descripcion: 'Pagos, historial cronológico, comunicaciones con el inquilino.',
    bullets: [
      'Histórico de liquidaciones con estado',
      'Timeline de eventos del contrato',
      'Plantillas de WhatsApp/Email para gestión',
    ],
    cta: { label: 'Ver contratos', href: '/contratos' },
  },
  {
    icon: CreditCard,
    iconBg: 'from-emerald-500 to-teal-600',
    titulo: 'Pagos y conciliación',
    descripcion: 'Pendientes, vencidos y pagados. Conciliá con un click cuando subas un comprobante.',
    bullets: [
      'Filtros rápidos por estado',
      'Total cobrado y en mora en grande',
      'El inquilino sube el comprobante, vos validás',
    ],
    cta: { label: 'Ver pagos', href: '/pagos' },
  },
  {
    icon: CalendarHeart,
    iconBg: 'from-rose-500 to-pink-600',
    titulo: 'Renovaciones cerca del fin',
    descripcion: 'Mirá qué inquilinos están por vencer y qué decidió cada uno.',
    bullets: [
      'Quién quiere renovar y quién no',
      'Falta avisar: los urgentes en rojo',
      'Mensaje WhatsApp con plantilla en un click',
    ],
    cta: { label: 'Ver renovaciones', href: '/renovaciones' },
  },
  {
    icon: Wrench,
    iconBg: 'from-amber-500 to-orange-600',
    titulo: 'Reclamos en tiempo real',
    descripcion: 'Cuando un inquilino reporta algo, lo recibís acá y asignás operador.',
    bullets: [
      'Timeline con mensajes del inquilino',
      'Asignás, cambiás estado, resolvés',
      'El inquilino te califica cuando cierra',
    ],
    cta: { label: 'Ver reclamos', href: '/reclamos' },
  },
  {
    icon: HardHat,
    iconBg: 'from-yellow-500 to-amber-600',
    titulo: 'Tu red de profesionales',
    descripcion: 'Plomero, electricista, gasista — los recomendás y tus inquilinos los contactan.',
    bullets: [
      'Cargás los que conocés y trabajaron bien',
      'Los marcás como verificados',
      'Aparecen en la app del inquilino con un toque',
    ],
    cta: { label: 'Ver profesionales', href: '/profesionales' },
  },
  {
    icon: Users,
    iconBg: 'from-violet-500 to-purple-600',
    titulo: 'Propietarios y rendiciones',
    descripcion: 'Acá ves lo que le debés rendir a cada dueño, con CBU y comisión.',
    bullets: [
      'Histórico de rendiciones mes a mes',
      'Te avisa cuando un dueño no tiene CBU',
      'Detalle con propiedades, contratos y comisión',
    ],
    cta: { label: 'Ver propietarios', href: '/propietarios' },
  },
  {
    icon: Settings,
    iconBg: 'from-slate-500 to-slate-700',
    titulo: 'Configuración del negocio',
    descripcion: 'Datos de tu inmobiliaria, equipo, permisos y plan.',
    bullets: [
      'Editás nombre, dirección y datos fiscales',
      'Sumás operadores con sus permisos',
      'Plan según cantidad de propiedades + facturas',
    ],
    cta: { label: 'Ir a configuración', href: '/configuracion' },
  },
  {
    icon: CheckCircle2,
    iconBg: 'from-emerald-500 to-green-600',
    titulo: '¡A trabajar!',
    descripcion: 'Ya conocés todo. Podés relanzar este tour desde Configuración cuando quieras.',
    bullets: [
      'Soporte por WhatsApp si te trabás',
      'Las novedades aparecen en el inicio',
      'Disfrutá menos tareas administrativas 🎯',
    ],
  },
];

export function OnboardingInmo() {
  const router = useRouter();
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

    const onRelaunch = () => {
      setStep(0);
      setOpen(true);
    };
    window.addEventListener(RELAUNCH_EVENT, onRelaunch);
    return () => window.removeEventListener(RELAUNCH_EVENT, onRelaunch);
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
    if (step < STEPS.length - 1) setStep(step + 1);
    else cerrar();
  };

  const anterior = () => {
    if (step > 0) setStep(step - 1);
  };

  const irACTA = () => {
    const slide = STEPS[step];
    if (!slide?.cta) return;
    cerrar();
    router.push(slide.cta.href);
  };

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  const slide = STEPS[step]!;
  const Icon = slide.icon;
  const esUltimo = step === STEPS.length - 1;
  const esPrimero = step === 0;

  return (
    <div className="fixed inset-0 z-50 flex animate-fade-in flex-col items-center justify-center bg-background/95 p-6 backdrop-blur md:p-10">
      <button
        onClick={cerrar}
        className="absolute right-4 top-4 rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label="Saltar tour"
      >
        <X className="h-5 w-5" />
      </button>

      <div className="w-full max-w-md space-y-6 text-center">
        <div
          className={cn(
            'mx-auto grid h-24 w-24 place-items-center rounded-3xl bg-gradient-to-br text-white shadow-xl md:h-28 md:w-28',
            slide.iconBg,
          )}
        >
          <Icon className="h-12 w-12 md:h-14 md:w-14" strokeWidth={1.5} />
        </div>

        <div className="space-y-2">
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Paso {step + 1} de {STEPS.length}
          </p>
          <h2 className="text-2xl font-bold leading-tight md:text-3xl">{slide.titulo}</h2>
          <p className="text-sm text-muted-foreground md:text-base">{slide.descripcion}</p>
        </div>

        <ul className="space-y-2 text-left">
          {slide.bullets.map((b, i) => (
            <li key={i} className="flex items-start gap-3 text-sm">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>{b}</span>
            </li>
          ))}
        </ul>

        <div className="flex items-center justify-center gap-1.5 pt-2">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={cn(
                'h-1.5 rounded-full transition-all',
                i === step ? 'w-6 bg-primary' : 'w-1.5 bg-muted',
              )}
            />
          ))}
        </div>

        <div className="space-y-2 pt-2">
          {slide.cta && !esUltimo && (
            <Button variant="outline" size="lg" className="w-full" onClick={irACTA}>
              {slide.cta.label}
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
          <div className="flex gap-2">
            {!esPrimero && (
              <Button variant="ghost" size="lg" className="flex-1" onClick={anterior}>
                <ArrowLeft className="h-4 w-4" />
                Anterior
              </Button>
            )}
            <Button size="lg" className="flex-1" onClick={siguiente}>
              {esUltimo ? '¡Listo!' : 'Siguiente'}
              {!esUltimo && <ArrowRight className="h-4 w-4" />}
            </Button>
          </div>
          {!esUltimo && esPrimero && (
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

// Helper para que /configuracion u otra pantalla pueda relanzar el tour.
export function relanzarOnboardingInmo(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(RELAUNCH_EVENT));
}
