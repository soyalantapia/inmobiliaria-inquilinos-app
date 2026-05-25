'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { FileText } from 'lucide-react';
import { Button, type ButtonProps } from '@llave/ui/button';
import { EditarPropiedadDialog } from './editar-propiedad-dialog';
import type { Propiedad } from '@/lib/types';

interface Props {
  propiedad: Propiedad;
  variant?: ButtonProps['variant'];
  size?: ButtonProps['size'];
}

/**
 * Trigger client-side para abrir el dialog de edición de propiedad
 * desde una page server. Hace router.refresh tras guardar para mostrar
 * los datos actualizados sin recargar full page.
 */
export function EditarPropiedadTrigger({ propiedad, variant = 'outline', size = 'sm' }: Props) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <>
      <Button variant={variant} size={size} onClick={() => setOpen(true)}>
        <FileText className="h-4 w-4" />
        Editar
      </Button>
      <EditarPropiedadDialog
        open={open}
        onOpenChange={setOpen}
        propiedad={propiedad}
        onGuardado={() => router.refresh()}
      />
    </>
  );
}
