import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireUsuario } from '../auth/guards.js';
import { generarLiquidacionesContrato } from '../lib/liquidaciones.js';

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

  // ===== Altas (auto-onboarding: cargar la cartera real) =====
  app.post('/propietarios', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'propietarios.crear');
    if (!u) return;
    const body = z
      .object({
        nombre: z.string().trim().min(2),
        apellido: z.string().trim().min(1),
        email: z.string().trim().email().optional().or(z.literal('')),
        telefono: z.string().trim().optional(),
        cuit: z.string().trim().optional(),
        cbuAlias: z.string().trim().optional(),
        comisionPct: z.number().min(0).max(100).optional(),
        notas: z.string().optional(),
      })
      .safeParse(request.body ?? {});
    if (!body.success) return reply.code(400).send({ message: 'Datos del propietario incompletos' });
    const d = body.data;
    return prisma.propietario.create({
      data: {
        inmobiliariaId: u.inmobiliariaId,
        nombre: d.nombre,
        apellido: d.apellido,
        cuit: d.cuit ?? '',
        email: d.email ?? '',
        telefono: d.telefono ?? '',
        cbuAlias: d.cbuAlias || null,
        comisionPct: d.comisionPct ?? 8,
        notas: d.notas || null,
      },
    });
  });

  app.post('/propiedades', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'propiedades.crear');
    if (!u) return;
    const body = z
      .object({
        direccion: z.string().trim().min(3),
        ciudad: z.string().trim().min(2),
        provincia: z.string().trim().min(2),
        tipo: z.enum(['DEPARTAMENTO', 'CASA', 'LOCAL', 'GALPON']),
        ambientes: z.number().int().positive().optional(),
        m2: z.number().positive().optional(),
        propietarios: z
          .array(z.object({ propietarioId: z.string(), porcentaje: z.number().min(0).max(100) }))
          .min(1),
      })
      .safeParse(request.body ?? {});
    if (!body.success) return reply.code(400).send({ message: 'Datos de la propiedad incompletos' });
    const d = body.data;
    if (Math.round(d.propietarios.reduce((a, p) => a + p.porcentaje, 0)) !== 100) {
      return reply.code(400).send({ message: 'Los porcentajes de los propietarios deben sumar 100' });
    }
    const ids = d.propietarios.map((p) => p.propietarioId);
    const existen = await prisma.propietario.count({ where: { id: { in: ids }, inmobiliariaId: u.inmobiliariaId } });
    if (existen !== ids.length) return reply.code(400).send({ message: 'Algún propietario no existe' });
    return prisma.$transaction(async (tx) => {
      const prop = await tx.propiedad.create({
        data: {
          inmobiliariaId: u.inmobiliariaId,
          direccion: d.direccion,
          ciudad: d.ciudad,
          provincia: d.provincia,
          tipo: d.tipo,
          ambientes: d.ambientes ?? null,
          m2: d.m2 ?? null,
          estado: 'DISPONIBLE',
        },
      });
      await tx.participacionPropietario.createMany({
        data: d.propietarios.map((p) => ({
          inmobiliariaId: u.inmobiliariaId,
          propiedadId: prop.id,
          propietarioId: p.propietarioId,
          porcentaje: p.porcentaje,
        })),
      });
      return prop;
    });
  });

  app.post('/contratos', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'contratos.crear');
    if (!u) return;
    const body = z
      .object({
        propiedadId: z.string(),
        inquilino: z.object({
          nombre: z.string().trim().min(2),
          apellido: z.string().trim().optional(),
          email: z.string().trim().email().optional().or(z.literal('')),
          telefono: z.string().trim().optional(),
          dni: z.string().trim().optional(),
        }),
        monto: z.number().nonnegative(), // 0 válido para SOLO_EXPENSAS
        moneda: z.enum(['ARS', 'USD']).default('ARS'),
        fechaInicio: z.string(),
        fechaFin: z.string(),
        diaPago: z.number().int().min(1).max(31),
        indiceAjuste: z.enum(['ICL', 'IPC', 'CASA_PROPIA', 'UVA', 'CAC', 'RIPTE']),
        frecuenciaAjusteMeses: z.number().int().positive(),
        montoExpensas: z.number().positive().optional(),
        tipoContrato: z.enum(['ALQUILER', 'SOLO_EXPENSAS', 'ALQUILER_Y_EXPENSAS']).default('ALQUILER'),
        depositoGarantia: z.number().positive().optional(),
        modoCobranza: z.enum(['INMOBILIARIA', 'PROPIETARIO_DIRECTO']).default('INMOBILIARIA'),
      })
      .safeParse(request.body ?? {});
    if (!body.success) return reply.code(400).send({ message: 'Datos del contrato incompletos' });
    const d = body.data;
    const prop = await prisma.propiedad.findFirst({ where: { id: d.propiedadId, inmobiliariaId: u.inmobiliariaId } });
    if (!prop) return reply.code(404).send({ message: 'Propiedad inexistente' });
    if (prop.contratoActualId) return reply.code(409).send({ message: 'La propiedad ya tiene un contrato activo' });
    return prisma.$transaction(async (tx) => {
      const inq = await tx.inquilino.create({
        data: {
          inmobiliariaId: u.inmobiliariaId,
          nombre: d.inquilino.nombre,
          apellido: d.inquilino.apellido || null,
          // Normalizado a minúsculas: el login por OTP busca el email en
          // minúsculas. Sin esto, un email cargado con mayúsculas dejaría al
          // inquilino sin poder entrar nunca.
          email: d.inquilino.email ? d.inquilino.email.toLowerCase() : null,
          telefono: d.inquilino.telefono || null,
          dni: d.inquilino.dni || null,
          esInvitado: false,
        },
      });
      const contrato = await tx.contrato.create({
        data: {
          inmobiliariaId: u.inmobiliariaId,
          propiedadId: prop.id,
          estado: 'ACTIVO',
          monto: d.monto,
          moneda: d.moneda,
          fechaInicio: new Date(d.fechaInicio),
          fechaFin: new Date(d.fechaFin),
          diaPago: d.diaPago,
          indiceAjuste: d.indiceAjuste,
          frecuenciaAjusteMeses: d.frecuenciaAjusteMeses,
          montoExpensas: d.montoExpensas ?? null,
          tipoContrato: d.tipoContrato,
          depositoGarantia: d.depositoGarantia ?? null,
          modoCobranza: d.modoCobranza,
          cargadoPor: u.userId,
          cargadoRol: u.rol,
          cargadoAt: new Date(),
        },
      });
      await tx.inquilino.update({ where: { id: inq.id }, data: { contratoId: contrato.id } });
      await tx.propiedad.update({ where: { id: prop.id }, data: { contratoActualId: contrato.id, estado: 'ALQUILADA' } });
      // Devengar las liquidaciones del contrato (cargos mensuales). Sin esto
      // el inquilino no tendría nada para pagar al activar el contrato.
      await generarLiquidacionesContrato(tx, contrato);
      return contrato;
    });
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
