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
    const u = await requireUsuario(request, reply, 'pagos.ver');
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

    // Totales POR MONEDA. Antes eran dos escalares planos que sumaban todos los contratos
    // de la propiedad y el response se etiquetaba con `contratos[0].moneda`: una propiedad
    // con un contrato en USD y otro en ARS devolvía la SUMA de los dos rotulada con una
    // sola moneda — un número que no existe. La comisión sale de ahí, así que el error se
    // lee como plata ganada.
    const porMoneda = new Map<string, { ganado: number; proyeccion: number }>();
    const salida = contratos.map((c) => {
      const g = armarGanancia(
        c.modoCobranza,
        totalAlqPorContrato.get(c.id) ?? 0,
        tasa,
        rendidoPorContrato.get(c.id) ?? 0,
      );
      const acum = porMoneda.get(c.moneda) ?? { ganado: 0, proyeccion: 0 };
      acum.ganado += g.ganado;
      acum.proyeccion += g.proyeccion;
      porMoneda.set(c.moneda, acum);
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

    const totales = [...porMoneda.entries()]
      .map(([moneda, t]) => ({
        moneda,
        ganado: r2c(t.ganado),
        proyeccion: r2c(t.proyeccion),
        faltaGanar: r2c(Math.max(t.proyeccion - t.ganado, 0)),
      }))
      .sort((a, b) => b.proyeccion - a.proyeccion);
    // `moneda` + `total` se conservan para no romper el panel, pero YA NO son una mezcla:
    // son los de la moneda principal. `totalesPorMoneda` trae el desglose completo para
    // que el front pueda mostrar las dos sin inventar una conversión (no hay cotización
    // en el sistema y el modelo de plata está congelado).
    const principal = totales[0] ?? { moneda: 'ARS', ganado: 0, proyeccion: 0, faltaGanar: 0 };
    return {
      moneda: principal.moneda,
      tasaComision: r2c(tasa * 100),
      total: { ganado: principal.ganado, proyeccion: principal.proyeccion, faltaGanar: principal.faltaGanar },
      totalesPorMoneda: totales,
      contratos: salida,
    };
  });
}
