'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, Copy, Loader2, Plus, Share2 } from 'lucide-react';
import { Button } from '@llave/ui/button';
import { Input } from '@llave/ui/input';
import { Label } from '@llave/ui/label';
import { cn } from '@llave/ui/cn';
import { toast } from '@llave/ui/use-toast';
import { NavBar } from '@/components/nav-bar';
import {
  type PermisoCoInquilino,
  permisoDescripcion,
  permisoLabel,
} from '@/lib/co-inquilinos-storage';
import { ApiError } from '@/lib/api/client';
import { useCoInquilinos } from '@/lib/api/use-coinquilinos';

// Antes el formulario de invitación vivía en un Dialog (modal centrado). En
// mobile, con 5 campos + permisos + acciones, el modal se pasaba del alto del
// viewport y se cortaba (no se llegaba a los botones). Ahora es una página
// completa con scroll natural — patrón de las demás pantallas-formulario
// (back-header + main + NavBar). No se rompe en ningún teléfono.
export default function InvitarCoInquilinoPage() {
  const router = useRouter();
  const { invitar } = useCoInquilinos();
  const [nombre, setNombre] = useState('');
  const [dni, setDni] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [relacion, setRelacion] = useState('Pareja');
  const [relacionOtro, setRelacionOtro] = useState('');
  const [permiso, setPermiso] = useState<PermisoCoInquilino>('PAGAR');
  const [enviando, setEnviando] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  const copiar = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      toast({ title: 'No pudimos copiar', description: 'Copialo manualmente.', variant: 'destructive' });
    }
  };
  const waUrl = link
    ? `https://wa.me/?text=${encodeURIComponent(`Te sumé al contrato en My Alquiler. Entrá con este link: ${link}`)}`
    : null;

  const enviar = async () => {
    if (enviando) return;
    const dniLimpio = dni.replace(/\D/g, '');
    if (!nombre.trim() || !email.trim()) {
      toast({ title: 'Faltan nombre y email', variant: 'destructive' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast({ title: 'Email inválido', variant: 'destructive' });
      return;
    }
    if (dniLimpio.length < 7 || dniLimpio.length > 8) {
      toast({
        title: 'Revisá el DNI',
        description: 'Tiene que tener 7 u 8 números.',
        variant: 'destructive',
      });
      return;
    }
    if (telefono.replace(/[^\d]/g, '').length < 8) {
      toast({
        title: 'Teléfono inválido',
        description: 'Mínimo 8 dígitos, con código de área.',
        variant: 'destructive',
      });
      return;
    }
    if (relacion === 'Otro' && !relacionOtro.trim()) {
      toast({ title: 'Aclará la relación', variant: 'destructive' });
      return;
    }
    const emailLimpio = email.trim();
    setEnviando(true);
    try {
      const tk = await invitar({
        nombre: nombre.trim(),
        dni: dniLimpio,
        email: emailLimpio,
        telefono: telefono.trim(),
        relacion: relacion === 'Otro' ? relacionOtro.trim() : relacion,
        permiso,
      });
      if (tk) {
        // El backend devuelve el token; armamos el link para que el titular lo
        // comparta (no se manda mail automático).
        setLink(`${window.location.origin}/invitacion/${tk}`);
        setEnviando(false);
        return;
      }
      // Demo sin backend: no hay link real para compartir.
      toast({ title: 'Invitación creada', description: `Para ${emailLimpio}` });
      router.push('/co-inquilinos');
    } catch (err) {
      // El API responde 409 si ya invitaste a alguien con ese email.
      toast({
        title: 'No se pudo enviar la invitación',
        description:
          err instanceof ApiError ? err.message : 'Revisá los datos e intentá de nuevo.',
        variant: 'destructive',
      });
      setEnviando(false);
    }
  };

  if (link) {
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
            <h1 className="text-xl font-semibold md:text-2xl">Invitación lista</h1>
          </div>
        </header>

        <main className="flex-1 px-5 pb-44 md:px-8 md:pb-8">
          <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-4">
            <Check className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <p className="text-sm">
              Compartile este link a <span className="font-medium">{nombre.trim()}</span>. Cuando lo
              abra y acepte, entra al contrato con el acceso que le diste.
            </p>
          </div>

          <div className="mt-4 space-y-1.5">
            <Label>Link de invitación</Label>
            <div className="flex gap-2">
              <Input
                readOnly
                value={link}
                onFocus={(e) => e.currentTarget.select()}
                className="h-12 text-sm"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-12 w-12 shrink-0"
                onClick={copiar}
                aria-label="Copiar link"
              >
                {copiado ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">El link vence en 7 días.</p>
          </div>

          <div className="mt-5 flex flex-col gap-2">
            {waUrl && (
              <Button asChild className="w-full">
                <a href={waUrl} target="_blank" rel="noopener noreferrer">
                  <Share2 className="h-4 w-4" /> Compartir por WhatsApp
                </a>
              </Button>
            )}
            <Button variant="outline" className="w-full" asChild>
              <Link href="/co-inquilinos">Listo</Link>
            </Button>
          </div>
        </main>

        <NavBar />
      </>
    );
  }

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

      <main className="flex-1 px-5 pb-44 md:px-8 md:pb-8">
        <p className="text-sm text-muted-foreground">
          Le generamos un link para que actives su acceso. Se lo compartís vos (WhatsApp, mail, lo que quieras).
        </p>

        <form onSubmit={(e) => { e.preventDefault(); void enviar(); }} className="mt-5 space-y-4">
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
            <Label htmlFor="ci-dni">DNI</Label>
            <Input
              id="ci-dni"
              inputMode="numeric"
              value={dni}
              onChange={(e) => setDni(e.target.value)}
              placeholder="Ej: 30123456"
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
            <Label htmlFor="ci-tel">Teléfono</Label>
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

          {relacion === 'Otro' && (
            <div className="space-y-1.5">
              <Label htmlFor="ci-relacion-otro">¿Cuál?</Label>
              <Input
                id="ci-relacion-otro"
                value={relacionOtro}
                onChange={(e) => setRelacionOtro(e.target.value)}
                placeholder="Ej: tío, compañero de trabajo…"
                className="h-12 text-base"
                autoFocus
              />
            </div>
          )}

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

          {/* Barra de acciones: en mobile flota fija abajo (arriba de la NavBar)
              con sombra hacia arriba que indica que el contenido scrollea detrás;
              en desktop vuelve a ser inline. */}
          <div className="fixed inset-x-0 bottom-16 z-20 flex gap-2 border-t bg-background/95 px-5 py-3 shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.18)] backdrop-blur supports-[backdrop-filter]:bg-background/80 md:static md:z-auto md:border-0 md:bg-transparent md:px-0 md:py-0 md:pt-2 md:shadow-none md:backdrop-blur-none">
            <Button type="button" variant="outline" className="flex-1" asChild>
              <Link href="/co-inquilinos">Cancelar</Link>
            </Button>
            <Button type="submit" className="flex-1" disabled={enviando}>
              {enviando ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {enviando ? 'Enviando…' : 'Enviar invitación'}
            </Button>
          </div>
        </form>
      </main>

      <NavBar />
    </>
  );
}
