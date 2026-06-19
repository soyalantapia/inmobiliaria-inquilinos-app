import type { FastifyInstance } from 'fastify';
import type { Prisma } from '@prisma/client';
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

  // Cuenta de cobranza DIRECTA del propietario (la que ve el inquilino cuando
  // el contrato es PROPIETARIO_DIRECTO). Antes solo vivía en localStorage del
  // panel → el inquilino veía el fallback. Upsert por propietario (@unique).
  app.put('/propietarios/:id/cuenta-cobranza-directa', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'propietarios.crear');
    if (!u) return;
    const { id } = request.params as { id: string };
    const prop = await prisma.propietario.findFirst({ where: { id, inmobiliariaId: u.inmobiliariaId } });
    if (!prop) return reply.code(404).send({ message: 'Propietario inexistente' });
    const body = z
      .object({
        banco: z.string().trim().min(2, 'Indicá el banco'),
        titular: z.string().trim().min(2, 'Indicá el titular'),
        cbu: z.string().trim().regex(/^\d{22}$/, 'El CBU debe tener 22 dígitos'),
        alias: z.string().trim().min(2, 'Indicá el alias'),
        cuit: z.string().trim().optional().default(''),
      })
      .safeParse(request.body ?? {});
    if (!body.success) return reply.code(400).send({ message: body.error.issues[0]?.message ?? 'Datos inválidos' });
    const data = {
      banco: body.data.banco,
      titular: body.data.titular,
      cbu: body.data.cbu,
      alias: body.data.alias,
      cuit: body.data.cuit,
    };
    const cuenta = await prisma.cuentaCobranzaDirecta.upsert({
      where: { propietarioId: id },
      create: { ...data, propietarioId: id, inmobiliariaId: u.inmobiliariaId },
      update: data,
    });
    return { ok: true, cuentaCobranza: cuenta };
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
      // Modo cobranza directa: el contrato apunta al dueño PRINCIPAL de la
      // propiedad (mayor participación) para que el inquilino vea SU cuenta de
      // cobranza directa. Sin esto, /mi-contrato no encontraba a quién cobrar y
      // caía al modo inmobiliaria.
      let cobraDirectoPropietarioId: string | null = null;
      if (d.modoCobranza === 'PROPIETARIO_DIRECTO') {
        const part = await tx.participacionPropietario.findFirst({
          where: { propiedadId: prop.id },
          orderBy: { porcentaje: 'desc' },
        });
        cobraDirectoPropietarioId = part?.propietarioId ?? null;
      }
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
          cobraDirectoPropietarioId,
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

  // ===== Configuración: datos de la empresa (fiscales/contacto) =====
  // Antes esta config vivía SOLO en localStorage (empresa-storage) → una cuenta
  // nueva no podía completar su CUIT/dirección/matrícula y `perfilFiscalCompleto`
  // quedaba en false para siempre. Ahora persiste en la inmobiliaria.
  app.get('/empresa', async (request, reply) => {
    const u = await requireUsuario(request, reply);
    if (!u) return;
    const i = await prisma.inmobiliaria.findUnique({ where: { id: u.inmobiliariaId } });
    if (!i) return reply.code(404).send({ message: 'Inmobiliaria inexistente' });
    return {
      nombre: i.nombre,
      email: i.email,
      cuit: i.cuit,
      matricula: i.matricula,
      telefono: i.telefono,
      direccionCalle: i.direccionCalle,
      direccionAltura: i.direccionAltura,
      direccionPiso: i.direccionPiso,
      direccionCiudad: i.direccionCiudad,
      direccionProvincia: i.direccionProvincia,
      direccionCp: i.direccionCp,
      perfilFiscalCompleto: !!(i.cuit && i.direccionCalle),
    };
  });

  app.put('/empresa', async (request, reply) => {
    const u = await requireUsuario(request, reply);
    if (!u) return;
    if (u.rol !== 'ADMIN') return reply.code(403).send({ message: 'Solo un Admin puede editar los datos de la empresa' });
    const body = z
      .object({
        nombre: z.string().trim().min(2).optional(),
        cuit: z.string().trim().optional(),
        matricula: z.string().trim().optional(),
        telefono: z.string().trim().optional(),
        direccionCalle: z.string().trim().optional(),
        direccionAltura: z.string().trim().optional(),
        direccionPiso: z.string().trim().optional(),
        direccionCiudad: z.string().trim().optional(),
        direccionProvincia: z.string().trim().optional(),
        direccionCp: z.string().trim().optional(),
      })
      .safeParse(request.body ?? {});
    if (!body.success) return reply.code(400).send({ message: 'Datos de la empresa inválidos' });
    const i = await prisma.inmobiliaria.update({ where: { id: u.inmobiliariaId }, data: body.data });
    return { ok: true, perfilFiscalCompleto: !!(i.cuit && i.direccionCalle) };
  });

  // ===== Configuración: cuenta de cobranza (lo que el inquilino ve para pagar) =====
  // Se guarda en la sociedad PRINCIPAL (Sociedad.cuentaCobranza). Antes no había
  // endpoint → una inmobiliaria nueva no podía cargar su CBU y el inquilino veía
  // el fallback "pedíle los datos". Ahora el inquilino ve el CBU real de la DB.
  app.get('/cobranza', async (request, reply) => {
    const u = await requireUsuario(request, reply);
    if (!u) return;
    const soc = await prisma.sociedad.findFirst({
      where: { inmobiliariaId: u.inmobiliariaId, esPrincipal: true, activa: true },
      select: { cuentaCobranza: true },
    });
    const c = (soc?.cuentaCobranza as { banco?: string; titular?: string; cbu?: string; alias?: string; cuit?: string } | null) ?? null;
    return {
      tieneCuenta: !!(c?.cbu && c?.titular),
      cuenta: {
        banco: c?.banco ?? '',
        titular: c?.titular ?? '',
        cbu: c?.cbu ?? '',
        alias: c?.alias ?? '',
        cuit: c?.cuit ?? '',
      },
    };
  });

  app.put('/cobranza', async (request, reply) => {
    const u = await requireUsuario(request, reply);
    if (!u) return;
    if (u.rol !== 'ADMIN') return reply.code(403).send({ message: 'Solo un Admin puede editar la cuenta de cobranza' });
    const body = z
      .object({
        banco: z.string().trim().min(2, 'Indicá el banco'),
        titular: z.string().trim().min(2, 'Indicá el titular de la cuenta'),
        cbu: z.string().trim().regex(/^\d{22}$/, 'El CBU debe tener 22 dígitos'),
        alias: z.string().trim().optional().default(''),
        cuit: z.string().trim().optional().default(''),
      })
      .safeParse(request.body ?? {});
    if (!body.success) return reply.code(400).send({ message: body.error.issues[0]?.message ?? 'Datos de cobranza inválidos' });
    const cuentaCobranza = {
      banco: body.data.banco,
      titular: body.data.titular,
      cbu: body.data.cbu,
      alias: body.data.alias,
      cuit: body.data.cuit,
    };
    const i = await prisma.inmobiliaria.findUnique({ where: { id: u.inmobiliariaId } });
    if (!i) return reply.code(404).send({ message: 'Inmobiliaria inexistente' });
    const existente = await prisma.sociedad.findFirst({
      where: { inmobiliariaId: u.inmobiliariaId, esPrincipal: true, activa: true },
    });
    if (existente) {
      await prisma.sociedad.update({ where: { id: existente.id }, data: { cuentaCobranza } });
    } else {
      // Primera vez: creamos la sociedad principal con los datos mínimos de la
      // inmobiliaria. El CRUD multi-sociedad completo está más abajo.
      const domicilio = [i.direccionCalle, i.direccionAltura, i.direccionPiso].filter(Boolean).join(' ').trim();
      await prisma.sociedad.create({
        data: {
          inmobiliariaId: u.inmobiliariaId,
          razonSocial: i.nombre,
          nombreComercial: i.nombre,
          cuit: body.data.cuit || i.cuit || '',
          condicionFiscal: 'RESPONSABLE_INSCRIPTO',
          domicilioFiscal: domicilio || i.direccionCiudad || '',
          email: i.email,
          telefono: i.telefono ?? '',
          cuentaCobranza,
          esPrincipal: true,
          activa: true,
        },
      });
    }
    return { ok: true, tieneCuenta: true };
  });

  // ===== Configuración: CRUD de sociedades (multi-empresa) =====
  // Antes vivía 100% en localStorage (sociedades-storage) → en prod el manager
  // estaba gateado. Ahora persiste en la tabla Sociedad. GET/PUT /cobranza
  // (arriba) sigue operando sobre la principal; esto es el CRUD completo.
  const sociedadBody = z.object({
    razonSocial: z.string().trim().min(2, 'Indicá la razón social'),
    nombreComercial: z.string().trim().min(1, 'Indicá el nombre comercial'),
    cuit: z.string().trim().optional().default(''),
    condicionFiscal: z.enum(['MONOTRIBUTO', 'RESPONSABLE_INSCRIPTO', 'EXENTO']).default('RESPONSABLE_INSCRIPTO'),
    domicilioFiscal: z.string().trim().optional().default(''),
    email: z.string().trim().optional().default(''),
    telefono: z.string().trim().optional().default(''),
    cuentaCobranza: z.record(z.unknown()).optional(),
    afip: z.record(z.unknown()).optional(),
  });

  app.get('/sociedades', async (request, reply) => {
    const u = await requireUsuario(request, reply);
    if (!u) return;
    const q = z.object({ incluirInactivas: z.coerce.boolean().optional() }).parse(request.query ?? {});
    return prisma.sociedad.findMany({
      where: { inmobiliariaId: u.inmobiliariaId, ...(q.incluirInactivas ? {} : { activa: true }) },
      orderBy: [{ esPrincipal: 'desc' }, { createdAt: 'asc' }],
    });
  });

  app.post('/sociedades', async (request, reply) => {
    const u = await requireUsuario(request, reply);
    if (!u) return;
    if (u.rol !== 'ADMIN') return reply.code(403).send({ message: 'Solo un Admin puede crear sociedades' });
    const body = sociedadBody.safeParse(request.body ?? {});
    if (!body.success) return reply.code(400).send({ message: body.error.issues[0]?.message ?? 'Datos inválidos' });
    // La primera sociedad activa queda como principal automáticamente.
    const tienePrincipal = await prisma.sociedad.findFirst({
      where: { inmobiliariaId: u.inmobiliariaId, esPrincipal: true, activa: true },
    });
    return prisma.sociedad.create({
      data: {
        inmobiliariaId: u.inmobiliariaId,
        razonSocial: body.data.razonSocial,
        nombreComercial: body.data.nombreComercial,
        cuit: body.data.cuit,
        condicionFiscal: body.data.condicionFiscal,
        domicilioFiscal: body.data.domicilioFiscal,
        email: body.data.email,
        telefono: body.data.telefono,
        cuentaCobranza: (body.data.cuentaCobranza ?? undefined) as Prisma.InputJsonValue | undefined,
        afip: (body.data.afip ?? undefined) as Prisma.InputJsonValue | undefined,
        esPrincipal: !tienePrincipal,
        activa: true,
      },
    });
  });

  app.put('/sociedades/:id', async (request, reply) => {
    const u = await requireUsuario(request, reply);
    if (!u) return;
    if (u.rol !== 'ADMIN') return reply.code(403).send({ message: 'Solo un Admin puede editar sociedades' });
    const { id } = request.params as { id: string };
    const soc = await prisma.sociedad.findFirst({ where: { id, inmobiliariaId: u.inmobiliariaId } });
    if (!soc) return reply.code(404).send({ message: 'Sociedad inexistente' });
    const body = sociedadBody.partial().safeParse(request.body ?? {});
    if (!body.success) return reply.code(400).send({ message: body.error.issues[0]?.message ?? 'Datos inválidos' });
    const { cuentaCobranza, afip, ...rest } = body.data;
    return prisma.sociedad.update({
      where: { id },
      data: {
        ...rest,
        ...(cuentaCobranza !== undefined ? { cuentaCobranza: cuentaCobranza as Prisma.InputJsonValue } : {}),
        ...(afip !== undefined ? { afip: afip as Prisma.InputJsonValue } : {}),
      },
    });
  });

  app.put('/sociedades/:id/principal', async (request, reply) => {
    const u = await requireUsuario(request, reply);
    if (!u) return;
    if (u.rol !== 'ADMIN') return reply.code(403).send({ message: 'Solo un Admin puede cambiar la sociedad principal' });
    const { id } = request.params as { id: string };
    const soc = await prisma.sociedad.findFirst({ where: { id, inmobiliariaId: u.inmobiliariaId, activa: true } });
    if (!soc) return reply.code(404).send({ message: 'Sociedad inexistente o inactiva' });
    await prisma.$transaction([
      prisma.sociedad.updateMany({ where: { inmobiliariaId: u.inmobiliariaId }, data: { esPrincipal: false } }),
      prisma.sociedad.update({ where: { id }, data: { esPrincipal: true } }),
    ]);
    return { ok: true };
  });

  app.patch('/sociedades/:id', async (request, reply) => {
    const u = await requireUsuario(request, reply);
    if (!u) return;
    if (u.rol !== 'ADMIN') return reply.code(403).send({ message: 'Solo un Admin puede dar de baja o reactivar sociedades' });
    const { id } = request.params as { id: string };
    const body = z.object({ reactivar: z.boolean().optional() }).parse(request.body ?? {});
    const soc = await prisma.sociedad.findFirst({ where: { id, inmobiliariaId: u.inmobiliariaId } });
    if (!soc) return reply.code(404).send({ message: 'Sociedad inexistente' });
    // Reactivar: simplemente la volvemos activa (no toca la principal).
    if (body.reactivar) {
      await prisma.sociedad.update({ where: { id }, data: { activa: true } });
      return { ok: true };
    }
    const activas = await prisma.sociedad.count({ where: { inmobiliariaId: u.inmobiliariaId, activa: true } });
    if (soc.activa && activas <= 1) return reply.code(409).send({ message: 'No podés dar de baja la única sociedad activa' });
    await prisma.sociedad.update({ where: { id }, data: { activa: false, esPrincipal: false } });
    // Si la dada de baja era la principal, promovemos otra activa.
    if (soc.esPrincipal) {
      const siguiente = await prisma.sociedad.findFirst({
        where: { inmobiliariaId: u.inmobiliariaId, activa: true },
        orderBy: { createdAt: 'asc' },
      });
      if (siguiente) await prisma.sociedad.update({ where: { id: siguiente.id }, data: { esPrincipal: true } });
    }
    return { ok: true };
  });
}
