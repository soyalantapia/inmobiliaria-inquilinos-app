'use client';

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
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
import { apiEnabled, apiFetch, ApiError } from '@/lib/api/client';
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
  const qc = useQueryClient();
  const [nombre, setNombre] = useState(propietario.nombre);
  const [apellido, setApellido] = useState(propietario.apellido);
  const [cuit, setCuit] = useState(propietario.cuit);
  const [email, setEmail] = useState(propietario.email);
  const [telefono, setTelefono] = useState(propietario.telefono);
  const [cbuAlias, setCbuAlias] = useState(propietario.cbuAlias ?? '');
  const [comisionPct, setComisionPct] = useState(String(propietario.comisionPct ?? 8));
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
      setComisionPct(String(propietario.comisionPct ?? 8));
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
    // El server (PUT /propietarios) exige email con formato válido → validamos acá
    // para no comernos un 400 genérico. Es opcional: solo si se cargó algo.
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast({ variant: 'destructive', title: 'Revisá el email', description: 'El email no tiene un formato válido (ej: nombre@correo.com).' });
      return;
    }
    const comisionNum = Number(comisionPct);
    if (!Number.isFinite(comisionNum) || comisionNum < 0 || comisionNum > 100) {
      toast({ variant: 'destructive', title: 'Revisá la comisión', description: 'La comisión tiene que ser un porcentaje entre 0 y 100.' });
      return;
    }
    const datos = {
      nombre: nombre.trim(),
      apellido: apellido.trim(),
      cuit: cuit.trim(),
      email: email.trim(),
      telefono: telefono.trim(),
      cbuAlias: cbuAlias.trim() || null,
      comisionPct: comisionNum,
      notas: notas.trim() || null,
    };
    setGuardando(true);
    try {
      if (apiEnabled) {
        // Prod: persiste de verdad en la DB (antes iba a localStorage y el cambio
        // se perdía al recargar → "no me deja editar").
        await apiFetch(`/propietarios/${propietario.id}`, { method: 'PUT', body: JSON.stringify(datos) });
        await Promise.all([
          qc.invalidateQueries({ queryKey: ['propietario', propietario.id] }),
          qc.invalidateQueries({ queryKey: ['propietarios'] }),
        ]);
      } else {
        await new Promise((r) => setTimeout(r, 350));
        guardarOverride(propietario.id, datos);
      }
    } catch (e) {
      setGuardando(false);
      toast({
        variant: 'destructive',
        title: 'No se pudo actualizar',
        description: e instanceof ApiError ? e.message : 'Probá de nuevo en un momento.',
      });
      return;
    }
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
              CUIT
              <span className="text-[10px] font-normal text-muted-foreground">opcional</span>
            </Label>
            <Input
              id="ed-cuit"
              value={cuit}
              onChange={(e) => setCuit(e.target.value)}
              placeholder="20-12345678-9"
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
            <Label htmlFor="ed-comision">Comisión de la inmobiliaria (%)</Label>
            <Input
              id="ed-comision"
              inputMode="decimal"
              value={comisionPct}
              onChange={(e) => setComisionPct(e.target.value.replace(/[^\d.,]/g, '').replace(',', '.'))}
              placeholder="8"
              className="w-32"
            />
            <p className="text-[11px] text-muted-foreground">
              Lo que te quedás vos al rendirle. Se descuenta del bruto en cada rendición.
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
