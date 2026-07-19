'use client';

/**
 * Ajuste masivo de alquileres. Camila (inmobiliaria): "el ajuste es por cada
 * inquilino, hay que hacerlo general a todos los que aumentan el mes entrante;
 * uno por uno es imposible". Su método: ELLA pone el % (lo saca del IPC) y el
 * sistema le dice a QUIÉN le toca ajustar este mes.
 *
 * Este dialog:
 *  - lista los contratos ACTIVOS, resaltando y pre-seleccionando los que tienen
 *    `proximoAjuste` este mes o vencido,
 *  - toma un % (que pone la inmo),
 *  - aplica el aumento a cada tildado reusando PATCH /contratos/:id/monto (el
 *    mismo del ajuste individual, que re-devenga las liquidaciones futuras).
 *
 * No hay endpoint bulk: se hace un PATCH por contrato (carteras de decenas → ok).
 */
import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { TrendingUp } from 'lucide-react';
import { Button } from '@llave/ui/button';
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
import { apiFetch, ApiError } from '@/lib/api/client';
import { ensureApiSession } from '@/lib/api/session';
import { useContratos } from '@/lib/api/hooks';
import { formatMonto } from '@/lib/format';
import type { ContratoListado } from '@/lib/types';

// YYYY-MM del mes actual (mismo formato que proximoAjuste).
function mesActual(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ¿Al contrato le toca ajustar este mes o ya está vencido el ajuste?
function ajustaEsteMes(c: ContratoListado, mes: string): boolean {
  if (!c.proximoAjuste) return false;
  return c.proximoAjuste.slice(0, 7) <= mes;
}

export function AjusteMasivoDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const { contratos } = useContratos();
  const mes = mesActual();

  const activos = useMemo(
    () => contratos.filter((c) => c.estado === 'ACTIVO'),
    [contratos],
  );

  const [porcentaje, setPorcentaje] = useState('');
  const [seleccion, setSeleccion] = useState<Record<string, boolean>>({});
  const [aplicando, setAplicando] = useState(false);
  const [progreso, setProgreso] = useState<{ hechos: number; total: number } | null>(null);

  // Al abrir: pre-tildar los que ajustan este mes (o vencidos). Si ninguno vence,
  // no tildamos nada (la inmo elige a mano).
  useEffect(() => {
    if (open) {
      const pre: Record<string, boolean> = {};
      activos.forEach((c) => {
        if (ajustaEsteMes(c, mes)) pre[c.id] = true;
      });
      setSeleccion(pre);
      setPorcentaje('');
      setProgreso(null);
      setAplicando(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activos.map((c) => c.id).join(',')]);

  const pct = Number(porcentaje.replace(',', '.'));
  const pctValido = Number.isFinite(pct) && pct > 0;
  const elegidos = activos.filter((c) => seleccion[c.id]);
  const nuevoMonto = (m: number) => Math.round(m * (1 + pct / 100));

  const tildarTodos = (v: boolean) => {
    const next: Record<string, boolean> = {};
    if (v) activos.forEach((c) => { next[c.id] = true; });
    setSeleccion(next);
  };

  const aplicar = async () => {
    if (!pctValido || elegidos.length === 0) return;
    setAplicando(true);
    setProgreso({ hechos: 0, total: elegidos.length });
    const exitosos: string[] = [];
    const errores: string[] = [];
    try {
      await ensureApiSession();
      for (const c of elegidos) {
        try {
          await apiFetch(`/contratos/${c.id}/monto`, {
            method: 'PATCH',
            body: JSON.stringify({
              monto: nuevoMonto(c.monto),
              motivo: `Ajuste masivo +${pct}%`,
            }),
          });
          exitosos.push(c.id);
        } catch (e) {
          errores.push(`${c.inquilino}: ${e instanceof ApiError ? e.message : 'error'}`);
        }
        setProgreso({ hechos: exitosos.length + errores.length, total: elegidos.length });
      }
      // CRÍTICO (plata): destildar los que salieron OK para que un reintento tras
      // un error parcial NO les vuelva a aplicar el aumento (15% sobre 15%). Así
      // "Aplicar" de nuevo corre SOLO sobre los que fallaron.
      if (exitosos.length > 0) {
        const okSet = new Set(exitosos);
        setSeleccion((s) => {
          const next = { ...s };
          for (const id of okSet) next[id] = false;
          return next;
        });
      }
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['contratos'] }),
        qc.invalidateQueries({ queryKey: ['contrato'] }),
        qc.invalidateQueries({ queryKey: ['liquidaciones'] }),
      ]);
      if (errores.length === 0) {
        toast({ variant: 'success', title: `¡Listo! Ajustaste ${exitosos.length} contrato${exitosos.length === 1 ? '' : 's'}`, description: `Aumento del ${pct}% aplicado.` });
        onOpenChange(false);
      } else {
        toast({
          variant: 'destructive',
          title: `${exitosos.length} ajustados, ${errores.length} con error`,
          description: `Dejamos tildados solo los que fallaron para que reintentes sin re-aumentar a nadie. ${errores.slice(0, 2).join(' · ')}`,
        });
      }
    } finally {
      setAplicando(false);
    }
  };

  const vencenEsteMes = activos.filter((c) => ajustaEsteMes(c, mes)).length;

  return (
    <Dialog open={open} onOpenChange={(v) => !aplicando && onOpenChange(v)}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Ajuste masivo de alquileres
          </DialogTitle>
          <DialogDescription>
            Poné el porcentaje de aumento y elegí a quiénes se lo aplicás. Ya te
            dejamos tildados los {vencenEsteMes} contrato{vencenEsteMes === 1 ? '' : 's'} que
            ajustan este mes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="am-pct">Aumento (%)</Label>
              <Input
                id="am-pct"
                inputMode="decimal"
                value={porcentaje}
                onChange={(e) => setPorcentaje(e.target.value.replace(/[^\d.,]/g, ''))}
                placeholder="Ej: 15"
                className="w-32"
                autoFocus
              />
            </div>
            <p className="pb-2 text-xs text-muted-foreground">
              El % lo ponés vos (ej. sumando los últimos meses de IPC).
            </p>
          </div>

          <div className="rounded-md border">
            <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-2 text-xs">
              <label className="flex items-center gap-2 font-medium">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-input accent-primary"
                  checked={elegidos.length > 0 && elegidos.length === activos.length}
                  onChange={(e) => tildarTodos(e.target.checked)}
                />
                {elegidos.length} de {activos.length} seleccionados
              </label>
              <span className="text-muted-foreground">Actual → Nuevo</span>
            </div>
            <div className="max-h-[45vh] divide-y overflow-y-auto">
              {activos.length === 0 && (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">No hay contratos activos.</p>
              )}
              {activos.map((c) => {
                const toca = ajustaEsteMes(c, mes);
                return (
                  <label key={c.id} className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-muted/20">
                    <input
                      type="checkbox"
                      className="h-4 w-4 shrink-0 rounded border-input accent-primary"
                      checked={!!seleccion[c.id]}
                      onChange={(e) => setSeleccion((s) => ({ ...s, [c.id]: e.target.checked }))}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{c.inquilino}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {c.direccion}
                        {toca && <span className="ml-1 rounded bg-amber-100 px-1 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">ajusta este mes</span>}
                      </span>
                    </span>
                    <span className="shrink-0 text-right text-xs tabular-nums">
                      <span className="text-muted-foreground">{formatMonto(c.monto, c.moneda)}</span>
                      {pctValido && seleccion[c.id] && (
                        <span className="block font-semibold text-emerald-600">{formatMonto(nuevoMonto(c.monto), c.moneda)}</span>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="text-xs text-muted-foreground">
              {progreso ? `Aplicando… ${progreso.hechos}/${progreso.total}` : `Se aplicará a ${elegidos.length} contrato${elegidos.length === 1 ? '' : 's'}.`}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={aplicando}>Cancelar</Button>
              <Button onClick={aplicar} disabled={aplicando || !pctValido || elegidos.length === 0}>
                {aplicando ? 'Aplicando…' : `Aplicar +${pctValido ? pct : '…'}%`}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
