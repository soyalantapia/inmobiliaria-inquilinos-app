'use client';

/**
 * Card "Cargos del inquilino" en el detalle del contrato: reparaciones imputadas
 * (al inquilino o al depósito) + penalidades de rescisión, con su estado y la
 * acción "Marcar cobrado". Los cargos pendientes que NO van contra el depósito
 * suman a la deuda que ve el inquilino en su app (`GET /mis-cargos`); saldarlos
 * (`POST /cargos/:id/saldar`) los baja de esa deuda. Los contraDeposito se netean
 * en /depositos/en-custodia (no se cobran al inquilino), así que van sin botón.
 *
 * Se rinde sola: null en demo o si el contrato no tiene cargos.
 */
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@llave/ui/card';
import { AlertTriangle, Check, Loader2, Wrench } from 'lucide-react';
import { apiEnabled, apiFetch } from '@/lib/api/client';
import { useMe } from '@/lib/api/hooks';
import { rolTienePermiso, type Rol } from '@/lib/permisos';
import { formatFecha, formatMonto } from '@/lib/format';
import { toast } from '@llave/ui/use-toast';

interface CargoPanel {
  id: string;
  tipo: 'REPARACION' | 'PENALIDAD_RESCISION' | 'DANOS' | 'OTRO';
  concepto: string;
  monto: number;
  moneda: 'ARS' | 'USD';
  contraDeposito: boolean;
  reclamoId: string | null;
  saldadoAt: string | null;
  fecha: string;
}

export function CargosContratoCard({ contratoId }: { contratoId: string }) {
  // "Deshacer" resucita una deuda del inquilino Y borra el ingreso de caja que la respaldaba:
  // el server lo gatea con `pago.revertir` (ADMIN). Sin esto el botón se le mostraba también a
  // CAJA, OPERADOR, CARGA y LECTURA, sólo para darles un 403 después del click.
  // Con /auth/me caído no se recorta en silencio: el 403 del server sigue siendo la frontera.
  const { me, isError: meError } = useMe();
  const puedeDeshacer = !apiEnabled || meError || rolTienePermiso((me?.rol ?? 'LECTURA') as Rol, 'pago.revertir');
  const qc = useQueryClient();
  const [saldando, setSaldando] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ['cargos-contrato', contratoId],
    queryFn: () => apiFetch<CargoPanel[]>(`/contratos/${contratoId}/cargos`),
    enabled: apiEnabled,
    staleTime: 30_000,
  });

  if (!apiEnabled) return null;
  const cargos = q.data ?? [];
  // "NO HAY CARGOS" Y "NO PUDIMOS PREGUNTAR" NO SON LO MISMO.
  //
  // `q.data ?? []` aplastaba las dos cosas —en error `data` queda undefined y `isPending` pasa a
  // false— y la línea de abajo escondía la card ENTERA. Esta es la única vista del operador
  // sobre reparaciones imputadas al inquilino y penalidades de rescisión: con el endpoint caído
  // veía un detalle limpio, concluía que no hay nada que cobrar y daba de baja el contrato.
  //
  // La regla ya estaba escrita en `use-rendiciones.ts`: "'0 rendiciones' y 'no pudimos
  // preguntar' son cosas distintas, y la pantalla que las confunde le dice al operador que ya
  // se le rindió a todo el mundo".
  if (q.isError) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-amber-600" /> Cargos del inquilino
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No pudimos traer los cargos de este contrato. <strong>No quiere decir que no haya</strong>:
            volvé a cargar la página antes de dar de baja el contrato o cerrar la cuenta.
          </p>
        </CardContent>
      </Card>
    );
  }
  if (q.isPending || cargos.length === 0) return null;

  const saldar = async (id: string) => {
    setSaldando(id);
    try {
      await apiFetch(`/cargos/${id}/saldar`, { method: 'POST' });
      await qc.invalidateQueries({ queryKey: ['cargos-contrato', contratoId] });
    } finally {
      setSaldando(null);
    }
  };

  // Deshacer el cobro. No es un lujo: cuando se quiere reimputar un reclamo cuyo cargo ya
  // se cobró, el backend corta con 409 y le pide al operador exactamente esto. Sin el
  // botón, ese mensaje mandaba a hacer algo que no se podía hacer desde ningún lado.
  const descobrar = async (id: string) => {
    setSaldando(id);
    try {
      await apiFetch(`/cargos/${id}/descobrar`, { method: 'POST' });
      await qc.invalidateQueries({ queryKey: ['cargos-contrato', contratoId] });
      toast({ title: 'Cobro deshecho', description: 'El cargo vuelve a figurar como deuda del inquilino.' });
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'No se pudo deshacer',
        description: e instanceof Error ? e.message : 'Probá de nuevo.',
      });
    } finally {
      setSaldando(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Cargos del inquilino
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p className="text-xs text-muted-foreground">
          Reparaciones imputadas al inquilino y penalidades de rescisión. Los pendientes suman a la
          deuda que ve el inquilino en su app; marcá <strong>Cobrado</strong> cuando lo saldó.
        </p>
        {cargos.map((c) => {
          const Icon = c.tipo === 'PENALIDAD_RESCISION' ? AlertTriangle : Wrench;
          const saldado = !!c.saldadoAt;
          return (
            <div key={c.id} className="flex items-center gap-3 rounded-lg border p-3">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{c.concepto}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {formatMonto(c.monto, c.moneda)} · {formatFecha(c.fecha)}
                  {c.contraDeposito ? ' · contra depósito' : ''}
                </p>
              </div>
              {saldado ? (
                <span className="flex shrink-0 items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                    <Check className="h-3.5 w-3.5" /> Cobrado
                  </span>
                  {puedeDeshacer && (
                    <button
                      type="button"
                      onClick={() => descobrar(c.id)}
                      disabled={saldando === c.id}
                      className="rounded px-1.5 py-1 text-xs text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline disabled:opacity-60"
                      title="Volver a marcarlo como deuda pendiente del inquilino"
                    >
                      {saldando === c.id ? '…' : 'Deshacer'}
                    </button>
                  )}
                </span>
              ) : c.contraDeposito ? (
                <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                  Del depósito
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => saldar(c.id)}
                  disabled={saldando === c.id}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg border bg-card px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted disabled:opacity-60"
                >
                  {saldando === c.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5" />
                  )}
                  Marcar cobrado
                </button>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
