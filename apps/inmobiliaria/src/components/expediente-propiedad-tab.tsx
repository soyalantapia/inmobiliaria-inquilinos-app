'use client';

/**
 * Pestaña "Expediente" de la ficha de propiedad: el trackeo de vida cruzando todos sus
 * contratos — salud de pago (morosidad + puntualidad + depósito), seguros/garantías con
 * alerta de vencimiento, y línea de tiempo. Solo modo API (en demo se oculta).
 */
import { Card, CardContent, CardHeader, CardTitle } from '@llave/ui/card';
import { Badge } from '@llave/ui/badge';
import { apiEnabled } from '@/lib/api/client';
import {
  usePropiedadSaludPago,
  usePropiedadSeguros,
  usePropiedadTimeline,
  type Garantia,
} from '@/lib/api/use-propiedad-expediente';
import { formatMonto, formatFecha } from '@/lib/format';
import type { Moneda } from '@/lib/types';

function titulo(s: string) {
  return s.charAt(0) + s.slice(1).toLowerCase();
}
function deudaTexto(m: Record<string, number>): string {
  const e = Object.entries(m).filter(([, v]) => v > 0);
  if (!e.length) return formatMonto(0, 'ARS');
  return e.map(([mon, val]) => formatMonto(val, mon as Moneda)).join(' · ');
}
function estadoPolizaColor(e: Garantia['estadoPoliza']): string {
  if (e === 'VENCIDA') return 'text-red-600';
  if (e === 'POR_VENCER') return 'text-amber-600';
  if (e === 'VIGENTE') return 'text-emerald-600';
  return 'text-muted-foreground';
}

export function ExpedientePropiedadTab({ propiedadId }: { propiedadId: string }) {
  const { data: salud } = usePropiedadSaludPago(propiedadId);
  const { data: seguros } = usePropiedadSeguros(propiedadId);
  const { data: tl } = usePropiedadTimeline(propiedadId);

  if (!apiEnabled) {
    return (
      <Card>
        <CardContent className="p-10 text-center text-sm text-muted-foreground">
          El expediente de la propiedad está disponible en producción.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* SALUD DE PAGO */}
      {salud && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Salud de pago (todos los contratos)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Deuda impaga que quedó</p>
                <p className="text-base font-semibold">{deudaTexto(salud.totales.deudaImpagaPorMoneda)}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Cuotas vencidas</p>
                <p className="text-base font-semibold">{salud.totales.cuotasVencidas}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Puntualidad</p>
                <p className="text-base font-semibold">
                  {salud.totales.puntualidadPct != null ? `${salud.totales.puntualidadPct}%` : '—'}
                </p>
              </div>
            </div>
            <ul role="list" className="divide-y">
              {salud.contratos.map((c) => (
                <li key={c.contratoId} className="space-y-1 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate font-medium">{c.inquilino || '—'}</span>
                    <Badge variant="outline">{titulo(c.estado)}</Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {c.deudaImpaga > 0 ? (
                      <span className="font-semibold text-red-600">
                        Debe {formatMonto(c.deudaImpaga, c.moneda)} · {c.cuotasVencidas} cuota(s) vencida(s)
                      </span>
                    ) : (
                      <span className="text-emerald-600">Sin deuda vencida</span>
                    )}
                    {c.cuotasPagadas > 0 &&
                      ` · pagó ${c.pagadasATiempo}/${c.cuotasPagadas} a tiempo${
                        c.pagadasTarde > 0 ? ` (atraso prom. ${c.diasAtrasoPromedio}d)` : ''
                      }`}
                    {c.deposito && ` · depósito ${formatMonto(c.deposito.monto, c.moneda)}${c.deposito.estado ? ` (${titulo(c.deposito.estado)})` : ''}`}
                  </p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* SEGUROS / GARANTÍAS */}
      {seguros && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
            <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Seguros / garantías
            </CardTitle>
            <div className="flex gap-1.5">
              {seguros.alertas.vencidas > 0 && (
                <Badge variant="destructive">{seguros.alertas.vencidas} vencida(s)</Badge>
              )}
              {seguros.alertas.porVencer > 0 && (
                <Badge variant="secondary">{seguros.alertas.porVencer} por vencer</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="text-sm">
            {seguros.garantias.length === 0 ? (
              <p className="text-muted-foreground">
                No hay seguros ni garantías cargados en los contratos de esta propiedad.
              </p>
            ) : (
              <ul role="list" className="divide-y">
                {seguros.garantias.map((g) => (
                  <li key={g.id} className="flex items-start justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{g.nombre}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {g.esPoliza ? (g.tipo === 'CAUCION' ? 'Seguro de caución' : 'Garantía digital') : titulo(g.tipo)}
                        {g.numeroPoliza && ` · póliza ${g.numeroPoliza}`}
                        {g.montoCobertura != null && ` · cobertura ${formatMonto(g.montoCobertura, 'ARS')}`}
                        {g.inquilino && ` · ${g.inquilino}`}
                      </p>
                    </div>
                    {g.vigenciaHasta && (
                      <div className="shrink-0 text-right">
                        <p className={`text-[11px] font-semibold ${estadoPolizaColor(g.estadoPoliza)}`}>
                          {g.estadoPoliza === 'VENCIDA' ? 'Vencida' : g.estadoPoliza === 'POR_VENCER' ? 'Por vencer' : 'Vigente'}
                        </p>
                        <p className="text-[11px] text-muted-foreground">vence {formatFecha(g.vigenciaHasta.slice(0, 10))}</p>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {/* LÍNEA DE TIEMPO */}
      {tl && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Línea de tiempo
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {tl.eventos.length === 0 ? (
              <p className="text-muted-foreground">Todavía no hay eventos registrados.</p>
            ) : (
              <ul role="list" className="space-y-3">
                {tl.eventos.map((e, i) => (
                  <li key={i} className="flex gap-3">
                    <div className="mt-1 flex flex-col items-center">
                      <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                      {i < tl.eventos.length - 1 && <span className="w-px flex-1 bg-border" />}
                    </div>
                    <div className="min-w-0 pb-1">
                      <p className="text-[11px] text-muted-foreground">{formatFecha(e.fecha.slice(0, 10))}</p>
                      <p className="font-medium">{e.titulo}</p>
                      {e.detalle && <p className="text-xs text-muted-foreground">{e.detalle}</p>}
                      {e.inquilino && <p className="text-[11px] text-muted-foreground">{e.inquilino}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
