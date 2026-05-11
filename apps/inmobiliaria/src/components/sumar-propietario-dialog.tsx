'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
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
import { validarCuit } from '@/lib/cuit';

// Modal para dar de alta un propietario. En backend real es POST /api/owners.
// Acá toasteamos y cerramos — los datos no se persisten porque mock-data es
// un array constante, pero el flow de UX queda 100% funcional para demo.

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

  const guardar = () => {
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
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button className="flex-1" onClick={guardar}>
            <Plus className="h-4 w-4" />
            Sumar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
