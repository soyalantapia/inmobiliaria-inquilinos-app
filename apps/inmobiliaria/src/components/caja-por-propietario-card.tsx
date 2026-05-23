'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Banknote,
  ChevronRight,
  Coins,
  HandCoins,
  Users,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@llave/ui/avatar';
import { Badge } from '@llave/ui/badge';
import { Card, CardContent } from '@llave/ui/card';
import { posicionPorPropietario, type PosicionPropietario } from '@/lib/cierre-caja';
import { formatMonto } from '@/lib/format';

/**
 * Resumen del mes desagregado por propietario — pedido del feedback:
 * "necesito ver la caja diaria de un propietario específico". Muestra
 * cobrado vs rendido vs pendiente por cada owner, y cuánto fue en
 * efectivo (importante para flujo de caja físico).
 */
export function CajaPorPropietarioCard() {
  const [pos, setPos] = useState<PosicionPropietario[]>([]);
  const [hidratado, setHidratado] = useState(false);

  useEffect(() => {
    setPos(posicionPorPropietario());
    setHidratado(true);
  }, []);

  const total = useMemo(() => {
    return pos.reduce(
      (acc, p) => ({
        cobrado: acc.cobrado + p.cobradoMes,
        rendido: acc.rendido + p.rendidoMes,
        pendiente: acc.pendiente + p.pendiente,
        efectivo: acc.efectivo + p.enEfectivoMes,
      }),
      { cobrado: 0, rendido: 0, pendiente: 0, efectivo: 0 },
    );
  }, [pos]);

  if (!hidratado) return null;

  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-md bg-primary/10 text-primary">
            <Users className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold">Caja del mes por propietario</p>
            <p className="text-xs text-muted-foreground">
              Cobrado, rendido y saldo en mano por dueño · diferencia entre
              transferencia y efectivo.
            </p>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-4">
          <Stat icono={Banknote} label="Cobrado total" valor={total.cobrado} />
          <Stat icono={HandCoins} label="Rendido total" valor={total.rendido} tono="emerald" />
          <Stat icono={Coins} label="En efectivo" valor={total.efectivo} tono="amber" />
          <Stat icono={Banknote} label="Pendiente rendir" valor={total.pendiente} tono="primary" />
        </div>

        {pos.length === 0 ? (
          <p className="rounded-md border bg-muted/30 p-6 text-center text-xs text-muted-foreground">
            Sin movimientos cobrados este mes.
          </p>
        ) : (
          <ul className="divide-y rounded-md border">
            {pos.map((p) => (
              <PropietarioRow key={p.propietarioId} pos={p} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({
  icono: Icono,
  label,
  valor,
  tono,
}: {
  icono: typeof Banknote;
  label: string;
  valor: number;
  tono?: 'emerald' | 'amber' | 'primary';
}) {
  const color =
    tono === 'emerald'
      ? 'text-emerald-600'
      : tono === 'amber'
        ? 'text-amber-700 dark:text-amber-300'
        : tono === 'primary'
          ? 'text-primary'
          : 'text-foreground';
  return (
    <div className="rounded-md border bg-background p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
        <Icono className={`h-3 w-3 ${color}`} />
        {label}
      </div>
      <p className={`mt-0.5 text-sm font-semibold tabular-nums ${color}`}>
        {formatMonto(valor)}
      </p>
    </div>
  );
}

function PropietarioRow({ pos }: { pos: PosicionPropietario }) {
  const iniciales = pos.nombre
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();
  return (
    <Link
      href={`/propietarios/${pos.propietarioId}`}
      className="flex items-center gap-3 p-3 text-sm transition-colors hover:bg-muted/40"
    >
      <Avatar className="h-9 w-9">
        <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
          {iniciales}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{pos.nombre}</p>
        <p className="text-[11px] text-muted-foreground">
          {pos.liquidacionesMes} liquidación{pos.liquidacionesMes === 1 ? '' : 'es'} ·{' '}
          {formatMonto(pos.cobradoMes)} cobrado · {formatMonto(pos.rendidoMes)} rendido
        </p>
      </div>
      <div className="flex flex-col items-end gap-0.5">
        {pos.enEfectivoMes > 0 && (
          <Badge variant="warning" className="text-[9px]">
            Efectivo {formatMonto(pos.enEfectivoMes)}
          </Badge>
        )}
        {pos.pendiente > 0 ? (
          <Badge variant="outline" className="text-[10px]">
            A rendir {formatMonto(pos.pendiente)}
          </Badge>
        ) : (
          <Badge variant="success" className="text-[10px]">
            Al día
          </Badge>
        )}
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </Link>
  );
}
