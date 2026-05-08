import Link from 'next/link';
import { Bell, Download } from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card, CardContent } from '@llave/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@llave/ui/table';
import { Topbar } from '@/components/topbar';
import { contratosMock } from '@/lib/mock-data';
import { formatFecha, formatMonto } from '@/lib/format';
import type { EstadoLiquidacion } from '@/lib/types';

const estadoVariant: Record<EstadoLiquidacion, React.ComponentProps<typeof Badge>['variant']> = {
  PENDIENTE: 'warning',
  PAGADO: 'success',
  PARCIAL: 'warning',
  VENCIDO: 'destructive',
};

const estadoLabel: Record<EstadoLiquidacion, string> = {
  PENDIENTE: 'Pendiente',
  PAGADO: 'Pagado',
  PARCIAL: 'Parcial',
  VENCIDO: 'Vencido',
};

export default function PagosPage() {
  const totalCobrado = contratosMock
    .filter((c) => c.estadoPagoActual === 'PAGADO')
    .reduce((acc, c) => acc + c.monto, 0);
  const totalPendiente = contratosMock
    .filter((c) => c.estadoPagoActual !== 'PAGADO')
    .reduce((acc, c) => acc + c.monto, 0);
  const morosos = contratosMock.filter((c) => c.estadoPagoActual === 'VENCIDO');

  return (
    <>
      <Topbar titulo="Pagos del mes" />
      <main className="flex-1 space-y-6 p-6">
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="p-5">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Cobrado</p>
              <p className="mt-1 text-2xl font-semibold text-emerald-600">{formatMonto(totalCobrado)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Pendiente</p>
              <p className="mt-1 text-2xl font-semibold text-amber-600">{formatMonto(totalPendiente)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">En mora</p>
              <p className="mt-1 text-2xl font-semibold text-red-600">{morosos.length}</p>
              <p className="text-xs text-muted-foreground">contrato{morosos.length === 1 ? '' : 's'}</p>
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Liquidaciones — mayo 2026</h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4" />
              Exportar
            </Button>
            <Button size="sm">
              <Bell className="h-4 w-4" />
              Recordar a morosos
            </Button>
          </div>
        </div>

        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Inquilino</TableHead>
                <TableHead>Dirección</TableHead>
                <TableHead>Vencimiento</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contratosMock.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.inquilino}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{c.direccion}</TableCell>
                  <TableCell className="text-sm">{formatFecha(c.proximoVencimiento)}</TableCell>
                  <TableCell className="text-right font-medium">{formatMonto(c.monto, c.moneda)}</TableCell>
                  <TableCell>
                    <Badge variant={estadoVariant[c.estadoPagoActual]}>
                      {estadoLabel[c.estadoPagoActual]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    <Link href={`/contratos/${c.id}`} className="text-primary hover:underline">
                      Ver contrato
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </main>
    </>
  );
}
