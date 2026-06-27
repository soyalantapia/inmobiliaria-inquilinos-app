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
  type AgregarCoInquilinoInput,
  type PermisoCoInquilino,
} from '@/lib/co-inquilinos-extra-storage';

interface AgregarCoInquilinoDialogProps {
  propiedadId: string;
  contratoId?: string | null;
  inquilinoPrincipal?: string;
  /** En prod el email es obligatorio (la activación del co-inquilino es por email). */
  emailRequerido?: boolean;
  /** Persiste el co-inquilino (API en prod, localStorage en demo). */
  onAgregar: (input: AgregarCoInquilinoInput) => Promise<void>;
  open: boolean;
  onOpenChange: (v: boolean) => void;
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
  emailRequerido = false,
  onAgregar,
  open,
  onOpenChange,
}: AgregarCoInquilinoDialogProps) {
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [email, setEmail] = useState('');
  const [dni, setDni] = useState('');
  const [celular, setCelular] = useState('');
  const [relacion, setRelacion] = useState('Conviviente');
  const [permiso, setPermiso] = useState<PermisoCoInquilino>('PAGAR');
  const [guardando, setGuardando] = useState(false);

  // Reset al abrir
  useEffect(() => {
    if (open) {
      setNombre('');
      setApellido('');
      setEmail('');
      setDni('');
      setCelular('');
      setRelacion('Conviviente');
      setPermiso('PAGAR');
      setGuardando(false);
    }
  }, [open]);

  const celularOk = celular.replace(/[^\d]/g, '').length >= 8;
  const emailFormatoOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const emailOk = emailRequerido ? emailFormatoOk : email.trim().length === 0 || emailFormatoOk;
  const puedeGuardar =
    nombre.trim().length >= 2 &&
    apellido.trim().length >= 2 &&
    celularOk &&
    emailOk &&
    !guardando;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!puedeGuardar) return;
    setGuardando(true);
    try {
      await onAgregar({
        propiedadId,
        contratoId: contratoId ?? null,
        nombre,
        apellido,
        celular,
        email: email.trim() || undefined,
        dni: dni.trim() || undefined,
        relacion,
        permiso,
      });
      toast({
        variant: 'success',
        title: '¡Co-inquilino agregado!',
        description: emailRequerido
          ? `${nombre.trim()} ya tiene acceso: que entre con su email (${email.trim().toLowerCase()}) para activar la cuenta.`
          : `En producción se le envía a ${nombre.trim()} el link por WhatsApp para activar su cuenta.`,
      });
      onOpenChange(false);
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'No se pudo agregar',
        description: err instanceof Error ? err.message : 'Revisá los datos e intentá de nuevo.',
      });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
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
            <Label htmlFor="co-celular" className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1">💬 WhatsApp</span>
              <span className="text-[10px] font-medium text-primary">obligatorio</span>
            </Label>
            <Input
              id="co-celular"
              type="tel"
              value={celular}
              onChange={(e) => setCelular(e.target.value)}
              placeholder="+54 11 5555-5555"
              className={
                celular.length > 0 && !celularOk
                  ? 'border-destructive focus-visible:ring-destructive'
                  : ''
              }
            />
            {celular.length > 0 && !celularOk && (
              <p className="text-[11px] text-destructive">
                Mínimo 8 dígitos (incluí código de área)
              </p>
            )}
            <p className="text-[11px] text-muted-foreground">
              En producción le llega el link para activar su cuenta por WhatsApp.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="co-dni" className="flex items-center gap-1.5">
                DNI
                <span className="text-[10px] font-normal text-muted-foreground">opcional</span>
              </Label>
              <Input
                id="co-dni"
                inputMode="numeric"
                value={dni}
                onChange={(e) => setDni(e.target.value.replace(/\D/g, '').slice(0, 8))}
                placeholder="30123456"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="co-email" className="flex items-center gap-1.5">
                Email
                {emailRequerido ? (
                  <span className="text-[10px] font-medium text-primary">obligatorio</span>
                ) : (
                  <span className="text-[10px] font-normal text-muted-foreground">opcional</span>
                )}
              </Label>
              <Input
                id="co-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="juan@correo.com"
                className={
                  email.length > 0 && !emailOk
                    ? 'border-destructive focus-visible:ring-destructive'
                    : ''
                }
              />
              {email.length > 0 && !emailOk && (
                <p className="text-[11px] text-destructive">Email inválido</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="aci-relacion" className="text-xs">Relación</Label>
              <Select value={relacion} onValueChange={setRelacion}>
                <SelectTrigger id="aci-relacion">
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
              <Label htmlFor="aci-permiso" className="text-xs">Permiso</Label>
              <Select
                value={permiso}
                onValueChange={(v) => setPermiso(v as PermisoCoInquilino)}
              >
                <SelectTrigger id="aci-permiso">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERMISOS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                {PERMISOS.find((p) => p.value === permiso)?.descripcion}
              </p>
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
                  <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
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
