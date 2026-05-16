'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Info,
  Loader2,
  Mail,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@llave/ui/button';
import { Card } from '@llave/ui/card';
import { Input } from '@llave/ui/input';
import { Label } from '@llave/ui/label';
import { toast } from '@llave/ui/use-toast';
import {
  SEGUNDOS_COOLDOWN,
  leerSesion,
  solicitarCodigo,
  verificarCodigo,
} from '@/lib/auth-otp';

type Paso = 'email' | 'otp';

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

  // Si ya hay sesión, redirigir a home (excepto que vengamos con ?force)
  useEffect(() => {
    const sesion = leerSesion();
    if (sesion) {
      const params = new URLSearchParams(window.location.search);
      if (!params.has('force')) router.replace('/');
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

    const r = solicitarCodigo(email);
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
    const r = verificarCodigo(email, codigo);
    if (!r.ok) {
      setErrorOtp(r.motivo ?? 'No pudimos verificar el código.');
      setVerificando(false);
      setDigitos(['', '', '', '', '', '']);
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
      return;
    }
    setVerificando(false);
    toast({
      title: `¡Hola ${r.sesion?.nombre ?? ''}!`,
      description: 'Ingresaste con éxito.',
    });
    router.replace('/');
  };

  const onReenviar = async () => {
    setErrorOtp(null);
    const r = solicitarCodigo(email);
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
  };

  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-gradient-to-br from-primary/10 via-background to-background p-5">
      <div className="w-full max-w-md space-y-5">
        {/* Branding */}
        <div className="text-center space-y-1">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-primary to-purple-600 text-white font-bold text-xl shadow-lg shadow-primary/30">
            L
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Llave</h1>
          <p className="text-sm text-muted-foreground">La app de tu alquiler</p>
        </div>

        <Card className="p-6 space-y-5">
          {paso === 'email' ? (
            <PasoEmail
              email={email}
              setEmail={setEmail}
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
        </Card>

        {/* Banner DEMO con el código generado */}
        {paso === 'otp' && codigoDemo && (
          <Card className="border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-900/10">
            <div className="flex items-start gap-3">
              <Info className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
              <div className="space-y-1 text-xs text-amber-900 dark:text-amber-200">
                <p className="font-semibold">Modo demo</p>
                <p>
                  En producción el código llega por mail. Acá te lo mostramos para
                  que puedas probar el flujo:
                </p>
                <p className="font-mono text-lg font-bold tracking-[0.3em] mt-1">
                  {codigoDemo}
                </p>
              </div>
            </div>
          </Card>
        )}

        <p className="text-center text-xs text-muted-foreground">
          ¿Sos nuevo? Tu inmobiliaria te tiene que invitar primero.
        </p>
      </div>
    </main>
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
  onSubmit,
}: {
  email: string;
  setEmail: (v: string) => void;
  error: string | null;
  enviando: boolean;
  onSubmit: (e?: React.FormEvent) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Entrá a tu cuenta</h2>
        <p className="text-sm text-muted-foreground">
          Te mandamos un código de 6 dígitos a tu mail.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          autoFocus
          inputMode="email"
          placeholder="tu@correo.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={enviando}
          required
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
      <Button
        type="submit"
        size="xl"
        className="w-full"
        disabled={enviando || !email.trim()}
      >
        {enviando ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
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
      <button
        type="button"
        onClick={() => setEmail('mariela.sosa@gmail.com')}
        className="block w-full text-center text-xs text-muted-foreground hover:text-foreground"
      >
        Usar email de demo: mariela.sosa@gmail.com
      </button>
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
    <div className="space-y-4">
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={onVolver}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-md hover:bg-muted text-muted-foreground"
          aria-label="Volver"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h2 className="text-lg font-semibold">Ingresá el código</h2>
          <p className="text-sm text-muted-foreground break-all">
            Te lo mandamos a <span className="font-medium text-foreground">{email}</span>
          </p>
        </div>
      </div>

      <div className="flex gap-2 justify-center">
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
            onChange={(e) => onDigito(idx, e.target.value)}
            onKeyDown={(e) => onKeyDown(idx, e)}
            disabled={verificando}
            className="h-12 w-10 sm:h-14 sm:w-12 rounded-lg border bg-background text-center text-xl font-semibold tabular-nums focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
            aria-label={`Dígito ${idx + 1}`}
          />
        ))}
      </div>

      {error && <p className="text-center text-xs text-destructive">{error}</p>}

      <Button
        type="button"
        size="xl"
        className="w-full"
        onClick={onVerificar}
        disabled={verificando || digitos.some((d) => d === '')}
      >
        {verificando ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Verificando…
          </>
        ) : (
          <>
            <CheckCircle2 className="h-4 w-4" />
            Entrar
          </>
        )}
      </Button>

      <div className="text-center text-xs">
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
            Podés pedir un código nuevo en <strong>{segundos}s</strong>
          </span>
        )}
      </div>

      <p className="text-center text-[11px] text-muted-foreground">
        El código vence a los 5 minutos. Tenés {SEGUNDOS_COOLDOWN}s entre reenvíos.
      </p>
    </div>
  );
}
