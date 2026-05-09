'use client';

import { SignIn } from '@clerk/nextjs';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@llave/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@llave/ui/card';
import { Input } from '@llave/ui/input';
import { Label } from '@llave/ui/label';
import { isClerkEnabled } from '@/lib/auth';

export default function LoginPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-10">
      <div className="mb-8 flex flex-col items-center gap-3">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary text-2xl font-bold text-primary-foreground">
          L
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-semibold">Llave</h1>
          <p className="text-sm text-muted-foreground">Alquilar tranquilo, cobrar tranquilo.</p>
        </div>
      </div>

      {isClerkEnabled() ? (
        <SignIn
          path="/login"
          routing="path"
          signUpUrl="/login"
          appearance={{
            elements: {
              rootBox: 'w-full',
              card: 'shadow-none border-none p-0',
              header: 'hidden',
              formButtonPrimary: 'h-14 text-base',
            },
          }}
        />
      ) : (
        <MockLogin />
      )}

      <p className="mt-6 text-center text-xs text-muted-foreground">
        {isClerkEnabled()
          ? 'Auth: Clerk · OTP por SMS interim hasta que conectemos WhatsApp Cloud (Sprint 3).'
          : 'Mock — pegá NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY en .env.local para activar Clerk real.'}
      </p>
    </main>
  );
}

type Step = 'phone' | 'otp';

function MockLogin() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('phone');
  const [telefono, setTelefono] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);

  const enviarOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await new Promise((r) => setTimeout(r, 600));
    setLoading(false);
    setStep('otp');
  };

  const verificarOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await new Promise((r) => setTimeout(r, 600));
    setLoading(false);
    router.push('/');
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{step === 'phone' ? 'Ingresá tu número' : 'Revisá tu WhatsApp'}</CardTitle>
        <CardDescription>
          {step === 'phone'
            ? 'Te mandamos un código por WhatsApp.'
            : `Mandamos un código a ${telefono}.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {step === 'phone' ? (
          <form onSubmit={enviarOtp} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Número</Label>
              <Input
                id="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="+54 9 11 1234 5678"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                required
              />
            </div>
            <Button type="submit" size="xl" className="w-full" disabled={!telefono || loading}>
              {loading ? 'Enviando…' : 'Enviar código'}
            </Button>
          </form>
        ) : (
          <form onSubmit={verificarOtp} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="otp">Código de 6 dígitos</Label>
              <Input
                id="otp"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                placeholder="123456"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                required
              />
            </div>
            <Button type="submit" size="xl" className="w-full" disabled={otp.length < 6 || loading}>
              {loading ? 'Verificando…' : 'Entrar'}
            </Button>
            <button
              type="button"
              className="block w-full text-center text-sm text-muted-foreground hover:text-foreground"
              onClick={() => setStep('phone')}
            >
              Cambiar número
            </button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
