// Genera eventos unificados para el calendario del inquilino, derivando del
// contrato + liquidaciones + reclamos abiertos. En backend real esto sería
// un endpoint que joinea las tablas y devuelve los próximos N eventos.

import {
  comprobantesMock,
  contratoMock,
  hitosContratoMock,
  liquidacionesMock,
} from './mock-data';
import { listarReclamos } from './reclamos-storage';

export type TipoEvento =
  | 'PAGO_MENSUAL'
  | 'AJUSTE'
  | 'FIN_CONTRATO'
  | 'RECLAMO_ABIERTO'
  | 'PAGO_VENCIDO'
  | 'PAGO_REALIZADO';

export interface EventoCalendario {
  id: string;
  fecha: string; // ISO date
  tipo: TipoEvento;
  titulo: string;
  detalle: string;
  monto?: number;
  href?: string;
}

const MS_DIA = 24 * 60 * 60 * 1000;

// Construye los próximos 6 meses de eventos.
export function generarEventos(mesesAdelante = 6): EventoCalendario[] {
  const eventos: EventoCalendario[] = [];
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  // Pagos mensuales futuros (día c.diaPago del mes)
  for (let m = 0; m <= mesesAdelante; m++) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() + m, contratoMock.diaPago);
    if (d < hoy) continue;
    const finContrato = new Date(contratoMock.fechaFin);
    if (d > finContrato) continue;
    eventos.push({
      id: `pago-${d.toISOString().slice(0, 7)}`,
      fecha: d.toISOString(),
      tipo: 'PAGO_MENSUAL',
      titulo: 'Vencimiento del alquiler',
      detalle: 'Pago mensual + expensas',
      monto: contratoMock.montoActual,
      href: '/',
    });
  }

  // Liquidaciones vencidas que aún no pagaste
  for (const liq of liquidacionesMock) {
    if (liq.estado === 'VENCIDO') {
      eventos.push({
        id: `venc-${liq.id}`,
        fecha: liq.fechaVencimiento,
        tipo: 'PAGO_VENCIDO',
        titulo: 'Pago vencido',
        detalle: `Período ${liq.periodo} sin pagar`,
        monto: liq.montoTotal,
        href: '/',
      });
    }
  }

  // Comprobantes pagados recientes (últimos 90 días)
  const hace90 = new Date(hoy.getTime() - 90 * MS_DIA);
  for (const c of comprobantesMock) {
    const fp = new Date(c.fechaPago);
    if (fp >= hace90 && fp <= hoy) {
      eventos.push({
        id: `cmp-${c.id}`,
        fecha: c.fechaPago,
        tipo: 'PAGO_REALIZADO',
        titulo: 'Pago realizado',
        detalle: `Período ${c.periodo}`,
        monto: c.monto,
        href: '/comprobantes',
      });
    }
  }

  // Hitos del contrato (ajustes + fin)
  for (const h of hitosContratoMock) {
    const fh = new Date(h.fecha);
    const limite = new Date(hoy.getTime() + (mesesAdelante + 1) * 30 * MS_DIA);
    if (fh < hace90 || fh > limite) continue;
    if (h.tipo === 'AJUSTE_FUTURO' || h.tipo === 'AJUSTE_APLICADO') {
      eventos.push({
        id: `ajuste-${h.fecha}`,
        fecha: h.fecha,
        tipo: 'AJUSTE',
        titulo: h.titulo,
        detalle: h.detalle ?? 'Ajuste programado',
        href: '/contrato',
      });
    } else if (h.tipo === 'FIN_CONTRATO') {
      eventos.push({
        id: `fin-${h.fecha}`,
        fecha: h.fecha,
        tipo: 'FIN_CONTRATO',
        titulo: h.titulo,
        detalle: h.detalle ?? 'Fin del contrato',
        href: '/contrato/renovacion',
      });
    }
  }

  // Reclamos abiertos: aparecen con la fecha de creación
  if (typeof window !== 'undefined') {
    const reclamos = listarReclamos();
    for (const r of reclamos) {
      if (r.estado === 'ABIERTO' || r.estado === 'EN_CURSO') {
        eventos.push({
          id: `rec-${r.id}`,
          fecha: r.createdAt,
          tipo: 'RECLAMO_ABIERTO',
          titulo: r.descripcion,
          detalle: `Reclamo ${r.estado.toLowerCase()}`,
          href: `/reclamos/${r.id}`,
        });
      }
    }
  }

  return eventos.sort((a, b) => a.fecha.localeCompare(b.fecha));
}

// Agrupa por mes para renderizado
export function agruparPorMes(eventos: EventoCalendario[]): {
  mes: string;
  label: string;
  items: EventoCalendario[];
}[] {
  const grupos: Record<string, EventoCalendario[]> = {};
  for (const e of eventos) {
    const key = e.fecha.slice(0, 7); // YYYY-MM
    if (!grupos[key]) grupos[key] = [];
    grupos[key]!.push(e);
  }
  return Object.entries(grupos)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, items]) => {
      // `new Date("2026-03-01")` parsea como UTC midnight, que en ARG (UTC-3)
      // queda el 28 de febrero. Construimos la fecha con year/monthIndex/day
      // en hora local para evitar el corrimiento.
      const [yearStr, monthStr] = mes.split('-');
      const d = new Date(Number(yearStr), Number(monthStr) - 1, 1);
      const label = d.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
      return { mes, label, items };
    });
}
