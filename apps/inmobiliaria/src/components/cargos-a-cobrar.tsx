'use client';

import { useEffect, useState } from 'react';
import { Bell, CheckCircle2, MessageCircle, Receipt, Wrench } from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card, CardContent } from '@llave/ui/card';
import { cn } from '@llave/ui/cn';
import { toast } from '@llave/ui/use-toast';
import {
  listarCargosACobrar,
  totalesCargosMes,
  type CargoACobrar,
} from '@/lib/cargos-a-cobrar';
import { contactosCobranzaMock } from '@/lib/mock-data';
import { formatFechaCorta, formatMonto } from '@/lib/format';

/**
 * Card que muestra los cargos USO_Y_GOCE generados al inquilino con su
 * estado de cobro. Va en /pagos del inmo.
 */
export function CargosACobrar() {
  const [cargos, setCargos] = useState<CargoACobrar[]>([]);
  const [totales, setTotales] = useState({
    pendiente: 0,
    cobrado: 0,
    cantPendientes: 0,
    cantCobrados: 0,
  });
  const [hidratado, setHidratado] = useState(false);

  useEffect(() => {
    setCargos(listarCargosACobrar());
    setTotales(totalesCargosMes());
    setHidratado(true);
  }, []);

  if (!hidratado || cargos.length === 0) return null;

  return (
    <Card className="border-amber-200 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-900/10">
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-amber-700 dark:text-amber-300" />
            <div>
              <h2 className="text-base font-semibold">Cargos a inquilinos</h2>
              <p className="text-xs text-muted-foreground">
                Reparaciones USO_Y_GOCE que generaste este mes. Se cobran junto
                con el próximo alquiler.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {totales.cantPendientes > 0 && (
              <Badge variant="warning" className="gap-1 text-[10px]">
                <Receipt className="h-3 w-3" />
                {totales.cantPendientes} pendiente
                {totales.cantPendientes === 1 ? '' : 's'} ·{' '}
                {formatMonto(totales.pendiente)}
              </Badge>
            )}
            {totales.cantCobrados > 0 && (
              <Badge variant="success" className="gap-1 text-[10px]">
                <CheckCircle2 className="h-3 w-3" />
                {totales.cantCobrados} cobrado
                {totales.cantCobrados === 1 ? '' : 's'} ·{' '}
                {formatMonto(totales.cobrado)}
              </Badge>
            )}
          </div>
        </div>

        <div className="divide-y divide-amber-200/60 rounded-md border bg-background dark:divide-amber-900/30">
          {cargos.map((c) => (
            <CargoRow key={c.reclamoId} cargo={c} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function CargoRow({ cargo }: { cargo: CargoACobrar }) {
  const pendiente = cargo.estado === 'PENDIENTE';
  const contacto = contactosCobranzaMock.find((c) => c.titular.nombre === cargo.inquilino);
  const tel = contacto?.titular.telefono.replace(/[^\d]/g, '') ?? '';
  const nombrePila = cargo.inquilino.split(' ')[0] ?? cargo.inquilino;
  const mensajeWA = encodeURIComponent(
    `Hola ${nombrePila}! Te recuerdo que este mes tenés un cargo extra de ` +
      `${formatMonto(cargo.monto)} por: ${cargo.descripcion}. Se cobra junto ` +
      `con el alquiler.`,
  );
  const waUrl = tel ? `https://wa.me/${tel}?text=${mensajeWA}` : null;

  return (
    <div className="flex items-start gap-3 p-3">
      <div
        className={cn(
          'grid h-9 w-9 shrink-0 place-items-center rounded-md',
          pendiente
            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
        )}
      >
        {pendiente ? <Wrench className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="truncate text-sm font-medium">{cargo.inquilino}</p>
          <Badge
            variant={pendiente ? 'warning' : 'success'}
            className="text-[10px]"
          >
            {pendiente ? 'Pendiente' : 'Cobrado'}
          </Badge>
        </div>
        <p className="line-clamp-1 text-xs text-muted-foreground">
          {cargo.descripcion}
        </p>
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {cargo.direccion}
          {cargo.profesional && ` · ${cargo.profesional}`}
          {' · '}
          {formatFechaCorta(cargo.fechaResolucion)}
          {cargo.pagadoAt && ` · pagado el ${formatFechaCorta(cargo.pagadoAt)}`}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <p className="text-sm font-semibold tabular-nums">
          {formatMonto(cargo.monto)}
        </p>
        {pendiente && waUrl && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1 px-2 text-[11px]"
            asChild
            onClick={() => {
              toast({
                title: 'WhatsApp listo para enviar',
                description: `Abrimos el chat con ${nombrePila}. Mandá el mensaje cuando quieras.`,
              });
            }}
          >
            <a href={waUrl} target="_blank" rel="noreferrer">
              <Bell className="h-3 w-3" />
              Recordar
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}
