import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Card } from '@llave/ui/card';
import type { Liquidacion } from '@/lib/types';
import { diasHastaVencimiento, formatMonto, formatPeriodo } from '@/lib/format';

const estadoVariant: Record<Liquidacion['estado'], React.ComponentProps<typeof Badge>['variant']> = {
  PENDIENTE: 'warning',
  PAGADO: 'success',
  PARCIAL: 'warning',
  VENCIDO: 'destructive',
};

const estadoLabel: Record<Liquidacion['estado'], string> = {
  PENDIENTE: 'A pagar',
  PAGADO: 'Pagado',
  PARCIAL: 'Pago parcial',
  VENCIDO: 'Vencido',
};

export function PaymentCard({ liquidacion }: { liquidacion: Liquidacion }) {
  const dias = diasHastaVencimiento(liquidacion.fechaVencimiento);
  const isPagado = liquidacion.estado === 'PAGADO';
  const subtitulo = isPagado
    ? 'Pagado a tiempo'
    : dias < 0
      ? `Venció hace ${Math.abs(dias)} día${Math.abs(dias) === 1 ? '' : 's'}`
      : dias === 0
        ? 'Vence hoy'
        : `Vence en ${dias} día${dias === 1 ? '' : 's'}`;

  return (
    <Link href={`/pago/${liquidacion.id}`} className="block">
      <Card className="flex items-center justify-between p-5 transition-colors hover:border-primary/40">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              {formatPeriodo(liquidacion.periodo)}
            </span>
            <Badge variant={estadoVariant[liquidacion.estado]}>{estadoLabel[liquidacion.estado]}</Badge>
          </div>
          <div className="text-2xl font-semibold">
            {formatMonto(liquidacion.montoTotal, liquidacion.moneda)}
          </div>
          <p className="text-sm text-muted-foreground">{subtitulo}</p>
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground" />
      </Card>
    </Link>
  );
}
