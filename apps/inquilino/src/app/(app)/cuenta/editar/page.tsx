'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save } from 'lucide-react';
import { Button } from '@llave/ui/button';
import { Input } from '@llave/ui/input';
import { Label } from '@llave/ui/label';
import { toast } from '@llave/ui/use-toast';
import { NavBar } from '@/components/nav-bar';
import { useCurrentUser } from '@/lib/use-current-user';
import { leerProfile, guardarProfile } from '@/lib/profile-override';

// Antes "Editar tus datos" era un Dialog (modal). En mobile, con teclado
// abierto y 3 campos + validaciones, el modal centrado se cortaba. Ahora es
// una página completa con scroll natural (back-header + form + NavBar).
export default function EditarDatosPage() {
  const router = useRouter();
  const user = useCurrentUser();

  // Valores efectivos iniciales: override guardado > datos del usuario.
  const [fullName, setFullName] = useState(user.fullName ?? '');
  const [phone, setPhone] = useState(user.phone ?? '');
  const [email, setEmail] = useState(user.email ?? '');
  const [guardando, setGuardando] = useState(false);

  // Aplicar el override persistido al montar (client-only).
  useEffect(() => {
    const ov = leerProfile();
    if (ov.fullName) setFullName(ov.fullName);
    if (ov.phone) setPhone(ov.phone);
    if (ov.email) setEmail(ov.email);
  }, []);

  const nombreOk = fullName.trim().length >= 3;
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const telOk = phone.trim().length === 0 || phone.trim().length >= 6;
  const puedeGuardar = nombreOk && emailOk && telOk && !guardando;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!puedeGuardar) return;
    setGuardando(true);
    // Simulación de delay de red.
    await new Promise((r) => setTimeout(r, 350));
    guardarProfile({
      fullName: fullName.trim(),
      phone: phone.trim(),
      email: email.trim(),
    });
    toast({
      title: 'Datos actualizados',
      description: 'Le avisamos a la inmobiliaria con tus nuevos datos.',
    });
    router.push('/cuenta');
  };

  return (
    <>
      <header className="flex items-center gap-3 p-5 md:px-8">
        <Button size="icon" variant="ghost" asChild>
          <Link href="/cuenta" aria-label="Volver a Mi cuenta">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1 min-w-0">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Mi cuenta</p>
          <h1 className="text-xl font-semibold md:text-2xl">Editar tus datos</h1>
        </div>
      </header>

      <main className="flex-1 px-5 pb-40 md:px-8 md:pb-8">
        <p className="text-sm text-muted-foreground">
          Si cambiás algún dato, la inmobiliaria lo recibe automáticamente.
        </p>

        <form onSubmit={submit} className="mt-5 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="nombre">Nombre completo</Label>
            <Input
              id="nombre"
              autoComplete="name"
              autoFocus
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Mariela Sosa"
              maxLength={80}
              className="h-12 text-base"
            />
            {!nombreOk && fullName.length > 0 && (
              <p className="text-xs text-destructive">Mínimo 3 caracteres</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="telefono">Teléfono</Label>
            <Input
              id="telefono"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+54 9 11 1234 5678"
              maxLength={30}
              className="h-12 text-base"
            />
            {!telOk && <p className="text-xs text-destructive">Teléfono inválido</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vos@correo.com"
              maxLength={80}
              className="h-12 text-base"
            />
            {!emailOk && email.length > 0 && (
              <p className="text-xs text-destructive">Email inválido</p>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1" asChild>
              <Link href="/cuenta">Cancelar</Link>
            </Button>
            <Button type="submit" className="flex-1" disabled={!puedeGuardar}>
              <Save className="h-4 w-4" />
              {guardando ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </form>
      </main>

      <NavBar />
    </>
  );
}
