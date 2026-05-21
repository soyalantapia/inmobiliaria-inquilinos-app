'use client';

import { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Handshake,
  MessageCircle,
  Send,
  Sparkles,
  User,
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
import { Input } from '@llave/ui/input';
import { toast } from '@llave/ui/use-toast';
import {
  iniciarNegociacion,
  responderContraoferta,
  type ConfigNegociacion,
  type PropuestaNegociacion,
} from '@/lib/negociador-ia';
import { formatMonto } from '@/lib/format';

type Autor = 'IA' | 'INQUILINO';

interface Mensaje {
  id: string;
  autor: Autor;
  monto: number;
  texto: string;
  cerrado?: boolean;
}

interface NegociacionIterativaDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contratoId: string;
  inquilino: string;
  /** Cuando se acuerda un precio, lo emitimos para mostrar en el panel padre. */
  onCerrado?: (monto: number) => void;
}

/**
 * Dialog de chat de negociación turn-by-turn.
 *
 * La IA arranca proponiendo el precio sugerido. El usuario inmo simula
 * al inquilino — escribe su contraoferta. La IA responde según el
 * rango aceptable del propietario. Termina cuando se cierra.
 *
 * En backend real, esto va a ser un agente LLM. Acá usamos las
 * heurísticas de lib/negociador-ia.ts.
 */
export function NegociacionIterativaDialog({
  open,
  onOpenChange,
  contratoId,
  inquilino,
  onCerrado,
}: NegociacionIterativaDialogProps) {
  const [config, setConfig] = useState<ConfigNegociacion | null>(null);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [input, setInput] = useState('');
  const [pensando, setPensando] = useState(false);
  const [cerrado, setCerrado] = useState<{ monto: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Iniciar cada vez que se abre
  useEffect(() => {
    if (!open) return;
    const init = iniciarNegociacion(contratoId);
    if (!init) return;
    setConfig(init.config);
    setMensajes([
      {
        id: `m_${Date.now()}`,
        autor: 'IA',
        monto: init.aperturaIA.monto,
        texto: init.aperturaIA.mensaje,
      },
    ]);
    setInput('');
    setCerrado(null);
  }, [open, contratoId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [mensajes, pensando]);

  const enviarContraoferta = (raw: string) => {
    if (!config || cerrado) return;
    const limpio = raw.replace(/[^\d]/g, '');
    const monto = Number(limpio);
    if (!Number.isFinite(monto) || monto <= 0) {
      toast({
        title: 'Ingresá un número válido',
        description: 'Tipeá el monto que querés contraofertar (en pesos).',
        variant: 'destructive',
      });
      return;
    }
    const ultimaOfertaIA = [...mensajes].reverse().find((m) => m.autor === 'IA')?.monto;
    if (ultimaOfertaIA === undefined) return;

    const msgInquilino: Mensaje = {
      id: `m_${Date.now()}_inq`,
      autor: 'INQUILINO',
      monto,
      texto: `Mi contraoferta: ${formatMonto(monto)}`,
    };
    setMensajes((prev) => [...prev, msgInquilino]);
    setInput('');
    setPensando(true);

    setTimeout(() => {
      const ronda = mensajes.filter((m) => m.autor === 'IA').length;
      const respuesta = responderContraoferta(config, ultimaOfertaIA, monto, ronda);
      const msgIA: Mensaje = {
        id: `m_${Date.now()}_ia`,
        autor: 'IA',
        monto: respuesta.monto,
        texto: respuesta.mensaje,
        cerrado: respuesta.cerrado,
      };
      setMensajes((prev) => [...prev, msgIA]);
      setPensando(false);
      if (respuesta.cerrado) {
        setCerrado({ monto: respuesta.monto });
        onCerrado?.(respuesta.monto);
      }
    }, 950);
  };

  const aceptarUltimaPropuesta = () => {
    if (!config || cerrado) return;
    const ultima = [...mensajes].reverse().find((m) => m.autor === 'IA');
    if (!ultima) return;
    const msgInquilino: Mensaje = {
      id: `m_${Date.now()}_acept`,
      autor: 'INQUILINO',
      monto: ultima.monto,
      texto: `Listo, acepto ${formatMonto(ultima.monto)}.`,
    };
    setMensajes((prev) => [...prev, msgInquilino]);
    setPensando(true);

    setTimeout(() => {
      const msgIA: Mensaje = {
        id: `m_${Date.now()}_cierre`,
        autor: 'IA',
        monto: ultima.monto,
        texto:
          `Genial, cerramos en ${formatMonto(ultima.monto)}. Te paso el ` +
          `borrador del contrato actualizado en las próximas horas.`,
        cerrado: true,
      };
      setMensajes((prev) => [...prev, msgIA]);
      setPensando(false);
      setCerrado({ monto: ultima.monto });
      onCerrado?.(ultima.monto);
    }, 700);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Handshake className="h-5 w-5 text-violet-600" />
            Negociar renovación con {inquilino.split(' ')[0]}
          </DialogTitle>
          <DialogDescription>
            Simulá la conversación con el inquilino. La IA negocia dentro
            del rango que vos aceptarías (basado en el perfil del inquilino
            y mercado).
          </DialogDescription>
        </DialogHeader>

        {config && (
          <div className="grid grid-cols-3 gap-2 rounded-md border bg-muted/30 p-3 text-xs">
            <Rango
              label="Mínimo"
              valor={formatMonto(config.pisoDuro)}
              hint="No bajamos de acá"
            />
            <Rango
              label="Ideal"
              valor={formatMonto(config.pisoBlando)}
              hint="Aceptamos sin chistar"
              accent="emerald"
            />
            <Rango
              label="Propuesta inicial"
              valor={formatMonto(config.techoBlando)}
              hint="Arrancamos pidiendo esto"
              accent="primary"
            />
          </div>
        )}

        <div
          ref={scrollRef}
          className="flex-1 min-h-[280px] overflow-y-auto rounded-md border bg-background p-3 space-y-3"
        >
          {mensajes.map((m) => (
            <MensajeBurbuja key={m.id} mensaje={m} />
          ))}
          {pensando && (
            <div className="flex items-start gap-2">
              <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                <Sparkles className="h-3 w-3" />
              </div>
              <div className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                <span className="inline-block animate-pulse">···</span>
              </div>
            </div>
          )}
        </div>

        {cerrado ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border-2 border-emerald-300 bg-emerald-50/60 p-3 dark:border-emerald-900/40 dark:bg-emerald-900/15">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
              <div>
                <p className="text-sm font-semibold">
                  Cerraron en {formatMonto(cerrado.monto)}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Se guardó el acuerdo en la auditoría. Generá el contrato
                  actualizado desde el panel de renovaciones.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cerrar
            </Button>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!pensando) enviarContraoferta(input);
            }}
            className="space-y-2"
          >
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Contraoferta del inquilino (ej: 580000)"
                inputMode="numeric"
                disabled={pensando}
              />
              <Button
                type="submit"
                disabled={pensando || input.trim().length === 0}
                className="bg-violet-600 text-white hover:bg-violet-700"
              >
                <Send className="h-4 w-4" />
                Enviar
              </Button>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
              <p className="text-muted-foreground">
                Probá distintos números para ver cómo negocia la IA.
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={aceptarUltimaPropuesta}
                disabled={pensando}
              >
                <CheckCircle2 className="h-3 w-3" />
                Aceptar última propuesta
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function MensajeBurbuja({ mensaje }: { mensaje: Mensaje }) {
  if (mensaje.autor === 'INQUILINO') {
    return (
      <div className="flex justify-end">
        <div className="flex max-w-[80%] flex-row-reverse items-start gap-2">
          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
            <User className="h-3 w-3" />
          </div>
          <div className="rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">
            {mensaje.texto}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2">
      <div
        className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${
          mensaje.cerrado
            ? 'bg-emerald-500 text-white'
            : 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300'
        }`}
      >
        {mensaje.cerrado ? (
          <CheckCircle2 className="h-3.5 w-3.5" />
        ) : (
          <Sparkles className="h-3 w-3" />
        )}
      </div>
      <div className="flex-1 max-w-[85%] space-y-1">
        <div
          className={`rounded-lg px-3 py-2 text-sm ${
            mensaje.cerrado
              ? 'bg-emerald-50 dark:bg-emerald-900/20'
              : 'bg-muted/50'
          }`}
        >
          {mensaje.texto}
        </div>
        {!mensaje.cerrado && (
          <Badge variant="outline" className="text-[10px]">
            <MessageCircle className="mr-1 h-2.5 w-2.5" />
            Propone {formatMonto(mensaje.monto)}
          </Badge>
        )}
      </div>
    </div>
  );
}

function Rango({
  label,
  valor,
  hint,
  accent,
}: {
  label: string;
  valor: string;
  hint?: string;
  accent?: 'emerald' | 'primary';
}) {
  return (
    <div className="min-w-0">
      <p className="text-[9px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={`truncate text-sm font-semibold tabular-nums ${
          accent === 'emerald'
            ? 'text-emerald-700 dark:text-emerald-300'
            : accent === 'primary'
              ? 'text-primary'
              : ''
        }`}
      >
        {valor}
      </p>
      {hint && (
        <p className="truncate text-[10px] text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}
