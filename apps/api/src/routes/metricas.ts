import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireUsuario } from '../auth/guards.js';
import { montoPagadoPorLiquidacion, conSaldo } from '../lib/saldos.js';
import { resolverEsquemaMora, calcularMora } from '../lib/punitorios.js';

/**
 * MÉTRICAS de la inmobiliaria — la capa analítica que no existía (todos los agregados
 * eran o diarios /caja/cierre o por-propiedad /propiedades/:id/ganancias, y el dashboard
 * bajaba las colecciones enteras y sumaba en el browser). Acá el cálculo vive en el
 * server y contesta por CUALQUIER mes, incluido uno pasado.
 *
 * Reusa la MISMA fuente de verdad que el resto del sistema (montoPagadoPorLiquidacion +
 * resolverEsquemaMora + calcularMora + conSaldo) para no inventar otra verdad: un número
 * que le miente al dueño es peor que no tenerlo.
 *
 * Eje temporal: todo lo financiero va por `liquidacion.periodo` (el mes del alquiler),
 * así devengado / cobrado / por cobrar / en mora son del MISMO mes y cuadran entre sí.
 * Candados de "cobrado": CONCILIADO + condonado:false + modoCobranza:'INMOBILIARIA'
 * (los tres que evitan inflar la plata con condonaciones o con cobros directos al dueño).
 * Moneda: se calcula sobre ARS (la default); si hay contratos en otra moneda se avisa con
 * `hayOtrasMonedas` en vez de sumar peras con manzanas.
 */

// 'YYYY-MM' → rango [desde, hasta) en hora Argentina (UTC-3, corte T03:00Z), igual que
// el cierre de caja. Sirve para filtrar createdAt/resueltoAt/fecha/fechaInicio por mes.
function rangoMesAR(mes: string): { desde: Date; hasta: Date } {
  const [y, m] = mes.split('-').map(Number) as [number, number];
  const sig = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
  return {
    desde: new Date(`${mes}-01T03:00:00.000Z`),
    hasta: new Date(`${sig}-01T03:00:00.000Z`),
  };
}

// Los últimos `n` períodos 'YYYY-MM' terminando en `mes` (para la serie del gráfico).
function ultimosMeses(mes: string, n: number): string[] {
  const [y, m] = mes.split('-').map(Number) as [number, number];
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    let yy = y;
    let mm = m - i;
    while (mm <= 0) {
      mm += 12;
      yy -= 1;
    }
    out.push(`${yy}-${String(mm).padStart(2, '0')}`);
  }
  return out;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

type Financiero = { devengado: number; cobrado: number; porCobrar: number; enMora: number };

function liqVencida(l: { estado: string; fechaVencimiento: Date | string }, now: Date): boolean {
  return l.estado !== 'PAGADO' && new Date(l.fechaVencimiento).getTime() < now.getTime();
}

/**
 * Financiero por período (ARS, modoCobranza INMOBILIARIA), agrupado por 'YYYY-MM'.
 * Una sola pasada para el mes y para la serie: trae las liquidaciones de todos los
 * períodos pedidos, su pagado, y los cobros reales; devuelve un Map período→números.
 */
async function financieroPorPeriodo(
  inmobiliariaId: string,
  periodos: string[],
  now: Date,
): Promise<Map<string, Financiero>> {
  const base = new Map<string, Financiero>(
    periodos.map((p) => [p, { devengado: 0, cobrado: 0, porCobrar: 0, enMora: 0 }]),
  );
  if (periodos.length === 0) return base;

  const inmo = await prisma.inmobiliaria.findUnique({
    where: { id: inmobiliariaId },
    select: { moraTipoDefault: true, moraValorDefault: true },
  });

  const liqs = await prisma.liquidacion.findMany({
    where: {
      inmobiliariaId,
      periodo: { in: periodos },
      moneda: 'ARS',
      contrato: { modoCobranza: 'INMOBILIARIA' },
    },
    select: {
      id: true,
      periodo: true,
      montoTotal: true,
      estado: true,
      fechaVencimiento: true,
      fechaPago: true,
      montoPunitorioManual: true,
      contrato: { select: { moraTipo: true, moraValor: true, tasaPunitorioDiaria: true } },
    },
  });

  const ids = liqs.map((l) => l.id);
  const pagadoMap = await montoPagadoPorLiquidacion(ids); // CONCILIADO (incl. condonado) → saldo

  // Cobrado REAL: plata que entró (excluye condonado, que cancela deuda sin ingresar).
  const cobros = ids.length
    ? await prisma.pago.findMany({
        where: { liquidacionId: { in: ids }, estado: 'CONCILIADO', condonado: false },
        select: { monto: true, liquidacionId: true },
      })
    : [];
  const cobradoPorLiq = new Map<string, number>();
  for (const p of cobros) {
    cobradoPorLiq.set(p.liquidacionId, (cobradoPorLiq.get(p.liquidacionId) ?? 0) + Number(p.monto));
  }
  const periodoDeLiq = new Map(liqs.map((l) => [l.id, l.periodo]));
  for (const [liqId, monto] of cobradoPorLiq) {
    const per = periodoDeLiq.get(liqId);
    const acc = per && base.get(per);
    if (acc) acc.cobrado += monto;
  }

  for (const l of liqs) {
    const acc = base.get(l.periodo);
    if (!acc) continue;
    acc.devengado += Number(l.montoTotal);
    const esquema = resolverEsquemaMora(l.contrato, inmo);
    const punit = calcularMora(
      Number(l.montoTotal),
      esquema,
      l.fechaVencimiento,
      l.estado === 'PAGADO' && l.fechaPago ? new Date(l.fechaPago) : now,
      l.montoPunitorioManual != null ? Number(l.montoPunitorioManual) : null,
    );
    acc.porCobrar += conSaldo(l, pagadoMap, punit).saldo;
    if (liqVencida(l, now) || l.estado === 'PARCIAL') acc.enMora += punit;
  }

  for (const [, v] of base) {
    v.devengado = r2(v.devengado);
    v.cobrado = r2(v.cobrado);
    v.porCobrar = r2(v.porCobrar);
    v.enMora = r2(v.enMora);
  }
  return base;
}

export async function metricasRoutes(app: FastifyInstance) {
  // Resumen analítico de un mes + la serie de los últimos 6 (para el gráfico).
  app.get('/metricas/resumen', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'metricas.ver');
    if (!u) return;

    const nowAR = new Date(Date.now() - 3 * 3600 * 1000);
    const mesActual = nowAR.toISOString().slice(0, 7);
    const q = z
      .object({ mes: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'mes debe ser YYYY-MM').optional() })
      .parse(request.query ?? {});
    const mes = q.mes ?? mesActual;
    const now = new Date();
    const { desde, hasta } = rangoMesAR(mes);

    // 1) Financiero del mes + serie de 6 meses (una sola pasada por período).
    const periodosSerie = ultimosMeses(mes, 6);
    const fin = await financieroPorPeriodo(u.inmobiliariaId, periodosSerie, now);
    const delMes = fin.get(mes) ?? { devengado: 0, cobrado: 0, porCobrar: 0, enMora: 0 };
    const serie = periodosSerie.map((p) => {
      const f = fin.get(p)!;
      return { mes: p, devengado: f.devengado, cobrado: f.cobrado };
    });

    // 2) Operativo (independiente de moneda).
    const [contratosActivos, altasMes, reclamosAbiertos, reclamosResueltos, cajaAgg, hayOtrasMonedas] =
      await Promise.all([
        prisma.contrato.count({ where: { inmobiliariaId: u.inmobiliariaId, estado: 'ACTIVO' } }),
        prisma.contrato.count({
          where: {
            inmobiliariaId: u.inmobiliariaId,
            estado: { not: 'BORRADOR' },
            fechaInicio: { gte: desde, lt: hasta },
          },
        }),
        prisma.reclamo.count({
          where: { inmobiliariaId: u.inmobiliariaId, createdAt: { gte: desde, lt: hasta } },
        }),
        prisma.reclamo.count({
          where: {
            inmobiliariaId: u.inmobiliariaId,
            estado: { in: ['RESUELTO', 'CERRADO'] },
            resueltoAt: { gte: desde, lt: hasta },
          },
        }),
        // Caja del mes por MovimientoCaja.fecha (el flujo real que carga la inmo).
        prisma.movimientoCaja.groupBy({
          by: ['tipo'],
          where: { inmobiliariaId: u.inmobiliariaId, fecha: { gte: desde, lt: hasta } },
          _sum: { monto: true },
        }),
        // ¿Hay contratos activos en otra moneda? (para avisar que el tablero es en ARS)
        prisma.contrato.count({
          where: { inmobiliariaId: u.inmobiliariaId, estado: 'ACTIVO', moneda: { not: 'ARS' } },
        }),
      ]);

    const ingresosCaja = r2(
      Number(cajaAgg.find((c) => c.tipo === 'INGRESO_EXTRA')?._sum.monto ?? 0),
    );
    const egresosCaja = r2(Number(cajaAgg.find((c) => c.tipo === 'GASTO')?._sum.monto ?? 0));

    return {
      mes,
      moneda: 'ARS',
      hayOtrasMonedas: hayOtrasMonedas > 0,
      financiero: {
        devengado: delMes.devengado,
        cobrado: delMes.cobrado,
        porCobrar: delMes.porCobrar,
        enMora: delMes.enMora,
        // % de lo devengado que ya se cobró (0 si no hubo devengado).
        cobrabilidadPct: delMes.devengado > 0 ? Math.round((delMes.cobrado / delMes.devengado) * 100) : 0,
      },
      operativo: {
        contratosActivos,
        altasMes,
        reclamosAbiertos,
        reclamosResueltos,
      },
      caja: { ingresos: ingresosCaja, egresos: egresosCaja, neto: r2(ingresosCaja - egresosCaja) },
      serie,
    };
  });
}
