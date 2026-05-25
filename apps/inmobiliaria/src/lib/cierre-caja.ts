'use client';

/**
 * Cierre diario y mensual de caja — pedido del feedback de pilotos:
 * "necesito ver al final del día cuánto entró, cuánto salí, cuánto
 * me queda en la mano vs lo que ya rendí al dueño".
 *
 * Derivamos los movimientos del día desde:
 *  - liquidaciones PAGADAS con fecha de pago = ese día (ingresos),
 *  - gastos de caja cargados ese día (egresos),
 *  - rendiciones a propietario hechas ese día (egresos),
 *  - acciones de conciliación CONCILIADO del día (info adicional).
 *
 * El "cierre" del día se snapshotea para tener auditoría de lo
 * registrado al momento de imprimir el reporte.
 */

import {
  listarMovimientosCaja,
  type MovimientoCaja,
} from './caja-storage';
import { formatPeriodo } from './format';
import {
  contratosMock,
  generarLiquidaciones,
  propiedadesMock,
  propietariosMock,
} from './mock-data';

const STORAGE_CIERRES_KEY = 'llave-inmo:cierres-caja:v1';
const STORAGE_RENDICIONES_KEY = 'llave-inmo:rendiciones:v1';

interface RendicionStored {
  id: string;
  propietarioId: string;
  periodo: string;
  montoBruto: number;
  montoNeto: number;
  rendidoAt: string;
  metodo: 'TRANSFERENCIA' | 'MERCADOPAGO' | 'EFECTIVO';
  notas?: string | null;
}

function leerRendicionesRaw(): RendicionStored[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_RENDICIONES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Record<string, RendicionStored>;
    return Object.values(parsed);
  } catch {
    return [];
  }
}

export interface CierreSnapshot {
  fecha: string;
  ingresos: number;
  egresos: number;
  balanceDia: number;
  efectivoEnMano: number;
  pendienteRendir: number;
  movimientos: number;
  cerradoAt: string;
  cerradoPor: string;
}

export type MovimientoDia =
  | { tipo: 'INGRESO'; descripcion: string; monto: number; fuente: string }
  | { tipo: 'GASTO'; mov: MovimientoCaja }
  | { tipo: 'RENDICION'; descripcion: string; monto: number; metodo: string };

export interface ResumenDia {
  fecha: string;
  ingresos: number;
  egresos: number;
  balanceDia: number;
  movimientos: MovimientoDia[];
}

function leerCierres(): CierreSnapshot[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_CIERRES_KEY);
    return raw ? (JSON.parse(raw) as CierreSnapshot[]) : [];
  } catch {
    return [];
  }
}

function guardarCierres(lista: CierreSnapshot[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_CIERRES_KEY, JSON.stringify(lista));
  } catch {
    // ignore
  }
}

export function listarCierres(): CierreSnapshot[] {
  return [...leerCierres()].sort((a, b) => b.fecha.localeCompare(a.fecha));
}

function fechaIso(fecha?: string | Date): string {
  const d = fecha ? new Date(fecha) : new Date();
  return d.toISOString().slice(0, 10);
}

/**
 * Calcula los movimientos consolidados del día.
 */
export function calcularResumenDia(fecha?: string): ResumenDia {
  const dia = fechaIso(fecha);

  const gastosDelDia = listarMovimientosCaja().filter(
    (m) => m.fecha === dia && m.tipo === 'GASTO',
  );

  // Ingresos del día = liquidaciones con fechaPago === dia
  type Ingreso = Extract<MovimientoDia, { tipo: 'INGRESO' }>;
  const ingresosLista: Ingreso[] = [];
  for (const c of contratosMock) {
    const liqs = generarLiquidaciones(c.id, c.monto);
    for (const liq of liqs) {
      if (liq.fechaPago && liq.fechaPago.slice(0, 10) === dia) {
        ingresosLista.push({
          tipo: 'INGRESO',
          descripcion: `Cobranza ${c.inquilino} · ${c.direccion}`,
          monto: liq.montoTotal,
          fuente: liq.metodoPago ?? 'Transferencia',
        });
      }
    }
  }

  // Rendiciones del día
  const rendicionesDelDia = leerRendicionesRaw().filter(
    (r) => r.rendidoAt.slice(0, 10) === dia,
  );

  const ingresos = ingresosLista.reduce((acc, i) => acc + i.monto, 0);
  const egresosGastos = gastosDelDia.reduce((acc, g) => acc + g.monto, 0);
  const egresosRendiciones = rendicionesDelDia.reduce(
    (acc, r) => acc + r.montoNeto,
    0,
  );
  const egresos = egresosGastos + egresosRendiciones;

  const movimientos: MovimientoDia[] = [
    ...ingresosLista,
    ...gastosDelDia.map<MovimientoDia>((mov) => ({ tipo: 'GASTO', mov })),
    ...rendicionesDelDia.map<MovimientoDia>((r) => ({
      tipo: 'RENDICION',
      descripcion: `Rendición · ${formatPeriodo(r.periodo)}`,
      monto: r.montoNeto,
      metodo: r.metodo,
    })),
  ].sort((a, b) => montoOrigen(b) - montoOrigen(a));

  return {
    fecha: dia,
    ingresos,
    egresos,
    balanceDia: ingresos - egresos,
    movimientos,
  };
}

function montoOrigen(m: MovimientoDia): number {
  return m.tipo === 'GASTO' ? m.mov.monto : m.monto;
}

/**
 * Estado de caja agregada del mes: cuánto cobró la inmo, cuánto rindió,
 * cuánto le queda "en mano".
 */
export function efectivoEnMano(): {
  enMano: number;
  pendienteRendir: number;
  cobradoMes: number;
  rendidoMes: number;
} {
  const ahora = new Date();
  const mes = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}`;

  let cobradoMes = 0;
  let alquilerCobradoMes = 0;
  for (const c of contratosMock) {
    const liqs = generarLiquidaciones(c.id, c.monto);
    for (const liq of liqs) {
      if (liq.periodo === mes && liq.estado === 'PAGADO') {
        cobradoMes += liq.montoTotal;
        alquilerCobradoMes += liq.montoAlquiler;
      }
    }
  }
  const rendidoMes = leerRendicionesRaw()
    .filter((r) => r.rendidoAt.slice(0, 7) === mes)
    .reduce((acc, r) => acc + r.montoNeto, 0);

  return {
    enMano: Math.max(0, cobradoMes - rendidoMes),
    pendienteRendir: Math.max(0, alquilerCobradoMes - rendidoMes),
    cobradoMes,
    rendidoMes,
  };
}

export function cerrarDia(input: {
  fecha?: string;
  cerradoPor: string;
}): CierreSnapshot {
  const dia = fechaIso(input.fecha);
  const resumen = calcularResumenDia(dia);
  const { enMano, pendienteRendir } = efectivoEnMano();
  const snap: CierreSnapshot = {
    fecha: dia,
    ingresos: resumen.ingresos,
    egresos: resumen.egresos,
    balanceDia: resumen.balanceDia,
    efectivoEnMano: enMano,
    pendienteRendir,
    movimientos: resumen.movimientos.length,
    cerradoAt: new Date().toISOString(),
    cerradoPor: input.cerradoPor,
  };
  const lista = leerCierres().filter((c) => c.fecha !== dia);
  lista.push(snap);
  guardarCierres(lista);
  return snap;
}

export function cierreDelDia(fecha?: string): CierreSnapshot | null {
  const dia = fechaIso(fecha);
  return leerCierres().find((c) => c.fecha === dia) ?? null;
}

/* ============================================================
 * Posición del mes desagregada por propietario.
 *
 * Pedido del feedback: "necesito ver la caja diaria de un propietario
 * específico, no solo la general". Esto cruza propiedades →
 * propietarios → liquidaciones cobradas y devuelve un resumen por
 * propietario con su porción del cobrado, su rendido y su saldo.
 * ============================================================ */

export interface PosicionPropietario {
  propietarioId: string;
  nombre: string;
  cobradoMes: number;
  rendidoMes: number;
  pendiente: number;
  /** Cuánto del cobrado fue en efectivo (los pagos METODO=EFECTIVO). */
  enEfectivoMes: number;
  /** Cuántas liquidaciones pagadas tiene en el mes. */
  liquidacionesMes: number;
}

export function posicionPorPropietario(): PosicionPropietario[] {
  const ahora = new Date();
  const mes = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}`;

  // Map contratoId → propietarioId via propiedad.contratoActualId
  const contratoPropietario = new Map<string, string>();
  for (const prop of propiedadesMock) {
    if (prop.contratoActualId && prop.propietariosIds[0]) {
      contratoPropietario.set(prop.contratoActualId, prop.propietariosIds[0]);
    }
  }

  const acumulador = new Map<string, PosicionPropietario>();
  for (const prop of propietariosMock) {
    acumulador.set(prop.id, {
      propietarioId: prop.id,
      nombre: `${prop.nombre} ${prop.apellido}`,
      cobradoMes: 0,
      rendidoMes: 0,
      pendiente: 0,
      enEfectivoMes: 0,
      liquidacionesMes: 0,
    });
  }

  for (const c of contratosMock) {
    const ownerId = contratoPropietario.get(c.id);
    if (!ownerId) continue;
    const item = acumulador.get(ownerId);
    if (!item) continue;
    const liqs = generarLiquidaciones(c.id, c.monto);
    for (const liq of liqs) {
      if (liq.periodo === mes && liq.estado === 'PAGADO') {
        item.cobradoMes += liq.montoTotal;
        item.liquidacionesMes += 1;
        // Heurística: si el método de pago es efectivo, lo contamos.
        if (
          liq.metodoPago &&
          /efectivo|cash/i.test(liq.metodoPago)
        ) {
          item.enEfectivoMes += liq.montoTotal;
        }
      }
    }
  }

  // Rendiciones del mes
  for (const r of leerRendicionesRaw()) {
    if (r.periodo === mes) {
      const item = acumulador.get(r.propietarioId);
      if (item) item.rendidoMes += r.montoNeto;
    }
  }

  for (const item of acumulador.values()) {
    item.pendiente = Math.max(0, item.cobradoMes - item.rendidoMes);
  }

  return Array.from(acumulador.values())
    .filter((p) => p.cobradoMes > 0 || p.rendidoMes > 0)
    .sort((a, b) => b.cobradoMes - a.cobradoMes);
}
