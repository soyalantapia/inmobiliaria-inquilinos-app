import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Calendar, CreditCard, Receipt } from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card } from '@llave/ui/card';
import { Separator } from '@llave/ui/separator';
import { liquidacionesMock } from '@/lib/mock-data';
import { formatFecha, formatMonto, formatPeriodo } from '@/lib/format';

export default function DetallePagoPage({ params }: { params: { liqId: string } }) {
  const liq = liquidacionesMock.find((l) => l.id === params.liqId);
  if (!liq) notFound();

  const esPagado = liq.estado === 'PAGADO';

  return (
    <>
      <header className="flex items-center gap-3 p-5">
        <Link href="/" className="rounded-full p-2 hover:bg-muted" aria-label="Volver">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-lg font-semibold">{formatPeriodo(liq.periodo)}</h1>
      </header>

      <main className="flex-1 space-y-5 px-5 pb-6">
        <Card className="space-y-4 p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total a pagar</span>
            <Badge variant={esPagado ? 'success' : 'warning'}>
              {esPagado ? 'Pagado' : 'Pendiente'}
            </Badge>
          </div>
          <div className="text-4xl font-semibold">
            {formatMonto(liq.montoTotal, liq.moneda)}
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            Vence el {formatFecha(liq.fechaVencimiento)}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Detalle
          </h2>
          <div className="space-y-3 text-sm">
            <Row label="Alquiler" value={formatMonto(liq.montoAlquiler, liq.moneda)} />
            {liq.montoExpensas !== null && (
              <Row label="Expensas" value={formatMonto(liq.montoExpensas, liq.moneda)} />
            )}
            {liq.montoPunitorio > 0 && (
              <Row
                label="Punitorios por mora"
                value={formatMonto(liq.montoPunitorio, liq.moneda)}
                highlight
              />
            )}
            <Separator />
            <Row label="Total" value={formatMonto(liq.montoTotal, liq.moneda)} bold />
          </div>
        </Card>

        {!esPagado ? (
          <div className="space-y-3">
            <Button asChild size="xl" className="w-full">
              <Link href={`/pago/${liq.id}/checkout`}>
                <CreditCard className="h-5 w-5" />
                Pagar {formatMonto(liq.montoTotal, liq.moneda)}
              </Link>
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Pasarela: Mercado Pago · cobra la inmobiliaria, Llave intermedia.
            </p>
          </div>
        ) : (
          <Button variant="outline" size="xl" className="w-full">
            <Receipt className="h-5 w-5" />
            Descargar comprobante
          </Button>
        )}
      </main>
    </>
  );
}

function Row({
  label,
  value,
  bold,
  highlight,
}: {
  label: string;
  value: string;
  bold?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={highlight ? 'text-destructive' : 'text-muted-foreground'}>{label}</span>
      <span className={bold ? 'text-base font-semibold' : highlight ? 'font-medium text-destructive' : ''}>
        {value}
      </span>
    </div>
  );
}
