'use client';

import { SignIn } from '@clerk/nextjs';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, Mail, RotateCcw } from 'lucide-react';
import { Button } from '@llave/ui/button';
import { Input } from '@llave/ui/input';
import { Label } from '@llave/ui/label';
import { AuthShell } from '@/components/auth-shell';
import { isClerkEnabled } from '@/lib/auth';
import { apiEnabled, apiFetch, setToken, ApiError } from '@/lib/api/client';

/** Segundos de cooldown entre reenvíos de código (anti-spam, lado cliente). */
const SEGUNDOS_COOLDOWN = 30;

export default function LoginPage() {
  return (
    <AuthShell>
      {isClerkEnabled() ? (
        <SignIn
          path="/login"
          routing="path"
          signUpUrl="/login"
          appearance={{ elements: { rootBox: 'w-full', card: 'shadow-sm' } }}
        />
      ) : (
        <LoginOtp />
      )}
    </AuthShell>
  );
}

/**
 * Login del panel por OTP: ponés el email → te llega un código de 6 dígitos →
 * entrás. Sin contraseñas. Mismo backend que el OTP del inquilino pero contra el
 * modelo Usuario (`/auth/usuario/otp/request` + `/verify`).
 *
 * En modo demo (`NEXT_PUBLIC_API_URL` vacío, GH Pages) no hay backend: el paso
 * de email entra directo, igual que antes, para no romper la demo.
 */
function LoginOtp() {
  const router = useRouter();
  const [paso, setPaso] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [digitos, setDigitos] = useState<string[]>(['', '', '', '', '', '']);
  const [enviando, setEnviando] = useState(false);
  const [verificando, setVerificando] = useState(false);
  const [errorEmail, setErrorEmail] = useState<string | null>(null);
  const [errorOtp, setErrorOtp] = useState<string | null>(null);
  const [cooldownHasta, setCooldownHasta] = useState<number | null>(null);
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);

  /* ----- Paso 1: pedir el código ----- */
  const onSolicitar = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setErrorEmail(null);
    const emailLc = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLc)) {
      setErrorEmail('Ingresá un email válido.');
      return;
    }
    setEnviando(true);
    if (!apiEnabled) {
      // Demo sin backend: entra directo (los datos viven en localStorage).
      router.replace('/');
      return;
    }
    try {
      await apiFetch('/auth/usuario/otp/request', {
        method: 'POST',
        body: JSON.stringify({ email: emailLc }),
      });
      setCooldownHasta(Date.now() + SEGUNDOS_COOLDOWN * 1000);
      setDigitos(['', '', '', '', '', '']);
      setPaso('otp');
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch {
      setErrorEmail('No pudimos enviar el código. Revisá tu conexión y probá de nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  /* ----- Paso 2: tipear / pegar / verificar ----- */
  const onDigito = (idx: number, valor: string) => {
    setErrorOtp(null);
    const limpio = valor.replace(/\D/g, '');
    if (limpio.length > 1) {
      const arr = ['', '', '', '', '', ''];
      for (let i = 0; i < 6 && i < limpio.length; i++) arr[i] = limpio[i] ?? '';
      setDigitos(arr);
      const ultimoLleno = Math.min(5, limpio.length - 1);
      setTimeout(() => otpRefs.current[ultimoLleno]?.focus(), 0);
      if (limpio.length >= 6) setTimeout(() => onVerificar(arr.join('')), 100);
      return;
    }
    const nuevo = [...digitos];
    nuevo[idx] = limpio.slice(-1);
    setDigitos(nuevo);
    if (limpio && idx < 5) setTimeout(() => otpRefs.current[idx + 1]?.focus(), 0);
    if (nuevo.every((d) => d !== '')) setTimeout(() => onVerificar(nuevo.join('')), 100);
  };

  const onKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digitos[idx] && idx > 0) {
      otpRefs.current[idx - 1]?.focus();
      return;
    }
    if (e.key === 'Enter' && digitos.every((d) => d !== '')) {
      e.preventDefault();
      void onVerificar();
    }
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
    const codigo = codigoCompleto ?? digitos.join('');
    if (codigo.length !== 6) {
      setErrorOtp('Faltan dígitos.');
      return;
    }
    setVerificando(true);
    try {
      const r = await apiFetch<{ token: string; nombre: string; rol: string }>(
        '/auth/usuario/otp/verify',
        { method: 'POST', body: JSON.stringify({ email: email.trim().toLowerCase(), code: codigo }) },
      );
      setToken(r.token);
      router.replace('/');
    } catch (err) {
      setErrorOtp(
        err instanceof ApiError && err.status === 401
          ? 'Código inválido o vencido. Pedí uno nuevo.'
          : 'No pudimos verificar. Probá de nuevo.',
      );
      setDigitos(['', '', '', '', '', '']);
      setVerificando(false);
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    }
  };

  const onReenviar = async () => {
    setErrorOtp(null);
    try {
      await apiFetch('/auth/usuario/otp/request', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      setCooldownHasta(Date.now() + SEGUNDOS_COOLDOWN * 1000);
      setDigitos(['', '', '', '', '', '']);
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch {
      setErrorOtp('No pudimos reenviar el código. Probá de nuevo.');
    }
  };

  const volverAlEmail = () => {
    setPaso('email');
    setDigitos(['', '', '', '', '', '']);
    setErrorOtp(null);
  };

  return (
    <div className="w-full space-y-8">
      {paso === 'email' ? (
        <PasoEmail
          email={email}
          setEmail={(v) => {
            setEmail(v);
            if (errorEmail) setErrorEmail(null);
          }}
          error={errorEmail}
          enviando={enviando}
          onSubmit={onSolicitar}
        />
      ) : (
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
      )}

      <p className="text-center text-sm text-muted-foreground">
        ¿No tenés cuenta?{' '}
        <Link href="/registro" className="font-semibold text-primary hover:underline">
          Probar gratis
        </Link>
      </p>
    </div>
  );
}

/* ----- Paso 1: email ----- */
function PasoEmail({
  email,
  setEmail,
  error,
  enviando,
  onSubmit,
}: {
  email: string;
  setEmail: (v: string) => void;
  error: string | null;
  enviando: boolean;
  onSubmit: (e?: React.FormEvent) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Entrá a tu panel
        </h1>
        <p className="text-sm text-muted-foreground">
          Te mandamos un código de 6 dígitos a tu mail. Sin contraseñas.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="vos@tuinmobiliaria.com"
          required
          aria-invalid={!!error}
          aria-describedby={error ? 'email-error' : undefined}
        />
        {error && (
          <p id="email-error" role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>

      <Button type="submit" className="w-full" size="lg" disabled={enviando || !email.trim()}>
        {enviando ? (
          <>
            <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
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
    </form>
  );
}

/* ----- Paso 2: código ----- */
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
    const update = () => setSegundos(Math.max(0, Math.ceil((cooldownHasta - Date.now()) / 1000)));
    update();
    const id = setInterval(update, 250);
    return () => clearInterval(id);
  }, [cooldownHasta]);

  const puedeReenviar = segundos === 0;

  return (
    <div className="space-y-6">
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
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Ingresá el código</h1>
          <p className="text-sm text-muted-foreground">
            Te lo mandamos a{' '}
            <span className="block break-words font-medium text-foreground">{email}</span>
          </p>
        </div>
      </div>

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
            onFocus={(e) => e.currentTarget.select()}
            disabled={verificando}
            aria-invalid={!!error}
            aria-describedby={error ? 'otp-error' : undefined}
            className={`h-14 min-w-0 flex-1 rounded-xl border-2 bg-background text-center text-xl font-bold tabular-nums shadow-sm transition-all focus:outline-none focus:ring-4 disabled:opacity-60 sm:h-16 sm:max-w-[3rem] sm:text-2xl ${
              error
                ? 'border-destructive focus:border-destructive focus:ring-destructive/20'
                : 'focus:border-primary focus:ring-primary/20'
            }`}
          />
        ))}
      </div>

      {error && (
        <p id="otp-error" role="alert" className="text-center text-sm text-destructive">
          {error}
        </p>
      )}

      <Button
        type="button"
        className="w-full"
        size="lg"
        onClick={onVerificar}
        disabled={verificando || digitos.some((d) => d === '')}
      >
        {verificando ? (
          <>
            <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
            Verificando…
          </>
        ) : (
          <>
            <CheckCircle2 className="h-4 w-4" />
            Entrar
          </>
        )}
      </Button>

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
          El código vence a los 10 minutos. {SEGUNDOS_COOLDOWN}s entre reenvíos.
        </p>
      </div>
    </div>
  );
}
