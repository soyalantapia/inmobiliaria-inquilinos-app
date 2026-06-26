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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@llave/ui/select';
import { toast } from '@llave/ui/use-toast';
import { guardarOverride } from '@/lib/propiedades-overrides-storage';
import { apiEnabled, apiFetch, ApiError } from '@/lib/api/client';
import type { Propiedad, TipoPropiedad } from '@/lib/types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propiedad: Propiedad;
  /** Callback opcional para refrescar el padre tras guardar. */
  onGuardado?: () => void;
}

const TIPOS: Array<{ value: TipoPropiedad; label: string }> = [
  { value: 'DEPARTAMENTO', label: 'Departamento' },
  { value: 'CASA', label: 'Casa' },
  { value: 'LOCAL', label: 'Local comercial' },
  { value: 'GALPON', label: 'Galpón' },
];

/**
 * Dialog de edición de datos básicos de una propiedad. Permite cambiar
 * dirección, ciudad, provincia, tipo, ambientes y m². Los cambios se
 * guardan como override local (ver propiedades-overrides-storage).
 */
export function EditarPropiedadDialog({ open, onOpenChange, propiedad, onGuardado }: Props) {
  const [direccion, setDireccion] = useState(propiedad.direccion);
  const [ciudad, setCiudad] = useState(propiedad.ciudad);
  const [provincia, setProvincia] = useState(propiedad.provincia);
  const [tipo, setTipo] = useState<TipoPropiedad>(propiedad.tipo);
  const [ambientes, setAmbientes] = useState<string>(
    propiedad.ambientes != null ? String(propiedad.ambientes) : '',
  );
  const [m2, setM2] = useState<string>(propiedad.m2 != null ? String(propiedad.m2) : '');
  const [guardando, setGuardando] = useState(false);
  const qc = useQueryClient();

  // Reset cuando abrimos: tomamos siempre los valores actuales de la
  // propiedad (que ya incluyen override aplicado si existía).
  useEffect(() => {
    if (open) {
      setDireccion(propiedad.direccion);
      setCiudad(propiedad.ciudad);
      setProvincia(propiedad.provincia);
      setTipo(propiedad.tipo);
      setAmbientes(propiedad.ambientes != null ? String(propiedad.ambientes) : '');
      setM2(propiedad.m2 != null ? String(propiedad.m2) : '');
    }
  }, [open, propiedad]);

  const guardar = async () => {
    if (!direccion.trim()) {
      toast({
        variant: 'destructive',
        title: 'Falta la dirección',
        description: 'No podemos guardar una propiedad sin dirección.',
      });
      return;
    }
    setGuardando(true);
    const datos = {
      direccion: direccion.trim(),
      ciudad: ciudad.trim(),
      provincia: provincia.trim(),
      tipo,
      ambientes: ambientes ? Number(ambientes) : null,
      m2: m2 ? Number(m2) : null,
    };
    try {
      if (apiEnabled) {
        // Prod: persistir de verdad en la fila Propiedad + refrescar la query
        // del detalle/listado (sin esto se veían los datos viejos hasta recargar).
        await apiFetch(`/propiedades/${propiedad.id}`, {
          method: 'PUT',
          body: JSON.stringify(datos),
        });
        await Promise.all([
          qc.invalidateQueries({ queryKey: ['propiedad', propiedad.id] }),
          qc.invalidateQueries({ queryKey: ['propiedades'] }),
        ]);
      } else {
        // Demo: override local + pequeño delay para feedback consistente.
        await new Promise((r) => setTimeout(r, 350));
        guardarOverride(propiedad.id, datos);
      }
      toast({
        variant: 'success',
        title: 'Propiedad actualizada',
        description: 'Los nuevos datos ya quedaron guardados.',
      });
      onGuardado?.();
      onOpenChange(false);
    } catch (e) {
      const sinPermiso = e instanceof ApiError && e.status === 403;
      toast({
        variant: 'destructive',
        title: sinPermiso ? 'Sin permiso' : 'No se pudo guardar',
        description: sinPermiso
          ? 'Tu rol no permite editar propiedades.'
          : 'Revisá los datos e intentá de nuevo.',
      });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar propiedad</DialogTitle>
          <DialogDescription>
            Cambiá los datos básicos del inmueble. Esto no afecta contratos vigentes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="direccion" className="flex items-center gap-1">
              Dirección
              <span className="text-destructive" aria-label="obligatorio">
                *
              </span>
            </Label>
            <Input
              id="direccion"
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              placeholder="Av. Rivadavia 6420, 8°C"
              aria-required="true"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ciudad">Ciudad</Label>
              <Input
                id="ciudad"
                value={ciudad}
                onChange={(e) => setCiudad(e.target.value)}
                placeholder="CABA"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="provincia">Provincia</Label>
              <Input
                id="provincia"
                value={provincia}
                onChange={(e) => setProvincia(e.target.value)}
                placeholder="Buenos Aires"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tipo">Tipo</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as TipoPropiedad)}>
              <SelectTrigger id="tipo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ambientes" className="flex items-center gap-1.5">
                Ambientes
                <span className="text-[10px] font-normal text-muted-foreground">opcional</span>
              </Label>
              <Input
                id="ambientes"
                value={ambientes}
                onChange={(e) => setAmbientes(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="3"
                inputMode="numeric"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="m2" className="flex items-center gap-1.5">
                Metros cuadrados
                <span className="text-[10px] font-normal text-muted-foreground">opcional</span>
              </Label>
              <Input
                id="m2"
                value={m2}
                onChange={(e) => setM2(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="68"
                inputMode="numeric"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={guardando}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={guardando || !direccion.trim()}>
            {guardando ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
