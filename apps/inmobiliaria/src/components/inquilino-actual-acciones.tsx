'use client';

import { useState } from 'react';
import { Mail, Plus, Trash2, UserCheck, UserPlus } from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card } from '@llave/ui/card';
import { ConfirmDialog } from '@llave/ui/confirm-dialog';
import { toast } from '@llave/ui/use-toast';
import { type CoInquilinoExtra, PERMISO_LABEL } from '@/lib/co-inquilinos-extra-storage';
import { useCoInquilinos } from '@/lib/api/use-co-inquilinos';
import { apiEnabled, apiFetch } from '@/lib/api/client';
import { ensureApiSession } from '@/lib/api/session';
import { AgregarCoInquilinoDialog } from './agregar-coinquilino-dialog';
import { EmailBienvenidaDialog } from './email-bienvenida-dialog';

/**
 * Card de acciones para el inquilino actual: ver estado de su cuenta,
 * reenviar invitación, sumar co-inquilinos.
 */
export function InquilinoActualAcciones({
  inquilinoNombre,
  inquilinoEmail,
  propiedadId,
  contratoId,
  direccion,
}: {
  inquilinoNombre: string;
  inquilinoEmail: string;
  propiedadId: string;
  contratoId?: string | null;
  direccion: string;
}) {
  const [reenviarOpen, setReenviarOpen] = useState(false);
  const [agregarOpen, setAgregarOpen] = useState(false);
  const [eliminando, setEliminando] = useState<CoInquilinoExtra | null>(null);
  // Co-inquilinos REALES vía API en prod (tabla CoInquilino); localStorage en demo.
  const { coInquilinos, hidratado, emailRequerido, agregar, eliminar } = useCoInquilinos(
    propiedadId,
    contratoId,
  );

  const onConfirmarEliminar = async () => {
    if (!eliminando) return;
    const co = eliminando;
    setEliminando(null);
    try {
      await eliminar(co);
      toast({
        title: 'Co-inquilino eliminado',
        description: `${co.nombre} ya no tiene acceso a la propiedad.`,
      });
    } catch {
      toast({
        variant: 'destructive',
        title: 'No se pudo eliminar',
        description: 'Intentá de nuevo.',
      });
    }
  };

  return (
    <>
      {/* Bloque de acciones sobre el inquilino actual */}
      <Card className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge variant="success" className="gap-1 text-[10px]">
              <UserCheck className="h-3 w-3" />
              Cuenta activa
            </Badge>
            <span className="text-xs text-muted-foreground">
              {inquilinoEmail}
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setReenviarOpen(true)}
            disabled={apiEnabled && !inquilinoEmail}
            title={apiEnabled && !inquilinoEmail ? 'El inquilino no tiene un email cargado' : undefined}
          >
            <Mail className="h-3.5 w-3.5" />
            Reenviar email de bienvenida
          </Button>
        </div>
      </Card>

      {/* Sección Co-inquilinos */}
      <Card className="space-y-4 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">Co-inquilinos</h3>
            <p className="text-xs text-muted-foreground">
              Personas que conviven con {inquilinoNombre.split(' ')[0]} con acceso propio a la app.
            </p>
          </div>
          <Button size="sm" onClick={() => setAgregarOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            Sumar
          </Button>
        </div>

        {hidratado && coInquilinos.length === 0 ? (
          <div className="rounded-md border border-dashed bg-muted/20 p-6 text-center">
            <UserPlus className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-2 text-sm font-medium">Sin co-inquilinos cargados</p>
            <p className="text-xs text-muted-foreground">
              Sumá pareja, familia o quien convive en la propiedad.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {coInquilinos.map((c) => (
              <CoInquilinoRow
                key={c.id}
                co={c}
                direccion={direccion}
                onDelete={() => setEliminando(c)}
              />
            ))}
          </div>
        )}
      </Card>

      {/* Dialogs */}
      <EmailBienvenidaDialog
        open={reenviarOpen}
        onOpenChange={setReenviarOpen}
        destinatario={{ nombre: inquilinoNombre, email: inquilinoEmail }}
        propiedad={direccion}
        modo="recordatorio"
        // Prod: reenvío REAL vía backend (POST /contratos/:id/reenviar-bienvenida).
        // En demo o sin contratoId no se pasa → el dialog simula como antes.
        onEnviarReal={
          apiEnabled && contratoId
            ? async () => {
                await ensureApiSession();
                await apiFetch(`/contratos/${contratoId}/reenviar-bienvenida`, { method: 'POST' });
              }
            : undefined
        }
      />
      <AgregarCoInquilinoDialog
        propiedadId={propiedadId}
        contratoId={contratoId ?? null}
        inquilinoPrincipal={inquilinoNombre}
        emailRequerido={emailRequerido}
        onAgregar={agregar}
        open={agregarOpen}
        onOpenChange={setAgregarOpen}
      />
      <ConfirmDialog
        open={!!eliminando}
        onOpenChange={(o) => !o && setEliminando(null)}
        title={`¿Sacar a ${eliminando?.nombre} ${eliminando?.apellido}?`}
        description="Pierde el acceso a la app inmediatamente. Lo podés volver a sumar cuando quieras."
        confirmLabel="Sí, sacarlo"
        variant="destructive"
        onConfirm={onConfirmarEliminar}
      />
    </>
  );
}

/* ============================================================
 * Fila de un co-inquilino con acciones
 * ============================================================ */
function CoInquilinoRow({
  co,
  direccion,
  onDelete,
}: {
  co: CoInquilinoExtra;
  direccion: string;
  onDelete: () => void;
}) {
  const [reenviarOpen, setReenviarOpen] = useState(false);

  return (
    <>
      <div className="flex items-start gap-3 rounded-md border bg-muted/20 p-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
          {co.nombre.charAt(0)}
          {co.apellido.charAt(0)}
        </div>
        <div className="flex-1 min-w-0 space-y-0.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="truncate text-sm font-medium">
              {co.nombre} {co.apellido}
            </p>
            {co.estado === 'PENDIENTE_ACTIVACION' ? (
              <Badge variant="warning" className="text-[10px]">
                Pendiente
              </Badge>
            ) : (
              <Badge variant="success" className="text-[10px]">
                Activo
              </Badge>
            )}
            <Badge variant="outline" className="text-[10px]">
              {PERMISO_LABEL[co.permiso]}
            </Badge>
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {co.relacion} · 💬 {co.celular}
            {co.email ? ` · ${co.email}` : ''}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {co.email && (
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setReenviarOpen(true)}
              aria-label="Reenviar email"
            >
              <Mail className="h-4 w-4" />
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            onClick={onDelete}
            aria-label="Eliminar"
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>

      {co.email && (
        <EmailBienvenidaDialog
          open={reenviarOpen}
          onOpenChange={setReenviarOpen}
          destinatario={{ nombre: `${co.nombre} ${co.apellido}`, email: co.email }}
          propiedad={direccion}
          modo={co.estado === 'PENDIENTE_ACTIVACION' ? 'recordatorio' : 'bienvenida'}
        />
      )}
    </>
  );
}
