import Link from 'next/link';
import { Plus_Jakarta_Sans, Fraunces } from 'next/font/google';
import {
  ArrowRight,
  ArrowUpRight,
  Wallet,
  Smartphone,
  FileText,
  Wrench,
  Building2,
  ScrollText,
  Calculator,
  CheckCircle2,
  Check,
  X,
  Plus,
  MessageCircle,
  ShieldCheck,
} from 'lucide-react';
import { HeroSignup } from './_landing/hero-signup';
import { LivePanel } from './_landing/live-panel';
import { Reveal } from './_landing/reveal';
import { Isotipo } from '@/components/isotipo';
import { AnalyticsProvider } from './_landing/analytics';
import { HeroHeadline } from './_landing/hero-headline';
import { TrustLogos } from './_landing/trust-logos';
import { Calculadora } from './_landing/calculadora';
import { Testimonios } from './_landing/testimonios';
import { WhatsappFab } from './_landing/whatsapp-fab';
import { Header } from './_landing/header';
import { SITE_URL, SITE_NAME } from '@/lib/site';

/**
 * Pantalla de inicio de My Alquiler — landing de alta conversión.
 *
 * Construida con el método landing-builder (research → copy → diseño). Ángulo
 * de mercado virgen (confirmado en el teardown de competidores AR): ninguno
 * muestra la plata en vivo, ninguno usa la app del inquilino como argumento,
 * ninguno dice "perseguir". El signature move es el panel vivo del hero.
 *
 * Honestidad: cero testimonios o métricas fabricados. La prueba es real:
 * convenios CPI/CUCICBA/Edifica + la beta, y una cita textual del relevamiento.
 *
 * El alta real ya existe (POST /auth/registro). La captura del hero precarga
 * /registro con el email.
 */

const display = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-display',
  display: 'swap',
});
const serif = Fraunces({
  subsets: ['latin'],
  weight: ['400', '500'],
  style: ['normal', 'italic'],
  variable: '--font-serif-display',
  display: 'swap',
});

const DESC =
  'El software de alquileres donde tus inquilinos pagan solos, la mora aparece sola y la rendición a propietarios sale calculada. Gratis hasta el lanzamiento, sin tarjeta.';

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'My Alquiler · Cobrá tus alquileres sin perseguir a nadie',
  description: DESC,
  alternates: { canonical: '/inicio' },
  robots: { index: true, follow: true },
  openGraph: {
    title: 'My Alquiler · Cobrá tus alquileres sin perseguir a nadie',
    description:
      'Tus inquilinos pagan desde la app. Vos ves la plata en vivo. La rendición sale sola. Para inmobiliarias argentinas.',
    type: 'website',
    url: '/inicio',
    siteName: 'My Alquiler',
    locale: 'es_AR',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'My Alquiler · Cobrá tus alquileres sin perseguir a nadie',
    description: DESC,
  },
};

const STYLES = `
.ml-landing h1, .ml-landing h2, .ml-landing h3, .ml-landing .display { font-family: var(--font-display), system-ui, sans-serif; }
.ml-landing .serif { font-family: var(--font-serif-display), Georgia, serif; }
@keyframes numIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
@keyframes kpiPulse { 0% { box-shadow: 0 0 0 0 rgba(16,185,129,0.45); } 100% { box-shadow: 0 0 0 9px rgba(16,185,129,0); } }
`;

// FAQs: fuente única para la sección visible Y el schema FAQPage (que la IA extrae).
const FAQS = [
  {
    q: '¿Y si mi inquilino no se baja la app?',
    a: 'Igual le llega el link de pago por WhatsApp y sube el comprobante desde el navegador. La app es un plus, no un requisito.',
  },
  {
    q: '¿Tengo que migrar toda mi cartera de una?',
    a: 'No. Podés arrancar con una sola propiedad para probar, o traer tu cartera completa desde tu Excel/planilla e importarla en minutos. Vos elegís el ritmo — nadie te apura ni te cobra por probar.',
  },
  {
    q: '¿Sirve si administro pocas propiedades?',
    a: 'Sí. Muchos arrancan con 5 o 10. El precio acompaña el tamaño de tu cartera, así que no pagás como una inmobiliaria grande por administrar poco.',
  },
  {
    q: '¿Qué pasa cuando termina el período gratis?',
    a: 'Te avisamos antes. Elegís un plan o te llevás tus datos. Cero cargo por irte.',
  },
  {
    q: '¿Es seguro? Manejo plata de terceros.',
    a: 'No conectamos tu cuenta bancaria ni tocamos tu dinero. La plata va directo a tu CBU; vos subís el resumen y validás los pagos. Nosotros sólo organizamos la información.',
  },
  {
    q: '¿Cómo paga el inquilino?',
    a: 'Por transferencia a tu CBU/alias o por Mercado Pago. Sube el comprobante y lo validás vos — el dinero nunca pasa por nosotros.',
  },
  {
    q: '¿Tengo con quién hablar si me trabo?',
    a: 'Sí: soporte por WhatsApp con gente real, no un bot. Te damos una mano para migrar y arrancar.',
  },
];

// Structured data (JSON-LD) para SEO + AI-SEO: identifica la entidad (Organization),
// el producto y sus precios (SoftwareApplication) y las FAQ (FAQPage, que los motores
// de IA extraen como respuestas). Los precios coinciden con /precios y /pricing.md.
const JSONLD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: SITE_URL,
      logo: `${SITE_URL}/icon.svg`,
      description: DESC,
      areaServed: { '@type': 'Country', name: 'Argentina' },
      foundingLocation: 'Córdoba, Argentina',
    },
    {
      '@type': 'SoftwareApplication',
      name: SITE_NAME,
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      url: `${SITE_URL}/inicio`,
      inLanguage: 'es-AR',
      description: DESC,
      offers: {
        '@type': 'AggregateOffer',
        priceCurrency: 'ARS',
        lowPrice: '50000',
        highPrice: '350000',
        offerCount: 4,
      },
    },
    {
      '@type': 'FAQPage',
      mainEntity: FAQS.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    },
  ],
};

export default function InicioPage() {
  return (
    <div className={`ml-landing ${display.variable} ${serif.variable} min-h-screen bg-[#faf8f5] text-foreground`}>
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSONLD) }} />
      {/* Sin JS (crawlers, lectores), el fade-up no debe esconder contenido. */}
      <noscript>
        <style
          dangerouslySetInnerHTML={{
            __html: '.ml-landing [data-reveal]{opacity:1!important;transform:none!important;}',
          }}
        />
      </noscript>
      <AnalyticsProvider />
      <Header />
      <main>
        <Hero />
        <TrustLogos />
        <Semana />
        <TresActores />
        <Features />
        <Calculadora />
        <Reclamos />
        <CitaRelevamiento />
        <Testimonios />
        <Precio />
        <Preguntas />
        <CierreCta />
      </main>
      <Footer />
      <WhatsappFab />
    </div>
  );
}

/* ── Hero ───────────────────────────────────────────────────────────────── */
function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-16 pt-28 md:px-8 md:pb-24 md:pt-32 lg:grid-cols-[0.92fr_1.08fr] lg:gap-10">
        <div>
          <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-primary">
            Software hecho por inmobiliarios, para inmobiliarios
          </p>
          <HeroHeadline />
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
            Tus inquilinos pagan desde la app. Vos ves la plata en vivo. La rendición a
            propietarios sale sola. Sin Excel y sin WhatsApp a las once de la noche.
          </p>
          <div className="mt-9">
            <HeroSignup />
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-muted-foreground">
            <Trust>Gratis hasta el lanzamiento</Trust>
            <Trust>Sin tarjeta</Trust>
            <Trust>Sin permanencia</Trust>
          </div>
        </div>

        {/* El producto antes del fold — el signature move. Ocupa más ancho para que
            domine el hero (es el diferenciador: nadie más muestra la plata en vivo). */}
        <div className="lg:-mr-4 lg:pl-2">
          <LivePanel />
        </div>
      </div>
    </section>
  );
}

function Trust({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Check className="h-3.5 w-3.5 text-emerald-600" strokeWidth={3} />
      {children}
    </span>
  );
}

/* ── La semana del administrador (PAS: problema + agitación) ─────────────── */
function Semana() {
  const antes = [
    'Rastreás quién pagó por WhatsApp, uno por uno.',
    'La rendición del mes la hacés a mano, en una planilla.',
    'Los ajustes por ICL quedan desactualizados entre contratos.',
    'El propietario te llama para preguntar si cobraste.',
  ];
  const despues = [
    'El inquilino paga desde la app y sube el comprobante.',
    'La rendición sale calculada: alquiler, comisión y gastos.',
    'El ajuste por índice se aplica solo, sin tocar Excel.',
    'El propietario ve su liquidación el mismo día que cobrás.',
  ];
  return (
    <section className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-24">
      <Reveal>
        <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-primary">El lunes del administrador</p>
        <h2 className="mt-3 max-w-2xl text-[clamp(1.9rem,4vw,3rem)] font-bold leading-[1.08] tracking-[-0.015em]">
          Son las nueve y ya tenés tres mensajes preguntando si cobraste.
        </h2>
      </Reveal>

      <div className="mt-12 grid gap-5 md:grid-cols-2">
        <Reveal>
          <div className="h-full rounded-3xl border border-black/[0.07] bg-white/40 p-7">
            <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Con Excel y WhatsApp</p>
            <ul className="mt-5 space-y-3.5">
              {antes.map((t) => (
                <li key={t} className="flex items-start gap-3 text-[15px] leading-snug text-muted-foreground">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-red-50 text-red-400">
                    <X className="h-3 w-3" strokeWidth={3} />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
        <Reveal delay={90}>
          <div className="h-full rounded-3xl border border-primary/20 bg-gradient-to-br from-white to-primary/[0.04] p-7 shadow-[0_24px_60px_-32px_rgba(80,40,160,0.4)]">
            <p className="text-sm font-semibold uppercase tracking-wide text-primary">Con My Alquiler</p>
            <ul className="mt-5 space-y-3.5">
              {despues.map((t) => (
                <li key={t} className="flex items-start gap-3 text-[15px] font-medium leading-snug text-foreground">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-600">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ── Tres actores (la solución, narrativa) ──────────────────────────────── */
function TresActores() {
  const actores = [
    {
      who: 'El inquilino',
      icon: Smartphone,
      text: 'Paga desde su celular, sube el comprobante y reclama. No te llama, no te escribe a la noche.',
    },
    {
      who: 'El propietario',
      icon: Wallet,
      text: 'Recibe su rendición prolija el mismo día que cobrás. Deja de llamarte a preguntar.',
    },
    {
      who: 'Vos',
      icon: ShieldCheck,
      text: 'Ves la plata en vivo, la mora aparece sola y la caja cuadra. No perseguís a nadie.',
    },
  ];
  return (
    <section className="border-y border-black/[0.06] bg-white/50">
      <div className="mx-auto max-w-6xl px-5 py-14 md:px-8 md:py-20">
        <Reveal>
          <h2 className="max-w-3xl text-[clamp(1.9rem,4vw,3rem)] font-bold leading-[1.08] tracking-[-0.015em]">
            Una sola plataforma. Tres personas más tranquilas.
          </h2>
        </Reveal>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {actores.map((a, i) => (
            <Reveal key={a.who} delay={i * 80}>
              <div className="flex h-full flex-col gap-4">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/[0.08] text-primary">
                  <a.icon className="h-6 w-6" />
                </div>
                <p className="display text-xl font-bold">{a.who}</p>
                <p className="text-[15px] leading-relaxed text-muted-foreground">{a.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Features (bento asimétrico, NO grid de 3 iguales) ───────────────────── */
function Features() {
  return (
    <section id="producto" className="mx-auto max-w-6xl scroll-mt-28 px-5 py-20 md:px-8 md:py-28">
      <Reveal>
        <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-primary">Todo en un panel</p>
        <h2 className="mt-3 max-w-2xl text-[clamp(1.9rem,4vw,3rem)] font-bold leading-[1.08] tracking-[-0.015em]">
          Lo que hoy hacés con cuatro herramientas, acá pasa solo.
        </h2>
      </Reveal>

      <div className="mt-12 grid auto-rows-[minmax(0,1fr)] gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Celda grande: cobranzas en vivo */}
        <Reveal className="sm:col-span-2 lg:row-span-2">
          <article className="flex h-full flex-col justify-between gap-6 rounded-3xl border border-black/[0.07] bg-white p-7">
            <div>
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/[0.08] text-primary">
                <Wallet className="h-5 w-5" />
              </div>
              <h3 className="mt-5 text-xl font-bold">Cobranzas en vivo</h3>
              <p className="mt-2 max-w-md text-[15px] leading-relaxed text-muted-foreground">
                Quién pagó, quién debe y cuánto, al instante. La mora aparece sola, con los
                punitorios calculados día a día. Te enterás antes de que el propietario te llame.
              </p>
            </div>
            <MiniCobranzas />
          </article>
        </Reveal>

        <FeatureCard icon={FileText} title="Rendición en un clic" highlight={false}>
          Alquiler, comisión, gastos y expensas, calculados. Tu propietario la recibe el mismo día.
        </FeatureCard>

        <FeatureCard icon={Wrench} title="Reclamos con red de profesionales" highlight>
          El inquilino reclama, vos derivás al plomero o electricista y se confirma por WhatsApp. Nadie más lo tiene.
        </FeatureCard>

        <FeatureCard icon={Calculator} title="Ajustes ICL e IPC automáticos">
          El índice se aplica solo en la fecha que toca. Sin planillas heredadas que nadie audita.
        </FeatureCard>

        <FeatureCard icon={Building2} title="Multi-sociedad y consorcios">
          S.R.L., S.A. y fideicomisos en una cuenta. Módulo aparte para administración de PH.
        </FeatureCard>

        <FeatureCard icon={ScrollText} title="Caja y auditoría al día">
          Cada peso y cada acción sensible quedan registrados. El cierre de caja cuadra sin sorpresas.
        </FeatureCard>
      </div>
    </section>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  children,
  highlight = false,
}: {
  icon: typeof Wallet;
  title: string;
  children: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <Reveal>
      <article
        className={[
          'group flex h-full flex-col gap-3 rounded-3xl border p-7 transition-all hover:-translate-y-0.5',
          highlight
            ? 'border-primary/25 bg-gradient-to-br from-primary/[0.06] to-white shadow-[0_24px_60px_-36px_rgba(80,40,160,0.45)]'
            : 'border-black/[0.07] bg-white hover:shadow-[0_24px_60px_-40px_rgba(80,40,160,0.35)]',
        ].join(' ')}
      >
        <div
          className={[
            'grid h-11 w-11 place-items-center rounded-2xl transition-colors',
            highlight ? 'bg-primary text-primary-foreground' : 'bg-primary/[0.08] text-primary',
          ].join(' ')}
        >
          <Icon className="h-5 w-5" />
        </div>
        <h3 className="mt-1 text-lg font-bold leading-snug">{title}</h3>
        <p className="text-[14.5px] leading-relaxed text-muted-foreground">{children}</p>
      </article>
    </Reveal>
  );
}

function MiniCobranzas() {
  const rows = [
    { n: 'Laura Giménez', d: 'Cobrado', tone: 'emerald' as const },
    { n: 'Carlos Romero', d: 'Vence en 2 días', tone: 'amber' as const },
    { n: 'Sofía Aguirre', d: '10 días en mora', tone: 'red' as const },
  ];
  const dot = { emerald: 'bg-emerald-500', amber: 'bg-amber-500', red: 'bg-red-500' };
  const txt = { emerald: 'text-emerald-600', amber: 'text-amber-600', red: 'text-red-500' };
  return (
    <div className="rounded-2xl border border-black/[0.06] bg-[#fbfafc] p-3">
      <div className="space-y-1.5">
        {rows.map((r) => (
          <div key={r.n} className="flex items-center gap-3 rounded-xl bg-white px-3 py-2 ring-1 ring-black/[0.04]">
            <span className={`h-2 w-2 shrink-0 rounded-full ${dot[r.tone]}`} />
            <span className="flex-1 truncate text-[13px] font-medium text-gray-800">{r.n}</span>
            <span className={`text-[12px] font-semibold ${txt[r.tone]}`}>{r.d}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Reclamos (banda oscura, ruptura de ritmo) ──────────────────────────── */
function Reclamos() {
  return (
    <section className="bg-[linear-gradient(135deg,#2a1758_0%,#1a0f33_100%)] text-white">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-20 md:grid-cols-2 md:px-8 md:py-24">
        <Reveal>
          <div>
            <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-violet-300">
              Lo que ningún software del rubro tiene
            </p>
            <h2 className="mt-4 text-[clamp(1.9rem,4vw,3rem)] font-bold leading-[1.06] tracking-[-0.015em]">
              El inquilino rompe algo. Vos no coordinás nada.
            </h2>
            <p className="mt-5 max-w-md text-lg leading-relaxed text-white/70">
              El reclamo entra desde la app, lo derivás a un profesional de tu red y el plomero
              confirma la visita por WhatsApp con un link. Sin login, sin llamados, sin quedar en el medio.
            </p>
            <Link
              href="/registro"
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#1b1228] transition-transform hover:-translate-y-0.5"
            >
              Empezá gratis
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </Reveal>
        <Reveal delay={90}>
          <FlujoReclamo />
        </Reveal>
      </div>
    </section>
  );
}

function FlujoReclamo() {
  const pasos = [
    { icon: Smartphone, t: 'El inquilino sube el reclamo', s: 'Pérdida de agua · Honduras 4490' },
    { icon: Wrench, t: 'Lo derivás a un profesional', s: 'Diego Funes · Plomería' },
    { icon: MessageCircle, t: 'Confirma la visita por WhatsApp', s: 'Sin login, con un link' },
    { icon: CheckCircle2, t: 'Resuelto y registrado', s: 'Sin que toques el teléfono' },
  ];
  return (
    <div className="space-y-2.5">
      {pasos.map((p, i) => (
        <div
          key={p.t}
          className="flex items-center gap-3.5 rounded-2xl border border-white/10 bg-white/[0.06] p-3.5 backdrop-blur"
        >
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10 text-violet-200">
            <p.icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="text-sm font-semibold">{p.t}</p>
            <p className="mt-0.5 truncate text-[12.5px] text-white/55">{p.s}</p>
          </div>
          <span className="text-xs font-bold text-white/30">0{i + 1}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Cita del relevamiento (honesta — la "cosa rara": numerales serif) ───── */
function CitaRelevamiento() {
  return (
    <section className="mx-auto max-w-4xl px-5 py-24 text-center md:px-8 md:py-32">
      <Reveal>
        <p className="text-[13px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Durante el relevamiento con inmobiliarias de Córdoba
        </p>
        <blockquote className="serif mt-7 text-[clamp(1.75rem,4.5vw,3.25rem)] font-medium italic leading-[1.15] tracking-[-0.01em] text-foreground">
          “La gestión de cobranza y rendición es un dolor de muela.”
        </blockquote>
        <p className="mt-7 text-sm text-muted-foreground">
          Un administrador, en una entrevista real. No es un testimonio armado: es la razón por la
          que existe My Alquiler.
        </p>
      </Reveal>
    </section>
  );
}

/* ── Precio (sin fake 3 columnas) ───────────────────────────────────────── */
function Precio() {
  return (
    <section id="precio" className="scroll-mt-28 border-y border-black/[0.06] bg-white/50">
      <div className="mx-auto max-w-6xl px-5 py-20 md:px-8 md:py-24">
        <div className="grid items-center gap-8 md:grid-cols-[1.1fr_0.9fr]">
          <Reveal>
            <div>
              <h2 className="text-[clamp(1.9rem,4vw,3rem)] font-bold leading-[1.08] tracking-[-0.015em]">
                Gratis hasta el lanzamiento. Después, un precio fijo y claro.
              </h2>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
                Después de la beta, un precio fijo por mes según el tamaño de tu cartera —{' '}
                <span className="font-semibold text-foreground">desde $50.000/mes</span>, sin comisión
                por transferencia y sin permanencia. Las primeras 50 inmobiliarias entran con{' '}
                <span className="font-semibold text-foreground">−20% para siempre</span>.
              </p>
            </div>
          </Reveal>
          <Reveal delay={90}>
            <div className="rounded-3xl border border-black/[0.07] bg-white p-7 shadow-[0_24px_60px_-40px_rgba(80,40,160,0.35)]">
              <div className="flex items-baseline gap-2">
                <span className="display text-4xl font-extrabold tracking-tight">$0</span>
                <span className="text-sm text-muted-foreground">hasta el lanzamiento</span>
              </div>
              <ul className="mt-5 space-y-2.5 text-[15px]">
                {['Sin tarjeta', 'Sin permanencia', 'Te llevás tus datos cuando quieras'].map((t) => (
                  <li key={t} className="flex items-center gap-2.5">
                    <Check className="h-4 w-4 text-emerald-600" strokeWidth={3} />
                    {t}
                  </li>
                ))}
              </ul>
              <Link
                href="/precios"
                className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
              >
                Ver los planes cuando termine la beta
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ── Preguntas (acordeón nativo <details> — sin JS, accesible y SEO-friendly) ─ */
function Preguntas() {
  return (
    <section id="preguntas" className="mx-auto max-w-3xl scroll-mt-28 px-5 py-20 md:px-8 md:py-24">
      <Reveal>
        <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-primary">Preguntas frecuentes</p>
        <h2 className="mt-3 text-[clamp(1.7rem,3.5vw,2.5rem)] font-bold tracking-[-0.015em]">
          Todo lo que te preguntás antes de arrancar.
        </h2>
        <p className="mt-3 text-[15px] text-muted-foreground">
          ¿Te queda una duda que no está acá?{' '}
          <a
            href="https://wa.me/5491154596266?text=Hola%2C%20tengo%20una%20duda%20sobre%20My%20Alquiler"
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-primary hover:underline"
          >
            Escribinos por WhatsApp
          </a>
          .
        </p>
      </Reveal>
      <Reveal>
        <div className="mt-10 divide-y divide-black/[0.07] overflow-hidden rounded-3xl border border-black/[0.07] bg-white">
          {FAQS.map((qa) => (
            <details key={qa.q} className="group px-6">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-left [&::-webkit-details-marker]:hidden">
                <span className="text-[16px] font-semibold leading-snug">{qa.q}</span>
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/[0.08] text-primary transition-transform duration-200 group-open:rotate-45">
                  <Plus className="h-4 w-4" strokeWidth={2.5} />
                </span>
              </summary>
              <p className="max-w-2xl pb-5 text-[15px] leading-relaxed text-muted-foreground">{qa.a}</p>
            </details>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

/* ── Cierre (repite la promesa + captura) ───────────────────────────────── */
function CierreCta() {
  return (
    <section className="px-5 pb-20 md:px-8">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#2a1758_0%,#16092e_100%)] px-7 py-16 text-white md:px-16 md:py-20">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-primary/30 blur-3xl" />
        <div className="relative max-w-2xl">
          <h2 className="text-[clamp(2rem,4.5vw,3.25rem)] font-bold leading-[1.06] tracking-[-0.015em]">
            Tu próxima rendición, lista antes del mediodía.
          </h2>
          <p className="mt-5 text-lg text-white/70">
            Creá tu inmobiliaria en minutos y empezá a cobrar sin perseguir a nadie.
          </p>
          <div className="mt-9">
            <HeroSignup tone="dark" from="cierre" cta="Crear mi inmobiliaria" microcopy="Gratis hasta el lanzamiento · sin tarjeta · sin vendedores." />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Footer ─────────────────────────────────────────────────────────────── */
function Footer() {
  return (
    <footer className="border-t border-black/[0.06] bg-[#faf8f5]">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 md:flex-row md:items-center md:justify-between md:px-8">
        <div className="flex items-center gap-2.5">
          <Isotipo size={32} />
          <div>
            <p className="display text-sm font-bold">My Alquiler</p>
            <p className="text-xs text-muted-foreground">Hecho en Córdoba para inmobiliarias argentinas.</p>
          </div>
        </div>
        <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <Link href="/login" className="hover:text-foreground">Iniciar sesión</Link>
          <Link href="/precios" className="hover:text-foreground">Precios</Link>
          <a
            href="https://wa.me/5491154596266?text=Hola%2C%20quiero%20saber%20m%C3%A1s%20de%20My%20Alquiler"
            target="_blank"
            rel="noreferrer"
            className="hover:text-foreground"
          >
            WhatsApp
          </a>
        </nav>
      </div>
    </footer>
  );
}
