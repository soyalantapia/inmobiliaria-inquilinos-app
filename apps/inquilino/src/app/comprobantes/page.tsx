import { Download, Receipt } from 'lucide-react';
import { Card } from '@llave/ui/card';
import { NavBar } from '@/components/nav-bar';
import { comprobantesMock } from '@/lib/mock-data';
import { formatFecha, formatMonto, formatPeriodo } from '@/lib/format';

const metodoLabel = {
  MERCADOPAGO: 'Mercado Pago',
  TRANSFERENCIA: 'Transferencia',
  QR: 'QR',
  CRIPTO: 'Cripto',
} as const;

export default function ComprobantesPage() {
  return (
    <>
      <header className="p-5">
        <h1 className="text-lg font-semibold">Comprobantes</h1>
        <p className="text-sm text-muted-foreground">Descargá los recibos de tus pagos.</p>
      </header>

      <main className="flex-1 space-y-3 px-5 pb-6">
        {comprobantesMock.length === 0 && (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            Todavía no tenés comprobantes.
          </Card>
        )}
        {comprobantesMock.map((c) => (
          <Card key={c.id} className="flex items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                <Receipt className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium leading-tight">{formatPeriodo(c.periodo)}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFecha(c.fechaPago)} · {metodoLabel[c.metodo]}
                </p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span className="text-sm font-semibold">{formatMonto(c.monto, c.moneda)}</span>
              <a
                href={c.pdfUrl}
                download
                className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                <Download className="h-3.5 w-3.5" />
                PDF
              </a>
            </div>
          </Card>
        ))}
      </main>

      <NavBar />
    </>
  );
}
