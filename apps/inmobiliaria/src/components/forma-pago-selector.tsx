'use client';

import { useEffect, useState } from 'react';
import {
  Banknote,
  CalendarRange,
  CheckCircle2,
  CreditCard,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card, CardContent } from '@llave/ui/card';
import { cn } from '@llave/ui/cn';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@llave/ui/dialog';
import { toast } from '@llave/ui/use-toast';
import {
  DESCUENTO_ANUAL,
  FORMA_PAGO_LABEL,
  type ConfigFormaPago,
  type FormaPago,
  guardarFormaPago,
  leerFormaPago,
  montoFinalSegunForma,
} from '@/lib/forma-pago-storage';
import { aplicarDescuentoCupon } from '@/lib/cupones';
import { calcularResumenPlan } from '@/lib/plan';
import { formatFechaCorta, formatMonto } from '@/lib/format';

/**
 * Selector de forma de pago para el panel de configuración. Muestra las
 * 3 opciones como cards y permite cambiar la activa con un dialog.
 */

const OPCIONES: Array<{
  forma: FormaPago;
  titulo: string;
  bullets: string[];
  icon: typeof CreditCard;
  recomendado?: boolean;
}> = [
  {
    forma: 'DEBITO_AUTOMATICO',
    titulo: 'Débito automático',
    bullets: [
      'Cargo mensual a tu tarjeta',
      'Lo más cómodo: te despreocupás',
      'Renovación automática',
    ],
    icon: CreditCard,
  },
  {
    forma: 'PREPAGO',
    titulo: 'Prepago por transferencia',
    bullets: [
      'Transferís el mes antes de empezar',
      '15 días de gracia si te atrasás',
      'Sin tarjeta',
    ],
    icon: Banknote,
  },
  {
    forma: 'ANUAL',
    titulo: 'Pago anual',
    bullets: [
      `${Math.round(DESCUENTO_ANUAL * 100)}% off sobre el total`,
      'Pagás 12 meses adelantado',
      'Precio congelado durante el año',
    ],
    icon: CalendarRange,
    recomendado: true,
  },
];

/**
 * Tarjeta de ejemplo que se MUESTRA, nunca se pide.
 *
 * Antes acá había cuatro inputs reales —número, vencimiento, CVV y titular—
 * con validación de BIN incluida. Este dialog SÓLO se monta en el build demo
 * (/configuracion corta antes con <ConfiguracionProd /> cuando apiEnabled), y
 * ese build se publica en GitHub Pages: es público, no pide login (AuthGuard
 * deja pasar con !apiEnabled) y tiene aspecto de producto real. Un formulario
 * de tarjeta ahí adentro es una página de phishing terminada y lista para
 * clonar, aunque de nuestro lado no procese nada.
 *
 * El número es el 4242… de prueba a propósito: pasa Luhn, se reconoce a
 * simple vista como de test y no es de nadie.
 */
const TARJETA_EJEMPLO = {
  numero: '4242 4242 4242 4242',
  vencimiento: '12/30',
  titular: 'INMOBILIARIA DEL SOL',
  ultimos4: '4242',
  marca: 'Visa',
} as const;

export function FormaPagoSelector() {
  const [config, setConfig] = useState<ConfigFormaPago | null>(null);
  const [eligiendo, setEligiendo] = useState<FormaPago | null>(null);

  useEffect(() => {
    setConfig(leerFormaPago());
  }, []);

  if (!config) return null;

  const plan = calcularResumenPlan();

  return (
    <>
      <Card>
        <CardContent className="space-y-5 p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold">Forma de pago</h3>
              <p className="text-xs text-muted-foreground">
                Elegí cómo querés abonar tu plan {plan.plan} de My Alquiler.
              </p>
            </div>
            <ResumenFormaActiva config={config} plan={plan} />
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {OPCIONES.map((op) => {
              const Icon = op.icon;
              const activa = op.forma === config.forma;
              const baseMonto = montoFinalSegunForma(plan.costoMensualTotal, op.forma);
              const conCupon = aplicarDescuentoCupon(baseMonto.importe);
              // `baseMonto.ahorro` ya está en escala anual (solo lo entrega ANUAL).
              // `conCupon.descuento` está en la escala del importe que recibió:
              // mensual para DEBITO/PREPAGO, anual para ANUAL. Normalizamos a
              // anual antes de sumar para mostrar siempre "Ahorrás X al año".
              const descuentoCuponAnual =
                baseMonto.periodo === 'mes'
                  ? conCupon.descuento * 12
                  : conCupon.descuento;
              const monto = {
                importe: conCupon.final,
                ahorroAnual: baseMonto.ahorro + descuentoCuponAnual,
                periodo: baseMonto.periodo,
              };
              return (
                <button
                  key={op.forma}
                  type="button"
                  aria-pressed={activa}
                  onClick={() => setEligiendo(op.forma)}
                  className={cn(
                    'relative flex flex-col gap-3 rounded-lg border p-4 text-left transition-all',
                    activa
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                      : op.recomendado
                        ? 'border-amber-300 bg-amber-50/40 hover:bg-amber-50 dark:border-amber-900/40 dark:bg-amber-900/10'
                        : 'border-border bg-card hover:border-primary/40 hover:bg-muted/30',
                  )}
                >
                  {activa && (
                    <Badge
                      variant="default"
                      className="absolute right-3 top-3 gap-1 text-[10px]"
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      Activa
                    </Badge>
                  )}
                  {!activa && op.recomendado && (
                    <Badge
                      variant="outline"
                      className="absolute right-3 top-3 gap-1 border-amber-300 bg-amber-100 text-[10px] text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200"
                    >
                      <Sparkles className="h-3 w-3" />
                      Recomendado
                    </Badge>
                  )}
                  <div
                    className={cn(
                      'grid h-10 w-10 place-items-center rounded-md',
                      activa
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-primary/10 text-primary',
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{op.titulo}</p>
                    <p className="text-xs text-muted-foreground">
                      {op.bullets[0]}
                    </p>
                  </div>
                  <div className="mt-auto space-y-1 border-t pt-3">
                    <p className="text-2xl font-bold tabular-nums">
                      {formatMonto(monto.importe)}
                      <span className="ml-1 text-xs font-normal text-muted-foreground">
                        / {monto.periodo}
                      </span>
                    </p>
                    {monto.ahorroAnual > 0 && (
                      <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                        Ahorrás {formatMonto(monto.ahorroAnual)} al año
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <ConfigurarFormaDialog
        forma={eligiendo}
        plan={{
          plan: plan.plan,
          costoMensual: plan.costoMensualTotal,
        }}
        activa={config.forma === eligiendo}
        ya={config}
        onOpenChange={(v) => !v && setEligiendo(null)}
        onConfirmar={(nuevo) => {
          setConfig(nuevo);
          setEligiendo(null);
        }}
      />
    </>
  );
}

function ResumenFormaActiva({
  config,
  plan,
}: {
  config: ConfigFormaPago;
  plan: ReturnType<typeof calcularResumenPlan>;
}) {
  // Aplicar el cupón activo igual que las cards (línea ~114): si no, el "Próximo
  // cobro" mostraba el precio sin descuento mientras la card mostraba el de cupón.
  const base = montoFinalSegunForma(plan.costoMensualTotal, config.forma);
  const monto = { ...base, importe: aplicarDescuentoCupon(base.importe).final };
  return (
    <div className="rounded-md border bg-muted/30 px-3 py-2 text-right text-xs">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
        Próximo cobro
      </p>
      <p className="font-semibold">{formatFechaCorta(config.proximoCobro)}</p>
      <p className="text-[10px] text-muted-foreground">
        {formatMonto(monto.importe)} ·{' '}
        {config.forma === 'DEBITO_AUTOMATICO' && config.ultimos4
          ? `${config.marca} ···· ${config.ultimos4}`
          : FORMA_PAGO_LABEL[config.forma]}
      </p>
    </div>
  );
}

function ConfigurarFormaDialog({
  forma,
  plan,
  activa,
  ya,
  onOpenChange,
  onConfirmar,
}: {
  forma: FormaPago | null;
  plan: { plan: string; costoMensual: number };
  activa: boolean;
  ya: ConfigFormaPago;
  onOpenChange: (v: boolean) => void;
  onConfirmar: (cfg: ConfigFormaPago) => void;
}) {
  const [guardando, setGuardando] = useState(false);

  // Ya no hay campos de tarjeta que limpiar al abrir el dialog (ver
  // TARJETA_EJEMPLO). Queda el reset de `guardando`, que sigue haciendo falta:
  // sin él, reabrir el dialog después de confirmar lo deja pegado en
  // "Guardando…" con el botón deshabilitado.
  useEffect(() => {
    if (forma) setGuardando(false);
  }, [forma]);

  if (!forma) return null;

  // Mismo cupón que las cards: el dialog mostraba el precio sin descuento
  // ($5.000-$48.000 más que la card). conCupon.descuento alimenta la línea
  // extra del desglose ANUAL.
  const base = montoFinalSegunForma(plan.costoMensual, forma);
  const conCupon = aplicarDescuentoCupon(base.importe);
  const monto = { ...base, importe: conCupon.final };

  const handleConfirmar = async () => {
    setGuardando(true);
    await new Promise((r) => setTimeout(r, 500));
    // El resumen "Visa ···· 4242" sale de la constante, no de lo tipeado: sin
    // campos de tarjeta no hay nada que validar ni que leer. La validación de
    // BIN que había acá era justamente lo que hacía que el formulario se
    // sintiera real, que es el problema, no la feature.
    const ultimos4 =
      forma === 'DEBITO_AUTOMATICO' ? TARJETA_EJEMPLO.ultimos4 : undefined;
    const marca = forma === 'DEBITO_AUTOMATICO' ? TARJETA_EJEMPLO.marca : undefined;
    const nuevo = guardarFormaPago({ forma, ultimos4, marca });
    setGuardando(false);
    toast({
      variant: 'success',
      title: 'Forma de pago actualizada',
      description: FORMA_PAGO_LABEL[forma],
    });
    onConfirmar(nuevo);
  };

  return (
    <Dialog open={!!forma} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{FORMA_PAGO_LABEL[forma]}</DialogTitle>
          <DialogDescription>
            {forma === 'DEBITO_AUTOMATICO' &&
              `Vamos a debitar mensualmente ${formatMonto(monto.importe)} de tu tarjeta.`}
            {forma === 'PREPAGO' &&
              `Te enviamos la factura por mail. Tenés 15 días de gracia para transferir ${formatMonto(monto.importe)}. Si te atrasás más de 45 días, se pausa el servicio.`}
            {forma === 'ANUAL' &&
              `Pagás los 12 meses adelantados: ${formatMonto(monto.importe)} (ahorro de ${formatMonto(monto.ahorro)} vs mensual).`}
          </DialogDescription>
        </DialogHeader>

        {forma === 'DEBITO_AUTOMATICO' && (
          <div className="space-y-3">
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/10 dark:text-amber-200">
              <p className="flex items-center gap-1.5 font-medium">
                <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                Vista de ejemplo — acá no se piden datos de tarjeta
              </p>
              <p className="mt-1">
                Esta demo es pública y no procesa pagos. Nunca cargues el
                número, el vencimiento ni el código de seguridad de una tarjeta
                real en un sitio de demostración.
              </p>
            </div>
            <div className="rounded-md border bg-muted/30 p-4">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Así se vería tu tarjeta cargada
              </p>
              <p className="mt-1 font-mono text-sm tabular-nums text-muted-foreground">
                {TARJETA_EJEMPLO.numero}
              </p>
              <div className="mt-2 flex gap-6 font-mono text-[11px] text-muted-foreground">
                <span>Venc. {TARJETA_EJEMPLO.vencimiento}</span>
                <span>CVV ···</span>
              </div>
              <p className="mt-2 font-mono text-[11px] text-muted-foreground">
                {TARJETA_EJEMPLO.titular}
              </p>
            </div>
          </div>
        )}

        {forma === 'PREPAGO' && (
          <div className="space-y-3 text-sm">
            {/* Los datos eran plausibles al punto de ser peligrosos: CBU que
                arranca con 007 (Galicia de verdad), alias con la marca real
                del producto y CUIT con formato válido, todo bajo el título
                "Datos para transferir" en un sitio público. Alguien podía
                transferir en serio, y un tercero podía clonar la página
                cambiando sólo el CBU. Ahora son ceros: imposibles de
                confundir con una cuenta y sin valor para quien clone. */}
            <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-xs dark:border-amber-900/40 dark:bg-amber-900/10">
              <p className="flex items-center gap-1.5 font-medium text-amber-900 dark:text-amber-200">
                <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                Datos de ejemplo — no transfieras a esta cuenta
              </p>
              <div className="mt-2 space-y-1 font-mono text-[11px] text-muted-foreground">
                <p>Banco de ejemplo · Cta. corriente</p>
                <p>CBU: 0000000000000000000000</p>
                <p>Alias: cuenta.de.ejemplo</p>
                <p>CUIT: 00-00000000-0</p>
              </div>
              <p className="mt-2 text-[11px] text-amber-900 dark:text-amber-200">
                En la cuenta real, los datos de cobro de My Alquiler te llegan
                en la factura por mail.
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Cada mes te enviamos la factura por mail. Si pasan 45 días sin
              pago, se pausa el servicio hasta que regularices.
            </p>
          </div>
        )}

        {forma === 'ANUAL' && (
          <div className="space-y-3 text-sm">
            <div className="rounded-md border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900/40 dark:bg-emerald-900/10">
              <p className="text-xs font-medium text-emerald-900 dark:text-emerald-200">
                Desglose
              </p>
              <div className="mt-2 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">12 meses ×{' '}
                    {formatMonto(plan.costoMensual)}</span>
                  <span className="tabular-nums">{formatMonto(plan.costoMensual * 12)}</span>
                </div>
                <div className="flex justify-between text-emerald-700 dark:text-emerald-300">
                  <span>Descuento {Math.round(DESCUENTO_ANUAL * 100)}%</span>
                  <span className="tabular-nums">− {formatMonto(monto.ahorro)}</span>
                </div>
                {conCupon.descuento > 0 && (
                  <div className="flex justify-between text-emerald-700 dark:text-emerald-300">
                    <span>Cupón {conCupon.cupon?.codigo}</span>
                    <span className="tabular-nums">− {formatMonto(conCupon.descuento)}</span>
                  </div>
                )}
                <div className="mt-2 flex justify-between border-t pt-2 text-sm font-semibold">
                  <span>A pagar hoy</span>
                  <span className="tabular-nums">{formatMonto(monto.importe)}</span>
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Una sola transferencia y te quedás tranquilo todo el año. El
              precio se congela aunque cambiemos la tarifa.
            </p>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => onOpenChange(false)}
            disabled={guardando}
          >
            Cancelar
          </Button>
          <Button
            className="flex-1"
            onClick={handleConfirmar}
            disabled={guardando || (activa && forma === ya.forma)}
          >
            {activa && forma === ya.forma
              ? 'Ya estás en este plan'
              : guardando
                ? 'Guardando…'
                : 'Confirmar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
