'use client';

import { useState } from 'react';
import { UserMinus, UserPlus } from 'lucide-react';
import { Button } from '@llave/ui/button';
import { ConfirmDialog } from '@llave/ui/confirm-dialog';
import { toast } from '@llave/ui/use-toast';
import { ApiError, varianteError } from '@/lib/api/client';
import { useBajaPropietario } from '@/lib/api/hooks';
import { textoDeBaja } from '@/lib/acciones-de-propietario';

/**
 * Dar de baja (o reactivar) a un propietario.
 *
 * Es el botón que faltaba: `PATCH /propietarios/:id/activo` existía desde hacía semanas y ningún
 * archivo del panel lo llamaba. Hasta ahora, la única forma de sacar del portal a un dueño que
 * vendió su departamento era borrarle el email a mano desde la ficha — un efecto lateral de otra
 * cosa, sin documentar, que nadie sabe.
 *
 * NO reemplaza a «Eliminar» y por eso nunca salen juntos (ver `accionDePropietario`): eliminar
 * borra la fila y sólo procede sin historial; esto conserva todo y corta el acceso.
 *
 * El 409 de cobranza directa sale tal cual lo manda el server: si este dueño es quien cobra
 * DIRECTO del inquilino en un contrato activo, darlo de baja dejaría al inquilino transfiriendo
 * a la cuenta de alguien que ya no administra la propiedad. Eso es plata yendo al lugar
 * equivocado, y el mensaje del backend dice qué contrato hay que arreglar primero.
 */
export function BajaPropietarioButton({
  propietarioId,
  nombre,
  activo,
}: {
  propietarioId: string;
  nombre: string;
  activo: boolean;
}) {
  const { cambiar } = useBajaPropietario();
  const [open, setOpen] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const texto = textoDeBaja(nombre, activo);

  const confirmar = async () => {
    if (guardando) return;
    setGuardando(true);
    try {
      await cambiar(propietarioId, !activo);
      toast({
        variant: 'success',
        title: activo ? 'Propietario dado de baja' : 'Propietario reactivado',
        description: activo
          ? 'Ya no tiene acceso a su portal. Su historial quedó intacto.'
          : 'Vuelve a tener acceso a su portal.',
      });
      setOpen(false);
    } catch (e) {
      toast({
        variant: varianteError(e),
        title: activo ? 'No se pudo dar de baja' : 'No se pudo reactivar',
        description: e instanceof ApiError ? e.message : 'Probá de nuevo en un momento.',
      });
      setOpen(false);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className={activo ? 'text-destructive hover:text-destructive' : undefined}
        onClick={() => setOpen(true)}
      >
        {activo ? <UserMinus className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
        {texto.boton}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={(o) => !guardando && setOpen(o)}
        title={texto.titulo}
        description={texto.descripcion}
        confirmLabel={texto.boton}
        variant={activo ? 'destructive' : 'default'}
        loading={guardando}
        onConfirm={confirmar}
      />
    </>
  );
}
