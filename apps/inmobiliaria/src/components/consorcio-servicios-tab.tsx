'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Edit3,
  Flame,
  HousePlus,
  Landmark,
  Lightbulb,
  Plus,
  Receipt,
  Wind,
  Wrench,
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
import { useConsorcioServicios } from '@/lib/api/use-consorcio-extra';
import {
  type ServicioComun,
  type TipoServicioConsorcio,
  TIPO_SERVICIO_CONSORCIO_LABEL,
} from '@/lib/consorcio-servicios-storage';
import { formatFechaCorta, formatMonto } from '@/lib/format';

const ICONO_SERVICIO: Record<TipoServicioConsorcio, typeof Zap> = {
  LUZ_PASILLO: Lightbulb,
  GAS_CENTRAL: Flame,
  AGUA_GENERAL: Wind,
  ASCENSOR: HousePlus,
  CALEFACCION_CENTRAL: Wrench,
  ABL: Landmark,
  OTRO: Receipt,
};

const ORDEN: TipoServicioConsorcio[] = [
  'LUZ_PASILLO',
  'GAS_CENTRAL',
  'AGUA_GENERAL',
  'ASCENSOR',
  'CALEFACCION_CENTRAL',
  'ABL',
  'OTRO',
];

interface Props {
  consorcioId: string;
}

export function ConsorcioServiciosTab({ consorcioId }: Props) {
  const { servicios, cargando, guardar: guardarServicio } = useConsorcioServicios(consorcioId);
  const [editar, setEditar] = useState<{
    tipo: TipoServicioConsorcio;
    existente?: ServicioComun;
  } | null>(null);

  const totalMensual = useMemo(
    () =>
      servicios
        .filter((s) => s.costoPromedioMensual)
        .reduce((acc, s) => acc + (s.costoPromedioMensual ?? 0), 0),
    [servicios],
  );

  // Los servicios comunes persisten en el backend (GET/PUT /consorcios/:id/servicios);
  // en build demo van a localStorage. El alta/edición ya no es demo-only.
  const puedeMutar = true;

  const guardar = async (s: ServicioComun) => {
    try {
      await guardarServicio(s);
      setEditar(null);
      toast({
        variant: 'success',
        title: 'Servicio actualizado',
        description: `${TIPO_SERVICIO_CONSORCIO_LABEL[s.tipo]} · ${s.proveedor}`,
      });
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'No se pudo guardar',
        description: e instanceof Error ? e.message : 'Intentá de nuevo.',
      });
    }
  };

  if (cargando) return null;

  const porTipo = new Map(servicios.map((s) => [s.tipo, s]));

  return (
    <div className="space-y-4">
      <Card className="border-violet-200 bg-violet-50/30 dark:border-violet-900/40 dark:bg-violet-900/10">
        <CardContent className="space-y-2 p-4 text-xs">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-md bg-violet-500/15 text-violet-600">
              <Receipt className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">Servicios comunes del consorcio</p>
              <p className="text-muted-foreground">
                NIS, medidor y costo promedio de los servicios que paga el
                consorcio como un todo. Costo estimado mensual:{' '}
                <strong className="text-foreground">{formatMonto(totalMensual)}</strong>.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        {ORDEN.map((tipo) => {
          const Icon = ICONO_SERVICIO[tipo];
          const datos = porTipo.get(tipo);
          return (
            <Card key={tipo}>
              <CardContent className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`grid h-9 w-9 place-items-center rounded-md ${
                        datos
                          ? 'bg-primary/10 text-primary'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">
                        {TIPO_SERVICIO_CONSORCIO_LABEL[tipo]}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {datos ? datos.proveedor : 'Sin datos cargados'}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant={datos ? 'ghost' : 'secondary'}
                    size="sm"
                    onClick={() => setEditar({ tipo, existente: datos })}
                    disabled={!puedeMutar}
                    title={puedeMutar ? undefined : 'Próximamente'}
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
                  <div className="space-y-1 rounded-md bg-muted/30 p-2 text-xs">
                    <Linea k="NIS / Nº cliente" v={datos.nis} mono />
                    {datos.numeroMedidor && (
                      <Linea k="Medidor" v={datos.numeroMedidor} mono />
                    )}
                    {datos.costoPromedioMensual && (
                      <Linea
                        k="Costo promedio"
                        v={`${formatMonto(datos.costoPromedioMensual)} / mes`}
                      />
                    )}
                    {datos.observaciones && (
                      <p className="border-t pt-1.5 text-[10px] text-muted-foreground">
                        {datos.observaciones}
                      </p>
                    )}
                    <p className="text-[9px] uppercase tracking-wide text-muted-foreground">
                      Actualizado {formatFechaCorta(datos.actualizadoAt)}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <ServicioConsorcioDialog
        abierto={!!editar}
        onClose={() => setEditar(null)}
        tipo={editar?.tipo ?? 'LUZ_PASILLO'}
        existente={editar?.existente}
        onGuardar={guardar}
        puedeMutar={puedeMutar}
      />
    </div>
  );
}

function Linea({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[9px] uppercase tracking-wide text-muted-foreground">
        {k}
      </span>
      <span className={`text-xs font-medium ${mono ? 'font-mono tabular-nums' : ''}`}>
        {v}
      </span>
    </div>
  );
}

interface DialogProps {
  abierto: boolean;
  onClose: () => void;
  tipo: TipoServicioConsorcio;
  existente?: ServicioComun;
  onGuardar: (s: ServicioComun) => void;
  puedeMutar: boolean;
}

function ServicioConsorcioDialog({
  abierto,
  onClose,
  tipo,
  existente,
  onGuardar,
  puedeMutar,
}: DialogProps) {
  const [proveedor, setProveedor] = useState('');
  const [nis, setNis] = useState('');
  const [medidor, setMedidor] = useState('');
  const [costo, setCosto] = useState('');
  const [observaciones, setObservaciones] = useState('');

  useEffect(() => {
    if (!abierto) return;
    setProveedor(existente?.proveedor ?? '');
    setNis(existente?.nis ?? '');
    setMedidor(existente?.numeroMedidor ?? '');
    setCosto(existente?.costoPromedioMensual?.toString() ?? '');
    setObservaciones(existente?.observaciones ?? '');
  }, [abierto, existente]);

  const submit = () => {
    if (!puedeMutar) return;
    if (!proveedor.trim() || !nis.trim()) {
      toast({
        variant: 'destructive',
        title: 'Faltan datos',
        description: 'Necesito proveedor y NIS / nº cliente.',
      });
      return;
    }
    onGuardar({
      tipo,
      proveedor: proveedor.trim(),
      nis: nis.trim(),
      numeroMedidor: medidor.trim() || undefined,
      costoPromedioMensual: costo ? parseInt(costo, 10) : undefined,
      observaciones: observaciones.trim() || undefined,
      actualizadoAt: new Date().toISOString(),
    });
  };

  return (
    <Dialog open={abierto} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {TIPO_SERVICIO_CONSORCIO_LABEL[tipo]} · datos
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="prov">Proveedor / empresa</Label>
            <Input
              id="prov"
              placeholder="Ej. Edesur, Ascensores Otis…"
              value={proveedor}
              onChange={(e) => setProveedor(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="nis">NIS / Nº cliente</Label>
              <Input
                id="nis"
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
            <Label htmlFor="costo">Costo promedio mensual (ARS)</Label>
            <Input
              id="costo"
              type="number"
              inputMode="decimal"
              min="0"
              value={costo}
              onChange={(e) => setCosto(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="obs">Observaciones</Label>
            <Textarea
              id="obs"
              rows={2}
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              onClick={submit}
              disabled={!puedeMutar}
              title={puedeMutar ? undefined : 'Próximamente'}
            >
              Guardar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
