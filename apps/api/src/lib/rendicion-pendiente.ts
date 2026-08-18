import { prisma } from '../db.js';

/** Un período con alquiler cobrado que todavía no se le rindió al propietario. */
export interface PeriodoSinRendir {
  periodo: string;
  monto: number;
}

/**
 * Alquiler COBRADO de un contrato que todavía NO se le rindió al propietario.
 *
 * POR QUÉ EXISTE: `POST /rendiciones` y `GET /caja/cierre` filtran por
 * `contrato.modoCobranza` **actual**, en CUALQUIER período. Entonces cambiar el modo
 * de cobranza mueve plata vieja de circuito:
 *
 *  - INMOBILIARIA → PROPIETARIO_DIRECTO: lo cobrado y no rendido queda FUERA del
 *    filtro de la rendición ⇒ la inmobiliaria tiene la plata y no hay ningún camino
 *    en el código para rendírsela al dueño.
 *  - PROPIETARIO_DIRECTO → INMOBILIARIA: los pagos que se conciliaron mientras el
 *    inquilino transfería al dueño (validar NO mira el modo) pasan a ser rendibles
 *    ⇒ la inmobiliaria le transfiere al propietario plata que el propietario ya cobró.
 *
 * En los DOS sentidos el dato en riesgo es el mismo: alquiler cobrado y sin rendir.
 * Por eso este helper es el guard de las dos direcciones.
 *
 * La aritmética replica EXACTAMENTE la de `POST /rendiciones` (plata.ts, paso BRUTO):
 * cap del cobrado a `montoTotal` (deja la MORA afuera) y prorrateo por
 * `montoAlquiler / montoTotal` (deja las EXPENSAS afuera, que van al consorcio).
 * Si divergiera, el guard bloquearía por plata que la rendición no rinde —o al revés.
 *
 * Excluye `condonado: true`: una condonación cancela deuda sin ingresar plata, así que
 * no hay nada para rendir (mismo criterio que la rendición y el cierre de caja).
 */
export async function alquilerCobradoSinRendir(
  contratoId: string,
): Promise<{ total: number; periodos: PeriodoSinRendir[] }> {
  const liqs = await prisma.liquidacion.findMany({
    where: { contratoId },
    select: { id: true, periodo: true, montoAlquiler: true, montoTotal: true },
  });
  if (liqs.length === 0) return { total: 0, periodos: [] };
  const ids = liqs.map((l) => l.id);

  const [cobros, rendidos] = await Promise.all([
    prisma.pago.groupBy({
      by: ['liquidacionId'],
      where: { liquidacionId: { in: ids }, estado: 'CONCILIADO', condonado: false },
      _sum: { monto: true },
    }),
    prisma.alquilerRendido.groupBy({
      by: ['liquidacionId'],
      where: { liquidacionId: { in: ids } },
      _sum: { monto: true },
    }),
  ]);
  const cobradoMap = new Map(cobros.map((c) => [c.liquidacionId, Number(c._sum.monto ?? 0)]));
  const rendidoMap = new Map(rendidos.map((r) => [r.liquidacionId, Number(r._sum.monto ?? 0)]));

  const periodos: PeriodoSinRendir[] = [];
  let total = 0;
  for (const l of liqs) {
    const cobrado = cobradoMap.get(l.id) ?? 0;
    if (cobrado <= 0) continue;
    const liqTotal = Number(l.montoTotal);
    const liqAlq = Number(l.montoAlquiler);
    const alquilerCobrado = liqTotal > 0 ? Math.min(cobrado, liqTotal) * (liqAlq / liqTotal) : 0;
    const pendiente = Math.round((alquilerCobrado - (rendidoMap.get(l.id) ?? 0)) * 100) / 100;
    // Tolerancia de 1 centavo: el mismo umbral que usa la rendición para decidir si
    // algo es rendible (`rendible <= 0` ⇒ se saltea). Sin esto, un resto de redondeo
    // del prorrateo bloquearía el cambio de modo para siempre.
    if (pendiente > 0.01) {
      periodos.push({ periodo: l.periodo, monto: pendiente });
      total += pendiente;
    }
  }
  periodos.sort((a, b) => a.periodo.localeCompare(b.periodo));
  return { total: Math.round(total * 100) / 100, periodos };
}
