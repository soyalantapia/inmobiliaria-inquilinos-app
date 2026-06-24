'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  FileText,
  Loader2,
  Lock,
  Search,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@llave/ui/select';
import { toast } from '@llave/ui/use-toast';
import {
  pagosInformadosMock,
  type PagoInformado,
} from '@/lib/mock-data';
import { formatFechaCorta, formatMonto, formatPeriodo } from '@/lib/format';
import {
  analizarResumen,
  matchearCredito,
  opcionesDeMatch,
  type ConfianzaMatch,
  type CreditoDetectado,
  type MatchSugerido,
  type OpcionMatch,
} from '@/lib/resumen-cuenta';
import {
  conciliarPago,
  estadoDePago,
} from '@/lib/conciliacion-storage';
import { PinPromptDialog } from '@/components/pin-prompt-dialog';
import { registrarEvento } from '@/lib/auditoria-storage';

type Step = 'upload' | 'leyendo' | 'matches' | 'listo';
const MAX_FILE_MB = 10;

interface ValidadorResumenDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Notifica al padre cuántos pagos quedaron conciliados (para refrescar). */
  onConciliado?: (cantidad: number) => void;
}

/**
 * Dialog grande con el flujo "validar por resumen":
 *   upload → leyendo → matches → listo
 *
 * En "matches" mostramos cada crédito del resumen con su match sugerido
 * y dejamos que el admin (a) acepte el match, (b) cambie el match con
 * un dropdown, o (c) lo ignore. Al cerrar, los aceptados se conciliarán
 * en bloque vía conciliarPago.
 */
export function ValidadorResumenDialog({
  open,
  onOpenChange,
  onConciliado,
}: ValidadorResumenDialogProps) {
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [creditos, setCreditos] = useState<CreditoDetectado[]>([]);
  const [matches, setMatches] = useState<Record<string, MatchSugerido>>({});
  /** ids de créditos que el admin va a conciliar al confirmar. */
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [conciliadosFinal, setConciliadosFinal] = useState(0);
  const [showPin, setShowPin] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  // Pagos pendientes (no resueltos todavía) — los necesitamos para el
  // matching y para las opciones del dropdown.
  const pagosPendientes = useMemo<PagoInformado[]>(
    () => pagosInformadosMock.filter((p) => estadoDePago(p.id) === 'INFORMADO'),
    // Recalculamos cada vez que se abre el dialog
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open],
  );

  const opciones = useMemo<OpcionMatch[]>(
    () => opcionesDeMatch(pagosPendientes),
    [pagosPendientes],
  );

  // Reset al cerrar/abrir
  useEffect(() => {
    if (!open) {
      setStep('upload');
      setFile(null);
      setCreditos([]);
      setMatches({});
      setSeleccionados(new Set());
      setConciliadosFinal(0);
    }
  }, [open]);

  const handleFile = (f: File) => {
    if (!/(image\/|application\/pdf)/.test(f.type)) {
      toast({ title: 'Solo aceptamos imágenes o PDF', variant: 'destructive' });
      return;
    }
    if (f.size / 1024 / 1024 > MAX_FILE_MB) {
      toast({
        title: 'Archivo muy grande',
        description: `Máximo ${MAX_FILE_MB} MB.`,
        variant: 'destructive',
      });
      return;
    }
    setFile(f);
    setStep('leyendo');
    // Disparo el análisis con un pequeño delay para que se sienta real
    setTimeout(() => {
      const crd = analizarResumen(f.name, f.size);
      const map: Record<string, MatchSugerido> = {};
      const seleccion = new Set<string>();
      for (const c of crd) {
        const m = matchearCredito(c, pagosPendientes);
        map[c.id] = m;
        // Pre-seleccionamos los matches alta/media confianza con pago informado
        if (m.confianza === 'alta' || (m.confianza === 'media' && m.pagoInformadoId)) {
          seleccion.add(c.id);
        }
      }
      setCreditos(crd);
      setMatches(map);
      setSeleccionados(seleccion);
      setStep('matches');
    }, 1800);
  };

  const toggleSeleccion = (id: string) => {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const setMatchManual = (creditoId: string, opcion: OpcionMatch | null) => {
    setMatches((prev) => {
      const next = { ...prev };
      const previo = next[creditoId];
      next[creditoId] = {
        creditoId,
        pagoInformadoId: opcion?.pagoInformadoId ?? null,
        contratoId: opcion?.contratoId ?? null,
        inquilino: opcion?.label.split(' · ')[0] ?? null,
        confianza: opcion ? 'alta' : 'baja',
        motivo: opcion ? 'Asignado manualmente' : (previo?.motivo ?? 'Sin match'),
      };
      return next;
    });
    if (opcion) setSeleccionados((s) => new Set(s).add(creditoId));
  };

  const ejecutarConciliacion = () => {
    let count = 0;
    for (const id of seleccionados) {
      const m = matches[id];
      const c = creditos.find((x) => x.id === id);
      if (!m || !c || !m.pagoInformadoId) continue;
      const pago = pagosInformadosMock.find((p) => p.id === m.pagoInformadoId);
      conciliarPago(m.pagoInformadoId, 'Roberto Tapia', {
        liqId: pago?.liquidacionId ?? null,
        observacion: `Conciliado por resumen de cuenta · crédito ${c.id}`,
      });
      registrarEvento({
        tipo: 'PAGO_CONCILIADO',
        autor: 'Roberto Tapia',
        rolAutor: 'ADMIN',
        entidadId: m.pagoInformadoId,
        entidadDescripcion: pago
          ? `Pago de ${pago.inquilino} · ${formatPeriodo(pago.periodo)}`
          : m.pagoInformadoId,
        detalle: `Match contra resumen · ${formatMonto(c.monto)} · ${c.bancoOrigen}`,
      });
      count++;
    }
    setConciliadosFinal(count);
    setStep('listo');
    onConciliado?.(count);
    toast({
      variant: 'success',
      title: `${count} pago${count === 1 ? '' : 's'} conciliado${count === 1 ? '' : 's'}`,
      description: 'Listo, revisá los detalles en el listado de pagos.',
    });
  };

  // Conciliar requiere PIN (permisos.ts: pago.conciliar). Esta ruta masiva lo
  // omitía; ahora abre el PinPromptDialog y concilia recién al confirmar.
  const conciliar = () => {
    if (seleccionados.size === 0) return;
    setShowPin(true);
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Validar por resumen de cuenta
          </DialogTitle>
          <DialogDescription className="flex items-center gap-1.5">
            <Lock className="h-3 w-3" />
            Sin contraseñas bancarias · solo lee el archivo que subas
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <StepUpload
            inputRef={inputRef}
            onFile={handleFile}
          />
        )}

        {step === 'leyendo' && <StepLeyendo file={file} />}

        {step === 'matches' && (
          <StepMatches
            creditos={creditos}
            matches={matches}
            seleccionados={seleccionados}
            opciones={opciones}
            onToggle={toggleSeleccion}
            onMatchManual={setMatchManual}
            onConciliar={conciliar}
            onCancelar={() => onOpenChange(false)}
          />
        )}

        {step === 'listo' && (
          <StepListo
            conciliados={conciliadosFinal}
            total={creditos.length}
            onCerrar={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
    <PinPromptDialog
      abierto={showPin}
      accion="Conciliar pagos por resumen"
      subaccion={`${seleccionados.size} pago${seleccionados.size === 1 ? '' : 's'}`}
      onClose={() => setShowPin(false)}
      onConfirmado={() => {
        setShowPin(false);
        ejecutarConciliacion();
      }}
    />
    </>
  );
}

function StepUpload({
  inputRef,
  onFile,
}: {
  inputRef: React.RefObject<HTMLInputElement>;
  onFile: (f: File) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-md border bg-muted/40 p-4 text-sm">
        <p className="font-medium">¿Cómo funciona?</p>
        <ol role="list" className="mt-2 space-y-1 text-xs text-muted-foreground">
          <li>1. Subís el PDF / imagen del resumen del banco (lo que te descargás de home banking).</li>
          <li>2. Leemos los créditos del período con IA.</li>
          <li>3. Para cada crédito te sugerimos qué inquilino lo pagó.</li>
          <li>4. Confirmás todo en un click — quedan conciliados.</li>
        </ol>
      </div>

      <label
        htmlFor="resumen-file"
        className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 px-6 py-10 text-center transition-colors hover:border-primary/60"
      >
        <Upload className="h-10 w-10 text-primary" aria-hidden="true" />
        <div>
          <p className="text-sm font-medium">Arrastrá el resumen o tocá el botón</p>
          <p className="text-xs text-muted-foreground">
            PDF / JPG / PNG · hasta {MAX_FILE_MB} MB
          </p>
        </div>
        {/* Botón visible además de la dropzone — antes la única
            indicación de cómo subir era el texto "Tocá para elegir"
            sobre el icono. Algunos usuarios buscaban un botón
            explícito antes de notar que toda la zona era clickeable.
            El input sigue oculto, el htmlFor del label lo dispara. */}
        <span className="pointer-events-none inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm">
          Elegir archivo
        </span>
        <input
          ref={inputRef}
          id="resumen-file"
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
          }}
        />
      </label>

      <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50/60 p-3 text-xs dark:border-emerald-900/40 dark:bg-emerald-900/10">
        <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-700 dark:text-emerald-400" />
        <p className="text-emerald-900 dark:text-emerald-200">
          Nunca pedimos tus claves del banco. El sistema sólo lee el archivo que
          vos subís — más seguro que conectar tu cuenta directo.
        </p>
      </div>
    </div>
  );
}

function StepLeyendo({ file }: { file: File | null }) {
  return (
    <div role="status" className="flex flex-col items-center gap-3 py-12 text-center">
      <Loader2 aria-hidden="true" className="h-10 w-10 animate-spin text-primary" />
      <div>
        <p className="text-base font-semibold">Leyendo el resumen…</p>
        <p className="text-xs text-muted-foreground">
          {file?.name ?? 'Procesando archivo'}
        </p>
      </div>
      <div className="mt-2 flex flex-col items-center gap-1 text-[11px] text-muted-foreground">
        <p>✓ Detectando créditos del período</p>
        <p>✓ Matcheando contra pagos informados</p>
        <p>✓ Calculando confianza por cada match</p>
      </div>
    </div>
  );
}

function StepMatches({
  creditos,
  matches,
  seleccionados,
  opciones,
  onToggle,
  onMatchManual,
  onConciliar,
  onCancelar,
}: {
  creditos: CreditoDetectado[];
  matches: Record<string, MatchSugerido>;
  seleccionados: Set<string>;
  opciones: OpcionMatch[];
  onToggle: (id: string) => void;
  onMatchManual: (creditoId: string, opcion: OpcionMatch | null) => void;
  onConciliar: () => void;
  onCancelar: () => void;
}) {
  const cantSeleccionados = seleccionados.size;
  const totalAConciliar = [...seleccionados].reduce((acc, id) => {
    const c = creditos.find((x) => x.id === id);
    return acc + (c?.monto ?? 0);
  }, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-md bg-primary/5 p-3 text-sm">
        <Sparkles className="h-4 w-4 text-primary" />
        <p>
          Detectamos <strong>{creditos.length} crédito{creditos.length === 1 ? '' : 's'}</strong> en
          el resumen. Marcá los que querés conciliar.
        </p>
      </div>

      <div className="space-y-2">
        {creditos.map((c) => {
          const m = matches[c.id]!;
          const seleccionado = seleccionados.has(c.id);
          return (
            <CreditoRow
              key={c.id}
              credito={c}
              match={m}
              seleccionado={seleccionado}
              opciones={opciones}
              onToggle={() => onToggle(c.id)}
              onMatchManual={(op) => onMatchManual(c.id, op)}
            />
          );
        })}
      </div>

      <div className="sticky bottom-0 -mx-6 -mb-6 flex flex-wrap items-center justify-between gap-3 border-t bg-background px-6 py-4">
        <div>
          <p className="text-sm font-semibold">
            {cantSeleccionados} crédito{cantSeleccionados === 1 ? '' : 's'} seleccionado
            {cantSeleccionados === 1 ? '' : 's'}
          </p>
          <p className="text-xs text-muted-foreground">
            Total a conciliar: {formatMonto(totalAConciliar)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancelar}>
            Cancelar
          </Button>
          <Button onClick={onConciliar} disabled={cantSeleccionados === 0}>
            <CheckCircle2 className="h-4 w-4" />
            Conciliar {cantSeleccionados}
          </Button>
        </div>
      </div>
    </div>
  );
}

function CreditoRow({
  credito,
  match,
  seleccionado,
  opciones,
  onToggle,
  onMatchManual,
}: {
  credito: CreditoDetectado;
  match: MatchSugerido;
  seleccionado: boolean;
  opciones: OpcionMatch[];
  onToggle: () => void;
  onMatchManual: (op: OpcionMatch | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const matchableable = match.pagoInformadoId !== null;
  const colorConfianza: Record<ConfianzaMatch, string> = {
    alta: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    media: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    baja: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  };
  const labelConfianza: Record<ConfianzaMatch, string> = {
    alta: 'Match alto',
    media: 'Revisar',
    baja: 'Sin match',
  };

  return (
    <div
      className={`rounded-lg border p-3 transition-colors ${
        seleccionado
          ? 'border-primary/40 bg-primary/5'
          : matchableable
            ? 'hover:bg-muted/30'
            : 'opacity-70'
      }`}
    >
      <div className="flex items-start gap-3">
        <label className="mt-0.5">
          <input
            type="checkbox"
            checked={seleccionado}
            onChange={onToggle}
            disabled={!matchableable}
            className="h-4 w-4 rounded border-border accent-primary"
            aria-label={`Seleccionar crédito de ${formatMonto(credito.monto)} – ${credito.concepto}`}
          />
        </label>

        <div className="flex-1 min-w-0 space-y-2">
          {/* Línea 1: monto + fecha + concepto */}
          <div className="flex flex-wrap items-baseline gap-2">
            <p className="text-base font-semibold tabular-nums">
              {formatMonto(credito.monto)}
            </p>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {formatFechaCorta(credito.fecha)}
            </p>
            <Badge className={`shrink-0 text-[10px] ${colorConfianza[match.confianza]}`}>
              {labelConfianza[match.confianza]}
            </Badge>
          </div>
          <p className="truncate text-xs text-muted-foreground">{credito.concepto}</p>

          {/* Match sugerido */}
          {!editing ? (
            <div className="flex flex-wrap items-center gap-2 rounded-md bg-muted/30 p-2 text-xs">
              <Search className="h-3 w-3 text-muted-foreground" />
              {match.inquilino ? (
                <>
                  <span className="font-medium">→ {match.inquilino}</span>
                  <span className="text-muted-foreground">· {match.motivo}</span>
                </>
              ) : (
                <span className="text-muted-foreground">
                  No encontramos a quién corresponde
                </span>
              )}
              <button
                type="button"
                className="ml-auto inline-flex items-center gap-1 text-primary hover:underline"
                onClick={() => setEditing(true)}
              >
                <ChevronDown className="h-3 w-3" />
                Cambiar
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-md border bg-background p-2 text-xs">
              <Select
                value={match.pagoInformadoId ?? ''}
                onValueChange={(v) => {
                  const op = opciones.find((o) => o.pagoInformadoId === v) ?? null;
                  onMatchManual(op);
                  setEditing(false);
                }}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Elegí el inquilino…" />
                </SelectTrigger>
                <SelectContent>
                  {opciones
                    .filter((o) => o.pagoInformadoId !== null)
                    .map((o) => (
                      <SelectItem key={o.pagoInformadoId!} value={o.pagoInformadoId!}>
                        {o.label}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditing(false)}
                aria-label="Cancelar edición"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}

          {/* Datos extra (banco + nro op + titular origen) */}
          <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
            <span>
              <FileText className="mr-1 inline h-3 w-3" />
              {credito.bancoOrigen}
            </span>
            <span>N° {credito.nroOperacion}</span>
            <span className="truncate">Origen: {credito.titularOrigen}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function StepListo({
  conciliados,
  total,
  onCerrar,
}: {
  conciliados: number;
  total: number;
  onCerrar: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-8 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
        <CheckCircle2 className="h-8 w-8" />
      </div>
      <div>
        <p className="text-lg font-semibold">¡Listo!</p>
        <p className="text-sm text-muted-foreground">
          Conciliamos <strong>{conciliados}</strong> pago{conciliados === 1 ? '' : 's'} de{' '}
          <strong>{total}</strong> créditos detectados.
        </p>
      </div>
      {total > conciliados && (
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50/60 p-3 text-xs dark:border-amber-900/40 dark:bg-amber-900/10">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-amber-900 dark:text-amber-200">
            {total - conciliados} crédito{total - conciliados === 1 ? '' : 's'}{' '}
            {total - conciliados === 1 ? 'quedó' : 'quedaron'} sin matchear. Revisalos a
            mano desde el listado de pagos.
          </p>
        </div>
      )}
      <Button size="lg" className="w-full" onClick={onCerrar}>
        Cerrar
      </Button>
    </div>
  );
}
