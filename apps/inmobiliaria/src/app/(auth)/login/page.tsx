'use client';

import { SignIn } from '@clerk/nextjs';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@llave/ui/button';
import { Input } from '@llave/ui/input';
import { Label } from '@llave/ui/label';
import { AuthShell } from '@/components/auth-shell';
import { isClerkEnabled } from '@/lib/auth';
import { apiEnabled, apiFetch, setToken, ApiError } from '@/lib/api/client';

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
        <LoginForm />
      )}
    </AuthShell>
  );
}

/**
 * Login real contra el API (email + password → JWT). En modo demo
 * (`NEXT_PUBLIC_API_URL` vacío) no hay backend: deja pasar para que la demo
 * de GH Pages siga funcionando con localStorage.
 */
function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (!apiEnabled) {
        // Demo sin backend: entra directo (los datos vienen de localStorage).
        router.replace('/');
        return;
      }
      const r = await apiFetch<{ token: string; nombre: string; rol: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim().toLowerCase(), password: pass }),
      });
      setToken(r.token);
      router.replace('/');
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 401
          ? 'Email o contraseña incorrectos.'
          : 'No se pudo entrar. Revisá tu conexión y probá de nuevo.',
      );
      setLoading(false);
    }
  };

  return (
    <div className="w-full space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Entrá a tu panel
        </h1>
        <p className="text-sm text-muted-foreground">Usá tu mail y contraseña.</p>
      </div>

      <form onSubmit={submit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="vos@tuinmobiliaria.com"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pass">Contraseña</Label>
          <Input
            id="pass"
            type="password"
            autoComplete="current-password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            required
          />
        </div>
        {error && (
          <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" size="lg" disabled={!email || !pass || loading}>
          {loading ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        ¿No tenés cuenta?{' '}
        <Link href="/registro" className="font-semibold text-primary hover:underline">
          Probar gratis
        </Link>
      </p>
    </div>
  );
}
