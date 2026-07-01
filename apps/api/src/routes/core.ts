import type { FastifyInstance, FastifyReply } from 'fastify';
import type { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireUsuario } from '../auth/guards.js';
import { registrarEvento } from '../lib/auditoria.js';
import { generarLiquidacionesContrato } from '../lib/liquidaciones.js';
import { conSaldo, montoPagadoPorLiquidacion } from '../lib/saldos.js';
import { calcularPunitorio } from '../lib/punitorios.js';
import { enviarInvitacionInquilino, enviarInvitacionEquipo } from '../mailer.js';

/**
 * Una liquidación cuenta como VENCIDA (a efectos de cobranza) si su estado ya es
 * VENCIDO, o si todavía no está paga (PENDIENTE/PARCIAL) y su vencimiento pasó.
 * El estado persistido sólo vira a VENCIDO cuando corre el barrido del devengo
 * (marcarLiquidacionesVencidas); esta derivación on-read cubre el hueco entre
 * corridas Y captura el parcial vencido (estado PARCIAL), que si no nunca volvía
 * a figurar como moroso en el panel (auditoría A2).
 */
function liqVencida(l: { estado: string; fechaVencimiento: Date | string }, now: Date): boolean {
  if (l.estado === 'VENCIDO') return true;
  if (l.estado === 'PENDIENTE' || l.estado === 'PARCIAL') return new Date(l.fechaVencimiento) < now;
  return false;
}

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
    // Liquidación ACTUAL por contrato (la que define estadoPagoActual): cualquier
    // vencida manda; si no, la más reciente. Se reutiliza abajo para exponer su
    // montoPagado/saldo sin recalcular la derivación.
    const now = new Date();
    const actualPorContrato = contratos.map(
      (c) => c.liquidaciones.find((l) => liqVencida(l, now)) ?? c.liquidaciones[0] ?? null,
    );
    // montoPagado (suma de pagos CONCILIADO) de la liquidación actual. Sin esto el
    // KPI "Pendiente" del panel contaba el alquiler ENTERO de un contrato PARCIAL,
    // ignorando lo ya cobrado → sobreestimaba la mora. Misma fuente de verdad que
    // /contratos/:id y /mis-liquidaciones (montoPagadoPorLiquidacion).
    const pagadoMap = await montoPagadoPorLiquidacion(
      actualPorContrato.flatMap((l) => (l ? [l.id] : [])),
    );
    // estadoPagoActual / proximoVencimiento DERIVADOS de liquidaciones reales:
    // una vencida (incluye parcial/pendiente fuera de término) manda; si no, la más
    // reciente; sin liqs → PENDIENTE. proximoVencimiento incluye PARCIAL (B6).
    return contratos.map(({ liquidaciones, ...c }, i) => {
      const actual = actualPorContrato[i];
      const pendiente = liquidaciones.find(
        (l) => l.estado === 'PENDIENTE' || l.estado === 'VENCIDO' || l.estado === 'PARCIAL',
      );
      const saldoActual = actual ? conSaldo(actual, pagadoMap) : null;
      return {
        ...c,
        // Un parcial/pendiente vencido se reporta VENCIDO (cobranza), no PARCIAL:
        // el saldo restante lo capta montoPagado/saldo de abajo.
        estadoPagoActual: actual ? (liqVencida(actual, now) ? 'VENCIDO' : actual.estado) : 'PENDIENTE',
        proximoVencimiento: pendiente?.fechaVencimiento ?? null,
        // montoPagado/saldo del período actual — el front resta lo ya conciliado en
        // el KPI "Pendiente". Sin liq actual → 0/null.
        montoPagado: saldoActual?.montoPagado ?? 0,
        saldo: saldoActual?.saldo ?? null,
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
        // cuentaCobranza incluida: en PROPIETARIO_DIRECTO el front necesita la
        // cuenta del dueño (CBU/alias) para mostrar el destino de cobro. Sin esto
        // siempre mostraba "Falta cargar la cuenta" aunque existiera (mismo include
        // que GET /propietarios/:id).
        propiedad: {
          include: {
            participaciones: { include: { propietario: { include: { cuentaCobranza: true } } } },
          },
        },
        inquilinoTitular: true,
        sociedad: { select: { id: true, nombreComercial: true } },
        garantes: true,
        coInquilinos: true,
        documentos: true,
        // SIN take: el tab "Pagos" del detalle lista el historial completo y su
        // ResumenPagos agrega "Total cobrado"/"Pagadas" sobre TODAS las liquidaciones
        // (con take:6 esos totales quedaban truncados). Están acotadas por la
        // duración del contrato (una por mes).
        liquidaciones: { orderBy: { periodo: 'desc' } },
      },
    });
    if (!contrato) return reply.code(404).send({ message: 'Contrato inexistente' });
    // estadoPagoActual / proximoVencimiento DERIVADOS de liquidaciones reales
    // (igual que el listado y el detalle de propiedad): antes el detalle no los
    // traía y el front aproximaba proximoVencimiento con la fecha de AJUSTE del
    // alquiler (dato equivocado: el ajuste no es el vencimiento del mes).
    const { liquidaciones, ...rest } = contrato;
    const now = new Date();
    const actual = liquidaciones.find((l) => liqVencida(l, now)) ?? liquidaciones[0] ?? null;
    const pendiente = liquidaciones.find(
      (l) => l.estado === 'PENDIENTE' || l.estado === 'VENCIDO' || l.estado === 'PARCIAL',
    );
    // Devolvemos las liquidaciones (con montoPagado/saldo) — antes se descartaban
    // y el tab "Pagos" del detalle quedaba SIEMPRE vacío (bug 4): un pago informado
    // o conciliado nunca se veía en el contrato.
    const pagado = await montoPagadoPorLiquidacion(liquidaciones.map((l) => l.id));
    // M1: cada liquidación con su mora al día (montoTotal = base + punitorio); una
    // PAGADA congela la mora en su fechaPago. tasaPunitorioDiaria viene en `rest`.
    const tasaP = rest.tasaPunitorioDiaria ?? null;
    return {
      ...rest,
      liquidaciones: liquidaciones.map((l) => {
        const asOf = l.estado === 'PAGADO' && l.fechaPago ? new Date(l.fechaPago) : now;
        return conSaldo(l, pagado, calcularPunitorio(Number(l.montoTotal), tasaP, l.fechaVencimiento, asOf));
      }),
      estadoPagoActual: actual ? (liqVencida(actual, now) ? 'VENCIDO' : actual.estado) : 'PENDIENTE',
      proximoVencimiento: pendiente?.fechaVencimiento ?? null,
    };
  });

  // Co-inquilinos de un contrato — lado PANEL (la inmobiliaria los carga). El lado
  // inquilino (auto-invitación del titular) vive en inquilino-mundo.ts con
  // requireInquilino; ESTO es requireUsuario + tenant-scope por inmobiliariaId.
  // Antes el panel los guardaba SOLO en localStorage → el toast decía "se le envía
  // el link por WhatsApp" pero nada llegaba a la DB ni daba acceso real.
  async function contratoDelTenant(
    contratoId: string,
    inmobiliariaId: string,
    reply: FastifyReply,
  ): Promise<boolean> {
    const c = await prisma.contrato.findFirst({
      where: { id: contratoId, inmobiliariaId },
      select: { id: true },
    });
    if (!c) {
      await reply.code(404).send({ message: 'Contrato no encontrado' });
      return false;
    }
    return true;
  }

  app.get('/contratos/:contratoId/co-inquilinos', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'contratos.ver');
    if (!u) return;
    const { contratoId } = request.params as { contratoId: string };
    if (!(await contratoDelTenant(contratoId, u.inmobiliariaId, reply))) return;
    return prisma.coInquilino.findMany({
      where: { contratoId, inmobiliariaId: u.inmobiliariaId },
      orderBy: { invitadoAt: 'desc' },
    });
  });

  app.post('/contratos/:contratoId/co-inquilinos', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'contratos.crear');
    if (!u) return;
    const { contratoId } = request.params as { contratoId: string };
    if (!(await contratoDelTenant(contratoId, u.inmobiliariaId, reply))) return;
    const body = z
      .object({
        nombre: z.string().trim().min(2).max(120),
        email: z.string().trim().email(),
        telefono: z.string().trim().max(40).optional(),
        dni: z.string().trim().max(20).optional(),
        relacion: z.string().trim().min(2).max(60),
        permiso: z.enum(['VER', 'PAGAR', 'COMPLETO']),
      })
      .safeParse(request.body ?? {});
    if (!body.success) {
      return reply.code(400).send({
        message: 'Datos del co-inquilino incompletos (nombre, email, relación y permiso)',
      });
    }
    const email = body.data.email.toLowerCase();
    try {
      const co = await prisma.coInquilino.create({
        data: {
          inmobiliariaId: u.inmobiliariaId,
          contratoId,
          nombre: body.data.nombre,
          email,
          telefono: body.data.telefono,
          dni: body.data.dni,
          relacion: body.data.relacion,
          permiso: body.data.permiso,
        },
      });
      return reply.code(201).send(co);
    } catch (e) {
      // @@unique([contratoId, email]) corta el duplicado con P2002.
      if (e && typeof e === 'object' && (e as { code?: string }).code === 'P2002') {
        return reply.code(409).send({ message: 'Ya hay un co-inquilino con ese email en este contrato' });
      }
      throw e;
    }
  });

  app.delete('/contratos/:contratoId/co-inquilinos/:id', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'contratos.crear');
    if (!u) return;
    const { contratoId, id } = request.params as { contratoId: string; id: string };
    const co = await prisma.coInquilino.findFirst({
      where: { id, contratoId, inmobiliariaId: u.inmobiliariaId },
    });
    if (!co) return reply.code(404).send({ message: 'Co-inquilino no encontrado' });
    await prisma.coInquilino.delete({ where: { id: co.id } });
    return { ok: true };
  });

  // ===== Propiedades =====
  app.get('/propiedades', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'propiedades.ver');
    if (!u) return;
    return prisma.propiedad.findMany({
      where: { inmobiliariaId: u.inmobiliariaId },
      include: {
        participaciones: { include: { propietario: { select: { id: true, nombre: true, apellido: true } } } },
        contratoActual: { select: { id: true, estado: true, monto: true, moneda: true, modoCobranza: true } },
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
      const now = new Date();
      const actual = liquidaciones.find((l) => liqVencida(l, now)) ?? liquidaciones[0] ?? null;
      const pendiente = liquidaciones.find(
        (l) => l.estado === 'PENDIENTE' || l.estado === 'VENCIDO' || l.estado === 'PARCIAL',
      );
      contratoActual = {
        ...rest,
        estadoPagoActual: actual ? (liqVencida(actual, now) ? 'VENCIDO' : actual.estado) : 'PENDIENTE',
        proximoVencimiento: pendiente?.fechaVencimiento ?? null,
      };
    }
    return { ...propiedad, contratoActual };
  });

  // Editar datos básicos de una propiedad. Antes el panel guardaba estos cambios
  // como "override" en localStorage (propiedades-overrides-storage), pero en prod
  // la lectura ignora los overrides → editar una propiedad decía "guardado" y NO
  // persistía (pérdida silenciosa). Ahora actualiza la fila real, tenant-scopeado.
  app.put('/propiedades/:id', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'propiedades.crear');
    if (!u) return;
    const { id } = request.params as { id: string };
    const parsed = z
      .object({
        direccion: z.string().trim().min(1).max(300),
        ciudad: z.string().trim().max(120),
        provincia: z.string().trim().max(120),
        tipo: z.enum(['DEPARTAMENTO', 'CASA', 'LOCAL', 'GALPON']),
        ambientes: z.number().int().nonnegative().nullable().optional(),
        m2: z.number().nonnegative().nullable().optional(),
      })
      .safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: 'Datos inválidos', detalle: parsed.error.flatten() });
    }
    const existe = await prisma.propiedad.findFirst({
      where: { id, inmobiliariaId: u.inmobiliariaId },
      select: { id: true },
    });
    if (!existe) return reply.code(404).send({ message: 'Propiedad inexistente' });
    const b = parsed.data;
    const propiedad = await prisma.propiedad.update({
      where: { id },
      data: {
        direccion: b.direccion,
        ciudad: b.ciudad,
        provincia: b.provincia,
        tipo: b.tipo,
        ambientes: b.ambientes ?? null,
        m2: b.m2 ?? null,
      },
    });
    return propiedad;
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
    // include participaciones (vacío en un alta nueva) para que la respuesta
    // matchee el tipo PropietarioApi del cliente, que las espera presentes.
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
      include: { participaciones: true },
    });
  });

  // Editar los datos básicos de un propietario. Antes el panel guardaba esto en
  // localStorage (guardarOverride) → el toast decía "actualizado" pero al recargar
  // (datos del API) el cambio se perdía: "no me deja editar". Ahora persiste de verdad.
  app.put('/propietarios/:id', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'propietarios.crear');
    if (!u) return;
    const { id } = request.params as { id: string };
    const prop = await prisma.propietario.findFirst({ where: { id, inmobiliariaId: u.inmobiliariaId } });
    if (!prop) return reply.code(404).send({ message: 'Propietario inexistente' });
    const body = z
      .object({
        nombre: z.string().trim().min(2),
        apellido: z.string().trim().min(1),
        email: z.string().trim().email().optional().or(z.literal('')),
        telefono: z.string().trim().optional(),
        cuit: z.string().trim().optional(),
        cbuAlias: z.string().trim().optional().nullable(),
        comisionPct: z.number().min(0).max(100).optional(),
        notas: z.string().optional().nullable(),
      })
      .safeParse(request.body ?? {});
    if (!body.success) return reply.code(400).send({ message: 'Datos del propietario incompletos' });
    const d = body.data;
    return prisma.propietario.update({
      where: { id },
      data: {
        nombre: d.nombre,
        apellido: d.apellido,
        cuit: d.cuit ?? '',
        email: d.email ?? '',
        telefono: d.telefono ?? '',
        cbuAlias: d.cbuAlias || null,
        ...(d.comisionPct != null ? { comisionPct: d.comisionPct } : {}),
        notas: d.notas || null,
      },
      include: { participaciones: true },
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

  // Eliminar un propietario. Igual que propiedades: solo si no tiene historial
  // (no está en ninguna propiedad, sin rendiciones, sin contrato de cobranza
  // directa). Pensado para limpiar altas duplicadas; los reales se preservan.
  app.delete('/propietarios/:id', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'propietarios.crear');
    if (!u) return;
    // H-1: la capacidad 'propietarios.crear' incluye CARGA, pero eliminar requiere
    // al menos OPERADOR (impacto mayor que cargar).
    if (u.rol === 'CARGA') return reply.code(403).send({ message: 'Solo un Admin u Operador puede eliminar propietarios' });
    const { id } = request.params as { id: string };
    const prop = await prisma.propietario.findFirst({ where: { id, inmobiliariaId: u.inmobiliariaId } });
    if (!prop) return reply.code(404).send({ message: 'Propietario inexistente' });
    const [participaciones, rendiciones, contratos] = await Promise.all([
      prisma.participacionPropietario.count({ where: { propietarioId: id } }),
      prisma.rendicion.count({ where: { propietarioId: id } }),
      prisma.contrato.count({ where: { cobraDirectoPropietarioId: id } }),
    ]);
    if (participaciones + rendiciones + contratos > 0) {
      return reply.code(409).send({
        message: 'Este propietario está asociado a propiedades, contratos o rendiciones y no se puede eliminar.',
      });
    }
    await prisma.$transaction([
      prisma.cuentaCobranzaDirecta.deleteMany({ where: { propietarioId: id } }),
      // El propietario puede tener ArcaConfig (relación 1:1). Sin borrarla, el
      // delete tiraba 500 por violación de FK.
      prisma.arcaConfig.deleteMany({ where: { propietarioId: id } }),
      prisma.propietario.delete({ where: { id } }),
    ]);
    return { ok: true };
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
          .array(z.object({ propietarioId: z.string(), porcentaje: z.number().positive().max(100) }))
          .min(1),
      })
      .safeParse(request.body ?? {});
    if (!body.success) return reply.code(400).send({ message: 'Datos de la propiedad incompletos' });
    const d = body.data;
    // B1: mismo propietario duplicado en el array → P2002 en createMany → 500
    const idsUnicos = [...new Set(d.propietarios.map((p) => p.propietarioId))];
    if (idsUnicos.length !== d.propietarios.length) {
      return reply.code(400).send({ message: 'El mismo propietario aparece más de una vez en la división' });
    }
    if (Math.round(d.propietarios.reduce((a, p) => a + p.porcentaje, 0)) !== 100) {
      return reply.code(400).send({ message: 'Los porcentajes de los propietarios deben sumar 100' });
    }
    const ids = idsUnicos;
    const existen = await prisma.propietario.count({ where: { id: { in: ids }, inmobiliariaId: u.inmobiliariaId } });
    if (existen !== ids.length) return reply.code(400).send({ message: 'Algún propietario no existe' });
    const creada = await prisma.$transaction(async (tx) => {
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
      // Devolvemos la propiedad CON sus participaciones: el cliente (mapPropiedad)
      // hace p.participaciones.map(...) y, sin esto, crasheaba con "reading 'map'"
      // DESPUÉS de crearla → falso error + recargas duplicadas.
      return { ...prop, participaciones: d.propietarios };
    });
    // Auditoría: sin esto, crear propiedades no dejaba rastro y el timeline sólo
    // mostraba pagos. Best-effort (no rompe el alta).
    await registrarEvento({
      inmobiliariaId: u.inmobiliariaId,
      tipo: 'PROPIEDAD_CARGADA',
      autorId: u.userId,
      rolAutor: u.rol,
      entidadId: creada.id,
      entidadDescripcion: `${creada.direccion}${creada.ciudad ? ` · ${creada.ciudad}` : ''}`,
    });
    return creada;
  });

  // Eliminar una propiedad. Pensado para limpiar altas DUPLICADAS: solo permite
  // borrar propiedades SIN contrato activo y SIN historial (contratos, reclamos
  // o movimientos de caja). Las que tienen historial no se borran — se preservan.
  app.delete('/propiedades/:id', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'propiedades.crear');
    if (!u) return;
    // H-1: mismo razonamiento que DELETE /propietarios.
    if (u.rol === 'CARGA') return reply.code(403).send({ message: 'Solo un Admin u Operador puede eliminar propiedades' });
    const { id } = request.params as { id: string };
    const prop = await prisma.propiedad.findFirst({ where: { id, inmobiliariaId: u.inmobiliariaId } });
    if (!prop) return reply.code(404).send({ message: 'Propiedad inexistente' });
    if (prop.contratoActualId) {
      return reply.code(409).send({ message: 'No podés eliminar una propiedad con un contrato activo. Finalizá el contrato primero.' });
    }
    const [contratos, reclamos, movimientos] = await Promise.all([
      prisma.contrato.count({ where: { propiedadId: id } }),
      prisma.reclamo.count({ where: { propiedadId: id } }),
      prisma.movimientoCaja.count({ where: { propiedadId: id } }),
    ]);
    if (contratos + reclamos + movimientos > 0) {
      return reply.code(409).send({
        message: 'Esta propiedad tiene historial (contratos, reclamos o caja) y no se puede eliminar.',
      });
    }
    await prisma.$transaction([
      prisma.participacionPropietario.deleteMany({ where: { propiedadId: id } }),
      prisma.servicioPublico.deleteMany({ where: { propiedadId: id } }),
      prisma.inquilinoInvitado.deleteMany({ where: { propiedadId: id } }),
      prisma.propiedad.delete({ where: { id } }),
    ]);
    return { ok: true };
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
        // coerce.date rechaza strings que no son fecha — antes new Date('xxx')
        // producía Invalid Date, que Prisma aceptaba y guardaba como null/epoch.
        fechaInicio: z.coerce.date(),
        fechaFin: z.coerce.date(),
        diaPago: z.number().int().min(1).max(31),
        indiceAjuste: z.enum(['ICL', 'IPC', 'CASA_PROPIA', 'UVA', 'CAC', 'RIPTE', 'FIJO']),
        frecuenciaAjusteMeses: z.number().int().positive(),
        montoExpensas: z.number().positive().optional(),
        tipoContrato: z.enum(['ALQUILER', 'SOLO_EXPENSAS', 'ALQUILER_Y_EXPENSAS']).default('ALQUILER'),
        depositoGarantia: z.number().positive().optional(),
        modoCobranza: z.enum(['INMOBILIARIA', 'PROPIETARIO_DIRECTO']).default('INMOBILIARIA'),
        // Comisión de la inmobiliaria para ESTE contrato (%). Opcional: si no se
        // manda queda null y se usa el default del negocio en las rendiciones.
        comisionInmobiliaria: z.number().min(0).max(100).optional(),
      })
      .safeParse(request.body ?? {});
    if (!body.success) return reply.code(400).send({ message: 'Datos del contrato incompletos' });
    const d = body.data;
    if (d.fechaFin <= d.fechaInicio) {
      return reply.code(400).send({ message: 'La fecha de fin tiene que ser posterior a la fecha de inicio' });
    }
    // monto 0 solo tiene sentido en SOLO_EXPENSAS; con ALQUILER las liquidaciones
    // nunca llegarían a PAGADO (montoTotal 0) y el inquilino quedaría "debiendo $0".
    if (d.monto === 0 && d.tipoContrato !== 'SOLO_EXPENSAS') {
      return reply.code(400).send({ message: 'El monto del alquiler tiene que ser mayor a cero' });
    }
    if ((d.tipoContrato === 'ALQUILER_Y_EXPENSAS' || d.tipoContrato === 'SOLO_EXPENSAS') && !d.montoExpensas) {
      return reply.code(400).send({ message: 'Este tipo de contrato requiere el monto de expensas' });
    }
    // CARGA carga contratos para REVISIÓN (permisos.ts: contratos.crear con
    // rolesAprobacion incluye CARGA): NO se activan solos. ADMIN/OPERADOR activan directo.
    const esCarga = u.rol === 'CARGA';
    const prop = await prisma.propiedad.findFirst({ where: { id: d.propiedadId, inmobiliariaId: u.inmobiliariaId } });
    if (!prop) return reply.code(404).send({ message: 'Propiedad inexistente' });
    if (prop.contratoActualId) return reply.code(409).send({ message: 'La propiedad ya tiene un contrato activo' });
    // Email del inquilino único por inmobiliaria (@@unique([inmobiliariaId,email])).
    // Lo chequeamos acá para devolver un 409 claro en vez de un 500 por violación
    // de constraint.
    const emailInq = d.inquilino.email ? d.inquilino.email.toLowerCase() : null;
    if (emailInq) {
      const yaInq = await prisma.inquilino.findFirst({ where: { inmobiliariaId: u.inmobiliariaId, email: emailInq } });
      if (yaInq) return reply.code(409).send({ message: 'Ya tenés un inquilino con ese email en tu cartera' });
    }
    // Modo cobranza directa: el contrato apunta al dueño PRINCIPAL (mayor
    // participación). Si la propiedad no tiene dueños cargados, rechazamos acá:
    // si no, el inquilino quedaría sin cuenta real a la cual transferir y /mi-
    // contrato caería silenciosamente al modo inmobiliaria.
    let cobraDirectoPropietarioId: string | null = null;
    if (d.modoCobranza === 'PROPIETARIO_DIRECTO') {
      const part = await prisma.participacionPropietario.findFirst({
        where: { propiedadId: prop.id },
        orderBy: { porcentaje: 'desc' },
      });
      if (!part) {
        return reply.code(400).send({
          message: 'La propiedad necesita dueños cargados para usar cobranza directa al propietario',
        });
      }
      cobraDirectoPropietarioId = part.propietarioId;
    }
    try {
      const contratoCreado = await prisma.$transaction(async (tx) => {
      const inq = await tx.inquilino.create({
        data: {
          inmobiliariaId: u.inmobiliariaId,
          nombre: d.inquilino.nombre,
          apellido: d.inquilino.apellido || null,
          // Normalizado a minúsculas: el login por OTP busca el email en minúsculas.
          email: emailInq,
          telefono: d.inquilino.telefono || null,
          dni: d.inquilino.dni || null,
          esInvitado: false,
        },
      });
      const contrato = await tx.contrato.create({
        data: {
          inmobiliariaId: u.inmobiliariaId,
          propiedadId: prop.id,
          estado: esCarga ? 'BORRADOR' : 'ACTIVO',
          pendienteAprobacion: esCarga,
          monto: d.monto,
          moneda: d.moneda,
          fechaInicio: d.fechaInicio,
          fechaFin: d.fechaFin,
          diaPago: d.diaPago,
          indiceAjuste: d.indiceAjuste,
          frecuenciaAjusteMeses: d.frecuenciaAjusteMeses,
          montoExpensas: d.montoExpensas ?? null,
          tipoContrato: d.tipoContrato,
          depositoGarantia: d.depositoGarantia ?? null,
          comisionInmobiliaria: d.comisionInmobiliaria ?? null,
          modoCobranza: d.modoCobranza,
          cobraDirectoPropietarioId,
          cargadoPor: u.userId,
          cargadoRol: u.rol,
          cargadoAt: new Date(),
        },
      });
      await tx.inquilino.update({ where: { id: inq.id }, data: { contratoId: contrato.id } });
      if (esCarga) {
        // BORRADOR: NO se reclama la propiedad ni se devengan liquidaciones hasta
        // que un ADMIN/OPERADOR apruebe. Creamos la Aprobacion que aparece en la
        // bandeja; la activación + claim + devengado ocurren al aprobar (plata.ts).
        await tx.aprobacion.create({
          data: {
            inmobiliariaId: u.inmobiliariaId,
            tipo: 'CONTRATO_CARGADO',
            titulo: `${d.inquilino.nombre} · ${prop.direccion}`,
            descripcion: `Contrato cargado para revisión (${d.tipoContrato}).`,
            entidadId: contrato.id,
            cargadoPorId: u.userId,
            rolAutor: 'CARGA',
            cargadoAt: new Date(),
          },
        });
        return contrato;
      }
      // ADMIN/OPERADOR: activa directo. Claim ATÓMICO de la propiedad: el WHERE
      // contratoActualId=null garantiza que si otra request concurrente ya activó
      // un contrato, count=0 → abortamos (cierra la carrera de doble alta).
      const claim = await tx.propiedad.updateMany({
        where: { id: prop.id, contratoActualId: null },
        data: { contratoActualId: contrato.id, estado: 'ALQUILADA' },
      });
      if (claim.count === 0) throw new Error('PROP_OCUPADA');
      // Devengar las liquidaciones del contrato (cargos mensuales). Sin esto
      // el inquilino no tendría nada para pagar al activar el contrato.
      await generarLiquidacionesContrato(tx, contrato);
      return contrato;
      });
      // Mail de onboarding al inquilino: solo contratos ACTIVOS (no BORRADOR de
      // CARGA) y con email. Best-effort: si el SMTP falla, NO rompemos el alta.
      if (emailInq && !esCarga) {
        try {
          const inmo = await prisma.inmobiliaria.findUnique({
            where: { id: u.inmobiliariaId },
            select: {
              nombre: true,
              email: true,
              telefono: true,
              direccionCalle: true,
              direccionAltura: true,
              direccionCiudad: true,
              direccionProvincia: true,
            },
          });
          const direccionInmo = inmo
            ? [
                `${inmo.direccionCalle} ${inmo.direccionAltura}`.trim(),
                inmo.direccionCiudad,
                inmo.direccionProvincia,
              ]
                .filter((p) => p && p.trim())
                .join(', ')
            : null;
          const enviado = await enviarInvitacionInquilino({
            email: emailInq,
            inquilinoNombre: d.inquilino.nombre,
            inmobiliaria: {
              nombre: inmo?.nombre ?? 'Tu inmobiliaria',
              telefono: inmo?.telefono ?? null,
              email: inmo?.email ?? null,
              direccion: direccionInmo || null,
            },
            propiedadDireccion: prop.direccion,
          });
          if (enviado) request.log.info({ email: emailInq }, 'Invitación de inquilino enviada');
          else request.log.info({ email: emailInq }, 'Invitación de inquilino: SMTP no configurado');
        } catch (err) {
          request.log.error(
            { email: emailInq, err: (err as Error).message },
            'Invitación de inquilino: fallo el envío',
          );
        }
      }
      // Auditoría: crear un contrato ahora deja rastro en el timeline (antes solo
      // aparecían pagos). Best-effort. CARGA lo deja BORRADOR para aprobar; ADMIN/
      // OPERADOR lo activan directo — en ambos casos queda registrado el alta.
      await registrarEvento({
        inmobiliariaId: u.inmobiliariaId,
        tipo: 'CONTRATO_CARGADO',
        autorId: u.userId,
        rolAutor: u.rol,
        entidadId: contratoCreado.id,
        entidadDescripcion: `${d.inquilino.nombre} · ${prop.direccion}`,
      });
      return contratoCreado;
    } catch (e) {
      if (e instanceof Error && e.message === 'PROP_OCUPADA') {
        return reply.code(409).send({ message: 'La propiedad ya tiene un contrato activo' });
      }
      // Carrera de email duplicado: dos altas concurrentes con el mismo email
      // pasan el pre-check y la 2da viola @@unique([inmobiliariaId,email]) → P2002.
      // Lo convertimos en un 409 claro en vez de un 500.
      if (e && typeof e === 'object' && (e as { code?: string }).code === 'P2002') {
        return reply.code(409).send({ message: 'Ya tenés un inquilino con ese email en tu cartera' });
      }
      throw e;
    }
  });

  // Reenviar el email de bienvenida/onboarding al inquilino TITULAR del contrato,
  // a demanda desde el panel (botón "Reenviar email de bienvenida"). Es el MISMO
  // email enriquecido que se envía al crear el contrato — 100% backend, no un
  // preview simulado. Devuelve 400 si el inquilino no tiene email cargado y 503
  // si el SMTP no está configurado.
  app.post('/contratos/:id/reenviar-bienvenida', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'contratos.crear');
    if (!u) return;
    const { id } = request.params as { id: string };
    const contrato = await prisma.contrato.findFirst({
      where: { id, inmobiliariaId: u.inmobiliariaId },
      select: {
        propiedad: { select: { direccion: true } },
        inquilinoTitular: { select: { nombre: true, email: true } },
        inmobiliaria: {
          select: {
            nombre: true,
            email: true,
            telefono: true,
            direccionCalle: true,
            direccionAltura: true,
            direccionCiudad: true,
            direccionProvincia: true,
          },
        },
      },
    });
    if (!contrato) return reply.code(404).send({ message: 'Contrato inexistente' });
    const inq = contrato.inquilinoTitular;
    if (!inq?.email) {
      return reply.code(400).send({
        message: 'El inquilino no tiene un email cargado — no hay a dónde enviar la bienvenida.',
      });
    }
    const inmo = contrato.inmobiliaria;
    const direccionInmo = inmo
      ? [
          `${inmo.direccionCalle} ${inmo.direccionAltura}`.trim(),
          inmo.direccionCiudad,
          inmo.direccionProvincia,
        ]
          .filter((p) => p && p.trim())
          .join(', ')
      : null;
    const enviado = await enviarInvitacionInquilino({
      email: inq.email,
      inquilinoNombre: inq.nombre,
      inmobiliaria: {
        nombre: inmo?.nombre ?? 'Tu inmobiliaria',
        telefono: inmo?.telefono ?? null,
        email: inmo?.email ?? null,
        direccion: direccionInmo || null,
      },
      propiedadDireccion: contrato.propiedad?.direccion ?? null,
    });
    if (!enviado) {
      return reply.code(503).send({
        message: 'El envío de emails no está configurado en este momento. Probá más tarde.',
      });
    }
    request.log.info({ email: inq.email, contratoId: id }, 'Bienvenida de inquilino reenviada');
    return { enviado: true, email: inq.email };
  });

  // Finalizar un contrato: lo marca FINALIZADO y LIBERA la propiedad (vuelve a
  // DISPONIBLE, contratoActualId=null) + desvincula al inquilino titular. Sin
  // esto, una propiedad quedaba ALQUILADA para siempre y no se le podía cargar
  // un contrato nuevo cuando el anterior vencía.
  app.post('/contratos/:id/finalizar', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'contratos.crear');
    if (!u) return;
    // Finalizar es irreversible (libera la propiedad + desvincula al inquilino).
    // contratos.crear incluye CARGA, pero CARGA solo carga para aprobación → no
    // debería poder finalizar. Mismo guard que DELETE /propietarios y /propiedades.
    if (u.rol === 'CARGA') return reply.code(403).send({ message: 'Solo un Admin u Operador puede finalizar contratos' });
    const { id } = request.params as { id: string };
    const contrato = await prisma.contrato.findFirst({ where: { id, inmobiliariaId: u.inmobiliariaId } });
    if (!contrato) return reply.code(404).send({ message: 'Contrato inexistente' });
    if (contrato.estado === 'FINALIZADO' || contrato.estado === 'RESCINDIDO') {
      return reply.code(409).send({ message: 'El contrato ya está finalizado' });
    }
    // Un BORRADOR (cargado, pendiente de aprobación) no se finaliza: hay que
    // rechazar la aprobación. Permitirlo dejaba un contrato finalizable que una
    // aprobación pendiente podía después revivir a ACTIVO.
    if (contrato.estado === 'BORRADOR') {
      return reply.code(409).send({ message: 'Un contrato en borrador no se finaliza; rechazá la aprobación.' });
    }
    // Lock atómico: el updateMany condicionado por estado evita la doble
    // finalización concurrente (sólo la primera gana; la segunda da count 0 → 409).
    const fin = await prisma.$transaction(async (tx) => {
      const upd = await tx.contrato.updateMany({
        where: { id, inmobiliariaId: u.inmobiliariaId, estado: { notIn: ['FINALIZADO', 'RESCINDIDO', 'BORRADOR'] } },
        data: { estado: 'FINALIZADO' },
      });
      if (upd.count === 0) return false;
      await tx.propiedad.updateMany({
        where: { id: contrato.propiedadId, contratoActualId: id },
        data: { contratoActualId: null, estado: 'DISPONIBLE' },
      });
      await tx.inquilino.updateMany({ where: { contratoId: id }, data: { contratoId: null } });
      return true;
    });
    if (!fin) return reply.code(409).send({ message: 'El contrato ya está finalizado' });
    return { ok: true };
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
    if (u.rol !== 'ADMIN') return reply.code(403).send({ message: 'Necesitás permiso de Admin para ver esta sección' });
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
        email: z.string().trim().email('Email inválido').optional(),
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
    if (u.rol !== 'ADMIN') return reply.code(403).send({ message: 'Necesitás permiso de Admin para ver esta sección' });
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

  // ===== Configuración: Mercado y país de operación =====
  // País / moneda / índice de ajuste default. Antes vivía SOLO en localStorage
  // (lib/paises) → no persistía por inmobiliaria ni impactaba nada. Ahora se
  // guarda en la inmobiliaria y el wizard de contratos lo usa como default.
  // LECTURA: cualquier usuario autenticado de la inmobiliaria (scoped por
  // inmobiliariaId del JWT). El wizard de contratos —usado por OPERADOR y CARGA,
  // no solo ADMIN— necesita leer el índice/moneda default. ESCRITURA: solo ADMIN.
  app.get('/mercado', async (request, reply) => {
    const u = await requireUsuario(request, reply);
    if (!u) return;
    const i = await prisma.inmobiliaria.findUnique({ where: { id: u.inmobiliariaId } });
    if (!i) return reply.code(404).send({ message: 'Inmobiliaria inexistente' });
    return {
      codigo: i.paisCodigo,
      moneda: i.monedaDefault,
      indiceDefault: i.indiceDefaultContrato,
    };
  });

  // Monedas válidas por país (la default del país + USD) — espeja el front
  // (monedasPosibles = [pais.monedaDefault, 'USD']).
  const MONEDAS_POR_PAIS: Record<string, string[]> = {
    AR: ['ARS', 'USD'],
    UY: ['UYU', 'USD'],
    BR: ['BRL', 'USD'],
    PY: ['PYG', 'USD'],
  };

  app.put('/mercado', async (request, reply) => {
    const u = await requireUsuario(request, reply);
    if (!u) return;
    if (u.rol !== 'ADMIN') return reply.code(403).send({ message: 'Solo un Admin puede editar la configuración de mercado' });
    const body = z
      .object({
        codigo: z.enum(['AR', 'UY', 'BR', 'PY']),
        moneda: z.enum(['ARS', 'USD', 'UYU', 'BRL', 'PYG']),
        // Mismo enum que POST /contratos: un índice fuera de esta lista lo
        // ignoraría el wizard (no-op silencioso). Hoy AR-céntrico (único país
        // activo); al abrir UY/BR/PY se extiende junto con el enum del contrato.
        indiceDefault: z.enum(['ICL', 'IPC', 'CASA_PROPIA', 'UVA', 'CAC', 'RIPTE', 'FIJO']),
      })
      .safeParse(request.body ?? {});
    if (!body.success) return reply.code(400).send({ message: body.error.issues[0]?.message ?? 'Configuración de mercado inválida' });
    // Cruce país↔moneda: evita tuplas imposibles (ej. AR con PYG).
    const monedasOk = MONEDAS_POR_PAIS[body.data.codigo] ?? ['USD'];
    if (!monedasOk.includes(body.data.moneda)) {
      return reply.code(400).send({ message: `La moneda ${body.data.moneda} no corresponde al país ${body.data.codigo}` });
    }
    const existe = await prisma.inmobiliaria.findUnique({ where: { id: u.inmobiliariaId }, select: { id: true } });
    if (!existe) return reply.code(404).send({ message: 'Inmobiliaria inexistente' });
    await prisma.inmobiliaria.update({
      where: { id: u.inmobiliariaId },
      data: {
        paisCodigo: body.data.codigo,
        monedaDefault: body.data.moneda,
        indiceDefaultContrato: body.data.indiceDefault,
      },
    });
    return { ok: true };
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
    if (u.rol !== 'ADMIN') return reply.code(403).send({ message: 'Necesitás permiso de Admin para ver esta sección' });
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
    const data = {
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
      activa: true,
    };
    try {
      return await prisma.sociedad.create({ data: { ...data, esPrincipal: !tienePrincipal } });
    } catch (e) {
      // Carrera: otra request creó la principal entre el findFirst y el create. El
      // índice parcial único (una sola principal-activa por inmobiliaria) la corta
      // con P2002 → reintentamos como NO principal (ya hay una principal).
      if (e && typeof e === 'object' && (e as { code?: string }).code === 'P2002' && !tienePrincipal) {
        return await prisma.sociedad.create({ data: { ...data, esPrincipal: false } });
      }
      throw e;
    }
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
    // Baja dentro de una tx Serializable: el count va DESPUÉS del update y si queda
    // 0 activas se hace rollback. Antes el count-then-update permitía que dos bajas
    // concurrentes de sociedades distintas pasaran ambas el chequeo y dejaran la
    // inmobiliaria sin ninguna sociedad activa. Mismo patrón que PUT/DELETE /usuarios.
    try {
      await prisma.$transaction(
        async (tx) => {
          await tx.sociedad.update({ where: { id }, data: { activa: false, esPrincipal: false } });
          const activas = await tx.sociedad.count({ where: { inmobiliariaId: u.inmobiliariaId, activa: true } });
          if (activas === 0) throw new Error('ULTIMA_ACTIVA');
          // Si la dada de baja era la principal, promovemos otra activa.
          if (soc.esPrincipal) {
            const siguiente = await tx.sociedad.findFirst({
              where: { inmobiliariaId: u.inmobiliariaId, activa: true },
              orderBy: { createdAt: 'asc' },
            });
            if (siguiente) await tx.sociedad.update({ where: { id: siguiente.id }, data: { esPrincipal: true } });
          }
        },
        { isolationLevel: 'Serializable' },
      );
    } catch (e) {
      if (e instanceof Error && e.message === 'ULTIMA_ACTIVA') {
        return reply.code(409).send({ message: 'No podés dar de baja la única sociedad activa' });
      }
      throw e;
    }
    return { ok: true };
  });

  // ===== Configuración: equipo y permisos (usuarios del panel) =====
  // Antes el tab Equipo era 100% mock (equipoInicial hardcoded). Ahora persiste
  // en la tabla Usuario. Guardas para no dejar la inmobiliaria sin ningún Admin.
  const rolEnum = z.enum(['ADMIN', 'OPERADOR', 'CARGA', 'LECTURA']);

  app.get('/usuarios', async (request, reply) => {
    const u = await requireUsuario(request, reply);
    if (!u) return;
    if (u.rol !== 'ADMIN') return reply.code(403).send({ message: 'Necesitás permiso de Admin para ver el equipo' });
    const rows = await prisma.usuario.findMany({
      where: { inmobiliariaId: u.inmobiliariaId },
      select: { id: true, nombre: true, apellido: true, email: true, rol: true, activo: true, createdAt: true },
      orderBy: [{ activo: 'desc' }, { createdAt: 'asc' }],
    });
    return rows.map((r) => ({ ...r, esVos: r.id === u.userId }));
  });

  app.post('/usuarios', async (request, reply) => {
    const u = await requireUsuario(request, reply);
    if (!u) return;
    if (u.rol !== 'ADMIN') return reply.code(403).send({ message: 'Solo un Admin puede sumar gente al equipo' });
    const body = z
      .object({
        nombre: z.string().trim().min(2, 'Indicá el nombre'),
        apellido: z.string().trim().min(1, 'Indicá el apellido'),
        email: z.string().trim().email('Email inválido'),
        rol: rolEnum,
        // Password OPCIONAL: el panel entra por OTP (código al email), no por
        // contraseña. Al invitar alguien no hace falta inventarle una: entra con su
        // email + el código que le llega. Si se manda una, se guarda igual.
        password: z.string().min(6, 'La contraseña tiene que tener al menos 6 caracteres').optional(),
      })
      .safeParse(request.body ?? {});
    if (!body.success) return reply.code(400).send({ message: body.error.issues[0]?.message ?? 'Datos inválidos' });
    const email = body.data.email.toLowerCase();
    const yaExiste = await prisma.usuario.findFirst({ where: { email } });
    if (yaExiste) {
      // B5: si fue dado de baja lógica (activo=false) en ESTA inmobiliaria, lo
      // reactivamos con los nuevos datos en lugar de bloquear el email para siempre.
      if (!yaExiste.activo && yaExiste.inmobiliariaId === u.inmobiliariaId) {
        const reactivado = await prisma.usuario.update({
          where: { id: yaExiste.id },
          data: {
            nombre: body.data.nombre,
            apellido: body.data.apellido,
            rol: body.data.rol,
            ...(body.data.password ? { passwordHash: bcrypt.hashSync(body.data.password, 10) } : {}),
            activo: true,
          },
          select: { id: true, nombre: true, apellido: true, email: true, rol: true, activo: true },
        });
        return reply.code(200).send({ ...reactivado, esVos: false });
      }
      return reply.code(409).send({ message: 'Ya existe una cuenta con ese email' });
    }
    const creado = await prisma.usuario.create({
      data: {
        inmobiliariaId: u.inmobiliariaId,
        nombre: body.data.nombre,
        apellido: body.data.apellido,
        email,
        rol: body.data.rol,
        ...(body.data.password ? { passwordHash: bcrypt.hashSync(body.data.password, 10) } : {}),
        activo: true,
      },
      select: { id: true, nombre: true, apellido: true, email: true, rol: true, activo: true },
    });
    await registrarEvento({
      inmobiliariaId: u.inmobiliariaId,
      tipo: 'EQUIPO_INVITADO',
      autorId: u.userId,
      rolAutor: u.rol,
      entidadId: creado.id,
      entidadDescripcion: `${creado.nombre} ${creado.apellido} (${creado.rol}) · ${creado.email}`,
    });
    // Email de invitación (best-effort): le avisamos que puede entrar con su email
    // (el código le llega al ingresar). Si el SMTP no está, no rompe el alta.
    try {
      const inmo = await prisma.inmobiliaria.findUnique({
        where: { id: u.inmobiliariaId },
        select: { nombre: true },
      });
      await enviarInvitacionEquipo({
        email: creado.email,
        nombre: creado.nombre,
        rol: creado.rol,
        inmobiliariaNombre: inmo?.nombre ?? 'la inmobiliaria',
      });
    } catch (e) {
      request.log.error({ err: (e as Error).message }, 'Invitación de equipo: fallo el email');
    }
    return reply.code(201).send({ ...creado, esVos: false });
  });

  app.put('/usuarios/:id', async (request, reply) => {
    const u = await requireUsuario(request, reply);
    if (!u) return;
    if (u.rol !== 'ADMIN') return reply.code(403).send({ message: 'Solo un Admin puede cambiar roles' });
    const { id } = request.params as { id: string };
    const target = await prisma.usuario.findFirst({ where: { id, inmobiliariaId: u.inmobiliariaId } });
    if (!target) return reply.code(404).send({ message: 'Usuario inexistente' });
    const body = z
      .object({ rol: rolEnum.optional(), nombre: z.string().trim().min(2).optional(), apellido: z.string().trim().min(1).optional() })
      .safeParse(request.body ?? {});
    if (!body.success) return reply.code(400).send({ message: 'Datos inválidos' });
    // Atómico: aplicamos el cambio y verificamos que quede ≥1 Admin activo
    // DENTRO de la misma transacción serializable. Cubre la carrera de dos
    // admins degradándose en simultáneo (que un pre-chequeo no atómico no ve).
    try {
      return await prisma.$transaction(
        async (tx) => {
          const r = await tx.usuario.update({
            where: { id },
            data: body.data,
            select: { id: true, nombre: true, apellido: true, email: true, rol: true, activo: true },
          });
          const admins = await tx.usuario.count({ where: { inmobiliariaId: u.inmobiliariaId, rol: 'ADMIN', activo: true } });
          if (admins === 0) throw new Error('SIN_ADMIN');
          return r;
        },
        { isolationLevel: 'Serializable' as Prisma.TransactionIsolationLevel },
      );
    } catch (e) {
      if (e instanceof Error && e.message === 'SIN_ADMIN') {
        return reply.code(409).send({ message: 'Tiene que quedar al menos un Admin activo' });
      }
      throw e;
    }
  });

  app.delete('/usuarios/:id', async (request, reply) => {
    const u = await requireUsuario(request, reply);
    if (!u) return;
    if (u.rol !== 'ADMIN') return reply.code(403).send({ message: 'Solo un Admin puede quitar gente del equipo' });
    const { id } = request.params as { id: string };
    if (id === u.userId) return reply.code(409).send({ message: 'No podés quitarte a vos mismo' });
    const target = await prisma.usuario.findFirst({ where: { id, inmobiliariaId: u.inmobiliariaId } });
    if (!target) return reply.code(404).send({ message: 'Usuario inexistente' });
    // Atómico (ver PUT /usuarios/:id): baja + verificación de ≥1 Admin activo
    // en la misma transacción serializable.
    try {
      await prisma.$transaction(
        async (tx) => {
          await tx.usuario.update({ where: { id }, data: { activo: false } });
          const admins = await tx.usuario.count({ where: { inmobiliariaId: u.inmobiliariaId, rol: 'ADMIN', activo: true } });
          if (admins === 0) throw new Error('SIN_ADMIN');
        },
        { isolationLevel: 'Serializable' as Prisma.TransactionIsolationLevel },
      );
    } catch (e) {
      if (e instanceof Error && e.message === 'SIN_ADMIN') {
        return reply.code(409).send({ message: 'Tiene que quedar al menos un Admin activo' });
      }
      throw e;
    }
    await registrarEvento({
      inmobiliariaId: u.inmobiliariaId,
      tipo: 'EQUIPO_REMOVIDO',
      autorId: u.userId,
      rolAutor: u.rol,
      entidadId: id,
      entidadDescripcion: `${target.nombre} ${target.apellido} (${target.rol}) · ${target.email}`,
    });
    return { ok: true };
  });

  // ===== Auditoría: lee el rastro de eventos (quién hizo qué). Capacidad
  // auditoria.ver (ADMIN/LECTURA). Tenant-scopeado. Lo escriben las acciones
  // sensibles vía lib/auditoria.ts. =====
  app.get('/eventos', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'auditoria.ver');
    if (!u) return;
    const q = z.object({ limit: z.coerce.number().int().min(1).max(200).default(80) }).parse(request.query ?? {});
    return prisma.eventoAuditoria.findMany({
      where: { inmobiliariaId: u.inmobiliariaId },
      include: { autor: { select: { nombre: true, apellido: true, rol: true } } },
      orderBy: { fecha: 'desc' },
      take: q.limit,
    });
  });
}
