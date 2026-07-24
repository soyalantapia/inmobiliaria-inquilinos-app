'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { Button } from '@llave/ui/button';
import { ConfirmDialog } from '@llave/ui/confirm-dialog';
import { toast } from '@llave/ui/use-toast';
import { ApiError, varianteError } from '@/lib/api/client';
import { useEliminarPropietario } from '@/lib/api/hooks';

/**
 * Botón para eliminar un propietario. Pensado para limpiar altas DUPLICADAS:
 * el backend solo deja borrar propietarios sin propiedades, contratos ni
 * rendiciones; para uno real con historial devuelve un mensaje claro.
 */
export function EliminarPropietarioButton({ propietarioId, nombre }: { propietarioId: string; nombre: string }) {
  const router = useRouter();
  const { eliminar } = useEliminarPropietario();
  const [open, setOpen] = useState(false);
  const [borrando, setBorrando] = useState(false);

  const confirmar = async () => {
    if (borrando) return;
    setBorrando(true);
    try {
      await eliminar(propietarioId);
      toast({ variant: 'success', title: 'Propietario eliminado', description: 'Ya no aparece en tu cartera.' });
      router.push('/propietarios');
    } catch (e) {
      toast({
        variant: varianteError(e),
        title: 'No se pudo eliminar',
        description: e instanceof ApiError ? e.message : 'Probá de nuevo en un momento.',
      });
      setBorrando(false);
      setOpen(false);
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setOpen(true)}>
        <Trash2 className="h-4 w-4" />
        Eliminar
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={(o) => !borrando && setOpen(o)}
        title={`¿Eliminar a ${nombre}?`}
        description="Se borra de tu cartera. Solo se pueden eliminar propietarios sin propiedades, contratos ni rendiciones — ideal para limpiar una carga duplicada. Esta acción no se puede deshacer."
        confirmLabel="Eliminar propietario"
        variant="destructive"
        loading={borrando}
        onConfirm={confirmar}
      />
    </>
  );
}
