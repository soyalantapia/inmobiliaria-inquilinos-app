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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@llave/ui/select';
import { toast } from '@llave/ui/use-toast';
import {
  type PermisoCoInquilino,
  agregarCoInquilino,
} from '@/lib/co-inquilinos-extra-storage';

interface AgregarCoInquilinoDialogProps {
  propiedadId: string;
  contratoId?: string | null;
  inquilinoPrincipal?: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAdded?: () => void;
}

const PERMISOS: Array<{ value: PermisoCoInquilino; label: string; descripcion: string }> = [
  { value: 'VER', label: 'Solo ver', descripcion: 'Ve el contrato y los pagos, no puede operar' },
  { value: 'PAGAR', label: 'Ver y pagar', descripcion: 'Puede pagar el alquiler en su nombre' },
  { value: 'COMPLETO', label: 'Todo', descripcion: 'Mismo nivel que el inquilino principal' },
];

export function AgregarCoInquilinoDialog({
  propiedadId,
  contratoId,
  inquilinoPrincipal,
  open,
  onOpenChange,
  onAdded,
}: AgregarCoInquilinoDialogProps) {
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [email, setEmail] = useState('');
  const [relacion, setRelacion] = useState('Conviviente');
  const [permiso, setPermiso] = useState<PermisoCoInquilino>('PAGAR');
  const [guardando, setGuardando] = useState(false);

  // Reset al abrir
  useEffect(() => {
    if (open) {
      setNombre('');
      setApellido('');
      setEmail('');
      setRelacion('Conviviente');
      setPermiso('PAGAR');
      setGuardando(false);
    }
  }, [open]);

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const puedeGuardar =
    nombre.trim().length >= 2 &&
    apellido.trim().length >= 2 &&
    emailOk &&
    !guardando;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!puedeGuardar) return;
    setGuardando(true);
    await new Promise((r) => setTimeout(r, 350));
    const co = agregarCoInquilino({
      propiedadId,
      contratoId: contratoId ?? null,
      nombre,
      apellido,
      email,
      relacion,
      permiso,
    });
    setGuardando(false);
    toast({
      title: '¡Co-inquilino agregado!',
      description: `Le mandamos a ${co.email} el link para activar su cuenta.`,
    });
    onAdded?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Sumar co-inquilino
          </DialogTitle>
          <DialogDescription>
            {inquilinoPrincipal
              ? `Vive con ${inquilinoPrincipal} y tendrá su propio acceso a la app.`
              : 'La persona que sumes va a recibir su propio acceso a la app.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="co-nombre">Nombre</Label>
              <Input
                id="co-nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Juan"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="co-apellido">Apellido</Label>
              <Input
                id="co-apellido"
                value={apellido}
                onChange={(e) => setApellido(e.target.value)}
                placeholder="Pérez"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="co-email">Email</Label>
            <Input
              id="co-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="juan@correo.com"
            />
            {!emailOk && email.length > 0 && (
              <p className="text-xs text-destructive">Email inválido</p>
            )}
            <p className="text-[11px] text-muted-foreground">
              Le mandamos un mail con el link para activar su cuenta.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Relación</Label>
              <Select value={relacion} onValueChange={setRelacion}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Conviviente">Conviviente</SelectItem>
                  <SelectItem value="Cónyuge">Cónyuge</SelectItem>
                  <SelectItem value="Hijo/a">Hijo/a</SelectItem>
                  <SelectItem value="Hermano/a">Hermano/a</SelectItem>
                  <SelectItem value="Padre/Madre">Padre / Madre</SelectItem>
                  <SelectItem value="Otro">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Permiso</Label>
              <Select
                value={permiso}
                onValueChange={(v) => setPermiso(v as PermisoCoInquilino)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERMISOS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium">{p.label}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {p.descripcion}
                        </p>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
                  Sumar y enviar invitación
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
