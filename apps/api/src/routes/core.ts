import type { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';
import { requireUsuario } from '../auth/guards.js';

/**
 * Núcleo de datos del panel (Fase 2): contratos, propiedades, propietarios,
 * inquilinos. Solo lectura por ahora — la escritura llega con sus flujos
 * (carga de contrato Fase 3+, etc.). Todo scoped por inmobiliariaId del JWT.
 *
 * Nota: estadoPagoActual / proximoVencimiento son DERIVADOS de liquidaciones
 * (Fase 3). Hasta entonces el server no los inventa: van null y el front decide.
 */
export async function coreRoutes(app: FastifyInstance) {
  // ===== Contratos =====
  app.get('/contratos', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'contratos.ver');
    if (!u) return;
    const contratos = await prisma.contrato.findMany({
      where: { inmobiliariaId: u.inmobiliariaId },
      include: {
        propiedad: { select: { id: true, direccion: true, ciudad: true, consorcio: { select: { nombre: true } } } },
        inquilinoTitular: { select: { id: true, nombre: true, apellido: true, email: true } },
        liquidaciones: { orderBy: { periodo: 'desc' }, take: 6 },
      },
      orderBy: { createdAt: 'asc' },
    });
    // estadoPagoActual / proximoVencimiento DERIVADOS de liquidaciones reales:
    // cualquier vencida manda; si no, la más reciente; sin liqs → PENDIENTE.
    return contratos.map(({ liquidaciones, ...c }) => {
      const vencida = liquidaciones.find((l) => l.estado === 'VENCIDO');
      const actual = vencida ?? liquidaciones[0] ?? null;
      const pendiente = liquidaciones.find((l) => l.estado === 'PENDIENTE' || l.estado === 'VENCIDO');
      return {
        ...c,
        estadoPagoActual: actual?.estado ?? 'PENDIENTE',
        proximoVencimiento: pendiente?.fechaVencimiento ?? null,
      };
    });
  });

  app.get('/contratos/:id', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'contratos.ver');
    if (!u) return;
    const { id } = request.params as { id: string };
    const contrato = await prisma.contrato.findFirst({
      where: { id, inmobiliariaId: u.inmobiliariaId },
      include: {
        propiedad: { include: { participaciones: { include: { propietario: true } } } },
        inquilinoTitular: true,
        sociedad: { select: { id: true, nombreComercial: true } },
        garantes: true,
        coInquilinos: true,
        documentos: true,
      },
    });
    if (!contrato) return reply.code(404).send({ message: 'Contrato inexistente' });
    return contrato;
  });

  // ===== Propiedades =====
  app.get('/propiedades', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'propiedades.ver');
    if (!u) return;
    return prisma.propiedad.findMany({
      where: { inmobiliariaId: u.inmobiliariaId },
      include: {
        participaciones: { include: { propietario: { select: { id: true, nombre: true, apellido: true } } } },
        contratoActual: { select: { id: true, estado: true, monto: true, moneda: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  });

  app.get('/propiedades/:id', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'propiedades.ver');
    if (!u) return;
    const { id } = request.params as { id: string };
    const propiedad = await prisma.propiedad.findFirst({
      where: { id, inmobiliariaId: u.inmobiliariaId },
      include: {
        participaciones: { include: { propietario: true } },
        contratoActual: {
          include: {
            inquilinoTitular: true,
            liquidaciones: { orderBy: { periodo: 'desc' }, take: 6 },
          },
        },
        contratos: { orderBy: { fechaInicio: 'desc' } },
        sociedad: { select: { id: true, nombreComercial: true } },
      },
    });
    if (!propiedad) return reply.code(404).send({ message: 'Propiedad inexistente' });
    // estadoPagoActual / proximoVencimiento DERIVADOS de liquidaciones reales
    // (igual que el listado): el detalle no los traía y el front asumía que
    // estaban → crasheaba al refrescar/deep-link (charAt sobre undefined).
    let contratoActual = null;
    if (propiedad.contratoActual) {
      const { liquidaciones, ...rest } = propiedad.contratoActual;
      const vencida = liquidaciones.find((l) => l.estado === 'VENCIDO');
      const actual = vencida ?? liquidaciones[0] ?? null;
      const pendiente = liquidaciones.find((l) => l.estado === 'PENDIENTE' || l.estado === 'VENCIDO');
      contratoActual = {
        ...rest,
        estadoPagoActual: actual?.estado ?? 'PENDIENTE',
        proximoVencimiento: pendiente?.fechaVencimiento ?? null,
      };
    }
    return { ...propiedad, contratoActual };
  });

  // ===== Propietarios =====
  app.get('/propietarios', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'propietarios.ver');
    if (!u) return;
    return prisma.propietario.findMany({
      where: { inmobiliariaId: u.inmobiliariaId },
      include: {
        participaciones: {
          include: { propiedad: { select: { id: true, direccion: true, estado: true } } },
        },
      },
      orderBy: { apellido: 'asc' },
    });
  });

  app.get('/propietarios/:id', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'propietarios.ver');
    if (!u) return;
    const { id } = request.params as { id: string };
    const propietario = await prisma.propietario.findFirst({
      where: { id, inmobiliariaId: u.inmobiliariaId },
      include: {
        participaciones: {
          include: {
            propiedad: { include: { contratoActual: { include: { inquilinoTitular: true } } } },
          },
        },
        arca: true,
        cuentaCobranza: true,
      },
    });
    if (!propietario) return reply.code(404).send({ message: 'Propietario inexistente' });
    return propietario;
  });

  // ===== Inquilinos =====
  app.get('/inquilinos', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'contratos.ver');
    if (!u) return;
    return prisma.inquilino.findMany({
      where: { inmobiliariaId: u.inmobiliariaId },
      include: { contrato: { select: { id: true, estado: true, propiedad: { select: { direccion: true } } } } },
      orderBy: { nombre: 'asc' },
    });
  });
}
