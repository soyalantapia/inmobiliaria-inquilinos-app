'use client';

import { useState } from 'react';
import { Pencil, Plus, ShieldCheck, Trash2, User } from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card, CardContent } from '@llave/ui/card';
import { Input } from '@llave/ui/input';
import { Label } from '@llave/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@llave/ui/select';
import { toast } from '@llave/ui/use-toast';
import { MoneyInput } from '@/components/money-input';
import { ApiError } from '@/lib/api/client';
import {
  TIPO_GARANTE_LABEL,
  useGarantes,
  type Garante,
  type GaranteInput,
  type TipoGarante,
} from '@/lib/api/use-garantes';

const TIPOS: TipoGarante[] = ['PROPIETARIA', 'SUELDO', 'CAUCION', 'DIGITAL'];
const esPoliza = (t: TipoGarante) => t === 'CAUCION' || t === 'DIGITAL';

function GaranteForm({
  contratoId,
  inicial,
  onDone,
  onCancel,
}: {
  contratoId: string;
  inicial?: Garante;
  onDone: () => void;
  onCancel: () => void;
}) {
  const { crear, actualizar } = useGarantes(contratoId);
  const [tipo, setTipo] = useState<TipoGarante>(inicial?.tipo ?? 'SUELDO');
  const [nombre, setNombre] = useState(inicial?.nombreProveedor ?? '');
  const [dni, setDni] = useState(inicial?.dni ?? '');
  const [telefono, setTelefono] = useState(inicial?.contactoTelefono ?? '');
  const [emailC, setEmailC] = useState(inicial?.contactoEmail ?? '');
  const [numeroPoliza, setNumeroPoliza] = useState(inicial?.numeroPoliza ?? '');
  const [montoCobertura, setMontoCobertura] = useState(
    inicial?.montoCobertura != null ? String(inicial.montoCobertura) : '',
  );
  const [vigenciaHasta, setVigenciaHasta] = useState(inicial?.vigenciaHasta ? inicial.vigenciaHasta.slice(0, 10) : '');
  const guardando = crear.isPending || actualizar.isPending;

  const submit = async () => {
    if (!nombre.trim() || !telefono.trim()) {
      toast({ variant: 'destructive', title: 'Faltan datos', description: 'El nombre y el teléfono son obligatorios.' });
      return;
    }
    // Mínimos que exige el server (evita un 400 genérico): nombre 2+, teléfono 3+.
    if (nombre.trim().length < 2) {
      toast({ variant: 'destructive', title: 'Nombre muy corto', description: 'Escribí el nombre completo del garante.' });
      return;
    }
    if (telefono.trim().length < 3) {
      toast({ variant: 'destructive', title: 'Teléfono inválido', description: 'Cargá un teléfono de contacto válido.' });
      return;
    }
    const input: GaranteInput = {
      tipo,
      nombreProveedor: nombre.trim(),
      contactoTelefono: telefono.trim(),
      ...(dni.trim() ? { dni: dni.trim() } : {}),
      ...(emailC.trim() ? { contactoEmail: emailC.trim() } : {}),
      ...(numeroPoliza.trim() ? { numeroPoliza: numeroPoliza.trim() } : {}),
      ...(montoCobertura.trim() ? { montoCobertura: Number(montoCobertura) } : {}),
      ...(vigenciaHasta ? { vigenciaHasta } : {}),
    };
    try {
      if (inicial) await actualizar.mutateAsync({ id: inicial.id, ...input });
      else await crear.mutateAsync(input);
      toast({ variant: 'success', title: inicial ? 'Garante actualizado' : 'Garante agregado' });
      onDone();
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'No se pudo guardar',
        description: e instanceof ApiError ? e.message : 'Probá de nuevo en un momento.',
      });
    }
  };

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Tipo de garantía</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as TipoGarante)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {TIPO_GARANTE_LABEL[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{esPoliza(tipo) ? 'Aseguradora / proveedor' : 'Nombre del garante'} *</Label>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre y apellido" />
          </div>
          <div className="space-y-1.5">
            <Label>DNI / CUIT</Label>
            <Input value={dni} onChange={(e) => setDni(e.target.value)} placeholder="30111222" />
          </div>
          <div className="space-y-1.5">
            <Label>Teléfono *</Label>
            <Input value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="11 5555 5555" />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input value={emailC} onChange={(e) => setEmailC(e.target.value)} placeholder="garante@email.com" />
          </div>
          {esPoliza(tipo) && (
            <>
              <div className="space-y-1.5">
                <Label>Nº de póliza</Label>
                <Input value={numeroPoliza} onChange={(e) => setNumeroPoliza(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Monto de cobertura</Label>
                <MoneyInput value={montoCobertura} onChange={setMontoCobertura} />
              </div>
              <div className="space-y-1.5">
                <Label>Vigencia hasta</Label>
                <Input type="date" value={vigenciaHasta} onChange={(e) => setVigenciaHasta(e.target.value)} />
              </div>
            </>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t pt-3">
          <Button variant="ghost" onClick={onCancel} disabled={guardando}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={guardando}>
            {guardando ? 'Guardando…' : inicial ? 'Guardar cambios' : 'Agregar garante'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function ContratoGarantesPanel({ contratoId }: { contratoId: string }) {
  const { garantes, cargando, disponible, eliminar } = useGarantes(contratoId);
  const [modo, setModo] = useState<'lista' | 'nuevo' | { editar: Garante }>('lista');

  if (!disponible) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Los garantes se gestionan en producción.
        </CardContent>
      </Card>
    );
  }

  if (modo === 'nuevo') {
    return <GaranteForm contratoId={contratoId} onDone={() => setModo('lista')} onCancel={() => setModo('lista')} />;
  }
  if (typeof modo === 'object') {
    return (
      <GaranteForm
        contratoId={contratoId}
        inicial={modo.editar}
        onDone={() => setModo('lista')}
        onCancel={() => setModo('lista')}
      />
    );
  }

  const borrar = async (g: Garante) => {
    try {
      await eliminar.mutateAsync(g.id);
      toast({ variant: 'success', title: 'Garante eliminado' });
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'No se pudo eliminar',
        description: e instanceof ApiError ? e.message : 'Probá de nuevo.',
      });
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Contacto del garante y datos de la garantía (persona o póliza de caución).
        </p>
        <Button size="sm" onClick={() => setModo('nuevo')}>
          <Plus className="h-4 w-4" />
          Agregar garante
        </Button>
      </div>

      {cargando ? (
        <div className="h-20 animate-pulse rounded-lg border bg-muted/50" />
      ) : garantes.length === 0 ? (
        <Card className="p-8 text-center">
          <ShieldCheck className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium">Sin garante registrado</p>
          <p className="text-xs text-muted-foreground">Agregá el contacto del garante o la póliza de caución.</p>
        </Card>
      ) : (
        garantes.map((g) => (
          <Card key={g.id}>
            <CardContent className="flex flex-wrap items-start justify-between gap-3 p-4">
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  {esPoliza(g.tipo) ? (
                    <ShieldCheck className="h-4 w-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className="font-medium">{g.nombreProveedor}</span>
                  <Badge variant="secondary" className="text-[10px]">
                    {TIPO_GARANTE_LABEL[g.tipo]}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {g.dni ? `DNI ${g.dni} · ` : ''}
                  {g.contactoTelefono}
                  {g.contactoEmail ? ` · ${g.contactoEmail}` : ''}
                </p>
                {esPoliza(g.tipo) && (g.numeroPoliza || g.montoCobertura || g.vigenciaHasta) && (
                  <p className="text-xs text-muted-foreground">
                    {g.numeroPoliza ? `Póliza ${g.numeroPoliza}` : ''}
                    {g.vigenciaHasta ? ` · vence ${g.vigenciaHasta.slice(0, 10)}` : ''}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 gap-1">
                <Button variant="ghost" size="icon" onClick={() => setModo({ editar: g })} aria-label="Editar garante">
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive"
                  onClick={() => borrar(g)}
                  disabled={eliminar.isPending}
                  aria-label="Eliminar garante"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
