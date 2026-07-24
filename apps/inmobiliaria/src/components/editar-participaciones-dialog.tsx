'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, Trash2, Users } from 'lucide-react';
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
import { ApiError, varianteError } from '@/lib/api/client';
import { useEditarParticipaciones } from '@/lib/api/use-ajustes';
import type { ParticipacionPropietario, Propietario } from '@/lib/types';

/**
 * Editar los DUEÑOS y su % de una propiedad. Antes no había forma de cambiar el
 * reparto tras el alta (un dueño que vende su parte, proporciones que cambian);
 * y el % define cuánto le toca a cada uno en cada rendición. Reemplaza el set
 * completo vía PUT /propiedades/:id/participaciones (el server valida sum=100).
 */

interface Fila {
  rowId: string;
  propietarioId: string;
  porcentaje: number;
}

let seq = 0;
const rid = () => `row_${(seq += 1)}`;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  propiedadId: string;
  participacionesActuales: ParticipacionPropietario[];
  /** Catálogo de propietarios del tenant para elegir. */
  propietarios: Propietario[];
}

export function EditarParticipacionesDialog({
  open,
  onOpenChange,
  propiedadId,
  participacionesActuales,
  propietarios,
}: Props) {
  const editar = useEditarParticipaciones(propiedadId);
  const [filas, setFilas] = useState<Fila[]>([]);

  // Al abrir, precargar con el reparto actual (o una fila vacía al 100%).
  useEffect(() => {
    if (!open) return;
    const base = participacionesActuales.length
      ? participacionesActuales.map((p) => ({
          rowId: rid(),
          propietarioId: p.propietarioId,
          porcentaje: p.porcentaje,
        }))
      : [{ rowId: rid(), propietarioId: '', porcentaje: 100 }];
    setFilas(base);
  }, [open, participacionesActuales]);

  const total = filas.reduce((s, f) => s + (Number(f.porcentaje) || 0), 0);
  const ids = filas.map((f) => f.propietarioId).filter(Boolean);
  const hayDuplicado = new Set(ids).size !== ids.length;
  const todosAsignados = filas.every((f) => !!f.propietarioId);
  const sumaOk = Math.abs(total - 100) < 0.01;
  const valido = todosAsignados && sumaOk && !hayDuplicado && filas.length >= 1;

  const motivos: string[] = [];
  if (!todosAsignados) motivos.push('Asigná un propietario en cada fila');
  if (!sumaOk) motivos.push(`Los % deben sumar 100 (hoy suman ${Math.round(total * 100) / 100})`);
  if (hayDuplicado) motivos.push('Un propietario no puede estar dos veces');

  const nombrePropietario = useMemo(() => {
    const map = new Map(propietarios.map((p) => [p.id, `${p.nombre} ${p.apellido}`.trim()]));
    return (id: string) => map.get(id) ?? id;
  }, [propietarios]);

  const agregarFila = () => {
    setFilas((prev) => {
      const restante = Math.max(0, 100 - prev.reduce((s, f) => s + (Number(f.porcentaje) || 0), 0));
      return [...prev, { rowId: rid(), propietarioId: '', porcentaje: restante }];
    });
  };

  const quitarFila = (rowId: string) => {
    setFilas((prev) => (prev.length <= 1 ? prev : prev.filter((f) => f.rowId !== rowId)));
  };

  const repartirIgual = () => {
    setFilas((prev) => {
      const n = prev.length;
      if (n === 0) return prev;
      // Reparto entero que suma exacto 100: el último absorbe el redondeo.
      const base = Math.floor((100 / n) * 100) / 100;
      return prev.map((f, i) => ({
        ...f,
        porcentaje: i === n - 1 ? Math.round((100 - base * (n - 1)) * 100) / 100 : base,
      }));
    });
  };

  const guardar = async () => {
    if (!valido) return;
    try {
      await editar.mutateAsync(filas.map((f) => ({ propietarioId: f.propietarioId, porcentaje: Number(f.porcentaje) })));
      toast({ variant: 'success', title: 'Reparto actualizado', description: 'Los % se aplican en las próximas rendiciones.' });
      onOpenChange(false);
    } catch (e) {
      toast({
        variant: varianteError(e),
        title: 'No se pudo guardar',
        description: e instanceof ApiError ? e.message : 'Reintentá en un momento.',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Editar reparto de la propiedad
          </DialogTitle>
          <DialogDescription>
            Cambiá quiénes son los dueños y con qué porcentaje. El % define cuánto le toca a
            cada uno en cada rendición.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {filas.map((f) => (
            <div key={f.rowId} className="flex items-end gap-2">
              <div className="flex-1 space-y-1">
                <Label className="text-xs">Propietario</Label>
                <Select
                  value={f.propietarioId}
                  onValueChange={(v) =>
                    setFilas((prev) => prev.map((x) => (x.rowId === f.rowId ? { ...x, propietarioId: v } : x)))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Elegí un propietario" />
                  </SelectTrigger>
                  <SelectContent>
                    {propietarios.map((p) => (
                      <SelectItem
                        key={p.id}
                        value={p.id}
                        disabled={ids.includes(p.id) && f.propietarioId !== p.id}
                      >
                        {nombrePropietario(p.id)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-24 space-y-1">
                <Label className="text-xs">%</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={String(f.porcentaje)}
                  onChange={(e) =>
                    setFilas((prev) =>
                      prev.map((x) =>
                        x.rowId === f.rowId ? { ...x, porcentaje: Math.max(0, Math.min(100, Number(e.target.value) || 0)) } : x,
                      ),
                    )
                  }
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => quitarFila(f.rowId)}
                disabled={filas.length <= 1}
                aria-label="Quitar propietario"
              >
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
          ))}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={agregarFila}>
                <Plus className="h-3.5 w-3.5" />
                Agregar dueño
              </Button>
              {filas.length > 1 && (
                <Button type="button" variant="ghost" size="sm" onClick={repartirIgual}>
                  Repartir en partes iguales
                </Button>
              )}
            </div>
            <span
              className={`text-sm font-semibold tabular-nums ${sumaOk ? 'text-emerald-600' : 'text-amber-600'}`}
            >
              Total: {Math.round(total * 100) / 100}%
            </span>
          </div>

          {motivos.length > 0 && (
            <ul className="rounded-md bg-amber-50 p-2 text-[11px] text-amber-800 dark:bg-amber-900/10 dark:text-amber-300">
              {motivos.map((m) => (
                <li key={m}>• {m}</li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={editar.isPending}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={!valido || editar.isPending}>
            {editar.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Guardar reparto
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
