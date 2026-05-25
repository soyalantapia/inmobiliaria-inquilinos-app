'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Inbox,
  Receipt,
  Sparkles,
  Wallet,
  Wrench,
} from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Card, CardContent } from '@llave/ui/card';
import { cn } from '@llave/ui/cn';
import { totalesCargosMes } from '@/lib/cargos-a-cobrar';
import { estadoDePago } from '@/lib/conciliacion-storage';
import {
  contactosCobranzaMock,
  contratosMock,
  pagosInformadosMock,
  propietariosMock,
} from '@/lib/mock-data';
import { obtenerRendicion, periodoActual } from '@/lib/rendiciones-storage';
import { listarReclamos } from '@/lib/reclamos-store';
import { formatMonto } from '@/lib/format';

/**
 * Inbox priorizado del día. Reúne en un solo lugar todas las acciones
 * pendientes del inmo:
 *  - Pagos por validar (comprobantes informados sin decisión)
 *  - Reclamos abiertos sin profesional asignado
 *  - Cargos USO_Y_GOCE pendientes de cobro
 *  - Propietarios sin rendir este mes
 *  - Propietarios sin CBU cargado
 *
 * Cada item linkea al lugar exacto donde se resuelve. Ordenados por
 * severidad — lo más urgente arriba.
 */

interface Item {
  id: string;
  titulo: string;
  detalle: string;
  href: string;
  cant: number;
  monto?: number;
  icono: typeof Inbox;
  tono: 'rojo' | 'amber' | 'violeta' | 'azul' | 'esmeralda';
}

const TONOS: Record<
  Item['tono'],
  { card: string; chip: string; icon: string }
> = {
  rojo: {
    card: 'border-red-200 bg-red-50/40 hover:bg-red-50 dark:border-red-900/40 dark:bg-red-900/10',
    chip: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    icon: 'text-red-600 dark:text-red-300',
  },
  amber: {
    card: 'border-amber-200 bg-amber-50/40 hover:bg-amber-50 dark:border-amber-900/40 dark:bg-amber-900/10',
    chip: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    icon: 'text-amber-700 dark:text-amber-300',
  },
  violeta: {
    card: 'border-violet-200 bg-violet-50/40 hover:bg-violet-50 dark:border-violet-900/40 dark:bg-violet-900/10',
    chip: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
    icon: 'text-violet-700 dark:text-violet-300',
  },
  azul: {
    card: 'border-blue-200 bg-blue-50/40 hover:bg-blue-50 dark:border-blue-900/40 dark:bg-blue-900/10',
    chip: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    icon: 'text-blue-700 dark:text-blue-300',
  },
  esmeralda: {
    card: 'border-emerald-200 bg-emerald-50/40 hover:bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-900/10',
    chip: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    icon: 'text-emerald-700 dark:text-emerald-300',
  },
};

export function InboxDelDia() {
  const [items, setItems] = useState<Item[]>([]);
  const [hidratado, setHidratado] = useState(false);

  useEffect(() => {
    setItems(construirItems());
    setHidratado(true);
    // Re-leemos cada 5 segs para que los cambios de otras apps se reflejen
    const id = setInterval(() => setItems(construirItems()), 5000);
    return () => clearInterval(id);
  }, []);

  if (!hidratado) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Inbox className="h-4 w-4 text-primary" />
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Para resolver hoy
          </h2>
          <Badge variant="outline" className="text-[10px]">
            {items.reduce((s, i) => s + i.cant, 0)} acciones
          </Badge>
        </div>
        {items.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Tocá cada bloque para resolverlo
          </p>
        )}
      </div>

      {items.length === 0 ? (
        <Card className="border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-900/10">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="grid h-9 w-9 place-items-center rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="space-y-0.5">
              <p className="text-sm font-medium">
                ¡Día limpio! No hay nada urgente.
              </p>
              <p className="text-xs text-muted-foreground">
                Todo lo del mes está al día. Tomate un café 😎
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((it) => {
            const t = TONOS[it.tono];
            const Icon = it.icono;
            return (
              <Link
                key={it.id}
                href={it.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg border p-3 transition-colors',
                  t.card,
                )}
              >
                <div className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-md', t.chip)}>
                  <Icon className={cn('h-4 w-4', t.icon)} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">{it.titulo}</p>
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      {it.cant}
                    </Badge>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {it.detalle}
                    {it.monto !== undefined && (
                      <span className="ml-1 font-medium text-foreground tabular-nums">
                        · {formatMonto(it.monto)}
                      </span>
                    )}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

/* ============================================================
 * Construcción de items priorizados
 * ============================================================ */
function construirItems(): Item[] {
  const items: Item[] = [];

  // 1) Pagos por validar (comprobantes informados sin decisión)
  const porValidar = pagosInformadosMock.filter(
    (p) => estadoDePago(p.id) === 'INFORMADO',
  );
  if (porValidar.length > 0) {
    items.push({
      id: 'pagos-validar',
      titulo: 'Pagos a validar',
      detalle: `${porValidar.length} comprobante${porValidar.length === 1 ? '' : 's'} esperando OK`,
      href: '/pagos',
      cant: porValidar.length,
      monto: porValidar.reduce((s, p) => s + p.monto, 0),
      icono: CheckCircle2,
      tono: 'violeta',
    });
  }

  // 2) Reclamos abiertos sin profesional asignado
  const reclamosSinProf = listarReclamos().filter(
    (r) =>
      (r.estado === 'ABIERTO' || r.estado === 'EN_CURSO') &&
      !r.profesionalAsignadoId,
  );
  if (reclamosSinProf.length > 0) {
    const emergencias = reclamosSinProf.filter((r) => r.urgencia === 'EMERGENCIA').length;
    items.push({
      id: 'reclamos-sin-prof',
      titulo: emergencias > 0 ? '⚠ Reclamos sin asignar' : 'Reclamos sin asignar',
      detalle:
        emergencias > 0
          ? `${emergencias} de emergencia · asigná un pro ya`
          : 'Asigná un profesional a la red',
      href: '/reclamos',
      cant: reclamosSinProf.length,
      icono: Wrench,
      tono: emergencias > 0 ? 'rojo' : 'amber',
    });
  }

  // 3) Cargos USO_Y_GOCE pendientes de cobro
  const cargos = totalesCargosMes();
  if (cargos.cantPendientes > 0) {
    items.push({
      id: 'cargos-pendientes',
      titulo: 'Cargos a cobrar al inquilino',
      detalle: `${cargos.cantPendientes} pendiente${cargos.cantPendientes === 1 ? '' : 's'} de cobro`,
      href: '/pagos',
      cant: cargos.cantPendientes,
      monto: cargos.pendiente,
      icono: Receipt,
      tono: 'amber',
    });
  }

  // 4) Propietarios sin rendir este mes
  const periodo = periodoActual();
  const sinRendir = propietariosMock.filter(
    (p) => !obtenerRendicion(p.id, periodo) && p.totalRecibirMes > 0,
  );
  if (sinRendir.length > 0) {
    items.push({
      id: 'sin-rendir',
      titulo: 'Propietarios por rendir',
      detalle: `${sinRendir.length} ${sinRendir.length === 1 ? 'esperando su transferencia' : 'esperando sus transferencias'}`,
      href: '/propietarios',
      cant: sinRendir.length,
      monto: sinRendir.reduce((s, p) => s + p.totalRecibirMes, 0),
      icono: Wallet,
      tono: 'violeta',
    });
  }

  // 5) Propietarios sin CBU
  const sinCbu = propietariosMock.filter((p) => !p.cbuAlias);
  if (sinCbu.length > 0) {
    items.push({
      id: 'sin-cbu',
      titulo: sinCbu.length === 1 ? 'Propietario sin CBU' : 'Propietarios sin CBU',
      detalle: 'Pediles los datos antes de rendir',
      href: '/propietarios',
      cant: sinCbu.length,
      icono: Banknote,
      tono: 'amber',
    });
  }

  // 6) Contratos vencidos / morosos del mes (KPI directo)
  const vencidos = contratosMock.filter((c) => c.estadoPagoActual === 'VENCIDO');
  if (vencidos.length > 0) {
    const sinGarante = vencidos.filter((c) => {
      const contacto = contactosCobranzaMock.find((x) => x.contratoId === c.id);
      return !contacto?.garante;
    }).length;
    items.push({
      id: 'morosos',
      titulo: vencidos.length === 1 ? 'Inquilino atrasado' : 'Inquilinos atrasados',
      detalle:
        sinGarante > 0
          ? `${vencidos.length} moroso${vencidos.length === 1 ? '' : 's'} · ${sinGarante} sin garante`
          : `${vencidos.length} contrato${vencidos.length === 1 ? '' : 's'} con atraso`,
      href: '/pagos',
      cant: vencidos.length,
      monto: vencidos.reduce((s, c) => s + c.monto, 0),
      icono: AlertTriangle,
      tono: 'rojo',
    });
  }

  // 7) Pagos próximos a vencer (3 días) — informativo, alta prioridad si pasa de 3 propiedades
  const proximos = contratosMock.filter((c) => {
    if (c.estadoPagoActual !== 'PENDIENTE') return false;
    const dias =
      (new Date(c.proximoVencimiento).getTime() - Date.now()) /
      (1000 * 60 * 60 * 24);
    return dias >= 0 && dias <= 3;
  });
  if (proximos.length > 0) {
    items.push({
      id: 'por-vencer',
      titulo: 'Vencimientos esta semana',
      detalle: `${proximos.length} alquiler${proximos.length === 1 ? '' : 'es'} vence${proximos.length === 1 ? '' : 'n'} en 3 días`,
      href: '/pagos',
      cant: proximos.length,
      monto: proximos.reduce((s, c) => s + c.monto, 0),
      icono: CreditCard,
      tono: 'azul',
    });
  }

  // Orden: rojo → amber → violeta → azul → esmeralda
  const ordenTono: Record<Item['tono'], number> = {
    rojo: 0,
    amber: 1,
    violeta: 2,
    azul: 3,
    esmeralda: 4,
  };
  items.sort((a, b) => ordenTono[a.tono] - ordenTono[b.tono]);
  return items;
}
