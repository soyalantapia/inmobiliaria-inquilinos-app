import type { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';
import { requireUsuario } from '../auth/guards.js';

const DIA_MS = 24 * 60 * 60 * 1000;
const POR_VENCER_DIAS = 30;

/**
 * Seguros / garantías de una propiedad, agregados por sus contratos. Hoy el seguro de
 * caución vive dentro del modelo `Garante` (tipo CAUCION|DIGITAL, con nº de póliza,
 * cobertura y vigenciaHasta); este endpoint los junta por propiedad y les calcula el
 * estado de vigencia (VIGENTE / POR_VENCER / VENCIDA) para poder alertar vencimientos.
 * Sin migración; archivo aparte (no toca core.ts, que tiene el CRUD de garantes).
 */
export async function propiedadSegurosRoutes(app: FastifyInstance) {
  app.get('/propiedades/:id/seguros', async (request, reply) => {
    const u = await requireUsuario(request, reply);
    if (!u) return;
    const { id } = request.params as { id: string };
    const now = new Date();

    const propiedad = await prisma.propiedad.findFirst({
      where: { id, inmobiliariaId: u.inmobiliariaId },
      select: { id: true },
    });
    if (!propiedad) return reply.code(404).send({ message: 'Propiedad inexistente' });

    const contratos = await prisma.contrato.findMany({
      where: { propiedadId: id, inmobiliariaId: u.inmobiliariaId },
      select: { id: true, estado: true, inquilinoTitular: { select: { nombre: true, apellido: true } } },
      orderBy: { fechaInicio: 'desc' },
    });
    const contratoIds = contratos.map((c) => c.id);
    const infoContrato = new Map(
      contratos.map((c) => [
        c.id,
        {
          estado: c.estado,
          inquilino: c.inquilinoTitular
            ? `${c.inquilinoTitular.nombre ?? ''} ${c.inquilinoTitular.apellido ?? ''}`.trim()
            : '',
        },
      ]),
    );

    const garantes = contratoIds.length
      ? await prisma.garante.findMany({
          where: { contratoId: { in: contratoIds }, inmobiliariaId: u.inmobiliariaId },
          select: {
            id: true,
            contratoId: true,
            tipo: true,
            nombreProveedor: true,
            numeroPoliza: true,
            montoCobertura: true,
            vigenciaHasta: true,
          },
          orderBy: { createdAt: 'desc' },
        })
      : [];

    let vencidas = 0;
    let porVencer = 0;
    const garantias = garantes.map((g) => {
      const esPoliza = g.tipo === 'CAUCION' || g.tipo === 'DIGITAL';
      let estadoPoliza: 'VIGENTE' | 'POR_VENCER' | 'VENCIDA' | null = null;
      let diasParaVencer: number | null = null;
      if (esPoliza && g.vigenciaHasta) {
        diasParaVencer = Math.ceil((new Date(g.vigenciaHasta).getTime() - now.getTime()) / DIA_MS);
        if (diasParaVencer < 0) {
          estadoPoliza = 'VENCIDA';
          vencidas += 1;
        } else if (diasParaVencer <= POR_VENCER_DIAS) {
          estadoPoliza = 'POR_VENCER';
          porVencer += 1;
        } else {
          estadoPoliza = 'VIGENTE';
        }
      }
      const info = infoContrato.get(g.contratoId);
      return {
        id: g.id,
        contratoId: g.contratoId,
        contratoEstado: info?.estado ?? null,
        inquilino: info?.inquilino ?? '',
        tipo: g.tipo,
        esPoliza,
        // aseguradora (caución/digital) o nombre del garante persona
        nombre: g.nombreProveedor,
        numeroPoliza: g.numeroPoliza,
        montoCobertura: g.montoCobertura != null ? Number(g.montoCobertura) : null,
        vigenciaHasta: g.vigenciaHasta,
        estadoPoliza,
        diasParaVencer,
      };
    });

    return { garantias, alertas: { vencidas, porVencer } };
  });
}
