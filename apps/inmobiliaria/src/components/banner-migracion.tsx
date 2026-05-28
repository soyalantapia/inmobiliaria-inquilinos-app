'use client';

import { useEffect, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Gift,
  Lightbulb,
  Sparkles,
  X,
} from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card, CardContent } from '@llave/ui/card';
import { toast } from '@llave/ui/use-toast';
import {
  aplicarCupon,
  buscarCupon,
  leerCuponActivo,
} from '@/lib/cupones';

const DISMISS_KEY = 'llave-inmo:migracion-banner-dismiss:v1';
const CUPON_MIGRACION = 'MIGRACION25';

const COMPETIDORES = [
  { id: 'TOCO', label: 'Toco', emoji: '🟦' },
  { id: 'CONSORCIO_ABIERTO', label: 'Consorcio Abierto', emoji: '🏢' },
  { id: 'ADMINPRO', label: 'AdminPro', emoji: '📋' },
  { id: 'OTRA', label: 'Otra plataforma', emoji: '🛠' },
];

/**
 * Banner pro-activo: la primera vez que una inmo entra a /configuracion
 * → Plan y facturas, le preguntamos si venía de otra plataforma. Si
 * confirma, aplicamos el cupón MIGRACION25 automáticamente (25% off
 * durante 12 meses).
 *
 * Idea de Ramiro: "para sacarte de la otra aplicación y meterte dentro
 * de la nuestra".
 *
 * El banner se dismissa permanentemente con el botón X o al elegir
 * "Ya estoy en My Alquiler". El cupón aplicado anula el banner para
 * siempre.
 */
export function BannerMigracion() {
  const [hidratado, setHidratado] = useState(false);
  const [visible, setVisible] = useState(false);
  const [paso, setPaso] = useState<'intro' | 'eligiendo' | 'aplicado'>('intro');
  const [competidorElegido, setCompetidorElegido] = useState<string | null>(null);

  useEffect(() => {
    setHidratado(true);
    // No mostrar si ya está aplicado el cupón MIGRACION25 o si se
    // dismisseó antes.
    const activo = leerCuponActivo();
    if (activo?.cupon.codigo === CUPON_MIGRACION) {
      setVisible(false);
      return;
    }
    if (typeof window !== 'undefined') {
      const dismissed = window.localStorage.getItem(DISMISS_KEY);
      if (dismissed === '1') {
        setVisible(false);
        return;
      }
    }
    setVisible(true);
  }, []);

  if (!hidratado || !visible) return null;

  const dismiss = (permanente: boolean) => {
    if (permanente && typeof window !== 'undefined') {
      window.localStorage.setItem(DISMISS_KEY, '1');
    }
    setVisible(false);
  };

  const elegir = (competidor: (typeof COMPETIDORES)[number]) => {
    setCompetidorElegido(competidor.label);
    const cupon = buscarCupon(CUPON_MIGRACION);
    if (!cupon) return;
    const res = aplicarCupon(CUPON_MIGRACION);
    if (res.ok) {
      setPaso('aplicado');
      toast({
        variant: 'success',
        title: `¡Bienvenida desde ${competidor.label}!`,
        description: `Aplicamos ${cupon.porcentaje}% off durante 12 meses. Se refleja en tu próxima factura.`,
      });
    }
  };

  /* ============================================================
   * Step 1: intro
   * ============================================================ */
  if (paso === 'intro') {
    return (
      <Card className="relative overflow-hidden border-violet-300 bg-gradient-to-br from-violet-50 via-violet-50/40 to-amber-50/40 dark:border-violet-900/40 dark:from-violet-900/15 dark:via-violet-900/5 dark:to-amber-900/5">
        <button
          type="button"
          onClick={() => dismiss(true)}
          aria-label="Cerrar"
          className="absolute right-2 top-2 rounded-full p-1.5 text-muted-foreground hover:bg-background/60"
        >
          <X className="h-3.5 w-3.5" />
        </button>
        <CardContent className="space-y-4 p-5">
          <div className="flex items-start gap-3">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-violet-600 text-white shadow-lg shadow-violet-600/20">
              <Gift className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <Badge className="bg-amber-500 text-[10px] text-white">
                <Sparkles className="mr-1 h-2.5 w-2.5" />
                Solo para los que migran
              </Badge>
              <p className="mt-1.5 text-base font-semibold leading-tight">
                ¿Venís de otra plataforma?
              </p>
              <p className="text-xs text-muted-foreground">
                Te bonificamos un <strong className="text-foreground">25% durante 12
                meses</strong> + onboarding completo sin cargo. Sumalo a tu
                convenio de colegio si tenés uno.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => setPaso('eligiendo')}
              className="bg-violet-600 text-white hover:bg-violet-700"
            >
              Sí, vengo de otra
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button variant="ghost" onClick={() => dismiss(true)}>
              No, ya soy de acá
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  /* ============================================================
   * Step 2: eligiendo competidor
   * ============================================================ */
  if (paso === 'eligiendo') {
    return (
      <Card className="border-violet-300 bg-violet-50/40 dark:border-violet-900/40 dark:bg-violet-900/10">
        <CardContent className="space-y-4 p-5">
          <div className="flex items-start gap-3">
            <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-violet-600" />
            <div>
              <p className="text-base font-semibold">¿De cuál venís?</p>
              <p className="text-xs text-muted-foreground">
                Lo usamos para entender el mercado. Tus datos siguen privados.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {COMPETIDORES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => elegir(c)}
                className="flex items-center gap-2 rounded-md border bg-background p-3 text-left text-sm transition-colors hover:border-violet-400 hover:bg-violet-50/40"
              >
                <span className="text-base">{c.emoji}</span>
                <span className="font-medium">{c.label}</span>
              </button>
            ))}
          </div>
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={() => setPaso('intro')}>
              Volver
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  /* ============================================================
   * Step 3: aplicado
   * ============================================================ */
  return (
    <Card className="border-emerald-300 bg-gradient-to-br from-emerald-50 to-emerald-50/30 dark:border-emerald-900/40 dark:from-emerald-900/20 dark:to-emerald-900/5">
      <CardContent className="space-y-3 p-5">
        <div className="flex items-start gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/20">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <p className="text-base font-semibold">
              ¡Cupón aplicado! Tenés 25% off por 12 meses
            </p>
            <p className="text-xs text-muted-foreground">
              Bienvenida desde {competidorElegido}. Lo ves reflejado en tu
              próxima factura. Si querés, ya podés{' '}
              <strong className="text-foreground">migrar tu cartera</strong>{' '}
              desde el botón violet en{' '}
              <strong className="text-foreground">Propiedades</strong>.
            </p>
          </div>
        </div>
        <div className="rounded-md border border-emerald-200 bg-background/60 p-3 text-[11px] dark:border-emerald-900/40">
          <p className="font-semibold">Próximos pasos sugeridos:</p>
          <ol role="list" className="mt-1 space-y-0.5 text-muted-foreground">
            <li>1. Migrá tu cartera desde Propiedades · botón &ldquo;Migrar mi cartera&rdquo;</li>
            <li>2. Configurá la sociedad emisora en Configuración → Sociedades</li>
            <li>3. Conectá ARCA para que las facturas salgan automáticas</li>
          </ol>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => dismiss(true)}
        >
          Entendido, seguir
        </Button>
      </CardContent>
    </Card>
  );
}
