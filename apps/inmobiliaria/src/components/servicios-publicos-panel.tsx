'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Cable,
  Droplets,
  Edit3,
  Flame,
  Landmark,
  Plus,
  Receipt,
  Wifi,
  Zap,
} from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card, CardContent } from '@llave/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@llave/ui/dialog';
import { Input } from '@llave/ui/input';
import { Label } from '@llave/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@llave/ui/select';
import { Textarea } from '@llave/ui/textarea';
import { toast } from '@llave/ui/use-toast';
import {
  type DatosServicio,
  type TipoServicio,
  DISTRIBUIDORAS_SUGERIDAS,
  TIPO_SERVICIO_LABEL,
  guardarServicio,
  leerServiciosDe,
} from '@/lib/servicios-publicos-storage';
import { formatFecha } from '@/lib/format';

const ICONO_SERVICIO: Record<TipoServicio, typeof Zap> = {
  LUZ: Zap,
  GAS: Flame,
  AGUA: Droplets,
  INTERNET: Wifi,
  ABL: Landmark,
  CABLE: Cable,
};

const ORDEN: TipoServicio[] = ['LUZ', 'GAS', 'AGUA', 'INTERNET', 'ABL', 'CABLE'];

interface Props {
  propiedadId: string;
}

export function ServiciosPublicosPanel({ propiedadId }: Props) {
  const [servicios, setServicios] = useState<DatosServicio[]>([]);
  const [hidratado, setHidratado] = useState(false);
  const [editar, setEditar] = useState<{ tipo: TipoServicio; existente?: DatosServicio } | null>(
    null,
  );

  useEffect(() => {
    setServicios(leerServiciosDe(propiedadId));
    setHidratado(true);
  }, [propiedadId]);

  const porTipo = useMemo(() => {
    const map = new Map<TipoServicio, DatosServicio>();
    servicios.forEach((s) => map.set(s.tipo, s));
    return map;
  }, [servicios]);

  const guardar = (input: DatosServicio) => {
    guardarServicio(propiedadId, input);
    setServicios(leerServiciosDe(propiedadId));
    setEditar(null);
    toast({
      variant: 'success',
      title: 'Servicio actualizado',
      description: `${TIPO_SERVICIO_LABEL[input.tipo]} · ${input.distribuidora}`,
    });
  };

  if (!hidratado) return null;

  return (
    <div className="space-y-4">
      <Card className="border-amber-200 bg-amber-50/40 dark:border-amber-900/30 dark:bg-amber-900/10">
        <CardContent className="flex items-start gap-3 p-4 text-xs">
          <Receipt className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" />
          <div>
            <p className="font-medium text-amber-900 dark:text-amber-100">
              Datos técnicos por servicio
            </p>
            <p className="text-amber-900/70 dark:text-amber-200/70">
              Cargá distribuidora, NIS y medidor por servicio. El inquilino los ve
              cuando tiene que subir la boleta del mes; vos los usás para gestionar
              cortes, cambios de titularidad y reclamos a la empresa.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        {ORDEN.map((tipo) => {
          const Icon = ICONO_SERVICIO[tipo];
          const datos = porTipo.get(tipo);
          return (
            <Card key={tipo}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div
                      className={`grid h-9 w-9 place-items-center rounded-md ${
                        datos ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{TIPO_SERVICIO_LABEL[tipo]}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {datos ? datos.distribuidora : 'Sin datos cargados'}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant={datos ? 'ghost' : 'secondary'}
                    size="sm"
                    onClick={() => setEditar({ tipo, existente: datos })}
                  >
                    {datos ? (
                      <>
                        <Edit3 className="h-3.5 w-3.5" />
                        <span className="text-xs">Editar</span>
                      </>
                    ) : (
                      <>
                        <Plus className="h-3.5 w-3.5" />
                        <span className="text-xs">Cargar</span>
                      </>
                    )}
                  </Button>
                </div>

                {datos && (
                  <div className="space-y-1.5 rounded-md bg-muted/40 p-2.5 text-xs">
                    <Linea k="NIS / Nº cliente" v={datos.nis} mono />
                    {datos.numeroMedidor && <Linea k="Medidor" v={datos.numeroMedidor} mono />}
                    {datos.titular && <Linea k="Titular" v={datos.titular} />}
                    {datos.consumoPromedioMensual && (
                      <Linea
                        k="Consumo promedio"
                        v={`$${datos.consumoPromedioMensual.toLocaleString('es-AR')} / mes`}
                      />
                    )}
                    {datos.observaciones && (
                      <p className="border-t pt-1.5 text-[10px] text-muted-foreground">
                        {datos.observaciones}
                      </p>
                    )}
                    <p className="text-[9px] uppercase tracking-wide text-muted-foreground">
                      Actualizado {formatFecha(datos.actualizadoAt)}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <ServicioDialog
        abierto={!!editar}
        onClose={() => setEditar(null)}
        tipo={editar?.tipo ?? 'LUZ'}
        existente={editar?.existente}
        onGuardar={guardar}
      />
    </div>
  );
}

function Linea({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{k}</span>
      <span className={`text-xs font-medium ${mono ? 'tabular-nums font-mono' : ''}`}>{v}</span>
    </div>
  );
}

interface DialogProps {
  abierto: boolean;
  onClose: () => void;
  tipo: TipoServicio;
  existente?: DatosServicio;
  onGuardar: (input: DatosServicio) => void;
}

function ServicioDialog({ abierto, onClose, tipo, existente, onGuardar }: DialogProps) {
  const [distribuidora, setDistribuidora] = useState('');
  const [nis, setNis] = useState('');
  const [medidor, setMedidor] = useState('');
  const [titular, setTitular] = useState('');
  const [consumo, setConsumo] = useState('');
  const [observaciones, setObservaciones] = useState('');

  useEffect(() => {
    if (!abierto) return;
    setDistribuidora(existente?.distribuidora ?? '');
    setNis(existente?.nis ?? '');
    setMedidor(existente?.numeroMedidor ?? '');
    setTitular(existente?.titular ?? '');
    setConsumo(existente?.consumoPromedioMensual?.toString() ?? '');
    setObservaciones(existente?.observaciones ?? '');
  }, [abierto, existente]);

  const sugerencias = DISTRIBUIDORAS_SUGERIDAS[tipo];

  const submit = () => {
    if (!distribuidora.trim() || !nis.trim()) {
      toast({
        variant: 'destructive',
        title: 'Faltan datos',
        description: 'Necesito al menos distribuidora y número de cliente / NIS.',
      });
      return;
    }
    onGuardar({
      tipo,
      distribuidora: distribuidora.trim(),
      nis: nis.trim(),
      numeroMedidor: medidor.trim() || undefined,
      titular: titular.trim() || undefined,
      consumoPromedioMensual: consumo ? parseInt(consumo, 10) : undefined,
      observaciones: observaciones.trim() || undefined,
      actualizadoAt: new Date().toISOString(),
    });
  };

  return (
    <Dialog open={abierto} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{TIPO_SERVICIO_LABEL[tipo]} · datos del servicio</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="distribuidora">Distribuidora</Label>
            <Select value={distribuidora} onValueChange={setDistribuidora}>
              <SelectTrigger id="distribuidora">
                <SelectValue placeholder="Elegí o tipeá una nueva" />
              </SelectTrigger>
              <SelectContent>
                {sugerencias.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="O ingresá manual"
              value={distribuidora}
              onChange={(e) => setDistribuidora(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="nis">NIS / Nº cliente</Label>
              <Input
                id="nis"
                placeholder="Ej. 7841029-3"
                value={nis}
                onChange={(e) => setNis(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="medidor">Nº medidor</Label>
              <Input
                id="medidor"
                placeholder="Opcional"
                value={medidor}
                onChange={(e) => setMedidor(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="titular">Titular del servicio</Label>
            <Input
              id="titular"
              placeholder="A nombre de quién factura"
              value={titular}
              onChange={(e) => setTitular(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="consumo">Consumo promedio mensual (ARS)</Label>
            <Input
              id="consumo"
              type="number"
              placeholder="Opcional · alertar si difiere"
              value={consumo}
              onChange={(e) => setConsumo(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="obs">Observaciones</Label>
            <Textarea
              id="obs"
              rows={2}
              placeholder="Tarifa social, va por expensas, etc."
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={submit}>
              <CheckCircle2 className="h-4 w-4" />
              Guardar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
