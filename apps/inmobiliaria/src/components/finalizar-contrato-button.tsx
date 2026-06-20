'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CalendarX } from 'lucide-react';
import { Button } from '@llave/ui/button';
import { ConfirmDialog } from '@llave/ui/confirm-dialog';
import { toast } from '@llave/ui/use-toast';
import { ApiError } from '@/lib/api/client';
import { useFinalizarContrato } from '@/lib/api/hooks';

/**
 * Finaliza un contrato y libera la propiedad (vuelve a DISPONIBLE). Sin esto, una
 * propiedad cuyo contrato venció quedaba ALQUILADA para siempre y no se le podía
 * cargar un contrato nuevo.
 */
export function FinalizarContratoButton({ contratoId, direccion }: { contratoId: string; direccion: string }) {
  const qc = useQueryClient();
  const { finalizar } = useFinalizarContrato();
  const [open, setOpen] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const confirmar = async () => {
    if (enviando) return;
    setEnviando(true);
    try {
      await finalizar(contratoId);
      await qc.invalidateQueries({ queryKey: ['contrato', contratoId] });
      toast({ variant: 'success', title: 'Contrato finalizado', description: `${direccion} quedó disponible para un nuevo contrato.` });
      setOpen(false);
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'No se pudo finalizar',
        description: e instanceof ApiError ? e.message : 'Probá de nuevo en un momento.',
      });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setOpen(true)}>
        <CalendarX className="h-4 w-4" />
        Finalizar contrato
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="¿Finalizar este contrato?"
        description="El contrato pasa a finalizado y la propiedad vuelve a estar disponible para cargar un contrato nuevo. El historial (pagos, liquidaciones) se conserva. No se puede deshacer."
        confirmLabel="Sí, finalizar"
        variant="destructive"
        loading={enviando}
        onConfirm={confirmar}
      />
    </>
  );
}
