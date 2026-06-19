'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Landmark, Pencil, PlugZap } from 'lucide-react';
import { Button, type ButtonProps } from '@llave/ui/button';
import { ConectarArcaDialog } from './conectar-arca-dialog';
import { CuentaCobranzaDialog } from './cuenta-cobranza-dialog';
import { EditarPropietarioDialog } from './editar-propietario-dialog';
import type { Propietario } from '@/lib/types';

interface BaseProps {
  propietario: Propietario;
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
  className?: string;
}

/** Botón "Editar" del header con dialog de datos básicos. */
export function EditarPropietarioTrigger({
  propietario,
  variant,
  size,
  className,
}: BaseProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} size={size} className={className} onClick={() => setOpen(true)}>
        <Pencil className="h-4 w-4" />
        Editar
      </Button>
      <EditarPropietarioDialog open={open} onOpenChange={setOpen} propietario={propietario} />
    </>
  );
}

/** Botón "Conectar ARCA" en la card de AFIP. */
export function ConectarArcaTrigger({
  propietario,
  variant,
  size = 'sm',
  className,
}: BaseProps) {
  const [open, setOpen] = useState(false);
  const yaConectado = propietario.afip?.conectado === true;
  return (
    <>
      <Button variant={variant} size={size} className={className} onClick={() => setOpen(true)}>
        <PlugZap className="h-3.5 w-3.5" />
        {yaConectado ? 'Reconectar credenciales ARCA' : 'Conectar ARCA'}
      </Button>
      <ConectarArcaDialog open={open} onOpenChange={setOpen} propietario={propietario} />
    </>
  );
}

/** Botón "Editar cuenta" / "Cargar cuenta" en la card de cobranza directa. */
export function CuentaCobranzaTrigger({
  propietario,
  variant = 'outline',
  size = 'sm',
  className,
}: BaseProps) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const yaTiene = !!propietario.cuentaCobranza;
  return (
    <>
      <Button variant={variant} size={size} className={className} onClick={() => setOpen(true)}>
        {yaTiene ? (
          <>
            <Pencil className="h-3.5 w-3.5" />
            Editar cuenta
          </>
        ) : (
          <>
            <Landmark className="h-3.5 w-3.5" />
            Cargar cuenta del propietario
          </>
        )}
      </Button>
      <CuentaCobranzaDialog
        open={open}
        onOpenChange={setOpen}
        propietario={propietario}
        onSaved={() => {
          void qc.invalidateQueries({ queryKey: ['propietario', propietario.id] });
          void qc.invalidateQueries({ queryKey: ['propietarios'] });
        }}
      />
    </>
  );
}
