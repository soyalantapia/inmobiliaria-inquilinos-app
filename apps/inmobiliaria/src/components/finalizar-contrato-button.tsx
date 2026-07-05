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

/**
 * Finaliza un contrato y libera la propiedad (vuelve a DISPONIBLE). Sin esto, una
 * propiedad cuyo contrato venció quedaba ALQUILADA para siempre y no se le podía
 * cargar un contrato nuevo.
 *
 * Al abrir el diálogo consulta GET /contratos/:id/finalizar-preview y muestra los
 * colaterales (deuda que queda, cuotas que se anulan, pagos en revisión,
 * co-inquilinos, reclamos) para que la baja —irreversible— no se confirme a ciegas.
 */
export function FinalizarContratoButton({ contratoId, direccion }: { contratoId: string; direccion: string }) {
  const qc = useQueryClient();
  const { finalizar } = useFinalizarContrato();
  const { obtenerPreview } = useFinalizarPreview();
  const [open, setOpen] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [preview, setPreview] = useState<FinalizarPreview | null>(null);
  const [cargandoPreview, setCargandoPreview] = useState(false);

  // Al abrir, traemos el preview. Si falla (o en demo devuelve null), el diálogo
  // igual funciona con el copy base — el preview es una ayuda, no un bloqueo.
  useEffect(() => {
    if (!open) return;
    let vivo = true;
    setPreview(null);
    setCargandoPreview(true);
    obtenerPreview(contratoId)
      .then((p) => { if (vivo) setPreview(p); })
      .catch(() => { /* preview best-effort: seguimos con el copy base */ })
      .finally(() => { if (vivo) setCargandoPreview(false); });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, contratoId]);

  const confirmar = async () => {
    if (enviando) return;
    setEnviando(true);
    try {
      const { cuotasAnuladas } = await finalizar(contratoId);
      await qc.invalidateQueries({ queryKey: ['contrato', contratoId] });
      toast({
        variant: 'success',
        title: 'Contrato finalizado',
        description:
          `${direccion} quedó disponible para un nuevo contrato.` +
          (cuotasAnuladas > 0
            ? ` Se anularon ${cuotasAnuladas} cuota${cuotasAnuladas === 1 ? '' : 's'} futura${cuotasAnuladas === 1 ? '' : 's'} impaga${cuotasAnuladas === 1 ? '' : 's'}.`
            : ''),
      });
      setOpen(false);
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'No se pudo finalizar',
        description: e instanceof ApiError ? e.message : 'Probá de nuevo en un momento.',
      });
    } finally {
      setEnviando(false);
    }
  };

  // Sólo mostramos las líneas que aplican (deuda > 0, cuotas a anular > 0, etc.).
  const colaterales: string[] = [];
  if (preview) {
    if (preview.deudaVencida > 0) {
      colaterales.push(
        `Queda deuda vencida por ${formatMonto(preview.deudaVencida)} (${preview.cuotasImpagas} cuota${preview.cuotasImpagas === 1 ? '' : 's'}) — se conserva y sigue siendo cobrable.`,
      );
    }
    if (preview.cuotasFuturasAAnular > 0) {
      colaterales.push(
        `Se anularán ${preview.cuotasFuturasAAnular} cuota${preview.cuotasFuturasAAnular === 1 ? '' : 's'} futura${preview.cuotasFuturasAAnular === 1 ? '' : 's'} impaga${preview.cuotasFuturasAAnular === 1 ? '' : 's'}.`,
      );
    }
    if (preview.pagosEnRevision > 0) {
      colaterales.push(
        `Hay ${preview.pagosEnRevision} pago${preview.pagosEnRevision === 1 ? '' : 's'} en revisión — vas a poder validarlo${preview.pagosEnRevision === 1 ? '' : 's'} después de la baja.`,
      );
    }
    if (preview.coInquilinos > 0) {
      colaterales.push(
        `${preview.coInquilinos} co-inquilino${preview.coInquilinos === 1 ? '' : 's'} perderá${preview.coInquilinos === 1 ? '' : 'n'} el acceso para operar.`,
      );
    }
    if (preview.reclamosAbiertos > 0) {
      colaterales.push(
        `Hay ${preview.reclamosAbiertos} reclamo${preview.reclamosAbiertos === 1 ? '' : 's'} abierto${preview.reclamosAbiertos === 1 ? '' : 's'}.`,
      );
    }
  }

  const descripcion = (
    <span className="block space-y-2">
      <span className="block">
        El contrato pasa a <strong>finalizado</strong> y la propiedad vuelve a estar disponible.
        Las cuotas <strong>futuras impagas se anulan</strong>; la <strong>deuda ya vencida se conserva</strong> (sigue
        siendo cobrable). El historial de pagos y comprobantes se mantiene. No se puede deshacer.
      </span>
      {cargandoPreview && (
        <span className="block text-xs text-muted-foreground">Revisando el contrato…</span>
      )}
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
        title="¿Finalizar este contrato?"
        description={descripcion}
        confirmLabel="Sí, finalizar"
        variant="destructive"
        loading={enviando}
        onConfirm={confirmar}
      />
    </>
  );
}
