'use client';

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CalendarX } from 'lucide-react';
import { Button } from '@llave/ui/button';
import { ConfirmDialog } from '@llave/ui/confirm-dialog';
import { toast } from '@llave/ui/use-toast';
import { ApiError } from '@/lib/api/client';
import { useFinalizarContrato, useFinalizarPreview, type FinalizarPreview } from '@/lib/api/hooks';
import { formatMonto } from '@/lib/format';
import type { Moneda } from '@/lib/types';

type DecisionDeposito = 'NETEAR' | 'DEVOLVER' | 'EJECUTAR' | 'MANTENER';

const DECISIONES: { k: DecisionDeposito; label: string; ayuda: string }[] = [
  { k: 'NETEAR', label: 'Netear', ayuda: 'Aplicar contra la deuda/penalidad' },
  { k: 'DEVOLVER', label: 'Devolver', ayuda: 'Devolvérselo íntegro' },
  { k: 'EJECUTAR', label: 'Retener', ayuda: 'Quedártelo por incumplimiento' },
  { k: 'MANTENER', label: 'Después', ayuda: 'Resolverlo más tarde' },
];

/**
 * Da de baja un contrato (finalización por fin de plazo o RESCISIÓN anticipada) y libera
 * la propiedad. Al abrir consulta /finalizar-preview (deuda que queda, cuotas a anular,
 * pagos en revisión, y —para rescisión— depósito en custodia + penalidad sugerida).
 * En rescisión el operador confirma la penalidad y qué hacer con el depósito (netear/
 * devolver/retener), y ve el saldo neto (a cobrar o a devolver) antes de confirmar.
 */
export function FinalizarContratoButton({ contratoId, direccion }: { contratoId: string; direccion: string }) {
  const qc = useQueryClient();
  const { finalizar } = useFinalizarContrato();
  const { obtenerPreview } = useFinalizarPreview();
  const [open, setOpen] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [preview, setPreview] = useState<FinalizarPreview | null>(null);
  const [cargandoPreview, setCargandoPreview] = useState(false);
  const [tipo, setTipo] = useState<'FINALIZADO' | 'RESCINDIDO'>('FINALIZADO');
  const [montoPenalidad, setMontoPenalidad] = useState('');
  const [motivo, setMotivo] = useState('');
  const [decisionDeposito, setDecisionDeposito] = useState<DecisionDeposito>('NETEAR');

  useEffect(() => {
    if (!open) return;
    let vivo = true;
    setPreview(null);
    setTipo('FINALIZADO');
    setMontoPenalidad('');
    setMotivo('');
    setDecisionDeposito('NETEAR');
    setCargandoPreview(true);
    obtenerPreview(contratoId)
      .then((p) => { if (vivo) setPreview(p); })
      .catch(() => { /* best-effort */ })
      .finally(() => { if (vivo) setCargandoPreview(false); });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, contratoId]);

  const esRescision = tipo === 'RESCINDIDO';
  const moneda = (preview?.moneda ?? 'ARS') as Moneda;
  const deudaV = preview?.deudaVencida ?? 0;
  const depositoCust = preview?.depositoEnCustodia ?? 0;
  const penalidadNum = montoPenalidad === '' ? 0 : Math.max(0, Number(montoPenalidad) || 0);

  // Al pasar a RESCISIÓN, precargamos la penalidad sugerida (editable por el operador).
  const elegirRescision = () => {
    setTipo('RESCINDIDO');
    if (montoPenalidad === '' && preview?.penalidadSugerida != null) {
      setMontoPenalidad(String(preview.penalidadSugerida));
    }
  };

  const depositoAplicado = depositoCust > 0 && (decisionDeposito === 'NETEAR' || decisionDeposito === 'EJECUTAR') ? depositoCust : 0;
  const saldoNeto = Math.round((deudaV + penalidadNum - depositoAplicado) * 100) / 100;
  const montoDevuelto =
    decisionDeposito === 'DEVOLVER'
      ? depositoCust
      : decisionDeposito === 'NETEAR'
        ? Math.max(0, Math.round((depositoCust - (deudaV + penalidadNum)) * 100) / 100)
        : 0; // EJECUTAR / MANTENER

  const confirmar = async () => {
    if (enviando) return;
    setEnviando(true);
    try {
      const opts = esRescision
        ? {
            tipo,
            motivoRescision: motivo.trim() || undefined,
            montoPenalidad: penalidadNum || undefined,
            decisionDeposito,
            montoDepositoDevuelto: decisionDeposito === 'MANTENER' ? undefined : montoDevuelto,
          }
        : { tipo };
      const { cuotasAnuladas, cargoPenalidad } = await finalizar(contratoId, opts);
      await qc.invalidateQueries({ queryKey: ['contrato', contratoId] });
      toast({
        variant: 'success',
        title: esRescision ? 'Contrato rescindido' : 'Contrato finalizado',
        description:
          `${direccion} quedó disponible para un nuevo contrato.` +
          (cargoPenalidad > 0 ? ` Penalidad de ${formatMonto(cargoPenalidad, moneda)} registrada.` : '') +
          (cuotasAnuladas > 0
            ? ` Se anularon ${cuotasAnuladas} cuota${cuotasAnuladas === 1 ? '' : 's'} futura${cuotasAnuladas === 1 ? '' : 's'}.`
            : ''),
      });
      setOpen(false);
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'No se pudo dar de baja',
        description: e instanceof ApiError ? e.message : 'Probá de nuevo en un momento.',
      });
    } finally {
      setEnviando(false);
    }
  };

  const colaterales: string[] = [];
  if (preview) {
    if (preview.deudaVencida > 0)
      colaterales.push(`Queda deuda vencida por ${formatMonto(preview.deudaVencida, moneda)} (${preview.cuotasImpagas} cuota${preview.cuotasImpagas === 1 ? '' : 's'}) — se conserva y sigue siendo cobrable.`);
    if (preview.cuotasFuturasAAnular > 0)
      colaterales.push(`Se anularán ${preview.cuotasFuturasAAnular} cuota${preview.cuotasFuturasAAnular === 1 ? '' : 's'} futura${preview.cuotasFuturasAAnular === 1 ? '' : 's'} impaga${preview.cuotasFuturasAAnular === 1 ? '' : 's'}.`);
    if (preview.pagosEnRevision > 0)
      colaterales.push(`Hay ${preview.pagosEnRevision} pago${preview.pagosEnRevision === 1 ? '' : 's'} en revisión — vas a poder validarlo${preview.pagosEnRevision === 1 ? '' : 's'} después.`);
    if (preview.coInquilinos > 0)
      colaterales.push(`${preview.coInquilinos} co-inquilino${preview.coInquilinos === 1 ? '' : 's'} perderá${preview.coInquilinos === 1 ? '' : 'n'} el acceso.`);
    if (preview.reclamosAbiertos > 0)
      colaterales.push(`Hay ${preview.reclamosAbiertos} reclamo${preview.reclamosAbiertos === 1 ? '' : 's'} abierto${preview.reclamosAbiertos === 1 ? '' : 's'}.`);
  }

  const opcionCls = (activo: boolean) =>
    `flex-1 rounded-md border p-2 text-left text-xs transition-colors ${activo ? 'border-primary bg-primary/5 text-foreground' : 'border-border text-muted-foreground hover:bg-muted/50'}`;
  const chipCls = (activo: boolean) =>
    `rounded-full border px-2 py-0.5 text-[11px] transition-colors ${activo ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted/50'}`;

  const descripcion = (
    <span className="block space-y-2">
      <span className="block">
        <span className="mb-1 block text-xs font-medium text-foreground">Motivo de la baja</span>
        <span className="flex gap-2">
          <button type="button" aria-pressed={!esRescision} className={opcionCls(!esRescision)} onClick={() => setTipo('FINALIZADO')}>
            <span className="block font-medium text-foreground">Finalización</span>
            <span className="block">Se cumplió el plazo pactado</span>
          </button>
          <button type="button" aria-pressed={esRescision} className={opcionCls(esRescision)} onClick={elegirRescision}>
            <span className="block font-medium text-foreground">Rescisión</span>
            <span className="block">Baja anticipada</span>
          </button>
        </span>
      </span>

      <span className="block">
        El contrato pasa a <strong>{esRescision ? 'rescindido' : 'finalizado'}</strong> y la propiedad vuelve a estar
        disponible. Las cuotas <strong>futuras impagas se anulan</strong>; la <strong>deuda ya vencida se conserva</strong>.
        No se puede deshacer.
      </span>

      {cargandoPreview && <span className="block text-xs text-muted-foreground">Revisando el contrato…</span>}

      {colaterales.length > 0 && (
        <span className="block rounded-md border border-border bg-muted/40 p-3 text-xs">
          <span className="block font-medium text-foreground">Antes de confirmar, tené en cuenta:</span>
          <span className="mt-1 block space-y-1">
            {colaterales.map((c, i) => (
              <span key={i} className="block text-muted-foreground">• {c}</span>
            ))}
          </span>
        </span>
      )}

      {/* Liquidación de la rescisión: penalidad + depósito + saldo neto */}
      {esRescision && preview && (
        <span className="block space-y-2 rounded-md border border-primary/30 bg-primary/5 p-3 text-xs">
          <span className="block font-medium text-foreground">Liquidación de la rescisión</span>

          <span className="flex items-center justify-between gap-2">
            <span>Penalidad (multa){preview.mesesPenalidad ? ` · ${preview.mesesPenalidad} canon${preview.mesesPenalidad === 1 ? '' : 'es'}` : ''}</span>
            <input
              type="number"
              inputMode="decimal"
              value={montoPenalidad}
              onChange={(e) => setMontoPenalidad(e.target.value)}
              className="w-32 rounded border border-border bg-background px-2 py-1 text-right"
              placeholder="0"
            />
          </span>

          {depositoCust > 0 && (
            <span className="block space-y-1">
              <span className="flex items-center justify-between">
                <span>Depósito en custodia</span>
                <span className="font-medium text-foreground">{formatMonto(depositoCust, moneda)}</span>
              </span>
              <span className="flex flex-wrap gap-1">
                {DECISIONES.map((d) => (
                  <button key={d.k} type="button" className={chipCls(decisionDeposito === d.k)} onClick={() => setDecisionDeposito(d.k)} title={d.ayuda}>
                    {d.label}
                  </button>
                ))}
              </span>
              {montoDevuelto > 0 && (
                <span className="block text-muted-foreground">Se le devuelve {formatMonto(montoDevuelto, moneda)}.</span>
              )}
            </span>
          )}

          <span className="flex items-center justify-between border-t border-primary/20 pt-1 font-medium text-foreground">
            <span>{saldoNeto >= 0 ? 'Saldo a cobrar al inquilino' : 'Saldo a devolver al inquilino'}</span>
            <span className={saldoNeto > 0 ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400'}>
              {formatMonto(Math.abs(saldoNeto), moneda)}
            </span>
          </span>

          <input
            type="text"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            className="w-full rounded border border-border bg-background px-2 py-1"
            placeholder="Motivo de la rescisión (opcional)"
            maxLength={500}
          />
        </span>
      )}
    </span>
  );

  return (
    <>
      <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setOpen(true)}>
        <CalendarX className="h-4 w-4" />
        Finalizar contrato
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="¿Dar de baja este contrato?"
        description={descripcion}
        confirmLabel={esRescision ? 'Sí, rescindir' : 'Sí, finalizar'}
        variant="destructive"
        loading={enviando}
        onConfirm={confirmar}
      />
    </>
  );
}
