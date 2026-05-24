'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Handshake,
  HelpCircle,
  PenLine,
  RotateCcw,
} from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card } from '@llave/ui/card';
import { cn } from '@llave/ui/cn';
import { Separator } from '@llave/ui/separator';
import { Textarea } from '@llave/ui/textarea';
import { toast } from '@llave/ui/use-toast';
import { NavBar } from '@/components/nav-bar';
import { contratoMock } from '@/lib/mock-data';
import { diasHastaVencimiento, formatFecha, formatMonto } from '@/lib/format';
import {
  type DecisionRenovacion,
  borrarRenovacion,
  guardarRenovacion,
  leerRenovacion,
} from '@/lib/renovacion-storage';

// Flow de 3 pasos:
// 1) Elegir decisión (Renovar / No renovar / Pensándolo)
// 2) Confirmar con detalles (monto estimado si renueva, fecha tentativa si no)
// 3) Confirmación + próximos pasos

type Paso = 1 | 2 | 3;

export default function RenovacionPage() {
  const router = useRouter();
  const c = contratoMock;
  const diasFin = diasHastaVencimiento(c.fechaFin);
  const [paso, setPaso] = useState<Paso>(1);
  const [decision, setDecision] = useState<DecisionRenovacion | null>(null);
  const [comentario, setComentario] = useState('');
  const [hidratando, setHidratando] = useState(true);

  useEffect(() => {
    const existente = leerRenovacion(c.id);
    if (existente) {
      setDecision(existente.decision);
      setComentario(existente.comentario ?? '');
    }
    setHidratando(false);
  }, [c.id]);

  // Monto estimado de renovación: +30% (aproximación si ICL anualizado)
  const montoEstimado = Math.round(c.montoActual * 1.3);

  const guardar = () => {
    if (!decision) return;
    guardarRenovacion({
      contratoId: c.id,
      decision,
      comentario: comentario.trim() || null,
      decidiSAt: new Date().toISOString(),
    });
    setPaso(3);
    toast({ title: 'Le avisamos a la inmobiliaria' });
  };

  const reiniciar = () => {
    borrarRenovacion(c.id);
    setDecision(null);
    setComentario('');
    setPaso(1);
  };

  if (hidratando) {
    return (
      <>
        <main className="flex-1 px-5 pb-6 md:px-8" />
        <NavBar />
      </>
    );
  }

  return (
    <>
      <header className="flex items-center gap-3 p-5 md:px-8">
        <Button size="icon" variant="ghost" asChild>
          <Link href="/contrato" aria-label="Volver al contrato">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1 min-w-0">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Mi contrato</p>
          <h1 className="text-xl font-semibold md:text-2xl">Renovación</h1>
        </div>
      </header>

      <main className="flex-1 space-y-5 px-5 pb-6 md:px-8">
        {/* Indicador de pasos */}
        <div className="flex items-center gap-2">
          {([1, 2, 3] as Paso[]).map((p) => (
            <div
              key={p}
              className={cn(
                'h-1.5 flex-1 rounded-full transition-colors',
                p <= paso ? 'bg-primary' : 'bg-muted',
              )}
            />
          ))}
        </div>

        {paso === 1 && (
          <>
            <Card className="space-y-3 p-5">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  <CalendarCheck className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-muted-foreground">Tu contrato vence el</p>
                  <p className="text-lg font-semibold">{formatFecha(c.fechaFin)}</p>
                  <p className="text-xs text-muted-foreground">
                    Faltan {diasFin} días · {c.direccion}
                  </p>
                </div>
              </div>
            </Card>

            <section className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                ¿Querés renovar?
              </h2>
              <div className="grid gap-3">
                <OpcionDecision
                  icon={<Handshake className="h-5 w-5" />}
                  titulo="Sí, quiero renovar"
                  detalle="Vamos a coordinar el nuevo contrato con la inmobiliaria"
                  selected={decision === 'RENOVAR'}
                  onClick={() => setDecision('RENOVAR')}
                />
                <OpcionDecision
                  icon={<Clock className="h-5 w-5" />}
                  titulo="Lo estoy pensando"
                  detalle="Quiero más tiempo para decidir. La inmobiliaria sabrá que estás evaluando."
                  selected={decision === 'PENSANDO'}
                  onClick={() => setDecision('PENSANDO')}
                />
                <OpcionDecision
                  icon={<RotateCcw className="h-5 w-5" />}
                  titulo="No voy a renovar"
                  detalle="Te vas a mudar al terminar el contrato"
                  selected={decision === 'NO_RENOVAR'}
                  onClick={() => setDecision('NO_RENOVAR')}
                />
              </div>
            </section>

            <Button className="w-full" size="lg" disabled={!decision} onClick={() => setPaso(2)}>
              Continuar
            </Button>
          </>
        )}

        {paso === 2 && decision && (
          <>
            <Card className="space-y-4 p-5">
              <div>
                <Badge variant="outline">Tu decisión</Badge>
                <p className="mt-2 text-lg font-semibold">
                  {decision === 'RENOVAR' && 'Querés renovar el contrato'}
                  {decision === 'PENSANDO' && 'Estás pensándolo'}
                  {decision === 'NO_RENOVAR' && 'No vas a renovar'}
                </p>
              </div>

              <Separator />

              {decision === 'RENOVAR' && (
                <div className="space-y-3">
                  <div className="rounded-lg border bg-muted/40 p-4 text-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Estimación inicial
                    </p>
                    <div className="mt-2 space-y-2">
                      <Row
                        label="Monto actual"
                        value={formatMonto(c.montoActual, c.moneda)}
                      />
                      <Row
                        label="Monto estimado de renovación"
                        value={formatMonto(montoEstimado, c.moneda)}
                        hint="+30% aprox según ICL anualizado"
                      />
                      <Row label="Nuevo plazo sugerido" value="36 meses" />
                      <Row label="Inicio nuevo contrato" value={formatFecha(c.fechaFin)} />
                    </div>
                  </div>
                  <div className="flex items-start gap-2 text-xs text-muted-foreground">
                    <HelpCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <p>
                      Esto es una estimación. El monto y plazo final los confirmás con la
                      inmobiliaria antes de firmar.
                    </p>
                  </div>
                </div>
              )}

              {decision === 'NO_RENOVAR' && (
                <div className="space-y-3 rounded-lg border bg-muted/40 p-4 text-sm">
                  <p className="font-medium">Qué pasa ahora:</p>
                  <ul className="space-y-1.5 text-xs text-muted-foreground">
                    <li>· La inmobiliaria coordina la inspección final 15 días antes.</li>
                    <li>· Tenés que entregar las llaves el {formatFecha(c.fechaFin)}.</li>
                    <li>· Te devuelven el depósito de {formatMonto(c.montoActual, c.moneda)} si no hay daños ni deudas.</li>
                  </ul>
                </div>
              )}

              {decision === 'PENSANDO' && (
                <div className="space-y-2 rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
                  <p>Avisamos a la inmobiliaria que estás evaluando.</p>
                  <p className="text-xs">
                    Cuando tengas la decisión, volvé a esta pantalla para confirmarla.
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">
                  Comentario (opcional)
                </label>
                <Textarea
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                  placeholder="Algo que quieras que la inmobiliaria sepa…"
                  rows={3}
                />
              </div>
            </Card>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="outline" className="flex-1" onClick={() => setPaso(1)}>
                Volver
              </Button>
              <Button className="flex-1" onClick={guardar}>
                Confirmar y avisar
              </Button>
            </div>
          </>
        )}

        {paso === 3 && decision && (
          <Card className="space-y-4 p-6 text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">¡Listo!</h2>
              <p className="text-sm text-muted-foreground">
                La inmobiliaria recibió tu intención. Te van a contactar en los próximos días.
              </p>
            </div>
            <Separator />
            <div className="text-left">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Próximos pasos
              </p>
              <ul className="mt-2 space-y-2 text-sm">
                {decision === 'RENOVAR' && (
                  <>
                    <NextStep>La inmobiliaria te manda la propuesta final</NextStep>
                    <NextStep>Negociás monto, plazo e índice si querés</NextStep>
                    <NextStep>Firmás el nuevo contrato antes del vencimiento</NextStep>
                  </>
                )}
                {decision === 'NO_RENOVAR' && (
                  <>
                    <NextStep>Coordinás la inspección final (~15 días antes)</NextStep>
                    <NextStep>Entregás las llaves el {formatFecha(c.fechaFin)}</NextStep>
                    <NextStep>Te devuelven el depósito si no hay observaciones</NextStep>
                  </>
                )}
                {decision === 'PENSANDO' && (
                  <>
                    <NextStep>La inmobiliaria sabe que estás evaluando</NextStep>
                    <NextStep>Te dan info adicional si la necesitás</NextStep>
                    <NextStep>Volvé acá cuando tengas la decisión final</NextStep>
                  </>
                )}
              </ul>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="outline" className="flex-1" onClick={reiniciar}>
                <PenLine className="h-4 w-4" />
                Cambiar decisión
              </Button>
              <Button className="flex-1" onClick={() => router.push('/contrato')}>
                Volver al contrato
              </Button>
            </div>
          </Card>
        )}
      </main>

      <NavBar />
    </>
  );
}

function OpcionDecision({
  icon,
  titulo,
  detalle,
  selected,
  onClick,
}: {
  icon: React.ReactNode;
  titulo: string;
  detalle: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-start gap-3 rounded-lg border p-4 text-left transition-colors',
        selected
          ? 'border-primary bg-primary/5 ring-1 ring-primary'
          : 'hover:border-primary/40 hover:bg-muted/40',
      )}
    >
      <div
        className={cn(
          'grid h-10 w-10 shrink-0 place-items-center rounded-lg transition-colors',
          selected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
        )}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{titulo}</p>
        <p className="text-xs text-muted-foreground">{detalle}</p>
      </div>
      <div
        className={cn(
          'mt-1 h-4 w-4 shrink-0 rounded-full border-2',
          selected ? 'border-primary bg-primary' : 'border-muted-foreground/40',
        )}
      />
    </button>
  );
}

function Row({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <div className="text-right">
        <p className="font-medium tabular-nums">{value}</p>
        {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );
}

function NextStep({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
      <span>{children}</span>
    </li>
  );
}
