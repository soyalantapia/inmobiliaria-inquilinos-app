'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Copy,
  MessageCircle,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
} from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@llave/ui/dialog';
import { Textarea } from '@llave/ui/textarea';
import { toast } from '@llave/ui/use-toast';
import { formatMonto } from '@/lib/format';
import {
  CONFIANZA_COLOR,
  CONFIANZA_LABEL,
  sugerirRenovacion,
} from '@/lib/negociador-ia';

/**
 * Panel del negociador IA para un contrato próximo a renovar.
 *
 * Se monta inline en /renovaciones debajo de cada card de contrato.
 * Muestra:
 * - El aumento sugerido (% + monto nuevo)
 * - La probabilidad estimada de renovación (con barra)
 * - El perfil del inquilino (excelente / buena / regular / riesgosa)
 * - 3-5 factores que el agente usó para llegar a esa propuesta
 * - Botón "Generar mensaje" que abre el dialog con borrador editable
 */
export function NegociadorRenovacionPanel({
  contratoId,
  /** Teléfono del inquilino (para deep-link WhatsApp). Opcional. */
  telefonoInquilino,
}: {
  contratoId: string;
  telefonoInquilino?: string | null;
}) {
  const sugerencia = useMemo(() => sugerirRenovacion(contratoId), [contratoId]);
  const [dialogOpen, setDialogOpen] = useState(false);

  if (!sugerencia) return null;

  const probabilidadPct = Math.round(sugerencia.probabilidadRenovar * 100);
  const colorBarra =
    probabilidadPct >= 70
      ? 'bg-emerald-500'
      : probabilidadPct >= 40
        ? 'bg-amber-500'
        : 'bg-red-500';

  return (
    <>
      <div className="space-y-3 rounded-lg border border-violet-200 bg-gradient-to-br from-violet-50/60 to-violet-50/20 p-4 dark:border-violet-900/40 dark:from-violet-900/15 dark:to-violet-900/5">
        <div className="flex items-start gap-2">
          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-violet-500 text-white">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold">Negociador IA · sugerencia</p>
              <Badge
                className={`shrink-0 text-[10px] ${CONFIANZA_COLOR[sugerencia.confianza]}`}
              >
                Inquilino {CONFIANZA_LABEL[sugerencia.confianza].toLowerCase()}
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Basado en historial de pagos, calidad del cuidado y mercado de la zona.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Metric
            label="Aumento sugerido"
            valor={`${sugerencia.aumentoPct}%`}
            highlight
          />
          <Metric
            label="Nuevo alquiler"
            valor={formatMonto(sugerencia.alquilerNuevo)}
          />
          <Metric
            label="+ por mes"
            valor={`+ ${formatMonto(sugerencia.diferenciaMensual)}`}
            highlight
          />
          <Metric
            label="Prob. renovación"
            valor={`${probabilidadPct}%`}
            sub={<Barra pct={probabilidadPct} colorClass={colorBarra} />}
          />
        </div>

        <details className="rounded-md bg-background/60 p-3 text-xs">
          <summary className="cursor-pointer font-medium text-foreground">
            Cómo llegamos a esta propuesta ({sugerencia.factores.length} factores)
          </summary>
          <ul className="mt-3 space-y-1.5">
            {sugerencia.factores.map((f, idx) => (
              <li key={idx} className="flex items-start gap-2">
                {f.positivo ? (
                  <ThumbsUp className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600" />
                ) : (
                  <ThumbsDown className="mt-0.5 h-3 w-3 shrink-0 text-amber-600" />
                )}
                <span className="text-muted-foreground">{f.texto}</span>
              </li>
            ))}
          </ul>
        </details>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <p className="text-[11px] text-muted-foreground">
            <TrendingUp className="mr-1 inline h-3 w-3" />
            Cartera anual: + {formatMonto(sugerencia.diferenciaMensual * 12)}
          </p>
          <Button
            size="sm"
            className="bg-violet-600 text-white hover:bg-violet-700"
            onClick={() => setDialogOpen(true)}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Generar mensaje WhatsApp
          </Button>
        </div>
      </div>

      <DialogMensaje
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        mensajeInicial={sugerencia.mensajeWhatsApp}
        telefono={telefonoInquilino}
      />
    </>
  );
}

function Metric({
  label,
  valor,
  sub,
  highlight,
}: {
  label: string;
  valor: string;
  sub?: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className="space-y-1 rounded-md border bg-background/60 p-2.5">
      <p className="text-[9px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={`text-base font-bold tabular-nums ${
          highlight ? 'text-violet-700 dark:text-violet-300' : ''
        }`}
      >
        {valor}
      </p>
      {sub}
    </div>
  );
}

function Barra({ pct, colorClass }: { pct: number; colorClass: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={`h-full ${colorClass} transition-all`}
        style={{ width: `${Math.max(2, pct)}%` }}
      />
    </div>
  );
}

/* ============================================================
 * Dialog: editar y mandar el mensaje por WhatsApp
 * ============================================================ */
function DialogMensaje({
  open,
  onClose,
  mensajeInicial,
  telefono,
}: {
  open: boolean;
  onClose: () => void;
  mensajeInicial: string;
  telefono?: string | null;
}) {
  const [texto, setTexto] = useState(mensajeInicial);
  // Cuando se (re)abre el dialog, reseteo el texto al borrador
  // sugerido por la IA. Si el usuario lo editó y cerró sin enviar, en
  // la próxima apertura recupera el borrador limpio.
  useEffect(() => {
    if (open) setTexto(mensajeInicial);
  }, [open, mensajeInicial]);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      toast({ title: 'Texto copiado', description: 'Pegalo donde lo necesites.' });
    } catch {
      toast({ title: 'No pudimos copiar', variant: 'destructive' });
    }
  };

  const enviarWhatsApp = () => {
    const num = (telefono ?? '').replace(/[^\d]/g, '');
    const url = `https://wa.me/${num}?text=${encodeURIComponent(texto)}`;
    window.open(url, '_blank', 'noopener');
    toast({
      variant: 'success',
      title: 'Abriendo WhatsApp…',
      description: 'Pegamos el mensaje listo para que lo revises y mandes.',
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-600" />
            Mensaje sugerido para renovación
          </DialogTitle>
          <DialogDescription>
            Editalo si querés. Cuando le des &ldquo;Enviar por WhatsApp&rdquo;,
            se abre con el texto pegado y vos lo terminás de revisar antes de
            mandar.
          </DialogDescription>
        </DialogHeader>

        <Textarea
          rows={14}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          className="font-mono text-xs"
        />

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={copiar}>
            <Copy className="h-4 w-4" />
            Copiar
          </Button>
          <Button
            onClick={enviarWhatsApp}
            className="bg-emerald-600 text-white hover:bg-emerald-700"
          >
            <MessageCircle className="h-4 w-4" />
            Enviar por WhatsApp
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ============================================================
 * Resumen de cartera para el header de /renovaciones
 *
 * KPI grande con el "potencial mensual extra" si todos aceptan
 * las sugerencias.
 * ============================================================ */
export function ResumenSugerenciasCartera({ contratoIds }: { contratoIds: string[] }) {
  const stats = useMemo(() => {
    let actual = 0;
    let nuevo = 0;
    let sugerencias = 0;
    for (const id of contratoIds) {
      const s = sugerirRenovacion(id);
      if (!s) continue;
      actual += s.alquilerActual;
      nuevo += s.alquilerNuevo;
      sugerencias++;
    }
    return {
      actualMensual: actual,
      nuevoMensual: nuevo,
      extraMensual: nuevo - actual,
      extraAnual: (nuevo - actual) * 12,
      sugerencias,
    };
  }, [contratoIds]);

  if (stats.sugerencias === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-lg border border-violet-300 bg-gradient-to-r from-violet-50 to-violet-50/40 p-4 dark:border-violet-900/40 dark:from-violet-900/20 dark:to-violet-900/5">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-violet-600 text-white">
        <Sparkles className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">Negociador IA · resumen de cartera</p>
        <p className="text-xs text-muted-foreground">
          Si todas las renovaciones se cierran con la propuesta sugerida, sumás{' '}
          <strong className="text-violet-700 dark:text-violet-300">
            {formatMonto(stats.extraMensual)} extra por mes
          </strong>{' '}
          ({formatMonto(stats.extraAnual)} al año) sobre {stats.sugerencias} contrato
          {stats.sugerencias === 1 ? '' : 's'}.
        </p>
      </div>
      <div className="text-right">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Hoy
        </p>
        <p className="text-sm font-semibold tabular-nums">
          {formatMonto(stats.actualMensual)}
        </p>
      </div>
      <div className="text-right">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Sugerido
        </p>
        <p className="text-sm font-semibold tabular-nums text-violet-700 dark:text-violet-300">
          {formatMonto(stats.nuevoMensual)}
        </p>
      </div>
    </div>
  );
}

