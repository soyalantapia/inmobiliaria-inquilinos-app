'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Copy,
  Loader2,
  Mail,
  Phone,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card } from '@llave/ui/card';
import { cn } from '@llave/ui/cn';
import { ConfirmDialog } from '@llave/ui/confirm-dialog';
import { toast } from '@llave/ui/use-toast';
import { NavBar } from '@/components/nav-bar';
import {
  type CoInquilino,
  type PermisoCoInquilino,
  permisoDescripcion,
  permisoLabel,
} from '@/lib/co-inquilinos-storage';
import { useCoInquilinos } from '@/lib/api/use-coinquilinos';
import { apiEnabled } from '@/lib/api/client';
import { formatFecha } from '@/lib/format';

export default function CoInquilinosPage() {
  const { coInquilinos, cargando, deApi, aceptar, cambiarPermiso, eliminar, regenerarLink } =
    useCoInquilinos();
  const [eliminando, setEliminando] = useState<CoInquilino | null>(null);

  const handleAceptar = async (id: string) => {
    try {
      await aceptar(id);
      toast({ title: deApi ? 'Invitación aceptada' : 'Aceptado (simulación)' });
    } catch {
      toast({
        title: 'No se pudo aceptar',
        description: 'La aceptación real llega por el link que le enviamos.',
        variant: 'destructive',
      });
    }
  };

  const handleEliminar = async () => {
    if (!eliminando) return;
    const co = eliminando;
    setEliminando(null);
    try {
      await eliminar(co.id);
      toast({ title: 'Removido' });
    } catch {
      toast({ title: 'No se pudo remover', variant: 'destructive' });
    }
  };

  const handleCambiarPermiso = async (id: string, p: PermisoCoInquilino) => {
    try {
      await cambiarPermiso(id, p);
      toast({ title: 'Permiso actualizado' });
    } catch {
      toast({ title: 'No se pudo actualizar el permiso', variant: 'destructive' });
    }
  };

  const handleCompartir = async (id: string) => {
    try {
      const tk = await regenerarLink(id);
      if (!tk) return;
      const url = `${window.location.origin}/invitacion/${tk}`;
      try {
        await navigator.clipboard.writeText(url);
        toast({ title: 'Link copiado', description: 'Pegáselo a tu co-inquilino para que entre.' });
      } catch {
        toast({ title: 'Tu link de invitación', description: url });
      }
    } catch {
      toast({ title: 'No se pudo generar el link', variant: 'destructive' });
    }
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
          <h1 className="text-xl font-semibold md:text-2xl">Co-inquilinos</h1>
        </div>
      </header>

      <main className="flex-1 space-y-5 px-5 pb-36 md:px-8 md:pb-6">
        <Card className="space-y-2 border-primary/20 bg-primary/5 p-4">
          <div className="flex items-start gap-3">
            <Users className="mt-0.5 h-4 w-4 text-primary" />
            <div className="text-xs">
              <p className="font-medium">Compartí tu contrato con quien vive con vos</p>
              <p className="text-muted-foreground">
                Tu pareja, hermano o amigo pueden ver el contrato, los pagos y hasta informar
                pagos en su nombre — sin tener que pasarte siempre los datos.
              </p>
            </div>
          </div>
        </Card>

        {/* Barra de acción: en mobile queda FIJA abajo (arriba de la NavBar);
            en desktop vuelve a ser inline. */}
        <div className="fixed inset-x-0 bottom-16 z-20 border-t bg-background/95 px-5 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:static md:inset-x-auto md:bottom-auto md:z-auto md:border-0 md:bg-transparent md:px-0 md:py-0 md:backdrop-blur-none">
          <Button className="w-full" asChild>
            <Link href="/co-inquilinos/invitar">
              <UserPlus className="h-4 w-4" />
              Invitar a alguien
            </Link>
          </Button>
        </div>

        {cargando ? (
          <Card className="p-8 text-center">
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-muted-foreground/50" />
            <p className="mt-2 text-sm font-medium">Cargando co-inquilinos…</p>
          </Card>
        ) : coInquilinos.length === 0 ? (
          <Card className="p-8 text-center">
            <Users className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <p className="mt-2 text-sm font-medium">Todavía no invitaste a nadie</p>
            <p className="text-xs text-muted-foreground">
              Cuando agregues a alguien, va a aparecer acá.
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {coInquilinos.map((c) => (
              <CoInquilinoCard
                key={c.id}
                co={c}
                onAceptar={() => handleAceptar(c.id)}
                onCompartir={() => handleCompartir(c.id)}
                onEliminar={() => setEliminando(c)}
                onCambiarPermiso={(p) => handleCambiarPermiso(c.id, p)}
              />
            ))}
          </div>
        )}
      </main>

      <NavBar />

      <ConfirmDialog
        open={!!eliminando}
        onOpenChange={(o) => !o && setEliminando(null)}
        title={`¿Sacar a ${eliminando?.nombre}?`}
        description="Va a dejar de poder ver tu contrato."
        confirmLabel="Sacar acceso"
        variant="destructive"
        onConfirm={handleEliminar}
      />
    </>
  );
}

function CoInquilinoCard({
  co,
  onAceptar,
  onCompartir,
  onEliminar,
  onCambiarPermiso,
}: {
  co: CoInquilino;
  onAceptar: () => void;
  onCompartir: () => void;
  onEliminar: () => void;
  onCambiarPermiso: (p: PermisoCoInquilino) => void;
}) {
  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
          {co.nombre.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate font-medium">{co.nombre}</p>
            {co.estado === 'ACEPTADO' ? (
              <Badge variant="success" className="h-5 px-1.5 text-[10px]">
                Activo
              </Badge>
            ) : (
              <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                Pendiente
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{co.relacion}</p>
        </div>
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onEliminar} aria-label={`Eliminar co-inquilino ${co.nombre}`}>
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </Button>
      </div>

      <div className="space-y-1 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Mail className="h-3 w-3" />
          <span className="truncate">{co.email}</span>
        </div>
        {co.telefono && (
          <div className="flex items-center gap-1.5">
            <Phone className="h-3 w-3" />
            <span>{co.telefono}</span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          {co.estado === 'ACEPTADO' ? (
            <>
              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
              <span>
                Aceptó el {co.aceptadoAt ? formatFecha(co.aceptadoAt) : '—'}
              </span>
            </>
          ) : (
            <>
              <Clock className="h-3 w-3" />
              <span>Invitado el {formatFecha(co.invitadoAt)}</span>
            </>
          )}
        </div>
      </div>

      {/* Permisos */}
      <div role="group" aria-labelledby={`ci-card-permisos-${co.id}`} className="space-y-2 rounded-md border bg-muted/30 p-3">
        <p id={`ci-card-permisos-${co.id}`} className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Permisos
        </p>
        <div className="grid grid-cols-3 gap-2">
          {(['VER', 'PAGAR', 'COMPLETO'] as PermisoCoInquilino[]).map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={co.permiso === p}
              // No re-disparamos la API si ya es el permiso actual (evita un
              // cambio "accidental" / llamada redundante por re-tap en mobile).
              onClick={() => co.permiso !== p && onCambiarPermiso(p)}
              className={cn(
                'min-h-[40px] rounded-md border px-2 py-2 text-xs font-medium transition-colors',
                co.permiso === p
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border hover:bg-muted/40',
              )}
            >
              {permisoLabel[p]}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground">{permisoDescripcion[co.permiso]}</p>
      </div>

      {/* Atajo demo: en prod (apiEnabled) la aceptación la hace el co-inquilino
          desde su propio flujo (link de invitación), así que no se muestra. */}
      {co.estado === 'PENDIENTE' && !apiEnabled && (
        <Button size="sm" variant="outline" className="w-full" onClick={onAceptar}>
          Simular que aceptó la invitación
        </Button>
      )}

      {/* Prod: el titular recupera/recomparte el link de invitación. */}
      {co.estado === 'PENDIENTE' && apiEnabled && (
        <Button size="sm" variant="outline" className="w-full" onClick={onCompartir}>
          <Copy className="h-3.5 w-3.5" /> Copiar link de invitación
        </Button>
      )}
    </Card>
  );
}
