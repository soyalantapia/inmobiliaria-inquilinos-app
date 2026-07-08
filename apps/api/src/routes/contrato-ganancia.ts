import type { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';
import { requireUsuario } from '../auth/guards.js';
import { armarGanancia, tasaComisionDeParticipaciones } from '../lib/ganancia-contrato.js';

/**
 * Ganancia de la inmobiliaria POR CONTRATO: comisión ya rendida (congelada) + proyección
 * sobre la vida del contrato. Ver `lib/ganancia-contrato.ts` para la fórmula. Derivado
 * on-read, sin migración; archivo aparte (no toca `plata.ts`/`core.ts`).
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

    const liquidaciones = await prisma.liquidacion.findMany({
      where: { contratoId: id, inmobiliariaId: u.inmobiliariaId },
      select: { id: true, montoAlquiler: true },
    });
    const liqIds = liquidaciones.map((l) => l.id);
    const totalAlquiler = liquidaciones.reduce((acc, l) => acc + Number(l.montoAlquiler), 0);

    const participaciones = await prisma.participacionPropietario.findMany({
      where: { propiedadId: contrato.propiedadId },
      select: { porcentaje: true, propietario: { select: { comisionPct: true } } },
    });
    const tasa = tasaComisionDeParticipaciones(participaciones);

    const rendidos = liqIds.length
      ? await prisma.alquilerRendido.findMany({
          where: { liquidacionId: { in: liqIds }, inmobiliariaId: u.inmobiliariaId },
          select: { monto: true, rendicion: { select: { comisionPct: true } } },
        })
      : [];
    const rendido = rendidos.reduce(
      (acc, ar) => acc + Number(ar.monto) * ((ar.rendicion?.comisionPct ?? 0) / 100),
      0,
    );

    return { ...armarGanancia(contrato.modoCobranza, totalAlquiler, tasa, rendido), moneda: contrato.moneda };
  });
}
