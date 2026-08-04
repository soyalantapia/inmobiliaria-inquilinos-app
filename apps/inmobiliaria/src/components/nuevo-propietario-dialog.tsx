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
import { apiEnabled } from '@/lib/api/client';
import { useCrearPropietario } from '@/lib/api/hooks';
import {
  type PropietarioExtra,
  agregarPropietarioExtra,
} from '@/lib/propietarios-extra-storage';

/**
 * Forma mínima que el wizard necesita del propietario recién creado: id +
 * nombre/apellido para asignarlo a un slot. PropietarioExtra (demo) y el
 * Propietario del API la satisfacen, así que `onCreated` acepta ambos.
 */
export interface PropietarioCreado {
  id: string;
  nombre: string;
  apellido: string;
}

interface NuevoPropietarioDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: (propietario: PropietarioCreado) => void;
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
  // Default 8: es el mismo que aplicaba el server en silencio, pero ahora se ve.
  const [comisionPct, setComisionPct] = useState('8');
  const [guardando, setGuardando] = useState(false);
  const { crear } = useCrearPropietario();

  useEffect(() => {
    if (open) {
      setNombre('');
      setApellido('');
      setCuit('');
      setEmail('');
      setTelefono('');
      setCbuAlias('');
      setComisionPct('8');
      setGuardando(false);
    }
  }, [open]);

  const telefonoOk = telefono.replace(/[^\d]/g, '').length >= 8;
  const comisionNum = Number(comisionPct);
  const comisionOk =
    comisionPct.trim() === '' || (Number.isFinite(comisionNum) && comisionNum >= 0 && comisionNum <= 100);
  // MÍNIMO UNIFICADO con la otra puerta (/propietarios) y con el server:
  // nombre + apellido y nada más. El teléfono era obligatorio SÓLO acá, así que
  // el mismo dueño se podía cargar de un lado y no del otro.
  const puedeGuardar =
    nombre.trim().length >= 2 &&
    apellido.trim().length >= 1 &&
    (telefono.trim() === '' || telefonoOk) &&
    comisionOk &&
    !guardando;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!puedeGuardar) return;
    setGuardando(true);

    // Prod: POST /propietarios con los campos del form (invalida ['propietarios']
    // dentro del hook). Demo: store local de antes (byte-for-byte).
    let nuevo: PropietarioCreado;
    if (apiEnabled) {
      try {
        nuevo = await crear({
          nombre: nombre.trim(),
          apellido: apellido.trim(),
          ...(email.trim() ? { email: email.trim() } : {}),
          ...(telefono.trim() ? { telefono: telefono.trim() } : {}),
          ...(cuit.trim() ? { cuit: cuit.trim() } : {}),
          ...(cbuAlias.trim() ? { cbuAlias: cbuAlias.trim() } : {}),
          // Explícito aunque sea 8: que el número que se ve en pantalla sea el
          // que se guarda, en vez de depender del default del server.
          ...(comisionPct.trim() !== '' ? { comisionPct: comisionNum } : {}),
        });
      } catch (err) {
        setGuardando(false);
        toast({
          variant: 'destructive',
          title: 'No se pudo crear el propietario',
          description: err instanceof Error ? err.message : 'Probá de nuevo en un momento.',
        });
        return;
      }
    } else {
      await new Promise((r) => setTimeout(r, 300));
      nuevo = agregarPropietarioExtra({
        nombre,
        apellido,
        cuit,
        email,
        telefono,
        cbuAlias,
      });
    }

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
              <Label htmlFor="np-nombre" aria-required>
                Nombre <span className="text-destructive">*</span>
              </Label>
              <Input
                id="np-nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="María"
                autoFocus
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="np-apellido" aria-required>
                Apellido <span className="text-destructive">*</span>
              </Label>
              <Input
                id="np-apellido"
                value={apellido}
                onChange={(e) => setApellido(e.target.value)}
                placeholder="González"
                required
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
                <span className="inline-flex items-center gap-1">
                  💬 WhatsApp
                </span>
                <span className="text-[10px] font-normal text-muted-foreground">
                  recomendado
                </span>
              </Label>
              <Input
                id="np-telefono"
                aria-invalid={telefono.length > 0 && !telefonoOk}
                aria-describedby={telefono.length > 0 && !telefonoOk ? 'np-telefono-error' : undefined}
                type="tel"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="+54 11 5555-5555"
                className={
                  telefono.length > 0 && !telefonoOk
                    ? 'border-destructive focus-visible:ring-destructive'
                    : ''
                }
              />
              {telefono.length > 0 && !telefonoOk && (
                <p id="np-telefono-error" role="alert" className="text-[11px] text-destructive">
                  Mínimo 8 dígitos (incluí código de área)
                </p>
              )}
              <p className="text-[11px] text-muted-foreground">
                Toda la comunicación con el propietario va por acá.
              </p>
            </div>
          </div>

          {/* La comisión NO se preguntaba acá y el server la fijaba en 8%
              (core.ts: comisionPct ?? 8). Ese porcentaje es el que usa la
              rendición para calcular cuánto se queda la inmobiliaria: se
              decidía solo, sin avisar, y recién se descubría al rendir. */}
          <div className="space-y-1.5">
            <Label htmlFor="np-comision">Tu comisión sobre el alquiler</Label>
            <div className="flex items-center gap-2">
              <Input
                id="np-comision"
                inputMode="decimal"
                aria-invalid={!comisionOk}
                aria-describedby="np-comision-hint"
                value={comisionPct}
                onChange={(e) => setComisionPct(e.target.value)}
                className={comisionOk ? 'w-24' : 'w-24 border-destructive focus-visible:ring-destructive'}
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
            <p id="np-comision-hint" className="text-[11px] text-muted-foreground">
              {comisionOk
                ? 'Es lo que se te descuenta a vos en cada rendición a este dueño. Podés cambiarlo después.'
                : 'Ingresá un número entre 0 y 100.'}
            </p>
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
              CBU / Alias del propietario (para rendirle)
              <span className="text-[10px] font-normal text-muted-foreground">
                opcional
              </span>
            </Label>
            <Input
              id="np-cbu"
              aria-describedby="np-cbu-hint"
              value={cbuAlias}
              onChange={(e) => setCbuAlias(e.target.value)}
              placeholder="alias.propietario.mp"
            />
            <p id="np-cbu-hint" className="text-[11px] text-muted-foreground">
              Es la cuenta a la que <strong>la inmobiliaria</strong> le transfiere
              lo que cobra del inquilino (rendición). Para que el inquilino
              transfiera <strong>directo</strong> al propietario (cobranza
              directa), cargá su cuenta en la ficha del propietario → “Cuenta de
              cobranza directa”.
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
                  <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
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
