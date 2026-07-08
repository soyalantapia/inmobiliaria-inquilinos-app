import type { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';
import { requireUsuario } from '../auth/guards.js';
import { armarGanancia, r2c, tasaComisionDeParticipaciones } from '../lib/ganancia-contrato.js';

/**
 * Ganancia de la inmobiliaria en TODOS los contratos de una propiedad (actual + históricos)
 * + el total de la propiedad. Misma fórmula que GET /contratos/:id/ganancia
 * (`lib/ganancia-contrato.ts`), pero batcheada en pocas queries. La tasa de comisión es la
 * misma para todos los contratos de la propiedad (sale de los dueños de la propiedad).
 * Derivado on-read, sin migración; archivo aparte (no toca `core.ts`/`plata.ts`).
 */
export async function propiedadGananciasRoutes(app: FastifyInstance) {
  app.get('/propiedades/:id/ganancias', async (request, reply) => {
    const u = await requireUsuario(request, reply);
    if (!u) return;
    const { id } = request.params as { id: string };

    const propiedad = await prisma.propiedad.findFirst({
      where: { id, inmobiliariaId: u.inmobiliariaId },
      select: { id: true },
    });
    if (!propiedad) return reply.code(404).send({ message: 'Propiedad inexistente' });

    const participaciones = await prisma.participacionPropietario.findMany({
      where: { propiedadId: id },
      select: { porcentaje: true, propietario: { select: { comisionPct: true } } },
    });
    const tasa = tasaComisionDeParticipaciones(participaciones);

    const contratos = await prisma.contrato.findMany({
      where: { propiedadId: id, inmobiliariaId: u.inmobiliariaId },
      select: {
        id: true,
        modoCobranza: true,
        moneda: true,
        estado: true,
        fechaInicio: true,
        fechaFin: true,
        inquilinoTitular: { select: { nombre: true, apellido: true } },
      },
      orderBy: { fechaInicio: 'desc' },
    });
    const contratoIds = contratos.map((c) => c.id);

    // Liquidaciones de todos los contratos → Σ alquiler por contrato + mapa liq→contrato.
    const liqs = contratoIds.length
      ? await prisma.liquidacion.findMany({
          where: { contratoId: { in: contratoIds }, inmobiliariaId: u.inmobiliariaId },
          select: { id: true, contratoId: true, montoAlquiler: true },
        })
      : [];
    const totalAlqPorContrato = new Map<string, number>();
    const contratoPorLiq = new Map<string, string>();
    for (const l of liqs) {
      totalAlqPorContrato.set(l.contratoId, (totalAlqPorContrato.get(l.contratoId) ?? 0) + Number(l.montoAlquiler));
      contratoPorLiq.set(l.id, l.contratoId);
    }

    // AlquilerRendido de todas esas liquidaciones → comisión rendida por contrato.
    const liqIds = liqs.map((l) => l.id);
    const rendidos = liqIds.length
      ? await prisma.alquilerRendido.findMany({
          where: { liquidacionId: { in: liqIds }, inmobiliariaId: u.inmobiliariaId },
          select: { liquidacionId: true, monto: true, rendicion: { select: { comisionPct: true } } },
        })
      : [];
    const rendidoPorContrato = new Map<string, number>();
    for (const ar of rendidos) {
      const cid = contratoPorLiq.get(ar.liquidacionId);
      if (!cid) continue;
      const aporte = Number(ar.monto) * ((ar.rendicion?.comisionPct ?? 0) / 100);
      rendidoPorContrato.set(cid, (rendidoPorContrato.get(cid) ?? 0) + aporte);
    }

    let totalGanado = 0;
    let totalProyeccion = 0;
    const salida = contratos.map((c) => {
      const g = armarGanancia(
        c.modoCobranza,
        totalAlqPorContrato.get(c.id) ?? 0,
        tasa,
        rendidoPorContrato.get(c.id) ?? 0,
      );
      totalGanado += g.ganado;
      totalProyeccion += g.proyeccion;
      return {
        contratoId: c.id,
        inquilino: c.inquilinoTitular
          ? `${c.inquilinoTitular.nombre ?? ''} ${c.inquilinoTitular.apellido ?? ''}`.trim()
          : '',
        estado: c.estado,
        fechaInicio: c.fechaInicio,
        fechaFin: c.fechaFin,
        moneda: c.moneda,
        ...g,
      };
    });

    return {
      moneda: contratos[0]?.moneda ?? 'ARS',
      tasaComision: r2c(tasa * 100),
      total: {
        ganado: r2c(totalGanado),
        proyeccion: r2c(totalProyeccion),
        faltaGanar: r2c(Math.max(totalProyeccion - totalGanado, 0)),
      },
      contratos: salida,
    };
  });
}
