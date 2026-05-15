'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { notFound, useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  Receipt,
  TrendingUp,
} from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card } from '@llave/ui/card';
import { Separator } from '@llave/ui/separator';
import { toast } from '@llave/ui/use-toast';
import { liquidacionesMock } from '@/lib/mock-data';
import { formatFecha, formatMonto, formatPeriodo } from '@/lib/format';
import { TASA_PUNITORIA_DIARIA_DEFAULT, calcularPunitorios } from '@/lib/punitorios';
import { leerPagoInformado, type PagoInformado } from '@/lib/pago-storage';
import { aplicarEstadoDemo, useDemoEstado } from '@/lib/demo-estado';

export default function DetallePagoPage({ params }: { params: { liqId: string } }) {
  const router = useRouter();
  const liqBase = liquidacionesMock.find((l) => l.id === params.liqId);
  if (!liqBase) notFound();

  // Aplicamos el modo demo a la liquidación. Si "a tiempo", la fecha de
  // vencimiento pasa a ser futura → calcularPunitorios devuelve diasAtraso=0
  // y la pantalla se muestra como "pendiente" sin recargos.
  const [demoEstado] = useDemoEstado();
  const liqDemo = aplicarEstadoDemo(demoEstado, liqBase);
  // Si el demo dice "al día" pero igual abrimos esta página, usamos la
  // liquidación base sin atrasos (asumimos que es histórica/consulta).
  const liq = liqDemo ?? { ...liqBase, fechaVencimiento: liqBase.fechaVencimiento };

  const [informado, setInformado] = useState<PagoInformado | null>(null);
  useEffect(() => {
    setInformado(leerPagoInformado(params.liqId));
  }, [params.liqId]);

  const calc = calcularPunitorios(liq, TASA_PUNITORIA_DIARIA_DEFAULT);
  const vencido = calc.diasAtraso > 0;
  const pagado = liq.estado === 'PAGADO';
  const pendienteValidacion = informado?.estado === 'INFORMADO';

  return (
    <>
      <header className="flex items-center gap-3 p-5">
        <button
          onClick={() => router.push('/')}
          className="rounded-full p-2 hover:bg-muted"
          aria-label="Volver"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-semibold">{formatPeriodo(liq.periodo)}</h1>
      </header>

      <main className="flex-1 space-y-5 px-5 pb-6">
        {pendienteValidacion && informado && (
          <Card className="flex items-start gap-3 border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-900/40 dark:bg-amber-900/10">
            <Clock className="mt-0.5 h-4 w-4 text-amber-600 dark:text-amber-400" />
            <div className="flex-1">
              <p className="font-medium text-amber-900 dark:text-amber-200">
                Pendiente de validación
              </p>
              <p className="text-xs text-amber-900/80 dark:text-amber-200/80">
                Recibimos tu comprobante el {formatFecha(informado.enviadoAt)}. Te avisamos por
                WhatsApp en 24-48 hs cuando lo confirmemos.
              </p>
            </div>
          </Card>
        )}

        <Card className="space-y-3 p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total a pagar</span>
            {pagado ? (
              <Badge variant="success">Pagado</Badge>
            ) : vencido ? (
              <Badge variant="destructive">
                Atrasado · {calc.diasAtraso} día{calc.diasAtraso === 1 ? '' : 's'}
              </Badge>
            ) : (
              <Badge variant="warning">Pendiente</Badge>
            )}
          </div>
          <div>
            <p className="text-4xl font-semibold tabular-nums">
              {formatMonto(pagado ? liq.montoTotal : calc.totalAPagar, liq.moneda)}
            </p>
            {!pagado && (
              <p className="flex items-center gap-1 text-sm text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                {vencido
                  ? `Venció el ${formatFecha(liq.fechaVencimiento)}`
                  : `Vence el ${formatFecha(liq.fechaVencimiento)}`}
              </p>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Cómo se compone
          </h2>
          <div className="space-y-3 text-sm">
            <Row label="Alquiler" value={formatMonto(liq.montoAlquiler, liq.moneda)} />
            {liq.montoExpensas !== null && (
              <Row label="Expensas" value={formatMonto(liq.montoExpensas, liq.moneda)} />
            )}
            {vencido && (
              <>
                <Separator />
                <div className="space-y-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
                    <div className="space-y-1.5 text-xs">
                      <p className="font-medium text-destructive">Punitorios por mora</p>
                      <p className="text-muted-foreground">
                        Tasa {calc.tasaDiariaPct}% diario sobre el monto original · {calc.diasAtraso}{' '}
                        día{calc.diasAtraso === 1 ? '' : 's'} de atraso
                      </p>
                    </div>
                  </div>
                  <Row
                    label="Acumulado hasta hoy"
                    value={`+ ${formatMonto(calc.punitorioAcumulado, liq.moneda)}`}
                    highlight
                  />
                  <p className="rounded bg-destructive/10 px-2 py-1 text-[11px] font-medium text-destructive">
                    <TrendingUp className="mr-1 inline h-3 w-3" />
                    Sumás {formatMonto(calc.punitorioPorDia, liq.moneda)} por cada día más que pase
                  </p>
                </div>
              </>
            )}
            <Separator />
            <Row
              label="Total"
              value={formatMonto(pagado ? liq.montoTotal : calc.totalAPagar, liq.moneda)}
              bold
            />
          </div>
        </Card>

        {pagado ? (
          <Button
            variant="outline"
            size="xl"
            className="w-full"
            onClick={() =>
              toast({
                title: 'Preparando comprobante…',
                description: 'En unos segundos te llega al mail el recibo en PDF.',
              })
            }
          >
            <Receipt className="h-5 w-5" />
            Descargar comprobante
          </Button>
        ) : pendienteValidacion ? (
          <div className="space-y-3">
            <Button variant="outline" size="xl" className="w-full" asChild>
              <Link href={`/pago/${liq.id}/checkout`}>
                Ver comprobante enviado
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <p className="flex items-center justify-center gap-1 text-center text-xs text-muted-foreground">
              <CheckCircle2 className="h-3 w-3 text-emerald-500" />
              Pausamos los punitorios hasta validar
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <Button asChild size="xl" className="w-full">
              <Link href={`/pago/${liq.id}/checkout`}>
                Pagar {formatMonto(calc.totalAPagar, liq.moneda)} por transferencia
                <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Te mostramos CBU, alias y titular. Después subís el comprobante.
            </p>
          </div>
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
      <span className={highlight ? 'font-medium text-destructive' : 'text-muted-foreground'}>
        {label}
      </span>
      <span
        className={`tabular-nums ${
          bold ? 'text-base font-semibold' : highlight ? 'font-medium text-destructive' : ''
        }`}
      >
        {value}
      </span>
    </div>
  );
}
