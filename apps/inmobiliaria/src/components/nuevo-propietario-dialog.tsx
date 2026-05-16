'use client';

import { useEffect, useState } from 'react';
import { Loader2, UserPlus } from 'lucide-react';
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
import { toast } from '@llave/ui/use-toast';
import {
  type PropietarioExtra,
  agregarPropietarioExtra,
} from '@/lib/propietarios-extra-storage';

interface NuevoPropietarioDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: (propietario: PropietarioExtra) => void;
}

/**
 * Dialog para dar de alta un propietario desde el wizard de Nueva propiedad
 * sin tener que salir del flujo. Pide lo mínimo; lo demás se completa
 * después desde el panel de propietarios.
 */
export function NuevoPropietarioDialog({
  open,
  onOpenChange,
  onCreated,
}: NuevoPropietarioDialogProps) {
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [cuit, setCuit] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [cbuAlias, setCbuAlias] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (open) {
      setNombre('');
      setApellido('');
      setCuit('');
      setEmail('');
      setTelefono('');
      setCbuAlias('');
      setGuardando(false);
    }
  }, [open]);

  const puedeGuardar =
    nombre.trim().length >= 2 && apellido.trim().length >= 2 && !guardando;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!puedeGuardar) return;
    setGuardando(true);
    await new Promise((r) => setTimeout(r, 300));
    const nuevo = agregarPropietarioExtra({
      nombre,
      apellido,
      cuit,
      email,
      telefono,
      cbuAlias,
    });
    setGuardando(false);
    toast({
      variant: 'success',
      title: '¡Propietario creado!',
      description: `${nuevo.nombre} ${nuevo.apellido} ya queda asociado a la propiedad.`,
    });
    onCreated?.(nuevo);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Nuevo propietario
          </DialogTitle>
          <DialogDescription>
            Datos mínimos para asociarlo a la propiedad. El resto se completa
            después desde el panel.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="np-nombre">Nombre</Label>
              <Input
                id="np-nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="María"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="np-apellido">Apellido</Label>
              <Input
                id="np-apellido"
                value={apellido}
                onChange={(e) => setApellido(e.target.value)}
                placeholder="González"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="np-cuit" className="flex items-center gap-1.5">
                CUIT
                <span className="text-[10px] font-normal text-muted-foreground">
                  opcional
                </span>
              </Label>
              <Input
                id="np-cuit"
                inputMode="numeric"
                value={cuit}
                onChange={(e) =>
                  setCuit(e.target.value.replace(/\D/g, '').slice(0, 11))
                }
                placeholder="20301234567"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="np-telefono" className="flex items-center gap-1.5">
                Teléfono
                <span className="text-[10px] font-normal text-muted-foreground">
                  opcional
                </span>
              </Label>
              <Input
                id="np-telefono"
                type="tel"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="+54 11 5555-5555"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="np-email" className="flex items-center gap-1.5">
              Email
              <span className="text-[10px] font-normal text-muted-foreground">
                opcional
              </span>
            </Label>
            <Input
              id="np-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="propietario@correo.com"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="np-cbu" className="flex items-center gap-1.5">
              CBU / Alias para cobrar
              <span className="text-[10px] font-normal text-muted-foreground">
                opcional
              </span>
            </Label>
            <Input
              id="np-cbu"
              value={cbuAlias}
              onChange={(e) => setCbuAlias(e.target.value)}
              placeholder="alias.propietario.mp"
            />
            <p className="text-[11px] text-muted-foreground">
              Si lo cargás ahora, los pagos del inquilino se acreditan directo a
              esta cuenta.
            </p>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              disabled={guardando}
            >
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={!puedeGuardar}>
              {guardando ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Guardando…
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4" />
                  Crear propietario
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
