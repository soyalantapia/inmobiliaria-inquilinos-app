'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Building2,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  FileImage,
  Hash,
  IdCard,
  Loader2,
  MessageCircle,
  Sparkles,
  SplitSquareHorizontal,
  Trash2,
  Upload,
  UserRound,
  X,
  XCircle,
} from 'lucide-react';
import { Button } from '@llave/ui/button';
import { Card } from '@llave/ui/card';
import { Input } from '@llave/ui/input';
import { Label } from '@llave/ui/label';
import { Separator } from '@llave/ui/separator';
import { toast } from '@llave/ui/use-toast';
import { contratoMock, liquidacionesMock } from '@/lib/mock-data';
import { datosBancariosMock, proximoCambioVigente } from '@/lib/datos-bancarios';
import { formatFecha, formatMonto, formatPeriodo } from '@/lib/format';
import { resolverMontos } from '@/lib/punitorios';
import {
  agregarPago,
  listarPagosDeLiq,
  olvidarPagoInformado,
  saldoPendiente,
  type PagoInformado,
} from '@/lib/pago-storage';
import { decisionInmoPago, type DecisionInmoSobrePago } from '@/lib/cross-app-inmo';
import { cargosExtraDelInquilino } from '@/lib/cross-app-inmo';
import { marcarVariosPagados } from '@/lib/cargos-pagados-storage';
import { extraerComprobante, type ExtraccionIA } from '@/lib/extraccion-ia';
import { leerSesion } from '@/lib/auth-otp';
import { aplicarEstadoDemo, useDemoEstado } from '@/lib/demo-estado';
import { useMiContrato, type DatosCobranza } from '@/lib/api/hooks';
import {
  apiEnabled,
  useInformarPago,
  useLiquidacion,
} from '@/lib/api/use-pago';
import { subirArchivo } from '@/lib/api/client';

type Step = 'datos' | 'comprobante' | 'ok';
const MAX_FILE_MB = 5;

export default function CheckoutPage({ params }: { params: { liqId: string } }) {
  const router = useRouter();
  // Liquidación: API en prod (useLiquidacion → useMisLiquidaciones), mock en
  // la demo offline. La búsqueda por liqId vive dentro del hook.
  const { liquidacion: liqApi, cargando } = useLiquidacion(params.liqId);
  // En demo aplicamos el estado del switcher (aplicarEstadoDemo) IGUAL que la
  // pantalla de detalle, para que monto/punitorios/estado coincidan entre el CTA
  // "Pagar $X" del detalle y este checkout. Antes el checkout leía el mock CRUDO:
  // en 'a-tiempo' cobraba punitorios que el detalle decía no aplicar, y una liq
  // ya PAGADA reaparecía como deuda repagable.
  const liqBase = liquidacionesMock.find((l) => l.id === params.liqId) ?? null;
  const [demoEstado] = useDemoEstado();
  // Sin `?? liqBase`: en 'al-dia' aplicarEstadoDemo devuelve null → el guard
  // `if (!liq || !calc)` muestra "No encontramos esta liquidación" (coherente con
  // el home). Antes el fallback mostraba el mock VENCIDO repagable.
  const liq = apiEnabled
    ? liqApi
    : liqBase
      ? aplicarEstadoDemo(demoEstado, liqBase)
      : null;

  const informarPago = useInformarPago();
  // Teléfono real de la inmobiliaria (sólo en prod) para el CTA de WhatsApp
  // del estado neutro de datos bancarios + el hint de negociar. En demo es
  // null. El contrato real aporta el alquiler vigente (umbral del hint).
  const { contrato, inmobiliariaTelefono, datosCobranza } = useMiContrato();

  const [step, setStep] = useState<Step>('datos');
  /** Pagos previos (parciales o total) ya informados para esta liq. */
  const [pagosPrevios, setPagosPrevios] = useState<PagoInformado[]>([]);
  /** Último pago hecho en esta sesión (lo que mostramos en step='ok'). */
  const [ultimoEnviado, setUltimoEnviado] = useState<PagoInformado | null>(null);
  /** Monto que el inquilino eligió pagar AHORA (puede ser saldo o parcial). */
  const [montoElegido, setMontoElegido] = useState<number | null>(null);
  /** En prod NO hay historial local de parciales (pagosPrevios queda []); este
   * estado preserva el saldo remanente tras informar un parcial, para que al
   * volver a "datos" no reaparezca el total original. */
  const [saldoProdRestante, setSaldoProdRestante] = useState<number | null>(null);
  const [decisionInmoUltima, setDecisionInmoUltima] = useState<
    DecisionInmoSobrePago | null
  >(null);
  // Sesión local: para gatear el flujo a co-inquilinos "Solo lectura" (VER), que
  // pueden ver pagos pero NO informarlos. Se lee tras montar (no en render) para
  // no romper la hidratación del export estático.
  const [sesion, setSesion] = useState<ReturnType<typeof leerSesion>>(null);
  useEffect(() => {
    setSesion(leerSesion());
  }, []);

  useEffect(() => {
    // Historial de parciales + decisión del inmo: sólo en la demo offline.
    // En prod el API no expone esos datos al inquilino.
    if (apiEnabled) return;
    setPagosPrevios(listarPagosDeLiq(params.liqId));
    setDecisionInmoUltima(decisionInmoPago(params.liqId));
  }, [params.liqId]);

  // CRÍTICO: el monto que se INFORMA al pagar deriva de calc.totalAPagar. En
  // prod (apiEnabled) debe ser liq.montoTotal real del API (server = verdad),
  // NO el re-cálculo con la tasa hardcodeada. En demo, cálculo local idéntico.
  const calc = useMemo(
    () => (liq ? resolverMontos(liq, apiEnabled) : null),
    [liq],
  );

  if (apiEnabled && cargando) {
    return (
      <main className="flex-1 px-5 py-10">
        <p className="text-sm text-muted-foreground">Cargando la liquidación…</p>
      </main>
    );
  }

  if (!liq || !calc) {
    return (
      <main className="flex-1 px-5 py-10">
        <p>No encontramos esta liquidación.</p>
        <Button asChild className="mt-4">
          <Link href="/">Volver</Link>
        </Button>
      </main>
    );
  }

  // Si la liquidación YA está paga, no re-mostramos el formulario de pago. En
  // demo (default 'atrasado') liq_002 conserva estado PAGADO, así que sin este
  // guard el checkout dejaba "re-pagar" una deuda inexistente con punitorios
  // recalculados. Antes el guard estaba gateado por `apiEnabled` y en demo no
  // corría. (El caso "informado, pendiente de validación" lo cubre el 409 del API.)
  if (liq.estado === 'PAGADO') {
    return (
      <main className="flex-1 px-5 py-10">
        <p className="text-base font-medium">Esta liquidación ya está paga. ¡Gracias!</p>
        <Button asChild className="mt-4">
          <Link href="/">Volver al inicio</Link>
        </Button>
      </main>
    );
  }

  // Co-inquilino "Solo lectura" (VER): la pantalla de invitación promete que NO
  // puede informar pagos. Lo hacemos cumplir acá, el único punto donde se informa
  // un pago (el home le muestra el monto, que sí puede ver).
  if (sesion?.esCoInquilino && sesion.permiso === 'VER') {
    return (
      <main className="flex-1 px-5 py-10">
        <div className="mx-auto max-w-md space-y-3 text-center">
          <p className="text-base font-medium">Tu acceso es de solo lectura</p>
          <p className="text-sm text-muted-foreground">
            Podés ver el contrato, las liquidaciones y los pagos, pero no informar pagos.
            Pedíselo al titular del contrato.
          </p>
          <Button asChild className="mt-2">
            <Link href="/">Volver al inicio</Link>
          </Button>
        </div>
      </main>
    );
  }

  const totalAPagar = calc.totalAPagar;
  // Saldo real: en prod sale del API (montoTotal − pagos conciliados, campo
  // liq.saldo); en demo, del store local de parciales. Antes en prod el store
  // estaba vacío → saldoBase = total completo, y un parcial ya conciliado NO
  // bajaba el saldo (bug 1/3). saldoProdRestante preserva el remanente dentro de
  // la sesión tras informar un parcial que el API todavía no concilió.
  const saldoBase = apiEnabled
    ? Math.max(0, liq.saldo ?? totalAPagar)
    : saldoPendiente(params.liqId, totalAPagar);
  const saldo = apiEnabled ? saldoProdRestante ?? saldoBase : saldoBase;
  // Alquiler vigente para el umbral del hint de negociación: en la demo es el
  // mock; en prod, el monto real del contrato (o, si no llegó, el montoAlquiler
  // de la liquidación). Nunca el mock en prod.
  const alquilerVigente = apiEnabled
    ? (contrato?.montoActual ?? liq.montoAlquiler)
    : contratoMock.montoActual;
  // Por defecto: pagar el saldo completo (que puede ser todo el total o
  // el remanente si hubo parciales antes).
  const montoActual = montoElegido ?? saldo;
  const cubreTodo = montoActual >= saldo;
  const completado = saldo === 0 && pagosPrevios.length > 0;

  return (
    <>
      <header className="flex items-center gap-3 p-5">
        <button
          type="button"
          // push (no back()): el home (banner + quick-action) linkea DIRECTO al
          // checkout salteando /pago/[liqId], así que back() salía del flujo de
          // pago. push garantiza que "Volver" siempre lleve al detalle.
          onClick={() => router.push(`/pago/${params.liqId}`)}
          className="rounded-full p-2 hover:bg-muted"
          aria-label="Volver"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-semibold">Pagar por transferencia</h1>
      </header>

      <main className="flex-1 space-y-5 px-5 pb-6">
        <Card className="space-y-1 p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {formatPeriodo(liq.periodo)} ·{' '}
            {completado ? 'Total del mes (pagado)' : 'Saldo pendiente'}
          </p>
          <p className="text-4xl font-semibold tabular-nums">
            {formatMonto(completado ? totalAPagar : saldo, liq.moneda)}
          </p>
          {!completado && totalAPagar - saldo > 0.5 && (
            <p className="text-xs text-muted-foreground">
              Total del mes {formatMonto(totalAPagar, liq.moneda)} · Ya{' '}
              {apiEnabled ? 'pagaste' : 'informaste'}{' '}
              {formatMonto(totalAPagar - saldo, liq.moneda)}
            </p>
          )}
          {calc.punitorioAcumulado > 0 && !completado && (
            <p className="text-xs text-muted-foreground">
              Incluye {formatMonto(calc.punitorioAcumulado, liq.moneda)} de punitorios por
              mora{calc.tasaDiariaPct > 0 ? ` · tasa ${calc.tasaDiariaPct}% diario` : ''}
            </p>
          )}
        </Card>

        {pagosPrevios.length > 0 && (
          <ParcialesAnteriores
            pagos={pagosPrevios}
            moneda={liq.moneda}
            decisionInmo={decisionInmoUltima}
          />
        )}

        {step === 'datos' && !completado && (
          <>
            {/* Si la deuda excede 1.2× alquiler vigente, sugerimos
                contactar a la inmo para negociar cuotas. Sin esto, el
                checkout solo ofrece "saldo completo" o "parcial" sin
                explicar que se puede pactar. En prod el alquiler vigente
                sale del contrato real (o, en su defecto, del montoAlquiler
                de la liq) y el wa.me usa el teléfono real de la inmo: si no
                tenemos teléfono, el hint no se muestra (sin CTA falso). */}
            {saldo > alquilerVigente * 1.2 && (!apiEnabled || inmobiliariaTelefono) && (
              <HintNegociarPagos
                saldo={saldo}
                alquilerVigente={alquilerVigente}
                inmobiliariaTelefono={inmobiliariaTelefono}
              />
            )}
            <SelectorMonto
              saldo={saldo}
              moneda={liq.moneda}
              valor={montoActual}
              onChange={setMontoElegido}
            />
            <StepDatosBancarios
              monto={montoActual}
              moneda={liq.moneda}
              parcial={!cubreTodo}
              inmobiliariaTelefono={inmobiliariaTelefono}
              datosCobranza={datosCobranza}
              onContinuar={() => setStep('comprobante')}
            />
          </>
        )}

        {step === 'comprobante' && !completado && (
          <StepSubirComprobante
            liqId={liq.id}
            monto={montoActual}
            tipo={cubreTodo ? 'TOTAL' : 'PARCIAL'}
            // En prod la persistencia es el POST real /pagos/informar; en la
            // demo offline seguimos guardando en pago-storage local.
            informarPagoApi={
              apiEnabled
                ? (input) => informarPago.mutateAsync(input)
                : null
            }
            onAtras={() => setStep('datos')}
            onEnviado={(p) => {
              setUltimoEnviado(p);
              // El historial local sólo aplica a la demo: en prod queda vacío.
              if (!apiEnabled) setPagosPrevios(listarPagosDeLiq(params.liqId));
              setMontoElegido(null);
              setStep('ok');
              toast({
                title: p.tipo === 'PARCIAL' ? 'Pago parcial recibido' : 'Comprobante recibido',
                description: 'Lo validamos en 24-48 hs y te avisamos por WhatsApp.',
              });
            }}
          />
        )}

        {(step === 'ok' || completado) && (
          <StepConfirmado
            informado={ultimoEnviado ?? pagosPrevios[pagosPrevios.length - 1] ?? null}
            // En prod no hay historial de parciales: el saldo restante se
            // deriva del pago recién enviado (total - lo informado ahora).
            saldoRestante={
              apiEnabled
                ? Math.max(0, saldo - (ultimoEnviado?.monto ?? saldo))
                : saldo
            }
            moneda={liq.moneda}
            allowReenviar={!apiEnabled}
            onPagarOtroParcial={() => {
              // Preservar el remanente para que "datos" muestre el saldo que
              // falta, no el total original (prod no tiene historial local).
              if (apiEnabled) {
                setSaldoProdRestante(Math.max(0, saldo - (ultimoEnviado?.monto ?? saldo)));
              }
              setMontoElegido(null);
              setUltimoEnviado(null);
              setStep('datos');
            }}
            onReenviar={() => {
              olvidarPagoInformado(liq.id);
              setPagosPrevios([]);
              setUltimoEnviado(null);
              setMontoElegido(null);
              setSaldoProdRestante(null);
              setStep('datos');
            }}
            onVolver={() => router.push('/')}
          />
        )}
      </main>
    </>
  );
}

/**
 * Lista los parciales ya informados, con su estado individual (pendiente
 * / confirmado / rechazado por el inmo). Si el último pago fue rechazado,
 * lo destacamos en rojo arriba.
 */
function ParcialesAnteriores({
  pagos,
  moneda,
  decisionInmo: _decisionInmo,
}: {
  pagos: PagoInformado[];
  moneda: 'ARS' | 'USD';
  decisionInmo: DecisionInmoSobrePago | null;
}) {
  return (
    <Card className="space-y-2 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Pagos informados ({pagos.length})
      </p>
      <div className="divide-y">
        {pagos.map((p) => (
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
                {formatMonto(p.monto, moneda)}
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
  );
}

/**
 * Banner que se muestra cuando la deuda supera 1.2× el alquiler vigente.
 * Le sugiere al inquilino contactar a la inmo por WhatsApp para negociar
 * un plan de cuotas. Antes el checkout solo ofrecía pagar el saldo
 * completo o un parcial sin guía — el inquilino con deuda alta no sabía
 * que podía pactar pagos escalonados.
 */
function HintNegociarPagos({
  saldo,
  alquilerVigente,
  inmobiliariaTelefono,
}: {
  saldo: number;
  alquilerVigente: number;
  /** Teléfono real de la inmobiliaria (prod). null en demo. */
  inmobiliariaTelefono: string | null;
}) {
  const multiplo = (saldo / alquilerVigente).toFixed(1);
  const mensaje = encodeURIComponent(
    `Hola, tengo una deuda de ${formatMonto(saldo)} (${multiplo}× mi alquiler). ¿Podemos pactar un plan de cuotas?`,
  );
  // En prod usamos el teléfono real de la inmo (el call-site no renderiza este
  // hint si no hay teléfono). En demo cae al número demo del WhatsappFab.
  const telefono = apiEnabled
    ? (inmobiliariaTelefono ?? '').replace(/\D/g, '')
    : '541145321100';
  const url = `https://wa.me/${telefono}?text=${mensaje}`;
  return (
    <Card className="border-violet-300 bg-violet-50/60 p-4 dark:border-violet-900/40 dark:bg-violet-900/10">
      <div className="flex items-start gap-3">
        <div
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-violet-500 text-white"
          aria-hidden="true"
        >
          <SplitSquareHorizontal className="h-4 w-4" strokeWidth={2.5} />
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          <div>
            <p className="text-sm font-semibold">
              ¿Necesitás dividir el pago en cuotas?
            </p>
            <p className="text-xs text-muted-foreground">
              Si no llegás a cubrir todo de una, escribile a la inmobiliaria
              para pactar un plan. Pagar parcial ayuda, pero acordar evita que
              los punitorios sigan corriendo.
            </p>
          </div>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-emerald-600"
          >
            💬 Negociar por WhatsApp
          </a>
        </div>
      </div>
    </Card>
  );
}

/**
 * Selector de monto: "saldo total" o "otro monto" (parcial).
 * El valor por defecto es el saldo pendiente. Si el inquilino elige
 * "otro monto", aparece un input numérico clamped a [1000, saldo].
 */
function SelectorMonto({
  saldo,
  moneda,
  valor,
  onChange,
}: {
  saldo: number;
  moneda: 'ARS' | 'USD';
  valor: number;
  onChange: (v: number | null) => void;
}) {
  // El modo (total/parcial) es estado EXPLÍCITO, no derivado de `valor >= saldo`.
  // Antes, al tipear un monto que llegaba al saldo, `esTotal` se volvía true, el
  // input del parcial se desmontaba y el usuario perdía el foco a mitad de tipeo.
  // Ahora el input sólo se oculta cuando el usuario elige "saldo completo".
  const [modoParcial, setModoParcial] = useState<boolean>(valor < saldo);
  const [draft, setDraft] = useState<string>(valor < saldo ? String(valor) : '');

  const setTotal = () => {
    setModoParcial(false);
    onChange(null); // null = usar default (saldo)
    setDraft('');
  };
  const setOtro = () => {
    setModoParcial(true);
    // Si pasa a "otro" sin valor, arrancamos en la mitad del saldo. Para saldos
    // chicos (< $2000) el redondeo al millar daba 0 → bloqueaba "Continuar" sin
    // aviso; caemos a la mitad exacta (mínimo 1) en ese caso.
    const mitadMil = Math.floor(saldo / 2 / 1000) * 1000;
    const inicial = mitadMil > 0 ? mitadMil : Math.max(1, Math.round(saldo / 2));
    onChange(inicial);
    setDraft(String(inicial));
  };

  const onInput = (raw: string) => {
    const limpio = raw.replace(/[^\d]/g, '').slice(0, 9);
    setDraft(limpio);
    const n = Number(limpio);
    if (!Number.isFinite(n)) return;
    // Permitimos cualquier monto entre $1 y saldo. La validación dura
    // (por ejemplo no permitir 0) la hacemos en el botón Continuar.
    onChange(Math.min(Math.max(n, 0), saldo));
  };

  // El parcial es inválido si está vacío o en 0 → explicamos por qué se bloquea
  // "Continuar" (antes el botón quedaba deshabilitado sin ningún aviso).
  const parcialInvalido = modoParcial && (draft === '' || Number(draft) <= 0);

  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-center gap-2">
        <SplitSquareHorizontal className="h-4 w-4 text-primary" />
        <p className="text-sm font-semibold">¿Cuánto vas a pagar ahora?</p>
      </div>
      <div className="space-y-2">
        <button
          type="button"
          onClick={setTotal}
          aria-pressed={!modoParcial}
          className={`flex w-full items-center justify-between gap-3 rounded-md border p-3 text-left text-sm transition-colors ${
            !modoParcial
              ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
              : 'hover:bg-muted/40'
          }`}
        >
          <div>
            <p className="font-medium">El saldo completo</p>
            <p className="text-[11px] text-muted-foreground">
              Quedás al día con el mes.
            </p>
          </div>
          <p className="font-semibold tabular-nums">{formatMonto(saldo, moneda)}</p>
        </button>
        <button
          type="button"
          onClick={setOtro}
          aria-pressed={modoParcial}
          className={`flex w-full items-start gap-3 rounded-md border p-3 text-left text-sm transition-colors ${
            modoParcial
              ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
              : 'hover:bg-muted/40'
          }`}
        >
          <div className="flex-1 space-y-2">
            <div>
              <p className="font-medium">Pagar un parcial</p>
              <p className="text-[11px] text-muted-foreground">
                Después podés volver y pagar el resto.
              </p>
            </div>
            {modoParcial && (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-base font-semibold">$</span>
                  <Input
                    aria-label="Monto a pagar"
                    inputMode="numeric"
                    value={draft}
                    onChange={(e) => onInput(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    placeholder="0"
                    className="text-lg font-semibold tabular-nums"
                  />
                </div>
                {parcialInvalido && (
                  <p className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
                    Ingresá un monto mayor a $0 para continuar.
                  </p>
                )}
              </>
            )}
          </div>
        </button>
      </div>
    </Card>
  );
}

function StepDatosBancarios({
  monto,
  moneda,
  parcial,
  inmobiliariaTelefono,
  datosCobranza,
  onContinuar,
}: {
  monto: number;
  moneda: 'ARS' | 'USD';
  parcial: boolean;
  /** Teléfono real de la inmobiliaria (prod). null en demo / sin dato. */
  inmobiliariaTelefono: string | null;
  /** Cuenta de cobranza REAL traída del API (prod). null si no está cargada. */
  datosCobranza: DatosCobranza | null;
  onContinuar: () => void;
}) {
  // En prod mostramos la cuenta de cobranza REAL de la base (datosCobranza).
  // Si la inmobiliaria todavía no la cargó (null), NO inventamos un CBU: estado
  // neutro + pedirle los datos a la inmobiliaria. En demo (!apiEnabled) usamos
  // el mock con el flujo intacto.
  if (apiEnabled && !datosCobranza) {
    return (
      <StepDatosBancariosNeutro
        monto={monto}
        moneda={moneda}
        parcial={parcial}
        inmobiliariaTelefono={inmobiliariaTelefono}
        onContinuar={onContinuar}
      />
    );
  }

  // Fuente única: prod => cuenta real de la DB; demo => mock.
  const d = datosCobranza
    ? { titular: datosCobranza.titular, cuit: datosCobranza.cuit, banco: datosCobranza.banco ?? '', tipoCuenta: '', cbu: datosCobranza.cbu, alias: datosCobranza.alias }
    : datosBancariosMock;
  // El banner de "próximo cambio de CBU" solo aplica al mock (demo).
  const cambio = datosCobranza ? null : proximoCambioVigente(datosBancariosMock);
  const filas: Array<{ label: string; value: string; icon: React.ReactNode; copyKey: string; copyValue?: string }> = [
    { label: 'Titular', value: d.titular, icon: <UserRound className="h-4 w-4" />, copyKey: 'titular' },
    ...(d.cuit
      ? [{ label: 'CUIT', value: d.cuit, icon: <IdCard className="h-4 w-4" />, copyKey: 'cuit', copyValue: d.cuit.replace(/-/g, '') }]
      : []),
    ...(d.banco
      ? [{ label: 'Banco', value: d.tipoCuenta ? `${d.banco} · ${d.tipoCuenta}` : d.banco, icon: <Building2 className="h-4 w-4" />, copyKey: 'banco' }]
      : []),
    { label: 'CBU', value: d.cbu, icon: <Hash className="h-4 w-4" />, copyKey: 'cbu' },
    ...(d.alias
      ? [{ label: 'Alias', value: d.alias, icon: <Hash className="h-4 w-4" />, copyKey: 'alias' }]
      : []),
    {
      label: parcial ? 'Monto del parcial' : 'Monto exacto',
      value: formatMonto(monto, moneda),
      icon: <Hash className="h-4 w-4" />,
      copyKey: 'monto',
      copyValue: String(Math.round(monto)),
    },
  ];

  // Si la inmo agendó un cambio de CBU para más adelante, mostramos un
  // banner amber con los datos nuevos + fecha de vigencia. Antes el
  // anuncio sólo vivía en el feed del home y el inquilino que llegaba
  // directo al checkout no se enteraba.
  const fechaCambioFmt = cambio
    ? new Date(cambio.fechaDesde + 'T00:00:00').toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : null;

  return (
    <>
      {cambio && fechaCambioFmt && (
        <Card
          role="alert"
          className="border-amber-300 bg-amber-50/70 p-4 dark:border-amber-900/40 dark:bg-amber-900/10"
        >
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            🔔 A partir del {fechaCambioFmt} cambian los datos de cobro
          </p>
          <p className="mt-1 text-xs text-amber-900/80 dark:text-amber-200/80">
            Si transferís <strong>hoy</strong>, usá el CBU y alias de abajo.
            Si transferís desde el <strong>{fechaCambioFmt}</strong>, usá los datos nuevos:
          </p>
          <div className="mt-2 space-y-1 rounded-md bg-background/60 p-3 text-xs">
            <p>
              <span className="text-muted-foreground">CBU nuevo: </span>
              <span className="font-mono break-all">{cambio.cbu}</span>
            </p>
            <p>
              <span className="text-muted-foreground">Alias nuevo: </span>
              <span className="font-mono">{cambio.alias}</span>
            </p>
          </div>
        </Card>
      )}

      <Card className="overflow-hidden">
        {/* Header con label + acción "Copiar todos" — power-user
            agradece pegar bloque preformateado en su app de banking
            sin tocar 5 botones Copiar individuales. Los individuales
            siguen disponibles para quien copia campo por campo. */}
        <div className="flex items-center justify-between gap-2 border-b bg-muted/50 px-5 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Datos para la transferencia
          </p>
          <button
            type="button"
            onClick={async () => {
              const texto = filas
                .map((f) => `${f.label}: ${f.copyValue ?? f.value}`)
                .join('\n');
              try {
                await navigator.clipboard.writeText(texto);
                toast({
                  title: 'Datos copiados',
                  description: 'Pegalos en tu home banking.',
                });
              } catch {
                toast({
                  title: 'No pudimos copiar',
                  variant: 'destructive',
                });
              }
            }}
            className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary transition-colors hover:bg-primary/20"
          >
            Copiar todos
          </button>
        </div>
        <div className="divide-y">
          {filas.map((f) => (
            <CopyRow
              key={f.copyKey}
              label={f.label}
              value={f.value}
              copyValue={f.copyValue ?? f.value}
              icon={f.icon}
            />
          ))}
        </div>
      </Card>

      <ol role="list" className="space-y-2 rounded-md bg-muted/50 p-4 text-sm text-muted-foreground">
        <li className="flex gap-2">
          <span className="font-semibold text-foreground">1.</span>
          Entrá al home banking o app de tu banco.
        </li>
        <li className="flex gap-2">
          <span className="font-semibold text-foreground">2.</span>
          Cargá los datos de arriba (alias o CBU) y transferí el monto exacto.
        </li>
        <li className="flex gap-2">
          <span className="font-semibold text-foreground">3.</span>
          Volvé acá y subí el comprobante para que validemos.
        </li>
      </ol>

      <Button size="xl" className="w-full" onClick={onContinuar} disabled={monto <= 0}>
        {parcial ? 'Ya transferí el parcial, subir comprobante' : 'Ya transferí, subir comprobante'}
        <Upload className="h-4 w-4" />
      </Button>
    </>
  );
}

/**
 * Estado neutro de datos bancarios para producción: como no hay endpoint con
 * la cuenta real de cobranza, no mostramos ningún CBU/CUIT/titular (sería un
 * dato inventado al que el inquilino podría transferir). Le explicamos que la
 * inmobiliaria le envía los datos y, si tenemos su teléfono, ofrecemos un CTA
 * de WhatsApp para pedírselos. El monto exacto sí lo mostramos (es real).
 */
function StepDatosBancariosNeutro({
  monto,
  moneda,
  parcial,
  inmobiliariaTelefono,
  onContinuar,
}: {
  monto: number;
  moneda: 'ARS' | 'USD';
  parcial: boolean;
  inmobiliariaTelefono: string | null;
  onContinuar: () => void;
}) {
  const telLimpio = (inmobiliariaTelefono ?? '').replace(/\D/g, '');
  const mensaje = encodeURIComponent(
    `Hola, quiero pagar ${formatMonto(monto, moneda)}. ¿Me pasás el CBU/alias y titular para transferir?`,
  );
  const waUrl = telLimpio ? `https://wa.me/${telLimpio}?text=${mensaje}` : null;

  return (
    <>
      <Card className="space-y-3 p-5">
        <div className="flex items-start gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <Building2 className="h-4 w-4" />
          </div>
          <div className="flex-1 space-y-1">
            <p className="text-sm font-semibold">
              Los datos para transferir te los envía la inmobiliaria
            </p>
            <p className="text-xs text-muted-foreground">
              Por seguridad no mostramos acá el CBU ni el titular. Pedíselos a
              la inmobiliaria, transferí el monto exacto y volvé a subir el
              comprobante.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/40 px-3 py-2.5">
          <span className="text-xs text-muted-foreground">
            {parcial ? 'Monto del parcial' : 'Monto a transferir'}
          </span>
          <span className="font-mono text-sm font-semibold tabular-nums">
            {formatMonto(monto, moneda)}
          </span>
        </div>

        {waUrl && (
          <a
            href={waUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-emerald-500 px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-600"
          >
            <MessageCircle className="h-4 w-4" strokeWidth={2.5} />
            Pedir los datos por WhatsApp
          </a>
        )}
      </Card>

      <Button size="xl" className="w-full" onClick={onContinuar} disabled={monto <= 0}>
        {parcial ? 'Ya transferí el parcial, subir comprobante' : 'Ya transferí, subir comprobante'}
        <Upload className="h-4 w-4" />
      </Button>
    </>
  );
}

function CopyRow({
  label,
  value,
  copyValue,
  icon,
}: {
  label: string;
  value: string;
  copyValue: string;
  icon: React.ReactNode;
}) {
  const [copiado, setCopiado] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(copyValue);
      setCopiado(true);
      toast({ title: `${label} copiado`, description: 'Pegalo en tu app bancaria.' });
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      toast({
        title: 'No pudimos copiar',
        description: 'Tocá y mantené presionado el valor para copiarlo manualmente.',
        variant: 'destructive',
      });
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-muted/40"
    >
      <span className="text-muted-foreground">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
        {/* CBU (22 dígitos numéricos) lo agrupamos en bloques de 4 para
            que sea legible y entre en una línea visible incluso en
            mobile angosto. Antes "00700991200000312345" + "60" se
            partía con los últimos 2 dígitos colgando, riesgoso al
            copiar manual. Otros valores (alias, monto) se renderizan
            normal con break-words. */}
        <p className="break-words font-mono text-sm font-medium tabular-nums">
          {label === 'CBU' && /^\d{22}$/.test(value)
            ? value.match(/.{1,4}/g)!.join(' ')
            : value}
        </p>
      </div>
      <span
        className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
          copiado
            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
            : 'bg-secondary text-secondary-foreground'
        }`}
      >
        {copiado ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        {copiado ? 'OK' : 'Copiar'}
      </span>
    </button>
  );
}

function StepSubirComprobante({
  liqId,
  monto,
  tipo,
  informarPagoApi,
  onAtras,
  onEnviado,
}: {
  liqId: string;
  monto: number;
  tipo: 'TOTAL' | 'PARCIAL';
  /**
   * En prod: POST real `/pagos/informar`. Si es null, estamos en la demo
   * offline y persistimos en el store local (`agregarPago`).
   */
  informarPagoApi:
    | ((input: {
        liquidacionId: string;
        monto: number;
        metodo: 'TRANSFERENCIA';
        nroOperacion?: string | null;
        fechaTransferencia: string;
        comprobanteUrl?: string;
        comprobanteFileName?: string;
        comprobanteMime?: string;
        comprobanteSize?: number;
      }) => Promise<unknown>)
    | null;
  onAtras: () => void;
  onEnviado: (p: PagoInformado) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [nroOperacion, setNroOperacion] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // Estado de la extracción por IA. Mientras `analizando` está en true
  // mostramos el spinner con "Leyendo el comprobante…". Después de unos
  // segundos cae la extracción y mostramos los campos detectados.
  const [analizando, setAnalizando] = useState(false);
  const [extraccion, setExtraccion] = useState<ExtraccionIA | null>(null);

  const handleFile = (f: File) => {
    setError(null);
    setExtraccion(null);
    if (!/(image\/|application\/pdf)/.test(f.type)) {
      setError('Solo aceptamos imágenes o PDF.');
      return;
    }
    const mb = f.size / 1024 / 1024;
    if (mb > MAX_FILE_MB) {
      setError(`El archivo pesa ${mb.toFixed(1)} MB y el máximo es ${MAX_FILE_MB} MB.`);
      return;
    }
    setFile(f);
    if (f.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => setPreview(reader.result as string);
      reader.readAsDataURL(f);
    } else {
      setPreview(null);
    }

    // La "lectura por IA" es un mock determinístico (PRNG sobre el nombre del
    // archivo): inventa monto/nro de operación/titular. Eso sirve para la demo
    // offline, pero en prod (apiEnabled) NO debe fabricar un N° de operación —
    // el inquilino tiene que ingresar el real de SU comprobante, no uno
    // simulado que después se informaría al backend como si fuese verdadero.
    // Por eso gateamos toda la extracción a la demo. Cuando exista el OCR+LLM
    // real en el backend, este bloque se reemplaza por esa llamada.
    if (!apiEnabled) {
      setAnalizando(true);
      setTimeout(() => {
        // BUG-03: el titular leído del comprobante tiene que ser el propio
        // inquilino (es SU recibo). Si no, la IA le mostraba un nombre random
        // ("Florencia Russo") en su propio pago y lo hacía dudar de si pagó
        // bien. Tomamos el nombre de la sesión activa.
        const sesion = leerSesion();
        const titularInquilino = sesion
          ? `${sesion.nombre} ${sesion.apellido}`.trim()
          : undefined;
        const ex = extraerComprobante(`${f.name}|${f.size}`, monto, {
          // Demo: que el comprobante del inquilino siempre matchee monto
          // exacto. Lo realista para esta UI: si el inquilino pagó lo
          // que se le pide, la lectura le dice "todo OK".
          forzarMatch: true,
          titularEsperado: titularInquilino,
        });
        setExtraccion(ex);
        // Auto-completo el nro de operación detectado si el usuario no
        // escribió uno manual.
        setNroOperacion((prev) => prev || ex.nroOperacion);
        setAnalizando(false);
      }, 1400);
    }
  };

  const limpiar = () => {
    setFile(null);
    setPreview(null);
    setExtraccion(null);
    setAnalizando(false);
    setNroOperacion('');
    if (inputRef.current) inputRef.current.value = '';
  };

  const enviar = async () => {
    if (!file) return;
    setEnviando(true);
    // En prod el N° de operación informado es SIEMPRE el que tipeó el inquilino
    // (o null si lo dejó vacío): nunca el valor simulado de la IA. En la demo
    // mantenemos el fallback a la extracción para que el flujo offline siga
    // autocompletando como antes.
    const nroOp = apiEnabled
      ? nroOperacion.trim() || null
      : nroOperacion.trim() || extraccion?.nroOperacion || null;
    const enviadoAt = new Date().toISOString();

    // ===== Prod: subir el comprobante REAL + POST /pagos/informar =====
    if (informarPagoApi) {
      try {
        // El archivo ahora SÍ llega al backend (Railway Volume), no solo metadatos.
        const subido = await subirArchivo(file);
        await informarPagoApi({
          liquidacionId: liqId,
          monto,
          metodo: 'TRANSFERENCIA',
          nroOperacion: nroOp,
          fechaTransferencia: enviadoAt,
          comprobanteUrl: subido.url,
          comprobanteFileName: subido.nombreArchivo,
          comprobanteMime: subido.tipoMime,
          comprobanteSize: subido.tamanioBytes,
        });
      } catch (e) {
        setEnviando(false);
        setError(
          e instanceof Error
            ? e.message
            : 'No pudimos informar el pago. Reintentá en un momento.',
        );
        return;
      }
      // Objeto sólo para la pantalla de confirmación: el pago Y su comprobante ya
      // quedaron en la DB (subirArchivo + POST /pagos/informar). Esto es sólo para
      // renderizar el "OK" con el preview local del archivo recién subido.
      const informado: PagoInformado = {
        v: 1,
        id: `api_${Date.now().toString(36)}`,
        liqId,
        tipo,
        estado: 'INFORMADO',
        monto,
        nroOperacion: nroOp,
        comprobanteFileName: file.name,
        comprobanteDataUrl: preview,
        comprobanteSize: file.size,
        comprobanteMime: file.type,
        enviadoAt,
        extraccionIA: extraccion ?? undefined,
      };
      setEnviando(false);
      onEnviado(informado);
      return;
    }

    // ===== Demo offline: store local =====
    // mock: en Sprint 3 esto sube a R2 y crea Pago en la DB
    await new Promise((r) => setTimeout(r, 800));
    const informado = agregarPago({
      liqId,
      tipo,
      estado: 'INFORMADO',
      monto,
      nroOperacion: nroOp,
      comprobanteFileName: file.name,
      comprobanteDataUrl: preview,
      comprobanteSize: file.size,
      comprobanteMime: file.type,
      enviadoAt,
      extraccionIA: extraccion ?? undefined,
    });
    // Si el inquilino tenía cargos extra USO_Y_GOCE pendientes del mes
    // y este pago cubre el total, los marcamos como pagados también
    // (asumimos que el comprobante incluye alquiler + cargos). En el
    // caso de parciales NO los marcamos: la deuda extra recién se
    // cubre cuando el alquiler está al día.
    if (tipo === 'TOTAL') {
      const pendientes = cargosExtraDelInquilino(contratoMock.id);
      if (pendientes.length > 0) {
        marcarVariosPagados(
          pendientes.map((c) => c.reclamoId),
          'TRANSFERENCIA',
        );
      }
    }
    setEnviando(false);
    onEnviado(informado);
  };

  return (
    <>
      <button
        type="button"
        onClick={onAtras}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" />
        Ver datos bancarios de nuevo
      </button>

      <Card className="space-y-4 p-5">
        <div className="space-y-1">
          <h2 className="text-base font-semibold">Subí el comprobante</h2>
          <p className="text-sm text-muted-foreground">
            Foto o PDF del recibo de la transferencia (hasta {MAX_FILE_MB} MB).
          </p>
        </div>

        {!file ? (
          <label
            htmlFor="comprobante"
            className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 px-6 py-10 text-center transition-colors hover:border-primary/60"
          >
            <Upload className="h-8 w-8 text-primary" />
            <div>
              <p className="text-sm font-medium">Tocá o arrastrá un archivo</p>
              <p className="text-xs text-muted-foreground">JPG, PNG o PDF</p>
            </div>
            <input
              ref={inputRef}
              id="comprobante"
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                // Limpiamos el value para que, si el archivo fue rechazado, el
                // usuario pueda volver a elegir EL MISMO archivo (corregido) y
                // el onChange dispare igual.
                e.target.value = '';
              }}
            />
          </label>
        ) : (
          <div className="space-y-3 rounded-lg border bg-muted/40 p-3">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview}
                alt="Comprobante"
                className="max-h-72 w-full rounded-md object-contain"
              />
            ) : (
              <div className="flex items-center gap-3 rounded-md bg-background p-4">
                <FileImage className="h-8 w-8 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    PDF · {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
            )}
            <div className="flex items-center justify-between">
              <p className="truncate text-xs text-muted-foreground">{file.name}</p>
              <Button size="sm" variant="ghost" onClick={limpiar}>
                <Trash2 className="h-3.5 w-3.5" />
                Cambiar
              </Button>
            </div>
          </div>
        )}

        {error && (
          <p className="flex items-center gap-2 text-xs text-destructive">
            <X className="h-3 w-3" />
            {error}
          </p>
        )}

        {file && analizando && (
          <div role="status" className="flex items-center gap-3 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin text-primary" />
            <div className="flex-1">
              <p className="font-medium">Leyendo el comprobante…</p>
              <p className="text-xs text-muted-foreground">
                Detectamos automáticamente el monto, la fecha y el N° de operación.
              </p>
            </div>
          </div>
        )}

        {file && extraccion && !analizando && (
          <div className="space-y-2 rounded-lg border border-emerald-300 bg-gradient-to-br from-emerald-50 to-emerald-50/40 p-4 dark:border-emerald-900/40 dark:from-emerald-900/20 dark:to-emerald-900/10">
            <div className="flex items-start gap-2">
              <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-emerald-500 text-white">
                <Sparkles className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold">Detectamos los datos automáticamente</p>
                <p className="text-[11px] text-muted-foreground">
                  Revisalos antes de enviar. Si algo no cuadra, completá manualmente.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
              <DetalleIA label="Monto" valor={formatMonto(extraccion.monto)} match />
              <DetalleIA
                label="Fecha"
                valor={new Date(extraccion.fechaTransferencia).toLocaleDateString('es-AR')}
                match={extraccion.matchFecha}
              />
              <DetalleIA label="Banco" valor={extraccion.bancoOrigen} />
              <DetalleIA label="N° operación" valor={extraccion.nroOperacion} />
              <DetalleIA label="Titular" valor={extraccion.titularOrigen} className="col-span-2" />
            </div>
          </div>
        )}

        <Separator />

        <div className="space-y-2">
          <Label htmlFor="nro">N° de operación</Label>
          <Input
            id="nro"
            aria-describedby="nro-hint"
            placeholder="Ej: 123456789"
            value={nroOperacion}
            onChange={(e) => setNroOperacion(e.target.value)}
            inputMode="numeric"
          />
          <p id="nro-hint" className="text-xs text-muted-foreground">
            {extraccion
              ? 'Lo detectamos del recibo. Editalo si querés.'
              : 'Opcional. Lo encontrás en el recibo del banco.'}
          </p>
        </div>
      </Card>

      <Button size="xl" className="w-full" onClick={enviar} disabled={!file || enviando}>
        {enviando ? 'Enviando…' : 'Enviar comprobante'}
      </Button>
    </>
  );
}

function StepConfirmado({
  informado,
  saldoRestante,
  moneda,
  allowReenviar,
  onPagarOtroParcial,
  onReenviar,
  onVolver,
}: {
  informado: PagoInformado | null;
  saldoRestante: number;
  moneda: 'ARS' | 'USD';
  /**
   * "Borrar todos los pagos y reenviar" es una operación del store local
   * (demo). En prod el pago ya quedó informado en la DB y no se puede
   * "olvidar" desde acá, así que ocultamos el botón.
   */
  allowReenviar: boolean;
  onPagarOtroParcial: () => void;
  onReenviar: () => void;
  onVolver: () => void;
}) {
  const quedoSaldo = saldoRestante > 0;
  return (
    <>
      <Card
        className={`flex flex-col items-center gap-3 p-6 text-center ${
          quedoSaldo
            ? 'border-amber-300 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-900/10'
            : ''
        }`}
      >
        <div
          className={`grid h-14 w-14 place-items-center rounded-full ${
            quedoSaldo
              ? 'bg-amber-500 text-white'
              : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
          }`}
        >
          {quedoSaldo ? <Clock className="h-7 w-7" /> : <CheckCircle2 className="h-7 w-7" />}
        </div>
        <div>
          <h2 className="text-lg font-semibold">
            {quedoSaldo
              ? apiEnabled
                ? 'Parcial informado'
                : 'Parcial recibido'
              : apiEnabled
                ? 'Pago informado'
                : 'Comprobante recibido'}
          </h2>
          {quedoSaldo ? (
            <p className="text-sm text-muted-foreground">
              Te queda un saldo pendiente de{' '}
              <strong className="text-foreground tabular-nums">
                {formatMonto(saldoRestante, moneda)}
              </strong>
              . Lo podés pagar cuando quieras.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Validamos en 24-48 hs hábiles y te avisamos por WhatsApp.
            </p>
          )}
        </div>
      </Card>

      {/* El comprobante SÍ viaja al backend: subirArchivo() lo sube a /uploads
          (Railway Volume) y queda adjunto al pago informado; la inmobiliaria lo
          abre al validar. Antes este cartel decía "todavía no nos llega" (copy
          obsoleto de cuando no había upload) y hacía dudar de que se guardara. */}
      {apiEnabled && (
        <Card className="space-y-1 border-emerald-300 bg-emerald-50/60 p-4 text-sm dark:border-emerald-900/40 dark:bg-emerald-900/10">
          <p className="font-semibold text-emerald-900 dark:text-emerald-200">📎 Recibimos tu comprobante</p>
          <p className="text-emerald-800 dark:text-emerald-300">
            Quedó adjunto a tu pago. La inmobiliaria lo revisa y te confirma en 24-48 hs.
          </p>
        </Card>
      )}

      {informado && (
        <Card className="space-y-3 p-5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {informado.tipo === 'PARCIAL' ? 'Parcial que enviaste' : 'Lo que enviaste'}
          </h3>
          <Row label="Monto" value={formatMonto(informado.monto, moneda)} />
          <Row label="Comprobante" value={informado.comprobanteFileName ?? '—'} />
          {informado.nroOperacion && <Row label="N° operación" value={informado.nroOperacion} />}
          <Row
            label="Estado"
            value={
              informado.estado === 'CONCILIADO'
                ? 'Confirmado por la inmobiliaria'
                : informado.estado === 'RECHAZADO'
                  ? 'Rechazado'
                  : 'Pendiente de validación'
            }
          />

          {informado.extraccionIA && (
            <div className="rounded-md border border-primary/20 bg-primary/5 p-3">
              <div className="mb-1.5 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                  Datos leídos por IA
                </p>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {informado.extraccionIA.bancoOrigen} · {informado.extraccionIA.titularOrigen} ·{' '}
                N° {informado.extraccionIA.nroOperacion}
              </p>
            </div>
          )}

          {/* Preview local del comprobante que ya viajó al backend: "esto es lo
              que mandaste". Se muestra tanto en prod como en demo. */}
          {informado.comprobanteDataUrl && (
            <div className="pt-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={informado.comprobanteDataUrl}
                alt="Comprobante enviado"
                className="max-h-64 w-full rounded-md border object-contain"
              />
            </div>
          )}
        </Card>
      )}

      <div className="space-y-2">
        {quedoSaldo ? (
          <>
            <Button size="xl" className="w-full" onClick={onPagarOtroParcial}>
              Pagar el saldo ({formatMonto(saldoRestante, moneda)})
            </Button>
            <Button variant="outline" className="w-full" onClick={onVolver}>
              Volver al inicio
            </Button>
          </>
        ) : (
          <>
            <Button size="xl" className="w-full" onClick={onVolver}>
              Volver al inicio
            </Button>
            {allowReenviar && (
              <Button variant="ghost" className="w-full" onClick={onReenviar}>
                Borrar todos los pagos y reenviar
              </Button>
            )}
          </>
        )}
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate text-right font-medium">{value}</span>
    </div>
  );
}

function DetalleIA({
  label,
  valor,
  match,
  className,
}: {
  label: string;
  valor: string;
  /** Si está definido, mostramos un check verde si true. */
  match?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`rounded-md bg-background/60 p-2 ${className ?? ''}`}
    >
      <div className="flex items-center justify-between gap-1">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        {match !== undefined && (
          <span
            className={
              match
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-amber-600 dark:text-amber-400'
            }
          >
            {match ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
          </span>
        )}
      </div>
      <p className="truncate text-xs font-medium tabular-nums">{valor}</p>
    </div>
  );
}
