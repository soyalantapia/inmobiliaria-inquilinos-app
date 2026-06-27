import Link from 'next/link';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  FileText,
  Rocket,
  ScrollText,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Wallet,
  Wrench,
} from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card, CardContent } from '@llave/ui/card';

/**
 * Pantalla de inicio pública de My Alquiler. Es la puerta de entrada para una
 * inmobiliaria nueva: presenta el producto y la invita a crear su cuenta.
 *
 * Accesible sin auth (grupo (landing)). El visitante sin sesión que entra a `/`
 * aterriza acá (ver AuthGuard) y de acá va al alta real en `/registro`.
 * El alta ya existe y funciona: crea la inmobiliaria (tenant) + el admin + el
 * trial en el backend y deja al admin logueado.
 */

export const metadata = {
  title: 'My Alquiler · Cobrá tus alquileres sin perseguir a nadie',
  description:
    'La plataforma para inmobiliarias: el panel que ordena tu cartera + la ' +
    'app donde tus inquilinos pagan, reclaman y ven su contrato. Creá tu ' +
    'inmobiliaria gratis hasta el lanzamiento, sin tarjeta.',
  openGraph: {
    title: 'My Alquiler · Software para inmobiliarias',
    description:
      'Cobranzas y mora en tiempo real, app para el inquilino, rendición a ' +
      'propietarios sin Excel. Creá tu inmobiliaria gratis.',
    type: 'website',
  },
};

const BENEFICIOS = [
  {
    icon: Wallet,
    titulo: 'Cobranzas y mora en tiempo real',
    detalle:
      'Ves quién pagó, quién debe y cuánto, al instante. Se terminó la planilla de cobranzas.',
  },
  {
    icon: Smartphone,
    titulo: 'Tus inquilinos pagan desde su app',
    detalle:
      'Cada inquilino tiene su app: informa el pago, sube el comprobante y reclama. Vos validás en un toque.',
  },
  {
    icon: FileText,
    titulo: 'Rendí a propietarios sin Excel',
    detalle:
      'La rendición del mes sale calculada: alquiler, comisión y gastos. Lista para enviar.',
  },
  {
    icon: Building2,
    titulo: 'Multi-sociedad y consorcios',
    detalle:
      'S.R.L., S.A. y fideicomisos en una sola cuenta. Módulo aparte para administración de PH.',
  },
  {
    icon: Wrench,
    titulo: 'Reclamos con red de profesionales',
    detalle:
      'El inquilino reclama, asignás al plomero o electricista y se confirma por WhatsApp.',
  },
  {
    icon: ScrollText,
    titulo: 'Caja y auditoría al día',
    detalle:
      'Cada peso y cada acción sensible quedan registrados. Cierre de caja sin sorpresas.',
  },
];

const PASOS = [
  'Creás tu inmobiliaria en 1 minuto · sin tarjeta',
  'Cargás tus propiedades, contratos y propietarios',
  'Invitás a tus inquilinos: pagan y reclaman desde su app',
  'Cobrás, rendís y tenés todo el mes ordenado',
];

export default function InicioPage() {
  return (
    <>
      {/* Topbar pública */}
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 md:px-6">
          <Link href="/inicio" className="flex items-center gap-2">
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
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link href="/login">Iniciar sesión</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/registro">
                Crear mi inmobiliaria
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
            Hecho por inmobiliarias, para inmobiliarias
          </Badge>
          <h1 className="mx-auto max-w-3xl text-3xl font-bold tracking-tight md:text-5xl">
            Cobrá tus alquileres sin perseguir a nadie
          </h1>
          <p className="mx-auto max-w-2xl text-base text-muted-foreground md:text-lg">
            El panel que ordena tu cartera{' '}
            <strong className="text-foreground">+ la app</strong> donde tus
            inquilinos pagan, reclaman y ven su contrato. Todo en un solo lugar,
            sin Excel.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button asChild size="xl">
              <Link href="/registro">
                Crear mi inmobiliaria
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/precios">Ver precios</Link>
            </Button>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 font-medium text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300">
              <Rocket className="h-3 w-3" />
              Gratis hasta el lanzamiento
            </span>
            <span>· sin tarjeta · sin permanencia</span>
          </div>
        </section>

        {/* Beneficios */}
        <section className="mt-20 space-y-8">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              Qué resolvés con My Alquiler
            </p>
            <h2 className="mt-1 text-2xl font-bold md:text-3xl">
              Todo lo que hoy hacés con 4 herramientas, en uno
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {BENEFICIOS.map((b) => {
              const Icon = b.icon;
              return (
                <Card key={b.titulo}>
                  <CardContent className="space-y-2 p-5">
                    <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <p className="font-semibold">{b.titulo}</p>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {b.detalle}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        {/* Cómo arrancás + CTA */}
        <section className="mt-20 rounded-2xl border-2 border-violet-200 bg-gradient-to-br from-violet-50/60 to-primary/5 p-8 dark:border-violet-900/40 dark:from-violet-900/15 md:p-12">
          <div className="grid gap-6 md:grid-cols-2 md:items-center">
            <div className="space-y-4">
              <h2 className="text-2xl font-bold md:text-3xl">
                Estás operando hoy mismo
              </h2>
              <p className="text-sm text-muted-foreground">
                Te das de alta vos, sin esperar a nadie. La cuenta queda lista al
                instante y entrás directo al panel.
              </p>
              <ul role="list" className="space-y-3 text-sm">
                <li className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-violet-600" />
                  <span>
                    <strong>Tus datos, tuyos</strong> · si te vas, te llevás tu
                    cartera. Sin permanencia ni cargos de cancelación.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <Wallet className="mt-0.5 h-5 w-5 shrink-0 text-violet-600" />
                  <span>
                    <strong>Gratis hasta el lanzamiento</strong> · empezás sin
                    tarjeta y sin compromiso.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-violet-600" />
                  <span>
                    <strong>La app del inquilino incluida</strong> · cada
                    inquilino paga y reclama desde su celular.
                  </span>
                </li>
              </ul>
            </div>
            <div className="rounded-lg bg-background p-6 shadow-lg">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                ¿Cómo arrancás?
              </p>
              <ol role="list" className="mt-3 space-y-2.5 text-sm">
                {PASOS.map((paso, idx) => (
                  <li key={paso} className="flex items-start gap-2">
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                      {idx + 1}
                    </span>
                    <span>{paso}</span>
                  </li>
                ))}
              </ol>
              <Button asChild size="lg" className="mt-5 w-full">
                <Link href="/registro">
                  Crear mi inmobiliaria
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <p className="mt-3 flex flex-wrap items-center justify-center gap-1 text-[11px] text-muted-foreground">
                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                Sin tarjeta · queda lista al instante
              </p>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-20 border-t pt-8 text-center text-xs text-muted-foreground">
          <p>My Alquiler · myalquiler.com · Hecho en Argentina para LATAM</p>
          <p className="mt-1">
            ¿Ya tenés cuenta?{' '}
            <Link href="/login" className="underline">
              Iniciar sesión
            </Link>
            {' · '}
            <Link href="/precios" className="underline">
              Ver precios
            </Link>
            {' · '}
            <a
              href="https://wa.me/5491154596266?text=Hola%2C%20quiero%20saber%20m%C3%A1s%20de%20My%20Alquiler"
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
