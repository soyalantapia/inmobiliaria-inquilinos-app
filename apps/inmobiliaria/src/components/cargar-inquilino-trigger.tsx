'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, UserPlus } from 'lucide-react';
import { Button } from '@llave/ui/button';
import {
  type InquilinoInvitado,
  invitadosDePropiedad,
} from '@/lib/inquilinos-invitados-storage';
import { CargarInquilinoWizard } from './cargar-inquilino-wizard';

/**
 * Trigger client-side para abrir el wizard de cargar inquilino desde un
 * server component. Mantiene también la lista de invitados ya cargados
 * para esa propiedad (rehidrata desde localStorage).
 */
export function CargarInquilinoTrigger({
  propiedadId,
  direccion,
  variant = 'default',
  size = 'default',
  label = 'Cargar inquilino',
  fullWidth = false,
}: {
  propiedadId: string;
  direccion: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'xl';
  label?: string;
  fullWidth?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={fullWidth ? 'w-full' : ''}
        onClick={() => setOpen(true)}
      >
        <UserPlus className="h-4 w-4" />
        {label}
      </Button>
      <CargarInquilinoWizard
        propiedadId={propiedadId}
        direccion={direccion}
        open={open}
        onOpenChange={setOpen}
        onCreated={() => router.refresh()}
      />
    </>
  );
}

/**
 * Lista de inquilinos ya invitados a esta propiedad (los que están
 * pendientes de activación). Se monta como client component para leer
 * localStorage sin romper el SSR.
 */
export function ListaInvitadosPropiedad({
  propiedadId,
  direccion,
}: {
  propiedadId: string;
  direccion: string;
}) {
  const [invitados, setInvitados] = useState<InquilinoInvitado[]>([]);
  const [hidratado, setHidratado] = useState(false);

  useEffect(() => {
    setInvitados(invitadosDePropiedad(propiedadId));
    setHidratado(true);
  }, [propiedadId]);

  if (!hidratado) return null;
  if (invitados.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Pendientes de activación
      </p>
      {invitados.map((i) => (
        <div
          key={i.id}
          className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50/40 p-3 dark:border-amber-900/40 dark:bg-amber-900/10"
        >
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-amber-500 text-sm font-semibold text-white">
            {i.nombre.charAt(0)}
            {i.apellido.charAt(0)}
          </div>
          <div className="flex-1 min-w-0 space-y-0.5">
            <p className="truncate text-sm font-medium">
              {i.nombre} {i.apellido}
            </p>
            <p className="truncate text-xs text-muted-foreground">{i.email}</p>
            <p className="text-[11px] text-amber-700 dark:text-amber-300">
              Le mandamos el link a su mail · {i.coInquilinos.length}{' '}
              co-inquilino{i.coInquilinos.length === 1 ? '' : 's'} · {i.documentos.length}{' '}
              doc{i.documentos.length === 1 ? '' : 's'}
            </p>
          </div>
        </div>
      ))}
      <CargarInquilinoTrigger
        propiedadId={propiedadId}
        direccion={direccion}
        variant="outline"
        size="sm"
        label="Cargar otro inquilino"
      />
    </div>
  );
}
