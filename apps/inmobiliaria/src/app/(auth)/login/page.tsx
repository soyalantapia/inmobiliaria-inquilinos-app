'use client';

import { SignIn } from '@clerk/nextjs';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@llave/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@llave/ui/card';
import { Input } from '@llave/ui/input';
import { Label } from '@llave/ui/label';
import { isClerkEnabled } from '@/lib/auth';
import { apiEnabled, apiFetch, setToken, ApiError } from '@/lib/api/client';

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center px-6">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
            My
          </div>
          <div>
            <p className="font-semibold">My Alquiler</p>
            <p className="text-xs text-muted-foreground">Panel inmobiliaria</p>
          </div>
        </div>

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
      </div>
    </main>
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
    <Card>
      <CardHeader>
        <CardTitle>Entrar</CardTitle>
        <CardDescription>Usá tu mail y contraseña.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
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
            <p className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" size="lg" disabled={!email || !pass || loading}>
            {loading ? 'Entrando…' : 'Entrar'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
