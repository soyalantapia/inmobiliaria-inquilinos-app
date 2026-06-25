'use client';

import { useEffect, useState } from 'react';
import { Button } from '@llave/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@llave/ui/dialog';
import { Input } from '@llave/ui/input';
import { Label } from '@llave/ui/label';
import { Textarea } from '@llave/ui/textarea';
import { toast } from '@llave/ui/use-toast';
import { guardarOverride } from '@/lib/propietarios-overrides-storage';
import { validarCuit } from '@/lib/cuit';
import type { Propietario } from '@/lib/types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propietario: Propietario;
}

/**
 * Dialog para editar nombre, apellido, CUIT, email, teléfono, CBU/alias
 * de cobro habitual y notas internas del propietario.
 */
export function EditarPropietarioDialog({ open, onOpenChange, propietario }: Props) {
  const [nombre, setNombre] = useState(propietario.nombre);
  const [apellido, setApellido] = useState(propietario.apellido);
  const [cuit, setCuit] = useState(propietario.cuit);
  const [email, setEmail] = useState(propietario.email);
  const [telefono, setTelefono] = useState(propietario.telefono);
  const [cbuAlias, setCbuAlias] = useState(propietario.cbuAlias ?? '');
  const [notas, setNotas] = useState(propietario.notas ?? '');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (open) {
      setNombre(propietario.nombre);
      setApellido(propietario.apellido);
      setCuit(propietario.cuit);
      setEmail(propietario.email);
      setTelefono(propietario.telefono);
      setCbuAlias(propietario.cbuAlias ?? '');
      setNotas(propietario.notas ?? '');
    }
  }, [open, propietario]);

  const guardar = async () => {
    if (!nombre.trim() || !apellido.trim()) {
      toast({
        variant: 'destructive',
        title: 'Faltan datos',
        description: 'Nombre y apellido son obligatorios.',
      });
      return;
    }
    // Validar formato + dígito verificador (igual que screening/configuracion):
    // el CUIT alimenta facturas y rendiciones, no debe guardarse basura. Es
    // OPCIONAL (el alta lo permite vacío) → solo lo validamos si se ingresó algo;
    // si no, no bloqueamos editar el resto de los campos.
    if (cuit.trim()) {
      const valCuit = validarCuit(cuit);
      if (!valCuit.valido) {
        toast({
          variant: 'destructive',
          title: 'Revisá el CUIT',
          description: valCuit.motivo ?? 'El CUIT no es válido.',
        });
        return;
      }
    }
    setGuardando(true);
    await new Promise((r) => setTimeout(r, 350));
    guardarOverride(propietario.id, {
      nombre: nombre.trim(),
      apellido: apellido.trim(),
      cuit: cuit.trim(),
      email: email.trim(),
      telefono: telefono.trim(),
      cbuAlias: cbuAlias.trim() || null,
      notas: notas.trim() || null,
    });
    setGuardando(false);
    toast({
      variant: 'success',
      title: 'Propietario actualizado',
      description: 'Los datos quedaron guardados.',
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar propietario</DialogTitle>
          <DialogDescription>
            Modificá los datos del propietario. Los cambios aplican a futuras facturas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ed-nombre" className="flex items-center gap-1">
                Nombre <span className="text-destructive" aria-label="obligatorio">*</span>
              </Label>
              <Input id="ed-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} aria-required="true" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ed-apellido" className="flex items-center gap-1">
                Apellido <span className="text-destructive" aria-label="obligatorio">*</span>
              </Label>
              <Input id="ed-apellido" value={apellido} onChange={(e) => setApellido(e.target.value)} aria-required="true" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ed-cuit" className="flex items-center gap-1">
              CUIT <span className="text-destructive" aria-label="obligatorio">*</span>
            </Label>
            <Input
              id="ed-cuit"
              value={cuit}
              onChange={(e) => setCuit(e.target.value)}
              placeholder="20-12345678-9"
              aria-required="true"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ed-email">Email</Label>
              <Input id="ed-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ed-tel">Teléfono</Label>
              <Input id="ed-tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ed-cbu">CBU / alias para rendiciones</Label>
            <Input
              id="ed-cbu"
              aria-describedby="ed-cbu-hint"
              value={cbuAlias}
              onChange={(e) => setCbuAlias(e.target.value)}
              placeholder="alias.banco.propietario"
            />
            <p id="ed-cbu-hint" className="text-[11px] text-muted-foreground">
              Es el destino donde se transfiere el neto al rendir el mes.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ed-notas" className="flex items-center gap-1.5">
              Notas internas
              <span className="text-[10px] font-normal text-muted-foreground">opcional</span>
            </Label>
            <Textarea
              id="ed-notas"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Apuntes para el equipo (no se comparten con el propietario)."
              rows={3}
            />
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={guardando}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
