'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus } from 'lucide-react';
import { Button } from '@llave/ui/button';
import { Input } from '@llave/ui/input';
import { Label } from '@llave/ui/label';
import { cn } from '@llave/ui/cn';
import { toast } from '@llave/ui/use-toast';
import { NavBar } from '@/components/nav-bar';
import {
  type PermisoCoInquilino,
  invitarCoInquilino,
  permisoDescripcion,
  permisoLabel,
} from '@/lib/co-inquilinos-storage';

// Antes el formulario de invitación vivía en un Dialog (modal centrado). En
// mobile, con 5 campos + permisos + acciones, el modal se pasaba del alto del
// viewport y se cortaba (no se llegaba a los botones). Ahora es una página
// completa con scroll natural — patrón de las demás pantallas-formulario
// (back-header + main + NavBar). No se rompe en ningún teléfono.
export default function InvitarCoInquilinoPage() {
  const router = useRouter();
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [relacion, setRelacion] = useState('Pareja');
  const [permiso, setPermiso] = useState<PermisoCoInquilino>('PAGAR');

  const enviar = () => {
    if (!nombre.trim() || !email.trim()) {
      toast({ title: 'Faltan nombre y email', variant: 'destructive' });
      return;
    }
    invitarCoInquilino({
      nombre: nombre.trim(),
      email: email.trim(),
      telefono: telefono.trim() || null,
      relacion,
      permiso,
    });
    toast({
      title: 'Invitación enviada',
      description: `Le mandamos un mail a ${email.trim()}`,
    });
    router.push('/co-inquilinos');
  };

  return (
    <>
      <header className="flex items-center gap-3 p-5 md:px-8">
        <Button size="icon" variant="ghost" asChild>
          <Link href="/co-inquilinos" aria-label="Volver a Co-inquilinos">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1 min-w-0">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Co-inquilinos</p>
          <h1 className="text-xl font-semibold md:text-2xl">Invitar a alguien</h1>
        </div>
      </header>

      <main className="flex-1 px-5 pb-40 md:px-8 md:pb-8">
        <p className="text-sm text-muted-foreground">
          Le mandamos un mail con un link para que active su acceso.
        </p>

        <form onSubmit={(e) => { e.preventDefault(); enviar(); }} className="mt-5 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ci-nombre">Nombre</Label>
            <Input
              id="ci-nombre"
              autoComplete="name"
              autoFocus
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Sofía García"
              className="h-12 text-base"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ci-email">Email</Label>
            <Input
              id="ci-email"
              type="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="sofia@ejemplo.com"
              className="h-12 text-base"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ci-tel">Teléfono (opcional)</Label>
            <Input
              id="ci-tel"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="+54 9 11 …"
              className="h-12 text-base"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ci-relacion">Relación</Label>
            <select
              id="ci-relacion"
              value={relacion}
              onChange={(e) => setRelacion(e.target.value)}
              className="h-12 w-full rounded-md border bg-background px-3 text-base"
            >
              <option>Pareja</option>
              <option>Hermano/a</option>
              <option>Amigo/a</option>
              <option>Familiar</option>
              <option>Otro</option>
            </select>
          </div>

          <div role="group" aria-labelledby="ci-permisos-label" className="space-y-1.5">
            <p id="ci-permisos-label" className="text-sm font-medium leading-none">
              Permisos
            </p>
            <div className="grid grid-cols-3 gap-2">
              {(['VER', 'PAGAR', 'COMPLETO'] as PermisoCoInquilino[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  aria-pressed={permiso === p}
                  onClick={() => setPermiso(p)}
                  className={cn(
                    'rounded-md border px-2 py-3 text-xs font-medium transition-colors',
                    permiso === p
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:bg-muted/40',
                  )}
                >
                  {permisoLabel[p]}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{permisoDescripcion[permiso]}</p>
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1" asChild>
              <Link href="/co-inquilinos">Cancelar</Link>
            </Button>
            <Button type="submit" className="flex-1">
              <Plus className="h-4 w-4" />
              Enviar invitación
            </Button>
          </div>
        </form>
      </main>

      <NavBar />
    </>
  );
}
