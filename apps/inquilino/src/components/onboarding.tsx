'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  FileText,
  Receipt,
  Sparkles,
  Users,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@llave/ui/button';
import { cn } from '@llave/ui/cn';

// Tutorial guiado paso a paso. NO se auto-abre como un muro: se ofrece de
// forma discreta y opt-in con <OnboardingInvite /> en el home (J3, walkthrough
// Jorge), y se puede relanzar desde /cuenta con "Ver tutorial". El flag de
// "ya visto/descartado" se guarda en localStorage.

const STORAGE_KEY = 'llave:onboarding-completed:v1';

// Evento personalizado para que /cuenta pueda relanzar el tour sin
// montar dos copias del componente.
const RELAUNCH_EVENT = 'llave:onboarding-relaunch';

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
    descripcion: 'Tu alquiler en un solo lugar. Te muestro las cosas importantes en 1 minuto.',
    bullets: [
      'Sin papeles ni llamadas innecesarias',
      'Todo lo que necesitás está a un toque',
      'Podés saltar este tour cuando quieras',
    ],
  },
  {
    icon: CreditCard,
    iconBg: 'from-primary to-primary/70',
    titulo: 'Pagás tu alquiler en un toque',
    descripcion: 'En la pantalla principal ves el monto exacto del mes y si está al día.',
    bullets: [
      'Te mostramos vencimiento, monto y punitorios si los hay',
      'Pagás con transferencia, MP o QR',
      'Subís el comprobante y queda registrado',
    ],
    cta: { label: 'Ver mis pagos', href: '/' },
  },
  {
    icon: FileText,
    iconBg: 'from-blue-500 to-indigo-600',
    titulo: 'Conocé tu contrato',
    descripcion: 'Datos clave, próximos ajustes, evolución del alquiler y estado del depósito.',
    bullets: [
      'Línea de tiempo del contrato',
      'Cuánto vas a recuperar del depósito',
      'Compartilo con tu garante con un link',
    ],
    cta: { label: 'Abrir mi contrato', href: '/contrato' },
  },
  {
    icon: Sparkles,
    iconBg: 'from-fuchsia-500 to-purple-600',
    titulo: 'Chateá con el Asistente',
    descripcion: 'Una IA que leyó tus cláusulas y te responde al instante.',
    bullets: [
      'Aumentos, depósito, mascotas, vencimiento',
      'Te cita la cláusula exacta del contrato',
      'Te deriva a la inmobiliaria si hace falta',
    ],
    cta: { label: 'Probar el Asistente', href: '/broker' },
  },
  {
    icon: Wrench,
    iconBg: 'from-amber-500 to-orange-600',
    titulo: 'Reportá problemas',
    descripcion: 'Plomería, electricidad, cerraduras — todo desde la app.',
    bullets: [
      'Sumás foto y descripción rápida',
      'Seguís el estado en tiempo real',
      'Calificás al final y te ahorra futuras visitas',
    ],
    cta: { label: 'Ver reclamos', href: '/reclamos' },
  },
  {
    icon: Receipt,
    iconBg: 'from-emerald-500 to-teal-600',
    titulo: 'Comprobantes a mano',
    descripcion: 'Todos tus pagos descargables en PDF, año por año.',
    bullets: [
      'Histórico mensual completo',
      'Útil para deducir si trabajás en relación de dependencia',
      'Lo compartís con tu contador en un clic',
    ],
    cta: { label: 'Ver comprobantes', href: '/comprobantes' },
  },
  {
    icon: CalendarDays,
    iconBg: 'from-cyan-500 to-blue-600',
    titulo: 'Mi calendario',
    descripcion: 'Todo lo que va a pasar con tu alquiler: pagos, ajustes, vencimientos.',
    bullets: [
      'Vista unificada de eventos',
      'No te olvides de nada importante',
      'Te avisamos por WhatsApp antes',
    ],
    cta: { label: 'Ver mi calendario', href: '/calendario' },
  },
  {
    icon: Users,
    iconBg: 'from-rose-500 to-pink-600',
    titulo: 'Y mucho más',
    descripcion: 'Profesionales, co-inquilinos, documentos, renovación — todo desde Mi Cuenta.',
    bullets: [
      'Plomero, electricista y técnicos recomendados',
      'Compartí el contrato con tu pareja o familia',
      'DNI y recibos guardados para renovar fácil',
    ],
    cta: { label: 'Explorar Mi Cuenta', href: '/cuenta' },
  },
  {
    icon: CheckCircle2,
    iconBg: 'from-emerald-500 to-green-600',
    titulo: '¡Listo!',
    descripcion: 'Ya conocés My Alquiler. Cualquier duda, el Asistente o la inmobiliaria están a un toque.',
    bullets: [
      'Podés volver a ver este tour desde Mi Cuenta',
      'WhatsApp directo con tu inmobiliaria',
      'Que tengas una buena estadía 💜',
    ],
  },
];

export function Onboarding() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // J3 (walkthrough Jorge): el tour YA NO se auto-abre. A un inquilino
    // apurado por pagar, taparle el home con un modal "PASO 1 DE 9" lo frena
    // y lo cierra con bronca. Ahora la primera vez se ofrece de forma discreta
    // y opt-in vía <OnboardingInvite /> (en el home), y desde /cuenta. Este
    // componente sólo muestra el modal cuando se dispara explícitamente.
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

  // Bloquear scroll del body cuando está abierto
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
      {/* Saltar */}
      <button
        type="button"
        onClick={cerrar}
        className="absolute right-4 top-4 rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label="Saltar tour"
      >
        <X className="h-5 w-5" />
      </button>

      <div className="w-full max-w-md space-y-6 text-center">
        {/* Ícono */}
        <div
          className={cn(
            'mx-auto grid h-24 w-24 place-items-center rounded-3xl bg-gradient-to-br text-white shadow-xl md:h-28 md:w-28',
            slide.iconBg,
          )}
        >
          <Icon className="h-12 w-12 md:h-14 md:w-14" strokeWidth={1.5} />
        </div>

        {/* Texto */}
        <div className="space-y-2">
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Paso {step + 1} de {STEPS.length}
          </p>
          <h2 className="text-2xl font-bold leading-tight md:text-3xl">{slide.titulo}</h2>
          <p className="text-sm text-muted-foreground md:text-base">{slide.descripcion}</p>
        </div>

        {/* Bullets */}
        <ul role="list" className="space-y-2 text-left">
          {slide.bullets.map((b, i) => (
            <li key={i} className="flex items-start gap-3 text-sm">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>{b}</span>
            </li>
          ))}
        </ul>

        {/* Progress dots */}
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

        {/* CTAs */}
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
              {/* En el último paso usamos un copy más corto — "¡Empezar a
                  usar My Alquiler!" (28 chars) se truncaba como
                  "¡Empezar a usar My Alqui..." en 375px porque comparte
                  fila con el botón Anterior. */}
              {esUltimo ? '¡Empezar!' : 'Siguiente'}
              {!esUltimo && <ArrowRight className="h-4 w-4" />}
            </Button>
          </div>
          {!esUltimo && esPrimero && (
            <button
              type="button"
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

// Helper que /cuenta usa para relanzar el tour.
export function relanzarOnboarding(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(RELAUNCH_EVENT));
}

// ¿El inquilino todavía no vio ni descartó el tour? (client-only)
export function onboardingPendiente(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return !window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return false;
  }
}

// Marca el tour como visto/descartado para que la invitación no vuelva a salir.
export function marcarOnboardingVisto(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, new Date().toISOString());
  } catch {
    // ignore
  }
}

// J3 (walkthrough Jorge): invitación discreta y opt-in al tour, dentro del
// flujo del home — NO un muro full-screen. Sólo aparece si el inquilino nunca
// vio ni descartó el tour. Sigue el patrón "smart nudge" de la card del Broker:
// estado inicial oculto + effect client-only que lo prende, para no romper la
// hidratación SSR.
export function OnboardingInvite() {
  const [mostrar, setMostrar] = useState(false);

  useEffect(() => {
    setMostrar(onboardingPendiente());
  }, []);

  if (!mostrar) return null;

  return (
    <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 animate-fade-in">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-fuchsia-500 to-purple-600 text-white">
        <Sparkles className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-tight">¿Primera vez por acá?</p>
        <p className="truncate text-xs text-muted-foreground">
          Te muestro cómo funciona en 1 minuto
        </p>
      </div>
      <button
        type="button"
        onClick={() => {
          setMostrar(false);
          relanzarOnboarding();
        }}
        className="shrink-0 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Ver cómo
      </button>
      <button
        type="button"
        onClick={() => {
          marcarOnboardingVisto();
          setMostrar(false);
        }}
        aria-label="Ahora no, gracias"
        className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
