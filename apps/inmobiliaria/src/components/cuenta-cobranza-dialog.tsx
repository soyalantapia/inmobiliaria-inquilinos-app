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
import { toast } from '@llave/ui/use-toast';
import { guardarOverride } from '@/lib/propietarios-overrides-storage';
import type { Propietario } from '@/lib/types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propietario: Propietario;
}

/**
 * Dialog para cargar/editar la cuenta de cobranza directa del propietario.
 * Si el propietario ya tiene cuenta, precarga los datos; si no, arranca
 * vacío. Al guardar persiste como override y dispara evento para refrescar.
 */
export function CuentaCobranzaDialog({ open, onOpenChange, propietario }: Props) {
  const existente = propietario.cuentaCobranza;
  const [banco, setBanco] = useState(existente?.banco ?? '');
  const [titular, setTitular] = useState(existente?.titular ?? `${propietario.nombre} ${propietario.apellido}`);
  const [cbu, setCbu] = useState(existente?.cbu ?? '');
  const [alias, setAlias] = useState(existente?.alias ?? '');
  const [cuitTitular, setCuitTitular] = useState(existente?.cuit ?? propietario.cuit);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (open) {
      setBanco(propietario.cuentaCobranza?.banco ?? '');
      setTitular(
        propietario.cuentaCobranza?.titular ?? `${propietario.nombre} ${propietario.apellido}`,
      );
      setCbu(propietario.cuentaCobranza?.cbu ?? '');
      setAlias(propietario.cuentaCobranza?.alias ?? '');
      setCuitTitular(propietario.cuentaCobranza?.cuit ?? propietario.cuit);
    }
  }, [open, propietario]);

  const guardar = async () => {
    if (!banco.trim() || !cbu.trim() || !alias.trim() || !titular.trim()) {
      toast({
        variant: 'destructive',
        title: 'Faltan datos',
        description: 'Banco, titular, CBU y alias son obligatorios.',
      });
      return;
    }
    if (cbu.replace(/\s/g, '').length !== 22) {
      toast({
        variant: 'destructive',
        title: 'CBU inválido',
        description: 'El CBU tiene que tener exactamente 22 dígitos.',
      });
      return;
    }
    setGuardando(true);
    await new Promise((r) => setTimeout(r, 350));
    guardarOverride(propietario.id, {
      cuentaCobranza: {
        banco: banco.trim(),
        titular: titular.trim(),
        cbu: cbu.replace(/\s/g, ''),
        alias: alias.trim(),
        cuit: cuitTitular.trim(),
      },
    });
    setGuardando(false);
    toast({
      variant: 'success',
      title: existente ? 'Cuenta actualizada' : 'Cuenta cargada',
      description: 'A partir de ahora el inquilino puede depositar acá directamente.',
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{existente ? 'Editar cuenta de cobranza' : 'Cargar cuenta del propietario'}</DialogTitle>
          <DialogDescription>
            Si un contrato está en modo <strong>cobranza directa</strong>, el inquilino transfiere
            acá y el propietario confirma. La inmobiliaria no toca la plata, sólo audita.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cc-banco">Banco</Label>
            <Input
              id="cc-banco"
              value={banco}
              onChange={(e) => setBanco(e.target.value)}
              placeholder="Banco Galicia"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cc-titular">Titular de la cuenta</Label>
            <Input
              id="cc-titular"
              value={titular}
              onChange={(e) => setTitular(e.target.value)}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cc-cbu">CBU</Label>
              <Input
                id="cc-cbu"
                value={cbu}
                onChange={(e) => setCbu(e.target.value.replace(/[^0-9]/g, '').slice(0, 22))}
                placeholder="0070000400000123456789"
                inputMode="numeric"
                className="font-mono"
              />
              <p className="text-[10px] text-muted-foreground tabular-nums">{cbu.length}/22</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cc-alias">Alias</Label>
              <Input
                id="cc-alias"
                value={alias}
                onChange={(e) => setAlias(e.target.value.toLowerCase().replace(/[^a-z0-9.]/g, ''))}
                placeholder="alquiler.juan.perez"
                className="font-mono"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cc-cuit">CUIT del titular</Label>
            <Input
              id="cc-cuit"
              value={cuitTitular}
              onChange={(e) => setCuitTitular(e.target.value)}
              placeholder="20-12345678-9"
            />
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={guardando}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={guardando}>
            {guardando ? 'Guardando…' : existente ? 'Guardar cambios' : 'Cargar cuenta'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
