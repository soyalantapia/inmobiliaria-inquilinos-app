'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  HandCoins,
  Landmark,
  Printer,
  RefreshCw,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card, CardContent } from '@llave/ui/card';
import { toast } from '@llave/ui/use-toast';
import {
  type CierreSnapshot,
  type MovimientoDia,
  calcularResumenDia,
  cerrarDia,
  cierreDelDia,
  efectivoEnMano,
  listarCierres,
} from '@/lib/cierre-caja';
import { formatFechaCorta, formatMonto } from '@/lib/format';

const USUARIO_ACTUAL = 'Roberto Tapia';

export function CierreDiarioCard() {
  const [hidratado, setHidratado] = useState(false);
  const [refresh, setRefresh] = useState(0);

  const hoyIso = useMemo(() => {
    return new Date().toISOString().slice(0, 10);
  }, []);

  useEffect(() => setHidratado(true), []);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- `refresh` es un contador para forzar re-lectura de localStorage
  const resumen = useMemo(() => calcularResumenDia(hoyIso), [hoyIso, refresh]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const estado = useMemo(() => efectivoEnMano(), [refresh]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const cierre = useMemo(() => cierreDelDia(hoyIso), [hoyIso, refresh]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const cierresPasados = useMemo(() => listarCierres().slice(0, 5), [refresh]);

  if (!hidratado) return null;

  const cerrar = () => {
    const snap = cerrarDia({ cerradoPor: USUARIO_ACTUAL });
    toast({
      variant: 'success',
      title: 'Día cerrado',
      description: `${snap.movimientos} movimiento${snap.movimientos === 1 ? '' : 's'} · saldo ${formatMonto(snap.balanceDia)}`,
    });
    setRefresh((n) => n + 1);
  };

  const imprimirReporte = () => {
    const html = construirReporteHtml(hoyIso, resumen, estado);
    const ventana = window.open('', '_blank', 'width=900,height=1100');
    if (!ventana) {
      toast({
        variant: 'destructive',
        title: 'Permite los pop-ups',
        description: 'Necesitamos abrir la ventana de impresión.',
      });
      return;
    }
    ventana.document.open();
    ventana.document.write(html);
    ventana.document.close();
    setTimeout(() => {
      ventana.focus();
      ventana.print();
    }, 350);
  };

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-md bg-primary text-primary-foreground">
              <CalendarClock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">Cierre del día · {formatFechaCorta(hoyIso)}</p>
              <p className="text-xs text-muted-foreground">
                {cierre
                  ? `Cerrado por ${cierre.cerradoPor} a las ${new Date(
                      cierre.cerradoAt,
                    ).toLocaleTimeString('es-AR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}`
                  : 'Caja abierta — todavía no cerraste el día.'}
              </p>
            </div>
          </div>
          {cierre && (
            <Badge variant="success" className="shrink-0 gap-1">
              <ShieldCheck className="h-3 w-3" />
              Cerrado
            </Badge>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          <Stat
            label="Ingresos del día"
            valor={formatMonto(resumen.ingresos)}
            tono="emerald"
            icono={ArrowUpRight}
          />
          <Stat
            label="Egresos del día"
            valor={formatMonto(resumen.egresos)}
            tono="red"
            icono={ArrowDownRight}
          />
          <Stat
            label="Balance del día"
            valor={formatMonto(resumen.balanceDia)}
            tono={resumen.balanceDia >= 0 ? 'emerald' : 'red'}
            icono={Wallet}
          />
          <Stat
            label="Efectivo en mano"
            valor={formatMonto(estado.enMano)}
            tono="primary"
            icono={HandCoins}
            hint={`Pendiente rendir ${formatMonto(estado.pendienteRendir)}`}
          />
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <ComparativaMes
            label="Cobrado este mes"
            valor={estado.cobradoMes}
            icono={Landmark}
          />
          <ComparativaMes
            label="Rendido este mes"
            valor={estado.rendidoMes}
            icono={CheckCircle2}
          />
          <ComparativaMes
            label="Movimientos hoy"
            valor={resumen.movimientos.length}
            icono={RefreshCw}
            esContador
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {!cierre && (
            <Button size="sm" onClick={cerrar}>
              <CheckCircle2 className="h-4 w-4" />
              Cerrar día
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={imprimirReporte}>
            <Printer className="h-4 w-4" />
            Imprimir reporte
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setRefresh((n) => n + 1)}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refrescar
          </Button>
        </div>

        {resumen.movimientos.length > 0 && (
          <details className="rounded-md border bg-background/50 p-3">
            <summary className="cursor-pointer text-xs font-medium">
              Ver detalle de hoy ({resumen.movimientos.length} movimiento{resumen.movimientos.length === 1 ? '' : 's'})
            </summary>
            <ul role="list" className="mt-2 space-y-1.5">
              {resumen.movimientos.map((m, i) => (
                <MovRow key={i} mov={m} />
              ))}
            </ul>
          </details>
        )}

        {cierresPasados.length > 0 && (
          <details className="rounded-md border bg-background/50 p-3">
            <summary className="cursor-pointer text-xs font-medium">
              Últimos cierres
            </summary>
            <ul role="list" className="mt-2 space-y-1">
              {cierresPasados.map((c) => (
                <li
                  key={c.fecha}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="text-muted-foreground">
                    {formatFechaCorta(c.fecha)} · {c.movimientos} movs · cerró{' '}
                    {c.cerradoPor}
                  </span>
                  <span
                    className={`font-semibold tabular-nums ${
                      c.balanceDia >= 0 ? 'text-emerald-600' : 'text-destructive'
                    }`}
                  >
                    {formatMonto(c.balanceDia)}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({
  label,
  valor,
  tono,
  icono: Icono,
  hint,
}: {
  label: string;
  valor: string;
  tono: 'emerald' | 'red' | 'primary' | 'muted';
  icono: typeof ArrowUpRight;
  hint?: string;
}) {
  const colorClass =
    tono === 'emerald'
      ? 'text-emerald-600'
      : tono === 'red'
        ? 'text-destructive'
        : tono === 'primary'
          ? 'text-primary'
          : 'text-muted-foreground';
  return (
    <div className="rounded-md border bg-background p-3">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
        <Icono className={`h-3 w-3 ${colorClass}`} />
        {label}
      </div>
      <p className={`mt-0.5 text-base font-semibold tabular-nums ${colorClass}`}>
        {valor}
      </p>
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function ComparativaMes({
  label,
  valor,
  icono: Icono,
  esContador = false,
}: {
  label: string;
  valor: number;
  icono: typeof ArrowUpRight;
  esContador?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border bg-background/50 p-2.5 text-xs">
      <Icono className="h-3.5 w-3.5 text-muted-foreground" />
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="text-sm font-semibold tabular-nums">
          {esContador ? valor : formatMonto(valor)}
        </p>
      </div>
    </div>
  );
}

function MovRow({ mov }: { mov: MovimientoDia }) {
  if (mov.tipo === 'INGRESO') {
    return (
      <li className="flex items-center justify-between gap-2 text-xs">
        <span className="flex items-center gap-1.5">
          <ArrowUpRight className="h-3 w-3 text-emerald-600" />
          {mov.descripcion}{' '}
          <span className="text-muted-foreground">· {mov.fuente}</span>
        </span>
        <span className="font-semibold tabular-nums text-emerald-600">
          + {formatMonto(mov.monto)}
        </span>
      </li>
    );
  }
  if (mov.tipo === 'RENDICION') {
    return (
      <li className="flex items-center justify-between gap-2 text-xs">
        <span className="flex items-center gap-1.5">
          <Landmark className="h-3 w-3 text-primary" />
          {mov.descripcion}{' '}
          <span className="text-muted-foreground">
            · {mov.metodo.charAt(0) + mov.metodo.slice(1).toLowerCase()}
          </span>
        </span>
        <span className="font-semibold tabular-nums text-destructive">
          − {formatMonto(mov.monto)}
        </span>
      </li>
    );
  }
  return (
    <li className="flex items-center justify-between gap-2 text-xs">
      <span className="flex items-center gap-1.5">
        <ArrowDownRight className="h-3 w-3 text-destructive" />
        {mov.mov.descripcion}{' '}
        <span className="text-muted-foreground">· {mov.mov.proveedor ?? '—'}</span>
      </span>
      <span className="font-semibold tabular-nums text-destructive">
        − {formatMonto(mov.mov.monto)}
      </span>
    </li>
  );
}

function construirReporteHtml(
  dia: string,
  resumen: { ingresos: number; egresos: number; balanceDia: number; movimientos: MovimientoDia[] },
  estado: { enMano: number; pendienteRendir: number; cobradoMes: number; rendidoMes: number },
): string {
  const filas = resumen.movimientos
    .map((m) => {
      if (m.tipo === 'INGRESO') {
        return `<tr><td>Ingreso</td><td>${escapar(m.descripcion)}</td><td>${escapar(
          m.fuente,
        )}</td><td style="text-align:right;color:#15803d">+ ${formatMonto(m.monto)}</td></tr>`;
      }
      if (m.tipo === 'RENDICION') {
        return `<tr><td>Rendición</td><td>${escapar(m.descripcion)}</td><td>${escapar(
          m.metodo,
        )}</td><td style="text-align:right;color:#b91c1c">− ${formatMonto(m.monto)}</td></tr>`;
      }
      return `<tr><td>Gasto</td><td>${escapar(m.mov.descripcion)}</td><td>${escapar(
        m.mov.proveedor ?? '—',
      )}</td><td style="text-align:right;color:#b91c1c">− ${formatMonto(m.mov.monto)}</td></tr>`;
    })
    .join('');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"/>
  <title>Cierre de caja ${dia}</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, sans-serif; padding: 32px; color: #111; }
    h1 { font-size: 18pt; margin-bottom: 4px; }
    h2 { font-size: 11pt; margin-top: 24px; color: #555; text-transform: uppercase; letter-spacing: 0.5px; }
    table { width: 100%; border-collapse: collapse; font-size: 10pt; margin-top: 8px; }
    th, td { padding: 6px 8px; border-bottom: 1px solid #e5e7eb; text-align: left; }
    th { background: #f3f4f6; font-size: 9pt; text-transform: uppercase; letter-spacing: 0.4px; }
    .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 12px; }
    .stat { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px; }
    .stat .label { font-size: 9pt; color: #6b7280; text-transform: uppercase; }
    .stat .valor { font-size: 14pt; font-weight: 700; margin-top: 2px; }
    .footer { margin-top: 24px; font-size: 9pt; color: #9ca3af; text-align: right; }
  </style></head>
  <body>
  <h1>Cierre de caja · ${formatFechaCorta(dia)}</h1>
  <p style="font-size:10pt;color:#555;margin-top:0;">My Alquiler · resumen del día y posición de mes</p>
  <div class="stats">
    <div class="stat"><div class="label">Ingresos</div><div class="valor" style="color:#15803d">${formatMonto(resumen.ingresos)}</div></div>
    <div class="stat"><div class="label">Egresos</div><div class="valor" style="color:#b91c1c">${formatMonto(resumen.egresos)}</div></div>
    <div class="stat"><div class="label">Balance del día</div><div class="valor">${formatMonto(resumen.balanceDia)}</div></div>
    <div class="stat"><div class="label">Efectivo en mano</div><div class="valor" style="color:#7c3aed">${formatMonto(estado.enMano)}</div></div>
  </div>
  <h2>Estado del mes</h2>
  <p style="font-size:10pt;">Cobrado: ${formatMonto(estado.cobradoMes)} · Rendido: ${formatMonto(estado.rendidoMes)} · Pendiente rendir: ${formatMonto(estado.pendienteRendir)}</p>
  <h2>Movimientos del día (${resumen.movimientos.length})</h2>
  <table>
    <thead><tr><th>Tipo</th><th>Detalle</th><th>Fuente/Proveedor</th><th style="text-align:right">Monto</th></tr></thead>
    <tbody>${filas || '<tr><td colspan="4" style="text-align:center;color:#888;padding:24px">Sin movimientos para ${dia}</td></tr>'}</tbody>
  </table>
  <p class="footer">Generado ${new Date().toLocaleString('es-AR')}</p>
  </body></html>`;
}

function escapar(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
