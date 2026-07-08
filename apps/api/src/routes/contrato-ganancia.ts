import type { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';
import { requireUsuario } from '../auth/guards.js';

const r2c = (n: number) => Math.round(n * 100) / 100;

/**
 * Ganancia de la inmobiliaria POR CONTRATO. Devuelve dos números:
 *
 *  - `ganado`  — comisión REALIZADA/congelada: por cada `AlquilerRendido` del contrato,
 *    `monto × rendicion.comisionPct/100`. Es exacto e histórico: `AlquilerRendido.monto`
 *    es la base bruta de alquiler del dueño (ya capea mora y excluye expensas), y la
 *    rendición congela su `comisionPct`. Atribución lineal: la comisión de una rendición
 *    es `Σ(alquilerRendido.monto) × comisionPct`, así que la parte de este contrato es
 *    `su alquilerRendido.monto × comisionPct`.
 *
 *  - `proyeccion` — comisión PROYECTADA sobre la vida del contrato: `Σ(liquidacion.montoAlquiler)
 *    × tasaComision`, con `tasaComision = Σ(participación/100 × propietario.comisionPct/100)`
 *    de los dueños de la propiedad. Es lo que la inmo ganaría si se cobrara todo el alquiler
 *    devengado del contrato. Solo sobre alquiler (nunca expensas/mora).
 *
 * Regla LOCKED: en `PROPIETARIO_DIRECTO` la inmo no cobra ni comisiona → ambos 0.
 * Todo derivado on-read, sin migración. No toca `plata.ts` (que tiene WIP de otra sesión).
 */
export async function contratoGananciaRoutes(app: FastifyInstance) {
  app.get('/contratos/:id/ganancia', async (request, reply) => {
    const u = await requireUsuario(request, reply);
    if (!u) return;
    const { id } = request.params as { id: string };

    const contrato = await prisma.contrato.findFirst({
      where: { id, inmobiliariaId: u.inmobiliariaId },
      select: { id: true, modoCobranza: true, propiedadId: true, moneda: true },
    });
    if (!contrato) return reply.code(404).send({ message: 'Contrato inexistente' });

    // En cobranza directa del propietario la inmobiliaria no cobra ni comisiona.
    if (contrato.modoCobranza !== 'INMOBILIARIA') {
      return { modoCobranza: contrato.modoCobranza, tasaComision: 0, ganado: 0, proyeccion: 0, faltaGanar: 0, moneda: contrato.moneda };
    }

    // Liquidaciones del contrato: total de alquiler devengado (para la proyección) + ids.
    const liquidaciones = await prisma.liquidacion.findMany({
      where: { contratoId: id, inmobiliariaId: u.inmobiliariaId },
      select: { id: true, montoAlquiler: true },
    });
    const liqIds = liquidaciones.map((l) => l.id);
    const totalAlquiler = liquidaciones.reduce((acc, l) => acc + Number(l.montoAlquiler), 0);

    // Tasa de comisión ponderada por los dueños de la propiedad (participación × su comisionPct).
    const participaciones = await prisma.participacionPropietario.findMany({
      where: { propiedadId: contrato.propiedadId },
      select: { porcentaje: true, propietario: { select: { comisionPct: true } } },
    });
    const tasaComision = participaciones.reduce(
      (acc, p) => acc + (p.porcentaje / 100) * ((p.propietario?.comisionPct ?? 0) / 100),
      0,
    );

    // Ganancia REALIZADA: por cada AlquilerRendido del contrato, monto × comisionPct congelada.
    const rendidos = liqIds.length
      ? await prisma.alquilerRendido.findMany({
          where: { liquidacionId: { in: liqIds }, inmobiliariaId: u.inmobiliariaId },
          select: { monto: true, rendicion: { select: { comisionPct: true } } },
        })
      : [];
    const ganado = rendidos.reduce(
      (acc, ar) => acc + Number(ar.monto) * ((ar.rendicion?.comisionPct ?? 0) / 100),
      0,
    );

    const proyeccion = totalAlquiler * tasaComision;

    return {
      modoCobranza: contrato.modoCobranza,
      moneda: contrato.moneda,
      // tasa como %: p.ej. 0.08 → 8
      tasaComision: r2c(tasaComision * 100),
      ganado: r2c(ganado),
      proyeccion: r2c(proyeccion),
      faltaGanar: r2c(Math.max(proyeccion - ganado, 0)),
    };
  });
}
