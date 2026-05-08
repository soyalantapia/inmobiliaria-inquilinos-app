'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@llave/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@llave/ui/card';
import { Input } from '@llave/ui/input';
import { Label } from '@llave/ui/label';

type Step = 'phone' | 'otp';

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('phone');
  const [telefono, setTelefono] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);

  const enviarOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // mock: en Sprint 3 esto llama a /api/auth/otp/send (WhatsApp Cloud)
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

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Mock de OTP — Sprint 3 lo conecta a WhatsApp Cloud API.
      </p>
    </main>
  );
}
