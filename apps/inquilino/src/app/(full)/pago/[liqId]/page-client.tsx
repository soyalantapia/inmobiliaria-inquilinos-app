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
  RotateCcw,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card } from '@llave/ui/card';
import { Separator } from '@llave/ui/separator';
import { toast } from '@llave/ui/use-toast';
import { contratoMock, liquidacionesMock } from '@/lib/mock-data';
import { formatFecha, formatFechaCorta, formatMonto, formatPeriodo } from '@/lib/format';
import { abrirReciboImprimible } from '@/lib/recibo-pdf';
import { resolverMontos } from '@/lib/punitorios';
import {
  leerPagoInformado,
  listarPagosDeLiq,
  saldoPendiente,
  type PagoInformado,
} from '@/lib/pago-storage';
import {
  decisionInmoPago,
  type DecisionInmoSobrePago,
} from '@/lib/cross-app-inmo';
import { aplicarEstadoDemo, useDemoEstado } from '@/lib/demo-estado';
import { apiEnabled, useLiquidacion } from '@/lib/api/use-pago';
import { useMiContrato } from '@/lib/api/hooks';
import { useCurrentUser } from '@/lib/use-current-user';
import type { Liquidacion } from '@/lib/types';

export default function DetallePagoPage({ params }: { params: { liqId: string } }) {
  const router = useRouter();

  // Origen de la liquidación: API en prod (useLiquidacion deriva de
  // useMisLiquidaciones), liquidacionesMock en la demo offline. La búsqueda
  // por liqId vive dentro del hook.
  const { liquidacion: liqApi, cargando, isError } = useLiquidacion(params.liqId);

  // En modo demo seguimos usando el mock + el "modo demo" (al día / atrasado)
  // y todo el store local de parciales/decisiones. En prod no hay endpoint
  // del inquilino para esos datos, así que quedan vacíos.
  const liqBase = liquidacionesMock.find((l) => l.id === params.liqId);
  const [demoEstado] = useDemoEstado();
  const liqDemo = liqBase ? aplicarEstadoDemo(demoEstado, liqBase) : null;

  // Loading real (sólo prod, mientras useMisLiquidaciones está pendiente).
  if (apiEnabled && cargando) {
    return (
      <main className="flex-1 px-5 py-10">
        <p className="text-sm text-muted-foreground">Cargando la liquidación…</p>
      </main>
    );
  }

  // Error de API (sólo prod): el liqId puede ser perfectamente válido pero el
  // backend está caído / la request falló. NO disparamos notFound (que daría un
  // 404 engañoso "esta liquidación no existe"): mostramos un estado de error
  // con reintento para no perder un liqId real por una caída transitoria.
  if (apiEnabled && isError) {
    return (
      <main className="flex-1 px-5 py-10 text-center">
        <p className="text-sm font-medium">No pudimos cargar la liquidación.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Revisá tu conexión e intentá de nuevo.
        </p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => window.location.reload()}
        >
          Reintentar
        </Button>
      </main>
    );
  }

  // No encontrada: en demo nunca pasa (generateStaticParams cubre todos los
  // ids del mock); en prod, si la lista cargó OK pero no contiene este liqId,
  // la liquidación realmente no existe → notFound.
  // En demo: estado 'al-dia' → liqDemo es null → notFound (no hay nada pendiente,
  // coherente con el home). Antes un `?? liqBase` mostraba el mock VENCIDO crudo,
  // contradiciendo el "Estás al día" del home.
  const liq = apiEnabled ? liqApi : liqDemo;
  if (!liq) notFound();

  return (
    <DetallePagoView liq={liq} liqId={params.liqId} router={router} />
  );
}

/**
 * Vista del detalle. Separada para poder llamar hooks (useState/useEffect)
 * después del early-return de loading/notFound sin romper las reglas de
 * hooks. `liq` ya viene resuelta (API o mock).
 */
function DetallePagoView({
  liq,
  liqId,
  router,
}: {
  liq: Liquidacion;
  liqId: string;
  router: ReturnType<typeof useRouter>;
}) {
  const [informado, setInformado] = useState<PagoInformado | null>(null);
  const [parciales, setParciales] = useState<PagoInformado[]>([]);
  const [decisionInmo, setDecisionInmo] = useState<DecisionInmoSobrePago | null>(null);
  // Datos reales para el recibo imprimible en prod: nombre de la sesión OTP +
  // dirección/inmobiliaria del contrato real. En demo no se usan (ver abajo).
  const user = useCurrentUser();
  const { contrato } = useMiContrato();
  useEffect(() => {
    // Historial de parciales + decisión del inmo: sólo en la demo offline.
    // En prod el API no expone esos datos al inquilino, así que quedan vacíos
    // (la liq de por sí ya refleja PAGADO cuando el inmo concilia).
    if (apiEnabled) return;
    setInformado(leerPagoInformado(liqId));
    setParciales(listarPagosDeLiq(liqId));
    setDecisionInmo(decisionInmoPago(liqId));
  }, [liqId]);

  // `liq` ya viene resuelta (API en prod, mock en demo). En prod total/punitorio
  // salen del API (server = verdad), no del re-cálculo con la tasa default.
  const calc = resolverMontos(liq, apiEnabled);
  const vencido = calc.diasAtraso > 0;
  const pagado = liq.estado === 'PAGADO';
  const rechazadoPorInmo = decisionInmo?.estado === 'RECHAZADO';
  const confirmadoPorInmo = decisionInmo?.estado === 'CONCILIADO';
  // Mostramos "pendiente de validación" sólo si el inmo todavía no decidió.
  const pendienteValidacion =
    informado?.estado === 'INFORMADO' && !rechazadoPorInmo && !confirmadoPorInmo;
  // Saldo pendiente. En prod sale del API (montoTotal − conciliados = liq.saldo);
  // en demo, de los parciales del store local. Antes en prod siempre daba el total
  // completo, así que un parcial ya conciliado no bajaba la deuda mostrada (bug 1/3).
  const saldo = apiEnabled
    ? Math.max(0, liq.saldo ?? calc.totalAPagar)
    : saldoPendiente(liqId, calc.totalAPagar);
  const totalInformado = calc.totalAPagar - saldo;
  // "Hay parciales / quedó al día por parciales": en prod lo derivamos de
  // montoPagado (conciliado) en vez del historial local (vacío en prod).
  const tieneParciales = apiEnabled ? (liq.montoPagado ?? 0) > 0 : parciales.length > 0;
  const hayParciales = tieneParciales && saldo > 0;
  const pagadoEnParciales = !pagado && tieneParciales && saldo === 0;

  return (
    <>
      <header className="flex items-center gap-3 p-5">
        <button
          type="button"
          onClick={() => router.push('/')}
          className="rounded-full p-2 hover:bg-muted"
          aria-label="Volver"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-semibold">{formatPeriodo(liq.periodo)}</h1>
      </header>

      <main className="flex-1 space-y-5 px-5 pb-6">
        {rechazadoPorInmo && decisionInmo && (
          <Card className="space-y-3 border-destructive bg-destructive/5 p-4">
            <div className="flex items-start gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-destructive text-destructive-foreground">
                <XCircle className="h-5 w-5" />
              </div>
              <div className="flex-1 space-y-1">
                <p className="text-sm font-semibold text-destructive">
                  Tu pago fue rechazado
                </p>
                {decisionInmo.motivo && (
                  <p className="rounded-md bg-background/60 p-2 text-xs italic">
                    “{decisionInmo.motivo}”
                  </p>
                )}
                <p className="text-[11px] text-muted-foreground">
                  Rechazado por {decisionInmo.decidiSPor} ·{' '}
                  {formatFecha(decisionInmo.decidiSAt)}
                </p>
              </div>
            </div>
            <Button asChild size="lg" variant="destructive" className="w-full">
              <Link href={`/pago/${liq.id}/checkout`}>
                <RotateCcw className="h-4 w-4" />
                Volver a subir comprobante
              </Link>
            </Button>
          </Card>
        )}

        {confirmadoPorInmo && decisionInmo && !pagado && (
          <Card className="flex items-start gap-3 border-emerald-200 bg-emerald-50 p-4 text-sm dark:border-emerald-900/40 dark:bg-emerald-900/10">
            <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <div className="flex-1">
              <p className="font-medium text-emerald-900 dark:text-emerald-200">
                Pago confirmado
              </p>
              <p className="text-xs text-emerald-900/80 dark:text-emerald-200/80">
                {decisionInmo.decidiSPor} validó tu comprobante el{' '}
                {formatFecha(decisionInmo.decidiSAt)}. Ya está acreditado.
              </p>
            </div>
          </Card>
        )}

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
            <span className="text-sm text-muted-foreground">
              {hayParciales ? 'Saldo pendiente' : 'Total a pagar'}
            </span>
            {pagado || pagadoEnParciales ? (
              <Badge variant="success">Pagado</Badge>
            ) : hayParciales ? (
              <Badge variant="warning">Parcial</Badge>
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
              {formatMonto(
                pagado || pagadoEnParciales
                  ? liq.montoTotal
                  : hayParciales
                    ? saldo
                    : calc.totalAPagar,
                liq.moneda,
              )}
            </p>
            {hayParciales && (
              <p className="text-xs text-muted-foreground">
                Total del mes {formatMonto(calc.totalAPagar, liq.moneda)} · Ya{' '}
                {apiEnabled ? 'pagaste' : 'informaste'} {formatMonto(totalInformado, liq.moneda)}
              </p>
            )}
            {!pagado && !pagadoEnParciales && (
              <p className="flex items-center gap-1 text-sm text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                {vencido
                  ? `Venció el ${formatFechaCorta(liq.fechaVencimiento)}`
                  : `Vence el ${formatFechaCorta(liq.fechaVencimiento)}`}
              </p>
            )}
          </div>
        </Card>

        {parciales.length > 0 && (
          <Card className="space-y-2 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Pagos informados ({parciales.length})
            </p>
            <div className="divide-y">
              {parciales.map((p) => (
                <div key={p.id} className="flex items-center gap-3 py-2 text-sm">
                  <div
                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${
                      p.estado === 'CONCILIADO'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                        : p.estado === 'RECHAZADO'
                          ? 'bg-destructive/10 text-destructive'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                    }`}
                  >
                    {p.estado === 'CONCILIADO' ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : p.estado === 'RECHAZADO' ? (
                      <XCircle className="h-3.5 w-3.5" />
                    ) : (
                      <Clock className="h-3.5 w-3.5" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium tabular-nums">
                      {formatMonto(p.monto, liq.moneda)}
                      {p.tipo === 'PARCIAL' && (
                        <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                          · parcial
                        </span>
                      )}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {formatFecha(p.enviadoAt)}
                      {' · '}
                      {p.estado === 'CONCILIADO'
                        ? 'Confirmado'
                        : p.estado === 'RECHAZADO'
                          ? 'Rechazado'
                          : 'En revisión'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        <Card className="p-5">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Cómo se compone
          </h2>
          <div className="space-y-3 text-sm">
            <Row label="Alquiler" value={formatMonto(liq.montoAlquiler, liq.moneda)} />
            {liq.montoExpensas !== null && (
              <Row label="Expensas" value={formatMonto(liq.montoExpensas, liq.moneda)} />
            )}
            {vencido && calc.punitorioAcumulado > 0 && (
              <>
                <Separator />
                <div className="space-y-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
                    <div className="space-y-1.5 text-xs">
                      <p className="font-medium text-destructive">Punitorios por mora</p>
                      <p className="text-muted-foreground">
                        {calc.tasaDiariaPct > 0
                          ? `Tasa ${calc.tasaDiariaPct}% diario sobre el monto original · ${calc.diasAtraso} día${calc.diasAtraso === 1 ? '' : 's'} de atraso`
                          : `${calc.diasAtraso} día${calc.diasAtraso === 1 ? '' : 's'} de atraso`}
                      </p>
                    </div>
                  </div>
                  <Row
                    label="Acumulado hasta hoy"
                    value={`+ ${formatMonto(calc.punitorioAcumulado, liq.moneda)}`}
                    highlight
                  />
                  {calc.punitorioPorDia > 0 && (
                    <p className="rounded bg-destructive/10 px-2 py-1 text-[11px] font-medium text-destructive">
                      <TrendingUp className="mr-1 inline h-3 w-3" />
                      Sumás {formatMonto(calc.punitorioPorDia, liq.moneda)} por cada día más que pase
                    </p>
                  )}
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

        {pagado || pagadoEnParciales ? (
          <Button
            variant="outline"
            size="xl"
            className="w-full"
            onClick={() => {
              const pagoBase = informado ?? parciales[0] ?? null;
              // En prod la fecha REAL del pago viene de la liquidación conciliada
              // (liq.fechaPago); antes el pagoBase local estaba vacío y el recibo
              // salía con la fecha de HOY. En demo liq.fechaPago es null → usa el mock.
              const fechaIso = liq.fechaPago ?? pagoBase?.enviadoAt ?? new Date().toISOString();
              abrirReciboImprimible({
                periodo: liq.periodo,
                periodoFmt: formatPeriodo(liq.periodo),
                // En prod usamos el nombre real de la sesión y la
                // dirección/inmobiliaria del contrato real; en demo
                // mantenemos los datos mock intactos.
                inquilino: apiEnabled ? user.fullName : 'Mariela Sosa',
                direccion: apiEnabled
                  ? (contrato?.direccion ?? '')
                  : contratoMock.direccion,
                monto: liq.montoTotal,
                montoFmt: formatMonto(liq.montoTotal, liq.moneda),
                metodo: 'Transferencia',
                fechaPago: fechaIso,
                fechaPagoFmt: formatFecha(fechaIso),
                inmobiliaria: apiEnabled
                  ? (contrato?.inmobiliaria ?? '')
                  : contratoMock.inmobiliaria,
              });
            }}
          >
            <Receipt className="h-5 w-5" />
            Descargar comprobante
          </Button>
        ) : hayParciales ? (
          <div className="space-y-3">
            <Button asChild size="xl" className="w-full">
              <Link href={`/pago/${liq.id}/checkout`}>
                Pagar el saldo · {formatMonto(saldo, liq.moneda)}
                <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              También podés hacer otro parcial.
            </p>
          </div>
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
              {apiEnabled
                ? 'Coordinás los datos de transferencia con la inmobiliaria. También podés hacer un pago parcial.'
                : 'Te mostramos CBU, alias y titular. También podés hacer un pago parcial.'}
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
