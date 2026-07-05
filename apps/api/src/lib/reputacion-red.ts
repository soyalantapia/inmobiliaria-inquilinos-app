import type { PrismaClient } from '@prisma/client';
import { prisma as prismaDefault } from '../db.js';

/**
 * Reputación CROSS-TENANT de un profesional de la red (ProfesionalRed).
 *
 * Regla de oro de privacidad: la ficha pública mezcla trabajos de varias
 * inmobiliarias, así que SOLO expone agregados + trabajos anonimizados. Nunca
 * dirección exacta, inquilino, identidad de la inmobiliaria, comentarios de
 * rating (texto libre = PII) ni fotos. Los SELECT de este archivo están acotados
 * a propósito a esos campos seguros: si alguien agrega `direccion`/`comentario`/
 * `inquilino` acá, es una fuga cross-tenant.
 */

const TERMINALES_RESUELTO = ['RESUELTO', 'CERRADO'] as const;

export function normalizarTelefono(tel: string): string {
  return (tel ?? '').replace(/\D/g, '');
}

type FichaRed = {
  trabajos: number; // visitas completadas (LISTO)
  asignados: number; // reclamos en los que se lo asignó
  resueltos: number;
  tasaResolucion: number; // 0..1 sobre asignados
  ratingPromedio: number; // 0..5
  reseñas: number;
  tiempoPromedioHoras: number | null; // confirmada → listo
  categorias: string[];
  zonas: string[]; // ciudades (nunca dirección)
  preciosPorCategoria: { categoria: string; min: number; max: number; promedio: number; n: number }[];
  trabajosRecientes: { categoria: string; ciudad: string | null; estrellas: number | null; fecha: string }[];
};

// SELECT sanitizado compartido: SOLO campos que pueden salir a la red.
const reclamoSelectSeguro = {
  id: true,
  estado: true,
  categoria: true,
  createdAt: true,
  resueltoAt: true,
  propiedad: { select: { ciudad: true } }, // ciudad SÍ, direccion NUNCA
  visita: {
    select: { estado: true, confirmadaAt: true, listoAt: true, montoCobrado: true },
  },
  rating: { select: { estrellas: true, enviadoAt: true } }, // estrellas SÍ, comentario NUNCA
} as const;

async function profesionalIdsDeRed(prisma: PrismaClient, profesionalRedId: string): Promise<string[]> {
  const profs = await prisma.profesional.findMany({
    where: { profesionalRedId },
    select: { id: true },
  });
  return profs.map((p) => p.id);
}

/** Ficha reputacional completa de UN profesional de la red (para el detalle). */
export async function fichaReputacion(
  profesionalRedId: string,
  prisma: PrismaClient = prismaDefault,
): Promise<FichaRed> {
  const vacia: FichaRed = {
    trabajos: 0, asignados: 0, resueltos: 0, tasaResolucion: 0, ratingPromedio: 0, reseñas: 0,
    tiempoPromedioHoras: null, categorias: [], zonas: [], preciosPorCategoria: [], trabajosRecientes: [],
  };
  const ids = await profesionalIdsDeRed(prisma, profesionalRedId);
  if (ids.length === 0) return vacia;

  const reclamos = await prisma.reclamo.findMany({
    where: { profesionalId: { in: ids } },
    select: reclamoSelectSeguro,
    orderBy: { createdAt: 'desc' },
  });
  if (reclamos.length === 0) return vacia;

  const asignados = reclamos.length;
  const trabajos = reclamos.filter((r) => r.visita?.estado === 'LISTO').length;
  const resueltos = reclamos.filter((r) => (TERMINALES_RESUELTO as readonly string[]).includes(r.estado)).length;

  const estrellas = reclamos.map((r) => r.rating?.estrellas).filter((e): e is number => e != null);
  const ratingPromedio = estrellas.length ? estrellas.reduce((a, b) => a + b, 0) / estrellas.length : 0;

  // Tiempo confirmada → listo (horas) sobre las visitas completadas con ambos timestamps.
  const duraciones = reclamos
    .map((r) => r.visita)
    .filter((v) => v?.confirmadaAt && v?.listoAt)
    .map((v) => (new Date(v!.listoAt!).getTime() - new Date(v!.confirmadaAt!).getTime()) / 3_600_000)
    .filter((h) => h >= 0);
  const tiempoPromedioHoras = duraciones.length
    ? Math.round((duraciones.reduce((a, b) => a + b, 0) / duraciones.length) * 10) / 10
    : null;

  // Precios por categoría (del monto cobrado en la visita).
  const porCat = new Map<string, number[]>();
  for (const r of reclamos) {
    const monto = r.visita?.montoCobrado != null ? Number(r.visita.montoCobrado) : null;
    if (monto != null && monto > 0) {
      const arr = porCat.get(r.categoria) ?? [];
      arr.push(monto);
      porCat.set(r.categoria, arr);
    }
  }
  const preciosPorCategoria = [...porCat.entries()].map(([categoria, ms]) => ({
    categoria,
    min: Math.min(...ms),
    max: Math.max(...ms),
    promedio: Math.round(ms.reduce((a, b) => a + b, 0) / ms.length),
    n: ms.length,
  }));

  const categorias = [...new Set(reclamos.map((r) => r.categoria))];
  const zonas = [...new Set(reclamos.map((r) => r.propiedad?.ciudad).filter((c): c is string => !!c))];

  // Trabajos recientes ANONIMIZADOS: categoría + ciudad + estrellas + fecha. Nada más.
  const trabajosRecientes = reclamos.slice(0, 8).map((r) => ({
    categoria: r.categoria,
    ciudad: r.propiedad?.ciudad ?? null,
    estrellas: r.rating?.estrellas ?? null,
    fecha: (r.resueltoAt ?? r.createdAt).toISOString(),
  }));

  return {
    trabajos,
    asignados,
    resueltos,
    tasaResolucion: asignados ? Math.round((resueltos / asignados) * 100) / 100 : 0,
    ratingPromedio: Math.round(ratingPromedio * 10) / 10,
    reseñas: estrellas.length,
    tiempoPromedioHoras,
    categorias,
    zonas,
    preciosPorCategoria,
    trabajosRecientes,
  };
}

/** Resumen liviano para el DIRECTORIO: rating + trabajos por red, en pocas queries. */
export async function resumenReputacionMasivo(
  profesionalRedIds: string[],
  prisma: PrismaClient = prismaDefault,
): Promise<Map<string, { trabajos: number; resueltos: number; ratingPromedio: number; reseñas: number }>> {
  const out = new Map<string, { trabajos: number; resueltos: number; ratingPromedio: number; reseñas: number }>();
  if (profesionalRedIds.length === 0) return out;

  // profesionalId → profesionalRedId (todas las inmos)
  const profs = await prisma.profesional.findMany({
    where: { profesionalRedId: { in: profesionalRedIds } },
    select: { id: true, profesionalRedId: true },
  });
  const profToRed = new Map(profs.map((p) => [p.id, p.profesionalRedId!]));
  const ids = profs.map((p) => p.id);
  for (const rid of profesionalRedIds) out.set(rid, { trabajos: 0, resueltos: 0, ratingPromedio: 0, reseñas: 0 });
  if (ids.length === 0) return out;

  const reclamos = await prisma.reclamo.findMany({
    where: { profesionalId: { in: ids } },
    select: { profesionalId: true, estado: true, visita: { select: { estado: true } }, rating: { select: { estrellas: true } } },
  });

  const acc = new Map<string, { trabajos: number; resueltos: number; suma: number; n: number }>();
  for (const r of reclamos) {
    const rid = profToRed.get(r.profesionalId!);
    if (!rid) continue;
    const a = acc.get(rid) ?? { trabajos: 0, resueltos: 0, suma: 0, n: 0 };
    if (r.visita?.estado === 'LISTO') a.trabajos++;
    if ((TERMINALES_RESUELTO as readonly string[]).includes(r.estado)) a.resueltos++;
    if (r.rating?.estrellas != null) { a.suma += r.rating.estrellas; a.n++; }
    acc.set(rid, a);
  }
  for (const [rid, a] of acc) {
    out.set(rid, {
      trabajos: a.trabajos,
      resueltos: a.resueltos,
      ratingPromedio: a.n ? Math.round((a.suma / a.n) * 10) / 10 : 0,
      reseñas: a.n,
    });
  }
  return out;
}
