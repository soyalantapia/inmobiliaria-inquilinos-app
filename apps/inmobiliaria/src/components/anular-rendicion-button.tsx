'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@llave/ui/use-toast';
import { PinPromptDialog } from '@/components/pin-prompt-dialog';
import { ApiError } from '@/lib/api/client';
import { anularRendicion } from '@/lib/api/hooks';

/**
 * "Deshacer" una rendición ya registrada (con PIN). La rendición es un registro
 * —no se movió plata real—, así que es reversible: los gastos descontados vuelven
 * a quedar pendientes para la próxima.
 */
export function AnularRendicionButton({
  rendicionId,
  nombre,
  onAnulada,
}: {
  rendicionId: string;
  nombre: string;
  onAnulada?: () => void;
}) {
  const qc = useQueryClient();
  const [pinOpen, setPinOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setPinOpen(true)}
        className="shrink-0 text-[10px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
      >
        Deshacer
      </button>
      <PinPromptDialog
        abierto={pinOpen}
        accion={`Deshacer la rendición de ${nombre}`}
        subaccion="Los gastos vuelven a quedar pendientes para la próxima rendición."
        validacion="servidor"
        onClose={() => setPinOpen(false)}
        onConfirmado={async (pin) => {
          try {
            await anularRendicion(rendicionId, pin);
          } catch (e) {
            return e instanceof ApiError ? e.message : 'No se pudo deshacer. Probá de nuevo.';
          }
          await qc.invalidateQueries({ queryKey: ['propietarios'] });
          // También la lista de rendiciones (historial): sin esto el "Deshacer"
          // limpiaba el badge local pero la cache de GET /rendiciones seguía
          // mostrando la rendición deshecha.
          await qc.invalidateQueries({ queryKey: ['rendiciones'] });
          toast({ variant: 'success', title: 'Rendición deshecha', description: 'Podés volver a rendir cuando quieras.' });
          onAnulada?.();
          setPinOpen(false);
          return null;
        }}
      />
    </>
  );
}
