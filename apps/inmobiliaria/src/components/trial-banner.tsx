'use client';

import Link from 'next/link';
import { Gift, Rocket, ArrowRight } from 'lucide-react';
import { apiEnabled } from '@/lib/api/client';
import { useMe } from '@/lib/api/hooks';

/**
 * Barra superior full-width para cuentas piloto pre-lanzamiento.
 *
 * Fuente: /auth/me REAL vía useMe (esPiloto + trial { diasRestantes, vigente }
 * + perfilFiscalCompleto). Gateada a apiEnabled: en demo (GH Pages / dev sin
 * backend) NO se muestra — el trial demo vive como card en /configuracion
 * (TrialCardDemo, basada en trial-storage local).
 *
 * Estados:
 *  - Trial vigente   → "Cuenta pre-lanzamiento · Gratis · quedan N días" (violeta).
 *  - Perfil fiscal incompleto → suma CTA "Completá tu perfil fiscal" → /configuracion.
 *  - Trial vencido   → variante suave "Tu acceso pre-lanzamiento venció" (no bloquea).
 *
 * Se monta arriba de todo en el layout del panel: aparece en todas las pantallas.
 */
export function TrialBanner() {
  const { me } = useMe();

  // Solo en prod (API real) y solo para cuentas piloto.
  if (!apiEnabled) return null;
  if (!me?.esPiloto) return null;

  const trial = me.trial;
  const fiscalIncompleto = me.perfilFiscalCompleto === false;

  // Trial vencido: aviso suave, no bloqueante.
  if (!trial?.vigente) {
    return (
      <div className="flex w-full flex-wrap items-center justify-center gap-x-2 gap-y-1 border-b border-violet-200/70 bg-violet-50 px-4 py-2 text-center text-sm text-violet-900 dark:border-violet-900/40 dark:bg-violet-950/40 dark:text-violet-100">
        <Gift className="h-4 w-4 shrink-0 text-violet-500" aria-hidden />
        <span className="font-medium">Tu acceso pre-lanzamiento venció</span>
        <span className="text-violet-700/80 dark:text-violet-200/70">
          Seguís con acceso al panel — coordiná con el equipo para continuar.
        </span>
      </div>
    );
  }

  const dias = trial.diasRestantes;
  const diasTxt = `${dias} día${dias === 1 ? '' : 's'}`;

  return (
    <div className="flex w-full flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-violet-200/70 bg-gradient-to-r from-violet-50 to-violet-100/60 px-4 py-2 text-sm text-violet-900 dark:border-violet-900/40 dark:from-violet-950/50 dark:to-violet-900/30 dark:text-violet-100">
      <span className="flex items-center gap-2">
        <Rocket className="h-4 w-4 shrink-0 text-violet-500" aria-hidden />
        <span>
          <span className="font-semibold">Cuenta pre-lanzamiento</span>
          <span className="text-violet-400 dark:text-violet-500"> · </span>
          <span className="font-medium">Gratis</span>
          <span className="text-violet-400 dark:text-violet-500"> · </span>
          <span>quedan {diasTxt}</span>
        </span>
      </span>

      {fiscalIncompleto && (
        <Link
          href="/configuracion"
          className="inline-flex items-center gap-1 rounded-full border border-violet-300/70 bg-white/60 px-2.5 py-0.5 text-xs font-medium text-violet-700 transition-colors hover:bg-white dark:border-violet-700/60 dark:bg-violet-900/40 dark:text-violet-100 dark:hover:bg-violet-900/70"
        >
          Completá tu perfil fiscal
          <ArrowRight className="h-3 w-3" aria-hidden />
        </Link>
      )}
    </div>
  );
}
