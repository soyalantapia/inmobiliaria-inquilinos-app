'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, TrendingUp } from 'lucide-react';
import { Button } from '@llave/ui/button';
import { Card, CardContent } from '@llave/ui/card';
import { calcularResumenPlan, type ResumenPlan } from '@/lib/plan';
import { formatMonto } from '@/lib/format';

/**
 * Banner que aparece en home cuando la inmobiliaria está cerca del tope
 * del plan actual. Lo umbral por defecto: faltan 3 o menos propiedades
 * para llegar al tope, o ya pasó.
 *
 * Tiene CTA directo a /configuracion en el tab del plan.
 */
const UMBRAL_AVISO = 3;

export function AlertaPlan() {
  const [plan, setPlan] = useState<ResumenPlan | null>(null);

  useEffect(() => {
    setPlan(calcularResumenPlan());
  }, []);

  if (!plan) return null;
  // Enterprise no tiene tope, no aplica.
  if (plan.topePlan === null || !plan.proximoTramo) return null;

  const restantes = plan.topePlan - plan.propiedadesActivas;
  // Solo mostrar el banner si faltan POCAS propiedades para el tope
  // (3 o menos), o si ya excedió.
  if (restantes > UMBRAL_AVISO) return null;

  const yaPaso = restantes < 0;
  const igualAlTope = restantes === 0;
  const siguiente = plan.proximoTramo;
  const diferencia = siguiente.precio - plan.costoMensualTotal;

  return (
    <Card
      className={
        yaPaso
          ? 'border-red-200 bg-red-50/60 dark:border-red-900/40 dark:bg-red-900/10'
          : 'border-amber-200 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-900/10'
      }
    >
      <CardContent className="flex flex-wrap items-start gap-4 p-5 md:flex-nowrap">
        <div
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg shadow-lg ${
            yaPaso
              ? 'bg-red-500 text-white shadow-red-500/20'
              : 'bg-amber-500 text-white shadow-amber-500/20'
          }`}
        >
          <TrendingUp className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <p className="font-semibold">
            {yaPaso
              ? `Pasaste el tope de tu plan ${plan.plan}`
              : igualAlTope
                ? `Llegaste al tope del plan ${plan.plan}`
                : `Te quedan ${restantes} propiedad${restantes === 1 ? '' : 'es'} en tu plan ${plan.plan}`}
          </p>
          <p className="text-sm text-muted-foreground">
            Tenés <strong className="text-foreground">{plan.propiedadesActivas}</strong>{' '}
            de <strong className="text-foreground">{plan.topePlan}</strong> propiedades
            activas. Si sumás otra, pasás automáticamente a{' '}
            <strong className="text-foreground">{siguiente.nombre}</strong>:{' '}
            <strong className="tabular-nums text-foreground">
              {formatMonto(siguiente.precio)}
            </strong>{' '}
            / mes (+{formatMonto(diferencia)} vs hoy).
          </p>
        </div>
        <Button asChild className="shrink-0">
          <Link href="/configuracion#plan">
            Ver planes
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
