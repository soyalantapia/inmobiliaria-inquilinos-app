'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@llave/ui/use-toast';
import { Button } from '@llave/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@llave/ui/dialog';
import { Label } from '@llave/ui/label';
import { Textarea } from '@llave/ui/textarea';
import { PinPromptDialog } from '@/components/pin-prompt-dialog';
import { ApiError } from '@/lib/api/client';
import { anularRendicion } from '@/lib/api/hooks';

/**
 * "Deshacer" una rendición ya registrada. Pide MOTIVO y después PIN.
 *
 * La rendición es un registro —no se movió plata real—, así que es reversible: los gastos
 * descontados vuelven a quedar pendientes para la próxima.
 *
 * EL MOTIVO SE PIDE PRIMERO Y ES OBLIGATORIO. Desde la baja lógica, deshacer ya no borra la
 * rendición: queda marcada, y el PROPIETARIO la ve tachada en su portal con este texto al
 * lado. O sea que lo que se escriba acá lo va a leer él. Antes se le desaparecía el depósito
 * de la pantalla sin una palabra, y cuando llamaba la inmobiliaria tampoco tenía con qué
 * contestarle porque no quedaba ni la fila.
 *
 * Mismo patrón que deshacer un cobro en Caja: motivo en un diálogo, después el PIN.
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
  const [motivoOpen, setMotivoOpen] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [pinOpen, setPinOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setMotivoOpen(true)}
        className="shrink-0 text-[10px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
      >
        Deshacer
      </button>
      <Dialog open={motivoOpen} onOpenChange={(o) => !o && setMotivoOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deshacer la rendición de {nombre}</DialogTitle>
            <DialogDescription>
              Los gastos vuelven a quedar pendientes para la próxima. La rendición no se borra:
              queda marcada como anulada, y {nombre} la va a ver tachada en su portal con este
              motivo al lado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="motivo-anular-rendicion">¿Por qué se deshace?</Label>
            <Textarea
              id="motivo-anular-rendicion"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej: se rindió el período equivocado"
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Lo lee el propietario en su portal. Mínimo 5 caracteres.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setMotivoOpen(false); setMotivo(''); }}>
              Cancelar
            </Button>
            <Button
              disabled={motivo.trim().length < 5}
              onClick={() => { setMotivoOpen(false); setPinOpen(true); }}
            >
              Continuar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <PinPromptDialog
        abierto={pinOpen}
        accion={`Deshacer la rendición de ${nombre}`}
        subaccion="Los gastos vuelven a quedar pendientes para la próxima rendición."
        validacion="servidor"
        onClose={() => setPinOpen(false)}
        onConfirmado={async (pin) => {
          try {
            await anularRendicion(rendicionId, motivo.trim(), pin);
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
          setMotivo('');
          return null;
        }}
      />
    </>
  );
}
