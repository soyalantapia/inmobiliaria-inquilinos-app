'use client';

/**
 * Cálculo de gastos atribuidos a un propietario en un período.
 *
 * Cruza dos fuentes:
 *  1. `caja`: gastos de bolsillo de la inmobiliaria asociados a una
 *     propiedad (plomería, expensas, materiales, etc.).
 *  2. `reclamos`: reclamos resueltos en el período con costoTrabajo cargado
 *     cuya clasificación es DESPERFECTO (lo paga el propietario). Los
 *     USO_Y_GOCE se descuentan del inquilino, no del propietario, así que
 *     acá no aparecen.
 *
 * Una propiedad puede tener varios propietarios (cotitularidad). En esa
 * variante el monto se reparte por la participación si está definida; si
 * no, se reparte en partes iguales.
 *
 * Solo se cuentan los gastos del PERÍODO actual (mes en curso) y los que
 * todavía no fueron descontados en una rendición anterior.
 */

import { propiedadesMock } from './mock-data';
import { listarMovimientosCaja, type MovimientoCaja } from './caja-storage';
import { listarReclamos } from './reclamos-store';
import { obtenerRendicion } from './rendiciones-storage';
import type { Reclamo } from './types';

export interface GastoAtribuido {
  /** Identificador del origen: 'caja:<movId>' o 'reclamo:<recId>'. */
  refId: string;
  tipo: 'CAJA' | 'TRABAJO';
  fecha: string;
  descripcion: string;
  proveedor: string | null;
  /** Monto que le toca a ESTE propietario (después de repartir por participación). */
  monto: number;
  /** Monto total del gasto (antes de repartir). */
  montoTotal: number;
  /** Cuota del propietario sobre el total (1 = se lleva todo, 0.5 = 50%, etc.). */
  participacion: number;
  /** ID de la propiedad asociada — link para que el usuario navegue al detalle. */
  propiedadId: string;
  direccion: string;
}

function participacionDe(
  propietarioId: string,
  propiedadId: string,
): number {
  const prop = propiedadesMock.find((p) => p.id === propiedadId);
  if (!prop) return 0;
  if (!prop.propietariosIds.includes(propietarioId)) return 0;
  // Si hay participaciones explícitas, usar esas.
  if (prop.participaciones && prop.participaciones.length > 0) {
    const mia = prop.participaciones.find((x) => x.propietarioId === propietarioId);
    return mia ? mia.porcentaje / 100 : 0;
  }
  // Si no, partes iguales.
  return 1 / prop.propietariosIds.length;
}

/** True si `fecha` está dentro del período YYYY-MM. */
function enPeriodo(fechaISO: string, periodo: string): boolean {
  return fechaISO.startsWith(periodo);
}

function gastoDesdeCaja(
  mov: MovimientoCaja,
  propietarioId: string,
): GastoAtribuido | null {
  if (mov.tipo !== 'GASTO') return null;
  const part = participacionDe(propietarioId, mov.propiedadId);
  if (part === 0) return null;
  const prop = propiedadesMock.find((p) => p.id === mov.propiedadId);
  return {
    refId: `caja:${mov.id}`,
    tipo: 'CAJA',
    fecha: mov.fecha,
    descripcion: mov.descripcion,
    proveedor: mov.proveedor,
    monto: Math.round(mov.monto * part),
    montoTotal: mov.monto,
    participacion: part,
    propiedadId: mov.propiedadId,
    direccion: prop?.direccion ?? '—',
  };
}

function gastoDesdeReclamo(
  r: Reclamo,
  propietarioId: string,
): GastoAtribuido | null {
  if (!r.costoTrabajo || r.costoTrabajo <= 0) return null;
  // Solo DESPERFECTO se descuenta al propietario.
  if (r.clasificacion !== 'DESPERFECTO') return null;
  // Resolver la propiedad: si el reclamo tiene propiedadId la usamos, sino
  // matcheamos por contratoId contra propiedadesMock.
  const prop =
    propiedadesMock.find((p) => p.id === r.propiedadId) ??
    propiedadesMock.find((p) => p.contratoActualId === r.contratoId);
  if (!prop) return null;
  const part = participacionDe(propietarioId, prop.id);
  if (part === 0) return null;
  const fecha = r.resueltoAt ?? r.createdAt;
  return {
    refId: `reclamo:${r.id}`,
    tipo: 'TRABAJO',
    fecha: fecha.slice(0, 10),
    descripcion:
      r.costoTrabajoNotas || `${r.categoria.toLowerCase()} · ${r.descripcion.slice(0, 60)}`,
    proveedor: r.profesionalAsignadoNombre ?? null,
    monto: Math.round(r.costoTrabajo * part),
    montoTotal: r.costoTrabajo,
    participacion: part,
    propiedadId: prop.id,
    direccion: prop.direccion,
  };
}

/**
 * Lista de gastos atribuidos al propietario en el período (YYYY-MM).
 * Filtra los que ya fueron descontados en una rendición previa, salvo que
 * `incluirYaRendidos` sea true (útil para visualizar el histórico).
 */
export function gastosAtribuidos(
  propietarioId: string,
  periodo: string,
  opts: { incluirYaRendidos?: boolean } = {},
): GastoAtribuido[] {
  const yaRendido = obtenerRendicion(propietarioId, periodo);
  // Si ya rendimos y NO queremos los descontados, retornamos los que
  // guardamos en la rendición (para mostrar el detalle congelado).
  if (yaRendido && !opts.incluirYaRendidos && yaRendido.gastos) {
    return yaRendido.gastos.map((g) => ({
      refId: g.refId,
      tipo: g.tipo,
      fecha: g.fecha,
      descripcion: g.descripcion,
      proveedor: g.proveedor ?? null,
      monto: g.monto,
      montoTotal: g.montoTotal,
      participacion: g.participacion,
      propiedadId: g.propiedadId,
      direccion: g.direccion,
    }));
  }

  const result: GastoAtribuido[] = [];

  // 1. Caja del período
  for (const mov of listarMovimientosCaja()) {
    if (!enPeriodo(mov.fecha, periodo)) continue;
    if (mov.descontadoEnRendicion && !opts.incluirYaRendidos) continue;
    const g = gastoDesdeCaja(mov, propietarioId);
    if (g) result.push(g);
  }

  // 2. Reclamos resueltos en el período con costoTrabajo
  for (const r of listarReclamos()) {
    if (r.estado !== 'RESUELTO' && r.estado !== 'CERRADO') continue;
    const fechaRef = r.resueltoAt ?? r.createdAt;
    if (!enPeriodo(fechaRef, periodo)) continue;
    const g = gastoDesdeReclamo(r, propietarioId);
    if (g) result.push(g);
  }

  result.sort((a, b) => b.fecha.localeCompare(a.fecha));
  return result;
}

/** Suma de los montos del propietario. */
export function totalGastosAtribuidos(
  propietarioId: string,
  periodo: string,
): number {
  return gastosAtribuidos(propietarioId, periodo).reduce((s, g) => s + g.monto, 0);
}
