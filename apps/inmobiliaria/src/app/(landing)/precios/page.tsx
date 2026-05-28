import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Handshake,
  MessageCircle,
  Receipt,
  ShieldCheck,
  Sparkles,
  Wand2,
  Wrench,
} from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card, CardContent } from '@llave/ui/card';
import { TRAMOS_PLAN, TRAMOS_PLAN_CONSORCIOS } from '@/lib/plan';
import { CUPONES_VALIDOS } from '@/lib/cupones';
import { formatMonto } from '@/lib/format';

/**
 * Landing pública con pricing. Accesible sin auth.
 *
 * Quote de Juanpi al final del meeting:
 *   "Lo único que nos faltaría es actualizar de la web, porque ahora
 *    está lo de 10.000"
 *
 * Esta página reemplaza el placeholder de $10.000 con los tramos
 * actuales ($50k/$100k/$200k/$350k) + plan de consorcios + features
 * destacadas + convenios activos + CTA al login.
 */

export const metadata = {
  title: 'My Alquiler · Precios y planes',
  description:
    'La plataforma para inmobiliarias. Cobranzas con IA, ' +
    'contratos digitales, multi-sociedad, consorcios. Convenios con ' +
    'CUCICBA, CPI y Edifica.',
};

const FEATURES_DESTACADAS = [
  {
    icon: Receipt,
    titulo: 'Cobranzas con IA',
    detalle:
      'La lectura del comprobante se hace sola. Subís el resumen del banco y validamos en bloque.',
  },
  {
    icon: Handshake,
    titulo: 'Negociador IA al renovar',
    detalle:
      'Propone el aumento óptimo según el perfil del inquilino. Negocia turn-by-turn dentro de tu rango.',
  },
  {
    icon: BadgeCheck,
    titulo: 'Certificado del inquilino',
    detalle:
      'Reemplazo del garante: un PDF verificable con el historial al día. Único en el mercado.',
  },
  {
    icon: Wand2,
    titulo: 'Migración masiva',
    detalle:
      'Subís tu Excel/PDF y cargamos todos los contratos en bloque. Sin la fricción de migrar manual.',
  },
  {
    icon: Building2,
    titulo: 'Multi-sociedad + consorcios',
    detalle:
      'S.R.L. + S.A. + fideicomisos en una cuenta. Módulo aparte para administración de PH.',
  },
  {
    icon: MessageCircle,
    titulo: 'WhatsApp como canal',
    detalle:
      'Toda la comunicación va por WhatsApp. Mail bombardeado, WhatsApp lo ve al toque.',
  },
];

export default function PreciosPage() {
  const conveniosActivos = CUPONES_VALIDOS.filter(
    (c) => c.estado === 'ACTIVO' && c.convenio !== 'Lanzamiento My Alquiler' &&
      c.convenio !== 'Migración desde competencia',
  );

  return (
    <>
      {/* Topbar pública */}
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 md:px-6">
          <Link href="/precios" className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-[12px] font-bold text-primary-foreground">
              My
            </div>
            <div>
              <p className="text-sm font-semibold leading-tight">My Alquiler</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Software inmobiliario
              </p>
            </div>
          </Link>
          <div className="flex gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">Iniciar sesión</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/login">
                Probar gratis
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-12 md:px-6 md:py-16 lg:py-20">
        {/* Hero */}
        <section className="space-y-5 text-center">
          <Badge className="bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
            <Sparkles className="mr-1 h-3 w-3" />
            Beta abierta · primeras 50 inmos con −20% permanente
          </Badge>
          <h1 className="text-3xl font-bold tracking-tight md:text-5xl">
            La plataforma que tu inmobiliaria estaba esperando
          </h1>
          <p className="mx-auto max-w-2xl text-base text-muted-foreground md:text-lg">
            Cobranzas con IA, contratos digitales, renovaciones automáticas,
            multi-sociedad y consorcios. <strong className="text-foreground">
            Una sola plataforma</strong> para todo lo que hoy hacés con 4
            herramientas y planilla de Excel.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button asChild size="lg">
              <Link href="/login">
                Empezar gratis 14 días
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="#pricing">Ver precios</Link>
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Sin tarjeta · sin permanencia · migramos tu cartera de regalo
          </p>
        </section>

        {/* Features destacadas */}
        <section className="mt-20 space-y-8">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              Qué incluye
            </p>
            <h2 className="mt-1 text-2xl font-bold md:text-3xl">
              Todo lo que necesita una inmo profesional
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES_DESTACADAS.map((f) => {
              const Icon = f.icon;
              return (
                <Card key={f.titulo}>
                  <CardContent className="space-y-2 p-5">
                    <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <p className="font-semibold">{f.titulo}</p>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {f.detalle}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        {/* Pricing alquileres */}
        <section id="pricing" className="mt-20 space-y-8">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              Pricing transparente · sin sorpresas
            </p>
            <h2 className="mt-1 text-2xl font-bold md:text-3xl">
              Plan Alquileres
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Precio fijo mensual por tramo. Cuando crecés, pasamos automático
              al tramo siguiente.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {TRAMOS_PLAN.map((t, idx) => {
              const propsRef = t.hasta ?? 250;
              const costoPorProp = Math.round(t.precio / Math.max(propsRef, 1));
              const recomendado = idx === 1; // Growth
              return (
                <Card
                  key={t.key}
                  className={
                    recomendado
                      ? 'relative border-primary shadow-lg shadow-primary/10 ring-2 ring-primary/20'
                      : ''
                  }
                >
                  {recomendado && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-primary text-primary-foreground">
                        Más elegido
                      </Badge>
                    </div>
                  )}
                  <CardContent className="space-y-3 p-5">
                    <div>
                      <p className="text-sm font-semibold">{t.nombre}</p>
                      <p className="text-[11px] text-muted-foreground">{t.rango}</p>
                    </div>
                    <div>
                      <p className="text-3xl font-bold tabular-nums">
                        {formatMonto(t.precio)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        / mes
                      </p>
                    </div>
                    <p className="rounded-md bg-emerald-50 px-2 py-1 text-[11px] text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300">
                      ≈ {formatMonto(costoPorProp)} por propiedad
                    </p>
                    <ul role="list" className="space-y-1 text-[11px]">
                      <li className="flex items-start gap-1.5">
                        <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600" />
                        <span>{t.rango.toLowerCase()}</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600" />
                        <span>Cobranzas con IA + ARCA</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600" />
                        <span>Multi-sociedad incluida</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600" />
                        <span>Negociador IA en renovaciones</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600" />
                        <span>Soporte por WhatsApp</span>
                      </li>
                    </ul>
                    <Button
                      asChild
                      className={`w-full ${recomendado ? '' : 'variant-outline'}`}
                      variant={recomendado ? 'default' : 'outline'}
                    >
                      <Link href="/login">Empezar</Link>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="rounded-lg border bg-muted/30 p-4 text-center text-xs text-muted-foreground">
            ¿Pagás anual? <strong className="text-foreground">−20% adicional</strong>{' '}
            sobre cualquier tramo. ¿Sos matriculado de CUCICBA, CPI o Edifica?
            <strong className="text-foreground"> Sumá tu convenio</strong> y
            descontá +10% / +15% sobre el plan.
          </div>
        </section>

        {/* Pricing consorcios */}
        <section className="mt-16 space-y-8">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
              Otro vertical
            </p>
            <h2 className="mt-1 text-2xl font-bold md:text-3xl">Plan Consorcios</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Para administradores de propiedad horizontal. Se factura aparte
              del Plan Alquileres si operás los dos verticales.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {TRAMOS_PLAN_CONSORCIOS.map((t) => (
              <Card key={t.key}>
                <CardContent className="space-y-2 p-5">
                  <p className="text-sm font-semibold">
                    {t.nombre.replace('Consorcios · ', '')}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{t.rango}</p>
                  <p className="text-2xl font-bold tabular-nums">
                    {formatMonto(t.precio)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">/ mes</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="text-center text-xs text-muted-foreground">
            Hasta un 40% más barato que un Plan Alquileres equivalente —
            porque el ticket promedio de un consorcio es menor.
          </p>
        </section>

        {/* Convenios */}
        <section className="mt-20 space-y-6">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              Trabajamos con
            </p>
            <h2 className="mt-1 text-2xl font-bold md:text-3xl">
              Convenios con colegios y cámaras
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Si pertenecés a alguno, accedés con un descuento permanente.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {conveniosActivos.map((c) => (
              <Card key={c.codigo}>
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
                    {c.sigla?.slice(0, 4) ?? c.convenio.slice(0, 4)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-semibold">{c.convenio}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {c.cobertura}
                    </p>
                  </div>
                  <Badge variant="outline" className="shrink-0 text-[10px]">
                    {c.porcentaje}% off
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Diferenciadores */}
        <section className="mt-20 rounded-2xl border-2 border-violet-200 bg-gradient-to-br from-violet-50/60 to-primary/5 p-8 dark:border-violet-900/40 dark:from-violet-900/15 md:p-12">
          <div className="grid gap-6 md:grid-cols-2 md:items-center">
            <div className="space-y-4">
              <h2 className="text-2xl font-bold md:text-3xl">
                ¿Qué te llevás distinto?
              </h2>
              <ul role="list" className="space-y-3 text-sm">
                <li className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-violet-600" />
                  <span>
                    <strong>Certificado de inquilino verificable</strong> · el
                    inquilino al día se ahorra el garante en la próxima
                    mudanza. Único en el mercado.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <Wrench className="mt-0.5 h-5 w-5 shrink-0 text-violet-600" />
                  <span>
                    <strong>Red de profesionales con link mágico</strong> ·
                    plomero/electricista confirma visita por WhatsApp sin
                    pasar por login.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <CreditCard className="mt-0.5 h-5 w-5 shrink-0 text-violet-600" />
                  <span>
                    <strong>Cobranzas sin claves bancarias</strong> ·
                    validamos el resumen que vos subís. Más seguro que
                    conectar tu cuenta.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <ChevronRight className="mt-0.5 h-5 w-5 shrink-0 text-violet-600" />
                  <span>
                    <strong>Sin permanencia</strong> · si te vas, no te
                    cobramos cancelación. Apostamos a que te quedes por valor.
                  </span>
                </li>
              </ul>
            </div>
            <div className="rounded-lg bg-background p-6 shadow-lg">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                ¿Cómo arrancás?
              </p>
              <ol role="list" className="mt-3 space-y-2.5 text-sm">
                <li className="flex items-start gap-2">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                    1
                  </span>
                  <span>Te das de alta gratis · 14 días sin tarjeta</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                    2
                  </span>
                  <span>
                    Subís tu cartera con migración masiva · IA carga 200+
                    contratos en minutos
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                    3
                  </span>
                  <span>
                    Conectás ARCA + tu CBU · facturás automático el primer
                    mes
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                    4
                  </span>
                  <span>
                    Si te gusta, elegís plan. Si no, te llevás tu data y
                    cero cargo.
                  </span>
                </li>
              </ol>
              <Button asChild className="mt-4 w-full">
                <Link href="/login">
                  Probar gratis
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-20 border-t pt-8 text-center text-xs text-muted-foreground">
          <p>
            My Alquiler · myalquiler.com.ar · Hecho en Argentina para LATAM
          </p>
          <p className="mt-1">
            <Link href="/login" className="underline">
              Iniciar sesión
            </Link>
            {' · '}
            <a
              href="https://wa.me/?text=Hola%2C%20quiero%20saber%20m%C3%A1s%20de%20My%20Alquiler"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              Hablar por WhatsApp
            </a>
          </p>
        </footer>
      </main>
    </>
  );
}
