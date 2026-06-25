'use client';

import React, { useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
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
import { apiEnabled } from '@/lib/api/client';
import { useCrearPropietario } from '@/lib/api/hooks';
import { validarCuit } from '@/lib/cuit';

// Modal para dar de alta un propietario.
//  - Prod (apiEnabled): POST /propietarios con los campos del form; el hook
//    invalida ['propietarios'] así la lista se refresca al instante.
//  - Demo (!apiEnabled): toasteamos y cerramos — los datos no se persisten
//    porque mock-data es un array constante, pero el flow de UX queda intacto.

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function SumarPropietarioDialog({ open, onOpenChange }: Props) {
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [cuit, setCuit] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [cbuAlias, setCbuAlias] = useState('');
  const [comisionPct, setComisionPct] = useState('8');
  const [notas, setNotas] = useState('');
  const [guardando, setGuardando] = useState(false);
  const { crear } = useCrearPropietario();

  const reset = () => {
    setNombre('');
    setApellido('');
    setCuit('');
    setEmail('');
    setTelefono('');
    setCbuAlias('');
    setComisionPct('8');
    setNotas('');
  };

  const guardar = async () => {
    if (!nombre.trim() || !apellido.trim() || !cuit.trim() || !email.trim()) {
      toast({
        title: 'Faltan datos obligatorios',
        description: 'Nombre, apellido, CUIT y email son requeridos.',
        variant: 'destructive',
      });
      return;
    }
    const checkCuit = validarCuit(cuit);
    if (!checkCuit.valido) {
      toast({
        title: 'CUIT inválido',
        description: checkCuit.motivo,
        variant: 'destructive',
      });
      return;
    }

    // Prod: POST /propietarios (el hook invalida ['propietarios']).
    if (apiEnabled) {
      const comision = Number(comisionPct);
      // Rango válido del API (z.number().min(0).max(100)): avisamos en cliente en
      // vez de mandar -5/500 y comerse un 400 genérico.
      if (comisionPct.trim() && (!Number.isFinite(comision) || comision < 0 || comision > 100)) {
        toast({
          variant: 'destructive',
          title: 'Comisión inválida',
          description: 'Ingresá un porcentaje entre 0 y 100.',
        });
        return;
      }
      setGuardando(true);
      try {
        await crear({
          nombre: nombre.trim(),
          apellido: apellido.trim(),
          email: email.trim(),
          ...(telefono.trim() ? { telefono: telefono.trim() } : {}),
          cuit: cuit.trim(),
          ...(cbuAlias.trim() ? { cbuAlias: cbuAlias.trim() } : {}),
          ...(Number.isFinite(comision) ? { comisionPct: comision } : {}),
          ...(notas.trim() ? { notas: notas.trim() } : {}),
        });
      } catch (err) {
        setGuardando(false);
        toast({
          variant: 'destructive',
          title: 'No se pudo sumar el propietario',
          description: err instanceof Error ? err.message : 'Probá de nuevo en un momento.',
        });
        return;
      }
      setGuardando(false);
      toast({
        title: `${nombre} ${apellido} agregado`,
        description: 'Ya aparece en tu cartera de propietarios.',
      });
      reset();
      onOpenChange(false);
      return;
    }

    // Demo: toast sin persistir (mismo comportamiento de antes).
    toast({
      title: `${nombre} ${apellido} agregado`,
      description: 'Cuando conectemos el backend, queda guardado al instante.',
    });
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Sumar propietario</DialogTitle>
          <DialogDescription>
            Cargá los datos básicos. Después le asociás propiedades.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Nombre">
              <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Juan" />
            </Field>
            <Field label="Apellido">
              <Input value={apellido} onChange={(e) => setApellido(e.target.value)} placeholder="Ej: García" />
            </Field>
          </div>

          <Field label="CUIT">
            <Input
              value={cuit}
              onChange={(e) => setCuit(e.target.value)}
              placeholder="20-12345678-9"
            />
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Email">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="juan@ejemplo.com"
              />
            </Field>
            <Field label="Teléfono">
              <Input
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="+54 9 11 …"
              />
            </Field>
          </div>

          <Field label="CBU o alias (opcional)">
            <Input
              value={cbuAlias}
              onChange={(e) => setCbuAlias(e.target.value)}
              placeholder="juan.garcia.mp"
            />
          </Field>

          <Field label="Comisión (%)">
            <Input
              type="number"
              min="0"
              max="30"
              step="0.5"
              value={comisionPct}
              onChange={(e) => setComisionPct(e.target.value)}
            />
          </Field>

          <Field label="Notas internas (opcional)">
            <Textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} />
          </Field>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => onOpenChange(false)}
            disabled={guardando}
          >
            Cancelar
          </Button>
          <Button className="flex-1" onClick={guardar} disabled={guardando}>
            {guardando ? (
              <>
                <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                Sumando…
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                Sumar
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const id = `spd-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`;
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs">{label}</Label>
      {React.isValidElement(children)
        ? React.cloneElement(children as React.ReactElement<{ id?: string }>, { id })
        : children}
    </div>
  );
}
