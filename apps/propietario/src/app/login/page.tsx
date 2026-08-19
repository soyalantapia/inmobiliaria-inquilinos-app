'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, KeyRound, Loader2, Mail, Sparkles } from 'lucide-react';
import { Button } from '@llave/ui/button';
import { Card } from '@llave/ui/card';
import { Input } from '@llave/ui/input';
import { API_URL, ApiError, apiEnabled, demoEnabled, guardarSesion, type SesionPropietario } from '@/lib/api';
import { CARTERA_DEMO, SESION_DEMO, TOKEN_DEMO } from '@/lib/demo-data';

/**
 * Login del propietario: email → código de 6 dígitos → adentro.
 *
 * No hay contraseña ni registro: al propietario lo dio de alta su inmobiliaria, y el email con
 * el que lo cargaron ES la credencial. Por eso el paso 1 responde siempre lo mismo, exista o no
 * el email — si dijera "ese no está" cualquiera podría averiguar quién es cliente de quién.
 */
export default function LoginPropietario() {
  const router = useRouter();
  const [paso, setPaso] = useState<'email' | 'codigo'>('email');
  const [email, setEmail] = useState('');
  const [codigo, setCodigo] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sin servidor Y sin demo: el mensaje honesto de siempre. La demo del sitio estático sí
  // entra, y recorre los dos pasos reales (email → código) en vez de saltearlos: lo que se
  // muestra es el login que existe, no un atajo que no existe.
  if (!apiEnabled && !demoEnabled) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-6">
        <Card className="space-y-2 p-6 text-center">
          <p className="font-medium">El portal no está conectado</p>
          <p className="text-sm text-muted-foreground">
            Falta configurar la dirección del servidor. Avisale a tu inmobiliaria.
          </p>
        </Card>
      </main>
    );
  }

  const pedirCodigo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cargando) return;
    setCargando(true);
    setError(null);
    try {
      if (demoEnabled) {
        setPaso('codigo');
        return;
      }
      const res = await fetch(`${API_URL}/auth/propietario/otp/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      if (!res.ok) throw new ApiError('No pudimos mandar el código. Probá de nuevo.', res.status);
      setPaso('codigo');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No pudimos conectar. Revisá tu conexión.');
    } finally {
      setCargando(false);
    }
  };

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cargando) return;
    setCargando(true);
    setError(null);
    try {
      if (demoEnabled) {
        // Cualquier código de 6 dígitos entra: no hay servidor que lo haya emitido, y pedir
        // uno "correcto" sería inventar un secreto que la demo tendría que soplar igual.
        guardarSesion(TOKEN_DEMO, SESION_DEMO);
        router.replace('/');
        return;
      }
      const res = await fetch(`${API_URL}/auth/propietario/otp/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), code: codigo.trim() }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        token?: string;
        message?: string;
      } & SesionPropietario;
      if (!res.ok || !body.token) {
        throw new ApiError(body.message ?? 'El código no es correcto o ya venció.', res.status);
      }
      guardarSesion(body.token, {
        nombre: body.nombre,
        inmobiliaria: body.inmobiliaria,
        carteras: body.carteras ?? [],
      });
      router.replace('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No pudimos conectar. Revisá tu conexión.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-6">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-semibold">My Alquiler</h1>
        <p className="text-sm text-muted-foreground">El portal de tus propiedades</p>
      </div>

      <Card className="space-y-4 p-6">
        {paso === 'email' ? (
          <form onSubmit={pedirCodigo} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium">
                Tu email
              </label>
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                placeholder="vos@correo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                El mismo que le diste a tu inmobiliaria. Te mandamos un código de 6 dígitos.
              </p>
            </div>
            <Button type="submit" className="w-full" disabled={cargando || email.trim().length === 0}>
              {cargando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              Recibir código
              <ArrowRight className="h-4 w-4" />
            </Button>
            {demoEnabled && (
              // Mismo gesto que la PWA: sin este botón, quien entra a la demo no tiene forma
              // de adivinar qué email "existe", y el portal se ve roto sin estarlo.
              <button
                type="button"
                onClick={() => setEmail(CARTERA_DEMO.email)}
                className="flex w-full items-center justify-center gap-2 rounded-full border border-dashed border-primary/40 bg-primary/5 px-3 py-2 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Probar con cuenta demo (Silvana Morales)
              </button>
            )}
          </form>
        ) : (
          <form onSubmit={entrar} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="codigo" className="text-sm font-medium">
                El código que te mandamos
              </label>
              <Input
                id="codigo"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="123456"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
                className="text-center text-2xl tracking-[0.4em]"
              />
              {/* Decimos a dónde fue, porque si el email estaba mal el código no llega nunca y
                  sin esto la persona se queda esperando sin entender. */}
              {demoEnabled ? (
                // En la demo no salió ningún mail. Decir "lo mandamos a tu casilla" dejaría a
                // la persona esperando un código que no existe, que es el mismo problema que
                // este texto vino a resolver del lado real.
                <p className="text-xs text-muted-foreground">
                  Esto es una demo: no se mandó ningún mail. Poné <strong>cualquier</strong> código de 6 dígitos y
                  entrás.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Lo mandamos a <strong>{email.trim().toLowerCase()}</strong>. Vence en 10 minutos.
                </p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={cargando || codigo.length !== 6}>
              {cargando ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              Entrar
            </Button>
            <button
              type="button"
              onClick={() => {
                setPaso('email');
                setCodigo('');
                setError(null);
              }}
              className="w-full text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              Usar otro email
            </button>
          </form>
        )}

        {error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">{error}</p>
        )}
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        ¿No te llega el código? Tu inmobiliaria tiene que tener cargado este email.
      </p>
    </main>
  );
}
