'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@llave/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@llave/ui/card';
import { Input } from '@llave/ui/input';
import { Label } from '@llave/ui/label';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await new Promise((r) => setTimeout(r, 600));
    setLoading(false);
    router.push('/');
  };

  return (
    <main className="grid min-h-screen place-items-center px-6">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-md bg-primary font-bold text-primary-foreground">
            L
          </div>
          <div>
            <p className="font-semibold">Llave</p>
            <p className="text-xs text-muted-foreground">Panel inmobiliaria</p>
          </div>
        </div>

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
                  placeholder="roberto@inmosol.com.ar"
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
              <Button type="submit" className="w-full" size="lg" disabled={!email || !pass || loading}>
                {loading ? 'Entrando…' : 'Entrar'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Mock — Sprint 0 lo reemplaza por Clerk.
        </p>
      </div>
    </main>
  );
}
