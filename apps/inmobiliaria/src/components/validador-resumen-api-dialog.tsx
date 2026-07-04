'use client';

/**
 * Validador de resumen bancario REAL (prod): sube el extracto que exporta el
 * banco (CSV/Excel — columnas fecha/monto/titular con sinónimos habituales),
 * el backend lo parsea y sugiere a qué liquidación corresponde cada crédito
 * (matching determinístico por monto+nombre, sin IA — ver matching-bancario.ts).
 * El admin confirma (o corrige) el destino y concilia con PIN.
 */
import { useRef, useState } from 'react';
import { CheckCircle2, FileSpreadsheet, Loader2, Upload } from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card, CardContent } from '@llave/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@llave/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@llave/ui/select';
import { toast } from '@llave/ui/use-toast';
import { PinPromptDialog } from '@/components/pin-prompt-dialog';
import {
  useResumenBancarioDetalle,
  useResumenesBancarios,
  type ConfianzaMatch,
  type CreditoDetectadoApi,
} from '@/lib/api/use-resumenes-bancarios';
import { formatMonto } from '@/lib/format';

const COLOR_CONFIANZA: Record<ConfianzaMatch, string> = {
  ALTA: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  MEDIA: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  BAJA: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  SIN_MATCH: 'bg-muted text-muted-foreground',
};
const LABEL_CONFIANZA: Record<ConfianzaMatch, string> = {
  ALTA: 'Match alto',
  MEDIA: 'Revisar',
  BAJA: 'Sólo monto',
  SIN_MATCH: 'Sin match',
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function ValidadorResumenApiDialog({ open, onOpenChange }: Props) {
  const { subir } = useResumenesBancarios();
  const [subiendo, setSubiendo] = useState(false);
  const [resumenId, setResumenId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSubiendo(true);
    try {
      const r = await subir(file);
      setResumenId(r.id);
      toast({
        variant: 'success',
        title: `Detectamos ${r.creditosDetectados} crédito${r.creditosDetectados === 1 ? '' : 's'}`,
        description: r.filasIgnoradas > 0 ? `${r.filasIgnoradas} fila(s) sin monto positivo se ignoraron.` : undefined,
      });
    } catch (err) {
      toast({ variant: 'destructive', title: 'No pudimos leer el archivo', description: err instanceof Error ? err.message : undefined });
    } finally {
      setSubiendo(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const cerrar = () => {
    onOpenChange(false);
    setTimeout(() => setResumenId(null), 200);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && cerrar()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Validar por resumen bancario
          </DialogTitle>
        </DialogHeader>

        {!resumenId ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Subí el extracto que exporta tu banco (Excel o CSV) con las columnas de fecha, monto y titular del
              remitente. Detectamos los créditos y sugerimos a qué pago corresponde cada uno.
            </p>
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed bg-muted/20 py-10 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted/30">
              {subiendo ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : <Upload className="h-6 w-6 text-primary" />}
              <span>{subiendo ? 'Leyendo el archivo…' : 'Elegí el archivo (.xlsx, .xls, .csv)'}</span>
              <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleUpload} disabled={subiendo} />
            </label>
          </div>
        ) : (
          <DetalleResumen resumenId={resumenId} onCerrar={cerrar} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function DetalleResumen({ resumenId, onCerrar }: { resumenId: string; onCerrar: () => void }) {
  const { detalle, cargando, conciliar } = useResumenBancarioDetalle(resumenId);
  const [seleccion, setSeleccion] = useState<Record<string, string>>({});
  const [pinAbierto, setPinAbierto] = useState(false);
  const pendingRef = useRef<{ creditoId: string; liquidacionId: string } | null>(null);

  if (cargando || !detalle) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const pendientes = detalle.creditos.filter((c) => !c.conciliado);
  const conciliados = detalle.creditos.filter((c) => c.conciliado);

  const liquidacionElegida = (c: CreditoDetectadoApi): string | undefined => seleccion[c.id] ?? c.sugerido.liquidacionId ?? undefined;

  const abrirConciliar = (credito: CreditoDetectadoApi) => {
    const liquidacionId = liquidacionElegida(credito);
    if (!liquidacionId) {
      toast({ variant: 'destructive', title: 'Elegí a qué liquidación corresponde' });
      return;
    }
    pendingRef.current = { creditoId: credito.id, liquidacionId };
    setPinAbierto(true);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
        {detalle.fileName} · {pendientes.length} pendiente{pendientes.length === 1 ? '' : 's'} · {conciliados.length} conciliado{conciliados.length === 1 ? '' : 's'}
      </div>

      {pendientes.length === 0 ? (
        <div className="rounded-md border border-dashed bg-muted/20 p-8 text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
          <p className="mt-2 text-sm font-medium">Todo conciliado</p>
        </div>
      ) : (
        <div className="space-y-2">
          {pendientes.map((c) => (
            <Card key={c.id}>
              <CardContent className="space-y-2 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{c.titularOrigen || 'Remitente sin nombre'}</p>
                    <p className="truncate text-xs text-muted-foreground">{c.concepto || c.bancoOrigen}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold">{formatMonto(c.monto)}</p>
                    <Badge className={`text-[9px] ${COLOR_CONFIANZA[c.sugerido.confianza]}`}>{LABEL_CONFIANZA[c.sugerido.confianza]}</Badge>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">{c.sugerido.motivo}</p>
                <div className="flex items-center gap-2">
                  <Select value={liquidacionElegida(c) ?? ''} onValueChange={(v) => setSeleccion((s) => ({ ...s, [c.id]: v }))}>
                    <SelectTrigger className="h-8 flex-1 text-xs">
                      <SelectValue placeholder="Elegí a qué liquidación corresponde" />
                    </SelectTrigger>
                    <SelectContent>
                      {detalle.opciones.map((o) => (
                        <SelectItem key={o.liquidacionId} value={o.liquidacionId}>
                          {o.inquilino || 'Sin nombre'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" onClick={() => abrirConciliar(c)} disabled={!liquidacionElegida(c)}>
                    Conciliar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {conciliados.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ya conciliados</p>
          {conciliados.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-md bg-emerald-50/40 px-3 py-1.5 text-xs dark:bg-emerald-900/10">
              <span className="truncate">{c.titularOrigen}</span>
              <span className="font-medium">{formatMonto(c.monto)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-end border-t pt-3">
        <Button variant="outline" onClick={onCerrar}>
          Cerrar
        </Button>
      </div>

      <PinPromptDialog
        abierto={pinAbierto}
        accion="Conciliar crédito bancario"
        validacion="servidor"
        onClose={() => setPinAbierto(false)}
        onConfirmado={async (pin) => {
          const pending = pendingRef.current;
          if (!pending) return null;
          const err = await conciliar(pending.creditoId, pending.liquidacionId, pin);
          if (err) return err;
          pendingRef.current = null;
          toast({ variant: 'success', title: 'Conciliado' });
          return null;
        }}
      />
    </div>
  );
}
