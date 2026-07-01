'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Isotipo } from '@/components/isotipo';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  CreditCard,
  FileText,
  Loader2,
  Mail,
  MapPin,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { Button } from '@llave/ui/button';
import { Card } from '@llave/ui/card';
import { Input } from '@llave/ui/input';
import { Label } from '@llave/ui/label';
import { toast } from '@llave/ui/use-toast';
import { apiEnabled } from '@/lib/api/client';
import { SEGUNDOS_COOLDOWN, leerSesion } from '@/lib/auth-otp';
import {
  elegirAlquiler,
  iniciarSesionDemoUnificada,
  solicitarCodigoUnificado,
  verificarCodigoUnificado,
  type Alquiler,
} from '@/lib/auth-otp-api';

type Paso = 'email' | 'otp' | 'elegir';

export default function LoginPage() {
  const router = useRouter();
  const [paso, setPaso] = useState<Paso>('email');
  const [email, setEmail] = useState('');
  const [codigoDemo, setCodigoDemo] = useState<string | null>(null);
  const [cooldownHasta, setCooldownHasta] = useState<number | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [verificando, setVerificando] = useState(false);
  const [errorEmail, setErrorEmail] = useState<string | null>(null);
  const [errorOtp, setErrorOtp] = useState<string | null>(null);
  const [digitos, setDigitos] = useState<string[]>(['', '', '', '', '', '']);
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);
  // Paso "elegir": cuando el email tiene varios alquileres, mostramos el
  // selector. `eligiendo` = inquilinoId en curso (spinner en esa fila).
  const [alquileres, setAlquileres] = useState<Alquiler[]>([]);
  const [eligiendo, setEligiendo] = useState<string | null>(null);
  const [errorElegir, setErrorElegir] = useState<string | null>(null);
  // ?expirada=1: el cliente nos echó por un 401 (token vencido). Avisamos por qué
  // para que no parezca que la app se rompió ni que mintió "sesión abierta".
  const [sesionExpirada, setSesionExpirada] = useState(false);

  // Si ya hay sesión, redirigir a home (excepto que vengamos con ?force)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    // Bypass de demo: `/login?demo=1` crea la sesión de Mariela y entra
    // directo, salteando el OTP. SOLO en el build demo sin backend
    // (!apiEnabled). En producción se ignora — nadie entra sin OTP real.
    if (!apiEnabled && params.has('demo')) {
      iniciarSesionDemoUnificada();
      router.replace('/');
      return;
    }
    if (params.has('expirada')) {
      setSesionExpirada(true);
      // Limpiamos el param para que un refresh no repita el aviso.
      window.history.replaceState(null, '', window.location.pathname);
    }
    const sesion = leerSesion();
    if (sesion && !params.has('force')) {
      router.replace('/');
    }
  }, [router]);

  /* ============================================================
   * Paso 1: pedir código por email
   * ============================================================ */
  const onSolicitar = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setErrorEmail(null);
    setEnviando(true);
    // Pequeño delay para que se sienta natural
    await new Promise((r) => setTimeout(r, 300));

    const r = await solicitarCodigoUnificado(email);
    if (!r.ok) {
      setErrorEmail(r.motivo ?? 'No pudimos enviar el código.');
      setEnviando(false);
      return;
    }
    setCodigoDemo(r.codigo ?? null);
    setCooldownHasta(r.cooldownHasta ?? null);
    setPaso('otp');
    setEnviando(false);
    // Focus al primer input del OTP
    setTimeout(() => otpRefs.current[0]?.focus(), 100);
  };

  /* ============================================================
   * Paso 2: tipear / pegar / verificar el código OTP
   * ============================================================ */
  const onDigito = (idx: number, valor: string) => {
    setErrorOtp(null);
    // Si pegan los 6 dígitos de una, distribuir
    const limpio = valor.replace(/\D/g, '');
    if (limpio.length > 1) {
      // Corrección sobre una casilla YA llena en teclados Android que no respetan
      // select(): el value llega como "viejoNuevo" (2 chars). Lo tratamos como
      // edición de ESA casilla (último char), no como pegado del código completo
      // (antes esto reescribía todo el código desde el índice 0).
      if (limpio.length === 2 && digitos[idx]) {
        const nuevo = [...digitos];
        nuevo[idx] = limpio.slice(-1);
        setDigitos(nuevo);
        if (idx < 5) setTimeout(() => otpRefs.current[idx + 1]?.focus(), 0);
        if (nuevo.every((d) => d !== '')) setTimeout(() => onVerificar(nuevo.join('')), 100);
        return;
      }
      const arr = ['', '', '', '', '', ''];
      for (let i = 0; i < 6 && i < limpio.length; i++) arr[i] = limpio[i] ?? '';
      setDigitos(arr);
      const ultimoLleno = Math.min(5, limpio.length - 1);
      setTimeout(() => otpRefs.current[ultimoLleno]?.focus(), 0);
      if (limpio.length >= 6) {
        setTimeout(() => onVerificar(arr.join('')), 100);
      }
      return;
    }

    const nuevo = [...digitos];
    nuevo[idx] = limpio.slice(-1);
    setDigitos(nuevo);
    if (limpio && idx < 5) {
      setTimeout(() => otpRefs.current[idx + 1]?.focus(), 0);
    }
    if (nuevo.every((d) => d !== '')) {
      setTimeout(() => onVerificar(nuevo.join('')), 100);
    }
  };

  const onKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digitos[idx] && idx > 0) {
      otpRefs.current[idx - 1]?.focus();
      return;
    }
    // Enter como backup: si auto-verify no disparó (race con setState),
    // el usuario puede confirmar a mano sin levantar la mano del teclado.
    if (e.key === 'Enter' && digitos.every((d) => d !== '')) {
      e.preventDefault();
      void onVerificar();
    }
    // Flechas para moverse entre dígitos sin tener que tocar el mouse.
    if (e.key === 'ArrowLeft' && idx > 0) {
      e.preventDefault();
      otpRefs.current[idx - 1]?.focus();
    }
    if (e.key === 'ArrowRight' && idx < 5) {
      e.preventDefault();
      otpRefs.current[idx + 1]?.focus();
    }
  };

  const onVerificar = async (codigoCompleto?: string) => {
    if (verificando) return;
    setVerificando(true);
    const codigo = codigoCompleto ?? digitos.join('');
    if (codigo.length !== 6) {
      setErrorOtp('Faltan dígitos');
      setVerificando(false);
      return;
    }
    await new Promise((r) => setTimeout(r, 350));
    const r = await verificarCodigoUnificado(email, codigo);
    if (!r.ok) {
      setErrorOtp(r.motivo ?? 'No pudimos verificar el código.');
      setVerificando(false);
      setDigitos(['', '', '', '', '', '']);
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
      return;
    }
    setVerificando(false);
    // Varios alquileres → mostramos el selector en vez de entrar directo.
    if (r.tipo === 'elegir') {
      setAlquileres(r.alquileres);
      setErrorElegir(null);
      setPaso('elegir');
      return;
    }
    toast({
      title: `¡Hola ${r.sesion.nombre}!`,
      description: 'Ingresaste con éxito.',
    });
    router.replace('/');
  };

  /* ============================================================
   * Paso 3 (opcional): elegir a qué alquiler entrar
   * ============================================================ */
  const onElegir = async (inquilinoId: string) => {
    if (eligiendo) return;
    setEligiendo(inquilinoId);
    setErrorElegir(null);
    try {
      const sesion = await elegirAlquiler(inquilinoId, alquileres.length);
      toast({ title: `¡Hola ${sesion.nombre}!`, description: 'Entraste a tu alquiler.' });
      router.replace('/');
    } catch {
      setEligiendo(null);
      setErrorElegir('No pudimos entrar a ese alquiler. Probá de nuevo.');
    }
  };

  const onReenviar = async () => {
    setErrorOtp(null);
    // Si quedó un verify colgado (p. ej. el usuario tocó esto en 3G lento), lo
    // liberamos: sin esto `verificando=true` bloqueaba el form (inputs disabled).
    setVerificando(false);
    const r = await solicitarCodigoUnificado(email);
    if (!r.ok) {
      setErrorOtp(r.motivo ?? 'No pudimos reenviar el código.');
      return;
    }
    setCodigoDemo(r.codigo ?? null);
    setCooldownHasta(r.cooldownHasta ?? null);
    setDigitos(['', '', '', '', '', '']);
    toast({
      title: 'Código reenviado',
      description: `Te mandamos un nuevo código a ${email}.`,
    });
    setTimeout(() => otpRefs.current[0]?.focus(), 100);
  };

  const volverAlEmail = () => {
    setPaso('email');
    setDigitos(['', '', '', '', '', '']);
    setErrorOtp(null);
    setCodigoDemo(null);
    // Liberamos un verify en curso para no dejar el botón/inputs trabados al
    // volver y reenviar el código.
    setVerificando(false);
  };

  return (
    // Antes el bg era `bg-background` (blanco plano) con 3 orbs decorativos.
    // En viewports tall (>1400px) los orbs quedaban en las esquinas y dejaban
    // una banda blanca enorme en el medio — el user lo veía "cortado":
    // gradient arriba → blanco medio → gradient abajo. Ahora el main tiene
    // un gradient diagonal continuo de base (siempre cubre el 100dvh) y los
    // orbs van encima como acento; además agrandé el orb central y movi el
    // de fuchsia más arriba para tapar el "hueco" en pantallas grandes.
    <main className="relative min-h-[100dvh] overflow-hidden bg-gradient-to-br from-violet-50 via-background to-fuchsia-50/60">
      {/* Orbs decorativos de fondo — sutiles, generan textura sin distraer */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-primary/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -right-32 h-[32rem] w-[32rem] rounded-full bg-fuchsia-400/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[28rem] w-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-400/10 blur-3xl"
      />

      {/* Wrapper centrado con max-width. Sin esto, en viewports >1280
          las dos columnas (`flex-1`) ocupaban 50%/50% y dejaban un
          vacío gigante en el centro — el user lo veía como "cortado".
          Ahora el contenido vive en un container 6xl, cerca del centro. */}
      <div className="relative z-10 mx-auto flex min-h-[100dvh] max-w-6xl flex-col md:flex-row md:items-stretch">
        {/* PANEL IZQUIERDO — branding + beneficios (solo desktop).
            Antes usaba `justify-between` con 3 hijos, lo que dejaba
            huecos enormes en viewports altos. Ahora agrupa el contenido
            en el centro vertical y el copyright queda como footer
            absolute al pie. */}
        <aside className="relative hidden flex-1 flex-col justify-center gap-10 p-12 md:flex">
          <BrandHero />

          <div className="space-y-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Lo que vas a encontrar
            </p>
            <ul role="list" className="space-y-4">
              <Beneficio
                Icon={CreditCard}
                titulo="Pagás directo desde la app"
                detalle="Transferencia, MP o QR. Comprobante registrado al instante."
              />
              <Beneficio
                Icon={FileText}
                titulo="Tu contrato siempre a mano"
                detalle="Cláusulas, ajustes, depósito y vencimientos en un lugar."
              />
              <Beneficio
                Icon={Sparkles}
                titulo="Asistente IA — muy pronto"
                detalle="Vas a poder preguntarle cualquier duda del contrato y te cita la cláusula exacta."
              />
            </ul>
          </div>
        </aside>

        {/* PANEL DERECHO — form de login (siempre visible) */}
        <section className="flex flex-1 items-center justify-center p-5 md:p-10">
          <div className="w-full max-w-md space-y-5">
          {/* Brand en mobile (cuando el aside no se ve) */}
          <div className="md:hidden">
            <BrandHero compact />
          </div>

          {/* Card del form */}
          <Card className="relative overflow-hidden border-0 bg-card/95 p-6 shadow-2xl shadow-primary/10 backdrop-blur-xl">
            {/* Borde gradient suave arriba */}
            <div
              aria-hidden
              className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-fuchsia-500 to-violet-500"
            />

            {paso === 'email' ? (
              <PasoEmail
                email={email}
                setEmail={(v) => {
                  setEmail(v);
                  // Si había un error de email, lo limpiamos apenas el usuario
                  // empieza a corregir — evita que el ⚠ siga visible mientras
                  // tipea la versión arreglada.
                  if (errorEmail) setErrorEmail(null);
                }}
                error={errorEmail}
                enviando={enviando}
                sesionExpirada={sesionExpirada}
                onSubmit={onSolicitar}
              />
            ) : paso === 'otp' ? (
              <PasoOtp
                email={email}
                digitos={digitos}
                error={errorOtp}
                verificando={verificando}
                cooldownHasta={cooldownHasta}
                otpRefs={otpRefs}
                onDigito={onDigito}
                onKeyDown={onKeyDown}
                onReenviar={onReenviar}
                onVerificar={() => onVerificar()}
                onVolver={volverAlEmail}
              />
            ) : (
              <PasoElegir
                alquileres={alquileres}
                eligiendo={eligiendo}
                error={errorElegir}
                onElegir={onElegir}
              />
            )}
          </Card>

          {/* Banner DEMO con el código generado — más prominente que antes */}
          {paso === 'otp' && codigoDemo && (
            <Card className="border border-amber-300/60 bg-gradient-to-br from-amber-50 to-amber-100/60 p-4 dark:border-amber-900/40 dark:from-amber-950/40 dark:to-amber-900/20">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                    Demo
                  </span>
                  <p className="text-xs text-amber-900 dark:text-amber-200">
                    En producción el código llega por mail
                  </p>
                </div>
                <p className="text-center font-mono text-3xl font-bold tracking-[0.4em] text-amber-900 dark:text-amber-100">
                  {codigoDemo}
                </p>
                <p className="text-center text-[10px] text-amber-800/70 dark:text-amber-300/70">
                  Tocá los dígitos arriba o pegá el código directo
                </p>
              </div>
            </Card>
          )}

          {/* Footer copy */}
          <p className="text-center text-xs text-muted-foreground">
            ¿Sos nuevo?{' '}
            <span className="text-foreground">
              Tu inmobiliaria tiene que invitarte primero.
            </span>
          </p>
        </div>
      </section>
      </div>

      {/* Copyright al pie, fuera del container max-w para que quede
          anclado al borde de la pantalla. */}
      <p className="pointer-events-none absolute bottom-6 left-1/2 z-10 hidden -translate-x-1/2 text-xs text-muted-foreground md:block">
        © My Alquiler · La app del inquilino
      </p>
    </main>
  );
}

/* ============================================================
 * Brand hero — logo + título + tagline.
 * En desktop ocupa el panel izquierdo grande; en mobile es la
 * versión `compact` arriba del form.
 * ============================================================ */
function BrandHero({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <div className="text-center">
        <div className="mx-auto mb-2 w-fit"><Isotipo size={48} /></div>
        <h1 className="text-xl font-bold tracking-tight">My Alquiler</h1>
        <p className="text-xs text-muted-foreground">La app de tu alquiler</p>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <Isotipo size={64} />
      <div>
        <h1 className="text-4xl font-bold leading-tight tracking-tight lg:text-5xl">
          My Alquiler
        </h1>
        <p className="mt-2 text-lg text-muted-foreground">
          La app del inquilino. Tu contrato, tus pagos y tu hogar — en un toque.
        </p>
      </div>
    </div>
  );
}

function Beneficio({
  Icon,
  titulo,
  detalle,
}: {
  Icon: typeof CreditCard;
  titulo: string;
  detalle: string;
}) {
  return (
    <li className="flex items-start gap-3">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold">{titulo}</p>
        <p className="text-xs text-muted-foreground">{detalle}</p>
      </div>
    </li>
  );
}

/* ============================================================
 * Paso 1: form de email
 * ============================================================ */
function PasoEmail({
  email,
  setEmail,
  error,
  enviando,
  sesionExpirada,
  onSubmit,
}: {
  email: string;
  setEmail: (v: string) => void;
  error: string | null;
  enviando: boolean;
  sesionExpirada: boolean;
  onSubmit: (e?: React.FormEvent) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-5 animate-fade-in">
      {sesionExpirada && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-xl border border-amber-300/60 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-200"
        >
          <RotateCcw className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>Tu sesión venció por seguridad. Volvé a entrar con tu email — es un toque.</span>
        </div>
      )}
      <div className="space-y-1.5">
        <h2 className="text-2xl font-bold tracking-tight">Entrá a tu cuenta</h2>
        <p className="text-sm text-muted-foreground">
          Te mandamos un código de 6 dígitos a tu mail.
        </p>
        {/* J4 (walkthrough Jorge): la sesión persiste (no expira). Jorge temía
            tener que buscar el código en el mail todos los meses. Se lo
            aclaramos acá para sacarle ese miedo desde la entrada. */}
        <p className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          Lo pedís una sola vez — después te mantenemos la sesión abierta.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email" className="text-sm font-medium">
          Email
        </Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          autoFocus
          inputMode="email"
          placeholder="vos@correo.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={enviando}
          required
          className="h-12 text-base"
          aria-invalid={!!error}
          aria-describedby={error ? 'email-error' : undefined}
        />
        {error && (
          <p
            id="email-error"
            role="alert"
            className="flex items-center gap-1 text-xs text-destructive"
          >
            <span aria-hidden>⚠</span> {error}
          </p>
        )}
      </div>

      <Button
        type="submit"
        size="xl"
        className="w-full"
        disabled={enviando || !email.trim()}
      >
        {enviando ? (
          <>
            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
            Enviando código…
          </>
        ) : (
          <>
            <Mail className="h-4 w-4" />
            Recibir código por email
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </Button>

      {/* CTA de demo — SOLO en el build demo sin backend. En producción
          no ofrecemos la cuenta de prueba (Mariela). */}
      {!apiEnabled && (
        <button
          type="button"
          onClick={() => setEmail('mariela.sosa@gmail.com')}
          className="flex w-full items-center justify-center gap-2 rounded-full border border-dashed border-primary/40 bg-primary/5 px-3 py-2 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Probar con cuenta demo (Mariela Sosa)
        </button>
      )}
    </form>
  );
}

/* ============================================================
 * Paso 2: form de OTP
 * ============================================================ */
function PasoOtp({
  email,
  digitos,
  error,
  verificando,
  cooldownHasta,
  otpRefs,
  onDigito,
  onKeyDown,
  onReenviar,
  onVerificar,
  onVolver,
}: {
  email: string;
  digitos: string[];
  error: string | null;
  verificando: boolean;
  cooldownHasta: number | null;
  otpRefs: React.MutableRefObject<Array<HTMLInputElement | null>>;
  onDigito: (idx: number, valor: string) => void;
  onKeyDown: (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => void;
  onReenviar: () => void;
  onVerificar: () => void;
  onVolver: () => void;
}) {
  const [segundos, setSegundos] = useState(0);

  useEffect(() => {
    if (!cooldownHasta) return;
    const update = () => {
      const restantes = Math.max(0, Math.ceil((cooldownHasta - Date.now()) / 1000));
      setSegundos(restantes);
    };
    update();
    const id = setInterval(update, 250);
    return () => clearInterval(id);
  }, [cooldownHasta]);

  const puedeReenviar = segundos === 0;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={onVolver}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Volver al email"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0">
          <h2 className="text-2xl font-bold tracking-tight">Ingresá el código</h2>
          {/* Antes el `break-all` rompía el email en cualquier char y
              quedaba "mariela.sosa@g | mail.com" — visualmente sucio.
              Ahora el email va en su propia línea con `break-words`
              (sólo en boundaries naturales), evitando el corte raro. */}
          <p className="text-sm text-muted-foreground">
            Te lo mandamos a{' '}
            <span className="block break-words font-medium text-foreground">
              {email}
            </span>
          </p>
        </div>
      </div>

      {/* Inputs OTP — más grandes y con focus ring más visible.
          Cuando hay error, el borde se pinta rojo y el ring también, para
          que el feedback no dependa solo del texto de abajo.
          flex-1 + max-w-[3rem] hace que se adapten al ancho del card
          (antes overflow horizontal en iPhone SE / viewports < 360px). */}
      <div className="flex justify-center gap-1.5 sm:gap-2">
        {digitos.map((d, idx) => (
          <input
            key={idx}
            ref={(el) => {
              otpRefs.current[idx] = el;
            }}
            type="text"
            inputMode="numeric"
            autoComplete={idx === 0 ? 'one-time-code' : 'off'}
            maxLength={6}
            value={d}
            aria-label={`Dígito ${idx + 1} de ${digitos.length}`}
            onChange={(e) => onDigito(idx, e.target.value)}
            onKeyDown={(e) => onKeyDown(idx, e)}
            // Al enfocar seleccionamos el dígito existente: corregir una casilla
            // ya llena reemplaza SOLO esa casilla (el value queda en 1 char y cae
            // en la rama single), sin reescribir todo el código desde el índice 0.
            // El pegado de 6 dígitos sigue funcionando: reemplaza la selección y
            // llega multi-char a onChange → rama de distribución.
            onFocus={(e) => e.currentTarget.select()}
            disabled={verificando}
            className={`h-14 min-w-0 flex-1 rounded-xl border-2 bg-background text-center text-xl font-bold tabular-nums shadow-sm transition-all focus:outline-none focus:ring-4 disabled:opacity-60 sm:h-16 sm:max-w-[3rem] sm:text-2xl ${
              error
                ? 'border-destructive focus:border-destructive focus:ring-destructive/20'
                : 'focus:border-primary focus:ring-primary/20'
            }`}
            aria-invalid={!!error}
            aria-describedby={error ? 'otp-error' : undefined}
          />
        ))}
      </div>

      {error && (
        <p
          id="otp-error"
          role="alert"
          className="flex items-center justify-center gap-1 text-center text-xs text-destructive"
        >
          <span aria-hidden>⚠</span> {error}
        </p>
      )}

      <Button
        type="button"
        size="xl"
        className="w-full"
        onClick={onVerificar}
        disabled={verificando || digitos.some((d) => d === '')}
      >
        {verificando ? (
          <>
            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
            Verificando…
          </>
        ) : (
          <>
            <CheckCircle2 className="h-4 w-4" />
            Entrar
          </>
        )}
      </Button>

      {/* Reenvío con visual cleaner */}
      <div className="space-y-1 text-center text-xs">
        {puedeReenviar ? (
          <button
            type="button"
            onClick={onReenviar}
            className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
          >
            <RotateCcw className="h-3 w-3" />
            Reenviar código
          </button>
        ) : (
          <span className="text-muted-foreground">
            Reenvío disponible en <strong className="tabular-nums">{segundos}s</strong>
          </span>
        )}
        <p className="text-[10px] text-muted-foreground/80">
          El código vence a los 5 minutos. {SEGUNDOS_COOLDOWN}s entre reenvíos.
        </p>
      </div>
    </div>
  );
}

/* ============================================================
 * Paso 3: elegir a qué alquiler entrar (email con varios alquileres)
 * ============================================================ */
function PasoElegir({
  alquileres,
  eligiendo,
  error,
  onElegir,
}: {
  alquileres: Alquiler[];
  eligiendo: string | null;
  error: string | null;
  onElegir: (inquilinoId: string) => void;
}) {
  return (
    <div className="space-y-5 animate-fade-in">
      <div className="space-y-1.5">
        <h2 className="text-2xl font-bold tracking-tight">Elegí tu alquiler</h2>
        <p className="text-sm text-muted-foreground">
          Tenés más de un alquiler con este email. ¿A cuál querés entrar?
        </p>
      </div>

      <ul role="list" className="space-y-2.5">
        {alquileres.map((a) => {
          const cargando = eligiendo === a.inquilinoId;
          return (
            <li key={a.inquilinoId}>
              <button
                type="button"
                onClick={() => onElegir(a.inquilinoId)}
                disabled={eligiendo !== null}
                className="group flex w-full items-center gap-3 rounded-xl border-2 border-border bg-background p-4 text-left transition-all hover:border-primary hover:bg-primary/5 focus:outline-none focus:ring-4 focus:ring-primary/20 disabled:opacity-60"
              >
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  <MapPin className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{a.direccion || 'Tu alquiler'}</p>
                  <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                    <Building2 className="h-3 w-3 shrink-0" />
                    <span className="truncate">
                      {a.inmobiliaria}
                      {a.ciudad ? ` · ${a.ciudad}` : ''}
                    </span>
                  </p>
                </div>
                {cargando ? (
                  <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" />
                ) : (
                  <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {error && (
        <p
          role="alert"
          className="flex items-center justify-center gap-1 text-center text-xs text-destructive"
        >
          <span aria-hidden>⚠</span> {error}
        </p>
      )}

      <p className="text-center text-[11px] text-muted-foreground">
        Vas a poder cambiar de alquiler cuando quieras desde tu cuenta.
      </p>
    </div>
  );
}
