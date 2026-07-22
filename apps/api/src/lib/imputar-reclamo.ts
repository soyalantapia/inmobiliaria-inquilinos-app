import type { Prisma, Moneda, PagadorReclamo } from '@prisma/client';

/**
 * Imputa el costo de un reclamo resuelto a quien corresponda.
 *
 * ÚNICO lugar donde se decide a dónde va esa plata. Lo llaman los DOS caminos que cierran
 * un reclamo: el panel (`POST /reclamos/:id/resolver`) y el profesional por link mágico
 * (`POST /visitas-publicas/listo`).
 *
 * POR QUÉ EXISTE: antes esta lógica vivía inline sólo en el resolver del panel. Cuando el
 * reclamo lo cerraba el profesional, el costo quedaba escrito en `costoTrabajo` pero NO se
 * le cobraba a nadie si el pagador era INQUILINO o DEPOSITO — no aparecía en `/mis-cargos`,
 * no deducía el depósito, y la rendición lo ignoraba porque no era PROPIETARIO. La plata se
 * evaporaba, y encima quedaba irrecuperable (el reclamo ya RESUELTO hace que `/resolver`
 * responda 409). Tener un solo helper es lo que impide que los dos caminos vuelvan a diverger.
 *
 *   PROPIETARIO → sin cargo: lo toma la rendición del dueño (GastoRendido tipo TRABAJO).
 *   INQUILINO   → CargoContrato (deuda visible en /mis-cargos).
 *   DEPOSITO    → CargoContrato contraDeposito (descuenta del depósito retenido).
 *
 * IDEMPOTENTE por `reclamoId` (@unique): reejecutarlo no duplica el cargo.
 *
 * ⚠️ NO borra cargos ya saldados: si el cargo se cobró (`saldadoAt`), reclasificar a
 * PROPIETARIO lo dejaba sin registro de esa plata. Ahora se conserva.
 */
export async function imputarCostoReclamo(
  tx: Prisma.TransactionClient,
  args: {
    inmobiliariaId: string;
    reclamoId: string;
    contratoId: string;
    pagador: PagadorReclamo | null;
    costo: number;
    moneda: Moneda;
    /** Texto del cargo que ve el inquilino. */
    concepto: string;
    creadoPorId?: string | null;
  },
): Promise<void> {
  const { inmobiliariaId, reclamoId, contratoId, pagador, costo, moneda, concepto, creadoPorId } = args;

  // Sin pagador o sin costo no hay nada que imputar. Limpiamos un cargo previo SOLO si
  // todavía no se cobró: borrar uno saldado destruiría la única evidencia del cobro.
  if (pagador === 'PROPIETARIO' || !pagador || costo <= 0) {
    await tx.cargoContrato.deleteMany({ where: { reclamoId, saldadoAt: null } });
    return;
  }

  await tx.cargoContrato.upsert({
    where: { reclamoId },
    create: {
      inmobiliariaId,
      contratoId,
      reclamoId,
      tipo: 'REPARACION',
      concepto,
      monto: costo,
      moneda,
      contraDeposito: pagador === 'DEPOSITO',
      creadoPorId: creadoPorId ?? null,
    },
    update: { monto: costo, moneda, concepto, contraDeposito: pagador === 'DEPOSITO', tipo: 'REPARACION' },
  });
}

/** Texto por defecto del cargo cuando el operador no escribió notas del costo. */
export function conceptoReclamo(categoria: string, descripcion: string): string {
  return `Reparación (${categoria.toLowerCase()}): ${descripcion.slice(0, 60)}`;
}
