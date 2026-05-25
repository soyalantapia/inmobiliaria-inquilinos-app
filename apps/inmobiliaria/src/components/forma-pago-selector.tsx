'use client';

import { useEffect, useState } from 'react';
import {
  Banknote,
  CalendarRange,
  CheckCircle2,
  CreditCard,
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
import { Input } from '@llave/ui/input';
import { Label } from '@llave/ui/label';
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
              const monto = {
                importe: conCupon.final,
                ahorro: baseMonto.ahorro + conCupon.descuento,
                periodo: baseMonto.periodo,
              };
              return (
                <button
                  key={op.forma}
                  type="button"
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
                    {monto.ahorro > 0 && (
                      <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                        Ahorrás {formatMonto(monto.ahorro)} al año
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
  const monto = montoFinalSegunForma(plan.costoMensualTotal, config.forma);
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
  const [numTarjeta, setNumTarjeta] = useState('');
  const [vencimiento, setVencimiento] = useState('');
  const [cvv, setCvv] = useState('');
  const [titular, setTitular] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (forma) {
      setNumTarjeta('');
      setVencimiento('');
      setCvv('');
      setTitular('');
      setGuardando(false);
    }
  }, [forma]);

  if (!forma) return null;

  const monto = montoFinalSegunForma(plan.costoMensual, forma);

  const handleConfirmar = async () => {
    if (forma === 'DEBITO_AUTOMATICO') {
      const digits = numTarjeta.replace(/\D/g, '');
      if (digits.length < 13) {
        toast({
          title: 'Número de tarjeta inválido',
          variant: 'destructive',
        });
        return;
      }
      if (!titular.trim()) {
        toast({ title: 'Falta el titular', variant: 'destructive' });
        return;
      }
    }
    setGuardando(true);
    await new Promise((r) => setTimeout(r, 500));
    const ultimos4 =
      forma === 'DEBITO_AUTOMATICO' ? numTarjeta.replace(/\D/g, '').slice(-4) : undefined;
    const marca =
      forma === 'DEBITO_AUTOMATICO' ? detectarMarca(numTarjeta) : undefined;
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
            <div className="space-y-1.5">
              <Label htmlFor="num-tarjeta">Número de tarjeta</Label>
              <Input
                id="num-tarjeta"
                value={formatTarjeta(numTarjeta)}
                onChange={(e) => setNumTarjeta(e.target.value)}
                placeholder="4521 1234 5678 9012"
                inputMode="numeric"
                maxLength={19}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="venc">Vencimiento</Label>
                <Input
                  id="venc"
                  value={vencimiento}
                  onChange={(e) => setVencimiento(e.target.value)}
                  placeholder="MM/AA"
                  inputMode="numeric"
                  maxLength={5}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cvv">CVV</Label>
                <Input
                  id="cvv"
                  value={cvv}
                  onChange={(e) => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="123"
                  inputMode="numeric"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="titular">Titular de la tarjeta</Label>
              <Input
                id="titular"
                value={titular}
                onChange={(e) => setTitular(e.target.value)}
                placeholder="Como aparece en la tarjeta"
              />
            </div>
            <Badge variant="outline" className="self-start text-[10px]">
              Modo demo · no se procesa la tarjeta
            </Badge>
          </div>
        )}

        {forma === 'PREPAGO' && (
          <div className="space-y-3 text-sm">
            <div className="rounded-md border bg-muted/30 p-4 text-xs">
              <p className="font-medium">Datos para transferir</p>
              <div className="mt-2 space-y-1 font-mono text-[11px] text-muted-foreground">
                <p>Banco Galicia · Cta. corriente</p>
                <p>CBU: 0070099120000031234567</p>
                <p>Alias: myalquiler.cobros</p>
                <p>CUIT: 30-71234567-9</p>
              </div>
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

function formatTarjeta(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 16);
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
}

function detectarMarca(numero: string): string {
  const d = numero.replace(/\D/g, '');
  if (d.startsWith('4')) return 'Visa';
  if (/^(5[1-5]|2[2-7])/.test(d)) return 'Mastercard';
  if (/^3[47]/.test(d)) return 'American Express';
  return 'Tarjeta';
}
