import type { FastifyInstance, FastifyReply } from 'fastify';
import type { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireUsuario } from '../auth/guards.js';
import { verificarPinUsuario } from '../auth/pin.js';
import { registrarEvento } from '../lib/auditoria.js';
import {
  generarLiquidacionesContrato,
  sumarMesesUTC,
  periodoDe,
  recomputarLiquidacionesFuturas,
} from '../lib/liquidaciones.js';
import { conSaldo, montoPagadoPorLiquidacion } from '../lib/saldos.js';
import { calcularMora, resolverEsquemaMora } from '../lib/punitorios.js';
import { aplicarEstadoInicial, EstadoInicialInvalido } from '../lib/estado-inicial-contrato.js';
import { borrarArchivoSubido, urlEsDelTenant } from './uploads.js';
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
    // Defaults de mora del tenant (cascada contrato → inmobiliaria): una sola
    // query para toda la lista.
    const inmoMora = await prisma.inmobiliaria.findUnique({
      where: { id: u.inmobiliariaId },
      select: { moraTipoDefault: true, moraValorDefault: true },
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
    // Deuda TOTAL por contrato = suma de TODAS las liquidaciones impagas y vencidas
    // (resto de parciales + vencidas + su mora), no solo la actual. El include de
    // arriba trae 6 liqs para derivar estado; para la deuda de un contrato "en curso"
    // (cuota N de M) traemos TODAS las no-PAGADO. Misma fuente de verdad (conSaldo +
    // calcularMora) que el saldo actual y que el inquilino.
    const deudaLiqs = await prisma.liquidacion.findMany({
      where: {
        inmobiliariaId: u.inmobiliariaId,
        contratoId: { in: contratos.map((c) => c.id) },
        estado: { not: 'PAGADO' },
      },
      select: { id: true, contratoId: true, montoTotal: true, estado: true, fechaVencimiento: true, montoPunitorioManual: true },
    });
    const pagadoDeuda = await montoPagadoPorLiquidacion(deudaLiqs.map((l) => l.id));
    const deudaPorContrato = new Map<string, typeof deudaLiqs>();
    for (const l of deudaLiqs) {
      const arr = deudaPorContrato.get(l.contratoId) ?? [];
      arr.push(l);
      deudaPorContrato.set(l.contratoId, arr);
    }
    // estadoPagoActual / proximoVencimiento DERIVADOS de liquidaciones reales:
    // una vencida (incluye parcial/pendiente fuera de término) manda; si no, la más
    // reciente; sin liqs → PENDIENTE. proximoVencimiento incluye PARCIAL (B6).
    return contratos.map(({ liquidaciones, ...c }, i) => {
      const actual = actualPorContrato[i];
      const pendiente = liquidaciones.find(
        (l) => l.estado === 'PENDIENTE' || l.estado === 'VENCIDO' || l.estado === 'PARCIAL',
      );
      // Mora del período actual según el esquema efectivo del contrato: sin esto
      // el saldo del listado (KPI morosos) ignoraba el punitorio que el detalle
      // y el inquilino SÍ cobran. PAGADA congela en fechaPago; manual pisa.
      const esquema = resolverEsquemaMora(c, inmoMora);
      const punitorioActual = actual
        ? calcularMora(
            Number(actual.montoTotal),
            esquema,
            actual.fechaVencimiento,
            actual.estado === 'PAGADO' && actual.fechaPago ? new Date(actual.fechaPago) : now,
            actual.montoPunitorioManual != null ? Number(actual.montoPunitorioManual) : null,
          )
        : 0;
      const saldoActual = actual ? conSaldo(actual, pagadoMap, punitorioActual) : null;
      // Deuda total: suma del saldo (con mora) de cada liquidación impaga y VENCIDA
      // del contrato. Una PENDIENTE futura no cuenta; una PARCIAL o vencida sí.
      let deudaTotal = 0;
      for (const l of deudaPorContrato.get(c.id) ?? []) {
        if (!(liqVencida(l, now) || l.estado === 'PARCIAL')) continue;
        const punit = calcularMora(
          Number(l.montoTotal),
          esquema,
          l.fechaVencimiento,
          now,
          l.montoPunitorioManual != null ? Number(l.montoPunitorioManual) : null,
        );
        deudaTotal += conSaldo(l, pagadoDeuda, punit).saldo;
      }
      deudaTotal = Math.round(deudaTotal * 100) / 100;
      return {
        ...c,
        // Deuda acumulada del contrato (todas las cuotas impagas + mora). El resumen
        // de morosidad/cobranza usa ESTO, no el alquiler mensual ni el saldo de un mes.
        deudaTotal,
        // Esquema ya resuelto (cascada) para que el panel muestre "Mora: X" con
        // su origen ("(heredada)" si viene del default de la inmobiliaria).
        moraEfectiva: { tipo: esquema.tipo, valor: esquema.valor, origen: esquema.origen },
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
    // Cada liquidación con su mora al día según el ESQUEMA EFECTIVO del contrato
    // (cascada contrato → legacy → default inmobiliaria); una PAGADA congela la
    // mora en su fechaPago y un montoPunitorioManual (migración) pisa el cálculo.
    const inmoMora = await prisma.inmobiliaria.findUnique({
      where: { id: u.inmobiliariaId },
      select: { moraTipoDefault: true, moraValorDefault: true },
    });
    const esquema = resolverEsquemaMora(rest, inmoMora);
    return {
      ...rest,
      moraEfectiva: { tipo: esquema.tipo, valor: esquema.valor, origen: esquema.origen },
      liquidaciones: liquidaciones.map((l) => {
        const asOf = l.estado === 'PAGADO' && l.fechaPago ? new Date(l.fechaPago) : now;
        const punitorio = calcularMora(
          Number(l.montoTotal),
          esquema,
          l.fechaVencimiento,
          asOf,
          l.montoPunitorioManual != null ? Number(l.montoPunitorioManual) : null,
        );
        return conSaldo(l, pagado, punitorio);
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
        // Historial completo de la propiedad: TODOS los contratos (pasados + actual)
        // con su inquilino titular, para la sección "Contratos anteriores" del detalle.
        // Nada se borra al finalizar (0 onDelete en el schema) → el histórico persiste
        // entero; acá solo lo exponemos. El front descarta el contrato vigente de esta
        // lista (ya lo muestra como contratoActual) y renderiza el resto como pasados.
        contratos: {
          orderBy: { fechaInicio: 'desc' },
          include: {
            inquilinoTitular: { select: { nombre: true, apellido: true, email: true, dni: true } },
          },
        },
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
        // Foto de /uploads del tenant. undefined = no tocar; null/'' = sacarla.
        fotoUrl: z.string().nullable().optional(),
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
    if (b.fotoUrl && !urlEsDelTenant(b.fotoUrl, u.inmobiliariaId)) {
      return reply.code(400).send({ message: 'Foto inválida' });
    }
    const propiedad = await prisma.propiedad.update({
      where: { id },
      data: {
        direccion: b.direccion,
        ciudad: b.ciudad,
        provincia: b.provincia,
        tipo: b.tipo,
        ambientes: b.ambientes ?? null,
        m2: b.m2 ?? null,
        ...(b.fotoUrl !== undefined ? { fotoUrl: b.fotoUrl || null } : {}),
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
        // Foto REAL subida a /uploads (Railway Volume) — misma mecánica que los
        // comprobantes y las fotos de reclamos.
        fotoUrl: z.string().optional(),
        propietarios: z
          .array(z.object({ propietarioId: z.string(), porcentaje: z.number().positive().max(100) }))
          .min(1),
      })
      .safeParse(request.body ?? {});
    if (!body.success) return reply.code(400).send({ message: 'Datos de la propiedad incompletos' });
    const d = body.data;
    // La foto, si viene, tiene que ser un archivo /uploads de ESTA inmobiliaria
    // (no una url externa ni de otro tenant).
    if (d.fotoUrl && !urlEsDelTenant(d.fotoUrl, u.inmobiliariaId)) {
      return reply.code(400).send({ message: 'Foto inválida' });
    }
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
          fotoUrl: d.fotoUrl ?? null,
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
        // Reuso (req 3): si viene, el inquilino nuevo se agrupa bajo una Persona EXISTENTE
        // (traer historial) en vez de crear/upsertear una. Se valida tenant-scopeado.
        personaId: z.string().optional(),
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
        // Esquema de mora del contrato ("ventanita Confirmá interés"). Omitido =>
        // hereda el default de la inmobiliaria (cascada en resolverEsquemaMora).
        moraTipo: z.enum(['SIN_MORA', 'PORCENTAJE_DIARIO', 'MONTO_FIJO', 'PORCENTAJE_MENSUAL']).optional(),
        moraValor: z.number().positive().optional(),
        // Contrato EN CURSO ("está en la cuota 7 de 12"): confirmación por
        // período YA VENCIDO — pagado fuera del sistema / parcial / adeudado,
        // con mora histórica manual opcional. Ver lib/estado-inicial-contrato.ts.
        periodosAnteriores: z
          .array(
            z.object({
              periodo: z.string().regex(/^\d{4}-\d{2}$/),
              estado: z.enum(['PAGADO', 'PARCIAL', 'ADEUDA']),
              montoPagado: z.number().positive().optional(),
              moraManual: z.number().nonnegative().optional(),
            }),
          )
          .max(120)
          .optional(),
      })
      .safeParse(request.body ?? {});
    if (!body.success) return reply.code(400).send({ message: 'Datos del contrato incompletos' });
    const d = body.data;
    if (d.moraTipo && d.moraTipo !== 'SIN_MORA' && !d.moraValor) {
      return reply.code(400).send({ message: 'Indicá el valor del interés por mora' });
    }
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
    // El BORRADOR de CARGA no devenga liquidaciones hasta la aprobación, así que
    // no hay períodos donde aplicar el estado inicial: lo rechazamos claro en vez
    // de descartarlo en silencio. (Extensión al flujo de aprobación: pendiente.)
    if (esCarga && d.periodosAnteriores?.length) {
      return reply.code(400).send({
        message: 'La carga para revisión no soporta períodos anteriores — pedile a un Admin/Operador que lo cargue',
      });
    }
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
    // Reuso (req 3): si el alta trae personaId, la Persona debe existir en ESTE tenant.
    // (El guard de email de arriba sigue aplicando: un 2º contrato reusado no puede
    // repetir el email de otra fila — se deja vacío o distinto; la identidad vive en Persona.)
    if (d.personaId) {
      const per = await prisma.persona.findFirst({
        where: { id: d.personaId, inmobiliariaId: u.inmobiliariaId },
        select: { id: true },
      });
      if (!per) return reply.code(404).send({ message: 'La persona seleccionada no existe en tu cartera' });
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
        include: { propietario: { select: { cuentaCobranza: { select: { id: true } }, nombre: true, apellido: true } } },
      });
      if (!part) {
        return reply.code(400).send({
          message: 'La propiedad necesita dueños cargados para usar cobranza directa al propietario',
        });
      }
      // Y el dueño necesita su CUENTA cargada: el checkout del inquilino solo
      // muestra la cuenta del propietario en modo directo (nunca la de la inmo);
      // sin cuenta, el contrato nacía "directo" pero el inquilino no tenía a
      // dónde transferir.
      if (!part.propietario.cuentaCobranza) {
        return reply.code(400).send({
          message: `Cargale la cuenta de cobro a ${part.propietario.nombre} ${part.propietario.apellido ?? ''}`.trim() +
            ' (CBU/alias, en su ficha) antes de crear el contrato con cobranza directa',
        });
      }
      cobraDirectoPropietarioId = part.propietarioId;
    }
    try {
      // timeout 30s (default 5s): el alta con periodosAnteriores corre varias
      // queries batcheadas contra una DB remota; el default cortaba carteras
      // largas a mitad de camino (rollback + 500). maxWait 10s por la cola de pool.
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
          // Próximo ajuste = inicio + frecuencia (month-end aware, UTC). Antes NO
          // se completaba nunca, así que el panel/PWA mostraba "—". Con esto ya
          // queda la fecha esperada del 1er reajuste (el operador la puede pisar
          // luego vía PATCH /contratos/:id/monto). NO cambia el monto del alta.
          proximoAjuste: sumarMesesUTC(d.fechaInicio, d.frecuenciaAjusteMeses),
          montoExpensas: d.montoExpensas ?? null,
          tipoContrato: d.tipoContrato,
          depositoGarantia: d.depositoGarantia ?? null,
          comisionInmobiliaria: d.comisionInmobiliaria ?? null,
          // SIN_MORA explícito guarda tipo sin valor; omitido deja ambos null
          // (hereda el default de la inmobiliaria en la lectura).
          moraTipo: d.moraTipo ?? null,
          moraValor: d.moraTipo && d.moraTipo !== 'SIN_MORA' ? (d.moraValor ?? null) : null,
          modoCobranza: d.modoCobranza,
          cobraDirectoPropietarioId,
          cargadoPor: u.userId,
          cargadoRol: u.rol,
          cargadoAt: new Date(),
        },
      });
      // Persona: identidad reutilizable del tenant para la ficha histórica del inquilino.
      // Por DNI hacemos upsert idempotente → un 2º contrato del MISMO DNI se agrupa bajo la
      // misma Persona automáticamente (base del reuso). Sin DNI, Persona nueva para este titular.
      const dniPersona = (d.inquilino.dni || '').trim() || null;
      const persona = d.personaId
        ? // Reuso explícito: agrupa bajo la Persona elegida (ya validada como del tenant).
          await tx.persona.findFirstOrThrow({ where: { id: d.personaId, inmobiliariaId: u.inmobiliariaId } })
        : dniPersona
          ? await tx.persona.upsert({
              where: { inmobiliariaId_dni: { inmobiliariaId: u.inmobiliariaId, dni: dniPersona } },
              update: {},
              create: {
                inmobiliariaId: u.inmobiliariaId,
                dni: dniPersona,
                email: emailInq,
                nombre: d.inquilino.nombre,
                apellido: d.inquilino.apellido || null,
                telefono: d.inquilino.telefono || null,
              },
            })
          : await tx.persona.create({
              data: {
                inmobiliariaId: u.inmobiliariaId,
                email: emailInq,
                nombre: d.inquilino.nombre,
                apellido: d.inquilino.apellido || null,
                telefono: d.inquilino.telefono || null,
              },
            });
      await tx.inquilino.update({ where: { id: inq.id }, data: { contratoId: contrato.id, personaId: persona.id } });
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
      // Contrato EN CURSO: aplicar la confirmación por período (pagados fuera
      // del sistema → pago sintético CONCILIADO; adeudados → mora manual). En
      // la MISMA transacción: o queda todo el estado inicial o no queda nada.
      if (d.periodosAnteriores?.length) {
        await aplicarEstadoInicial(tx, contrato, d.periodosAnteriores, u.userId);
      }
      return contrato;
      }, { timeout: 30_000, maxWait: 10_000 });
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
      // Estado inicial inconsistente (período inexistente/futuro, parcial sin
      // monto, etc.): 400 con el detalle — la transacción ya hizo rollback.
      if (e instanceof EstadoInicialInvalido) {
        return reply.code(400).send({ message: e.message });
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

  // Avatar del usuario logueado (foto de perfil en /uploads del tenant).
  // imageUrl null/'' = sacar la foto. Al reemplazar/quitar, se libera el archivo
  // anterior del Volume (best effort). Cualquier rol edita SU propia foto.
  app.put('/me/avatar', async (request, reply) => {
    const u = await requireUsuario(request, reply);
    if (!u) return;
    const body = z
      .object({ imageUrl: z.string().nullable() })
      .safeParse(request.body ?? {});
    if (!body.success) return reply.code(400).send({ message: 'Avatar inválido' });
    const nueva = body.data.imageUrl || null;
    if (nueva && !urlEsDelTenant(nueva, u.inmobiliariaId)) {
      return reply.code(400).send({ message: 'Avatar inválido' });
    }
    const actual = await prisma.usuario.findUnique({ where: { id: u.userId }, select: { imageUrl: true } });
    await prisma.usuario.update({ where: { id: u.userId }, data: { imageUrl: nueva } });
    if (actual?.imageUrl && actual.imageUrl !== nueva) {
      await borrarArchivoSubido(actual.imageUrl, u.inmobiliariaId);
    }
    return { imageUrl: nueva };
  });

  // Editar el esquema de mora de un contrato existente. `tipo: null` = volver a
  // heredar el default de la inmobiliaria (limpia también la tasa legacy, que si
  // no la cascada la seguiría prefiriendo). Afecta las liquidaciones IMPAGAS
  // on-read; las PAGADAS ya congelaron su mora en fechaPago y los overrides
  // manuales (migración) se conservan.
  app.put('/contratos/:id/mora', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'contratos.crear');
    if (!u) return;
    const { id } = request.params as { id: string };
    const body = z
      .object({
        tipo: z.enum(['SIN_MORA', 'PORCENTAJE_DIARIO', 'MONTO_FIJO', 'PORCENTAJE_MENSUAL']).nullable(),
        valor: z.number().positive().nullable().optional(),
      })
      .safeParse(request.body ?? {});
    if (!body.success) return reply.code(400).send({ message: 'Esquema de mora inválido' });
    const { tipo, valor } = body.data;
    if (tipo && tipo !== 'SIN_MORA' && (valor == null || valor <= 0)) {
      return reply.code(400).send({ message: 'Indicá el valor del interés por mora' });
    }
    const contrato = await prisma.contrato.findFirst({ where: { id, inmobiliariaId: u.inmobiliariaId } });
    if (!contrato) return reply.code(404).send({ message: 'Contrato inexistente' });
    const actualizado = await prisma.contrato.update({
      where: { id },
      data: {
        moraTipo: tipo,
        moraValor: tipo && tipo !== 'SIN_MORA' ? valor : null,
        // Este endpoint es la acción EXPLÍCITA del usuario sobre la mora: la
        // tasa legacy deja de opinar siempre (elija esquema o herencia).
        tasaPunitorioDiaria: null,
      },
    });
    const inmoMora = await prisma.inmobiliaria.findUnique({
      where: { id: u.inmobiliariaId },
      select: { moraTipoDefault: true, moraValorDefault: true },
    });
    const esquema = resolverEsquemaMora(actualizado, inmoMora);
    await registrarEvento({
      inmobiliariaId: u.inmobiliariaId,
      tipo: 'MORA_EDITADA',
      autorId: u.userId,
      rolAutor: u.rol,
      entidadId: id,
      entidadDescripcion: tipo
        ? `Mora → ${tipo}${valor != null && tipo !== 'SIN_MORA' ? ` (${valor})` : ''}`
        : 'Mora → hereda el default de la inmobiliaria',
    });
    return { ...actualizado, moraEfectiva: { tipo: esquema.tipo, valor: esquema.valor, origen: esquema.origen } };
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
    // Finalizar es irreversible (libera la propiedad). NO desvincula al inquilino:
    // el vínculo Inquilino→Contrato se conserva a propósito para que el ex-inquilino
    // mantenga acceso de SOLO LECTURA a su historial (contrato pasado, liquidaciones,
    // comprobantes) incluso tras re-loguear. Las escrituras las corta exigirContratoActivo.
    // contratos.crear incluye CARGA, pero CARGA solo carga para aprobación → no
    // debería poder finalizar. Mismo guard que DELETE /propietarios y /propiedades.
    if (u.rol === 'CARGA') return reply.code(403).send({ message: 'Solo un Admin u Operador puede finalizar contratos' });
    const { id } = request.params as { id: string };
    // Tipo de baja: FINALIZADO (fin natural del plazo) vs RESCINDIDO (rescisión
    // anticipada). Antes toda baja colapsaba en FINALIZADO y se perdía el dato para
    // el historial y el certificado. Default FINALIZADO por compat (callers sin body).
    const body = z
      .object({
        tipo: z.enum(['FINALIZADO', 'RESCINDIDO']).optional(),
        // Sólo aplican cuando tipo === RESCINDIDO:
        motivoRescision: z.string().trim().max(500).optional(),
        fechaEfectiva: z.coerce.date().optional(),
        montoPenalidad: z.number().nonnegative().optional(),
        // Qué se hace con el depósito al cerrar. MANTENER = sigue RETENIDO (se resuelve después).
        decisionDeposito: z.enum(['MANTENER', 'DEVOLVER', 'NETEAR', 'EJECUTAR']).optional(),
        montoDepositoDevuelto: z.number().nonnegative().optional(),
      })
      .safeParse(request.body ?? {});
    const b = body.success ? body.data : {};
    const nuevoEstado: 'FINALIZADO' | 'RESCINDIDO' = b.tipo ?? 'FINALIZADO';
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
        data: { estado: nuevoEstado },
      });
      if (upd.count === 0) return null;
      await tx.propiedad.updateMany({
        where: { id: contrato.propiedadId, contratoActualId: id },
        data: { contratoActualId: null, estado: 'DISPONIBLE' },
      });
      // Anular la deuda FANTASMA: las liquidaciones futuras (vencimiento posterior
      // a la baja) que están PENDIENTE y SIN ningún pago son meras proyecciones del
      // devengo — el ex-inquilino no ocupó esos meses, así que no las debe. Borrarlas
      // evita que el barrido de vencidos las convierta en morosidad falsa y que la PWA
      // ofrezca "pagar" un mes muerto. La deuda YA vencida mientras el contrato estaba
      // activo se conserva (es deuda real y cobrable). El filtro `pagos: { none }`
      // protege un pago en vuelo: una cuota con INFORMADO/CONCILIADO NO se toca.
      const anuladas = await tx.liquidacion.deleteMany({
        where: {
          contratoId: id,
          inmobiliariaId: u.inmobiliariaId,
          estado: 'PENDIENTE',
          fechaVencimiento: { gt: new Date() },
          pagos: { none: {} },
        },
      });
      // RESCISIÓN: penalidad como cargo one-off (no cabe en Liquidacion, @@unique período) +
      // decisión sobre el depósito (devolver/netear/ejecutar) + fecha efectiva y motivo.
      let cargoPenalidad = 0;
      if (nuevoEstado === 'RESCINDIDO') {
        if (b.montoPenalidad && b.montoPenalidad > 0) {
          await tx.cargoContrato.create({
            data: {
              inmobiliariaId: u.inmobiliariaId,
              contratoId: id,
              tipo: 'PENALIDAD_RESCISION',
              concepto: 'Penalidad por rescisión anticipada',
              monto: b.montoPenalidad,
              moneda: contrato.moneda,
              creadoPorId: u.userId,
            },
          });
          cargoPenalidad = b.montoPenalidad;
        }
        const estadoDep =
          b.decisionDeposito === 'DEVOLVER'
            ? 'DEVUELTO'
            : b.decisionDeposito === 'NETEAR'
              ? 'NETEADO'
              : b.decisionDeposito === 'EJECUTAR'
                ? 'EJECUTADO'
                : null;
        await tx.contrato.update({
          where: { id },
          data: {
            motivoRescision: b.motivoRescision || null,
            fechaEfectivaRescision: b.fechaEfectiva ?? new Date(),
            ...(estadoDep
              ? {
                  estadoDeposito: estadoDep,
                  depositoDevueltoMonto: b.montoDepositoDevuelto ?? null,
                  depositoDevueltoAt: new Date(),
                }
              : {}),
          },
        });
      }
      return { cuotasAnuladas: anuladas.count, cargoPenalidad };
    });
    if (!fin) return reply.code(409).send({ message: 'El contrato ya está finalizado' });
    return { ok: true, estado: nuevoEstado, cuotasAnuladas: fin.cuotasAnuladas, cargoPenalidad: fin.cargoPenalidad };
  });

  // Preview de la baja: qué colaterales tiene el contrato ANTES de finalizar, para
  // que el diálogo del panel avise (deuda real que queda, cuotas futuras que se
  // anulan, pagos en revisión que hay que resolver, co-inquilinos y reclamos abiertos).
  app.get('/contratos/:id/finalizar-preview', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'contratos.crear');
    if (!u) return;
    // Mismo guard de rol explícito que POST /finalizar: CARGA tiene contratos.crear
    // pero NO pagos.ver ni reclamos.ver, y este preview expone pagosEnRevision y
    // reclamosAbiertos. Sin esto, un rol de carga vería datos que el resto de la app le niega.
    if (u.rol === 'CARGA') return reply.code(403).send({ message: 'Solo un Admin u Operador puede finalizar contratos' });
    const { id } = request.params as { id: string };
    const contrato = await prisma.contrato.findFirst({
      where: { id, inmobiliariaId: u.inmobiliariaId },
      include: {
        inmobiliaria: {
          select: { moraTipoDefault: true, moraValorDefault: true, penalidadRescisionMesesDefault: true },
        },
      },
    });
    if (!contrato) return reply.code(404).send({ message: 'Contrato inexistente' });
    const now = new Date();
    const liqs = await prisma.liquidacion.findMany({
      where: { contratoId: id, inmobiliariaId: u.inmobiliariaId, estado: { in: ['PENDIENTE', 'VENCIDO', 'PARCIAL'] } },
      include: { _count: { select: { pagos: true } } },
    });
    const esquema = resolverEsquemaMora(contrato, contrato.inmobiliaria);
    const pagadoMap = await montoPagadoPorLiquidacion(liqs.map((l) => l.id));
    let cuotasFuturasAAnular = 0;
    let deudaVencida = 0;
    let cuotasImpagas = 0;
    for (const l of liqs) {
      const esFuturaSinPago =
        l.estado === 'PENDIENTE' && l.fechaVencimiento > now && l._count.pagos === 0;
      if (esFuturaSinPago) {
        cuotasFuturasAAnular++;
        continue;
      }
      // Sólo cuenta como "deuda que queda" la cuota realmente EXIGIBLE (vencida, o
      // parcial ya vencida). Una cuota FUTURA con un pago no conciliado adjunto
      // (INFORMADO/RECHAZADO) no cae en esFuturaSinPago —tiene pagos— pero TAMPOCO es
      // deuda vencida: sin este filtro se sumaba su montoTotal completo e inflaba el
      // número del diálogo, contradiciendo la deudaTotal del panel (que excluye futuras).
      if (!liqVencida(l, now)) continue;
      const punit = calcularMora(
        Number(l.montoTotal),
        esquema,
        l.fechaVencimiento,
        now,
        l.montoPunitorioManual != null ? Number(l.montoPunitorioManual) : null,
      );
      const { saldo } = conSaldo(l, pagadoMap, punit);
      if (saldo > 0) {
        deudaVencida += saldo;
        cuotasImpagas++;
      }
    }
    const [pagosEnRevision, coInquilinos, reclamosAbiertos] = await Promise.all([
      prisma.pago.count({ where: { contratoId: id, estado: 'INFORMADO' } }),
      prisma.coInquilino.count({ where: { contratoId: id, estado: 'ACEPTADO' } }),
      prisma.reclamo.count({ where: { contratoId: id, estado: { in: ['ABIERTO', 'EN_CURSO'] } } }),
    ]);
    // Rescisión: penalidad sugerida (cánones × alquiler, override contrato > default inmo),
    // depósito en custodia disponible a netear, y el saldo neto = deuda + penalidad − depósito
    // (>0 el ex-inquilino debe; <0 hay que devolverle). El operador puede editar la penalidad.
    const alquiler = Number(contrato.monto);
    const mesesPenalidad = contrato.penalidadRescisionMeses ?? contrato.inmobiliaria.penalidadRescisionMesesDefault;
    const penalidadSugerida = Math.round(alquiler * mesesPenalidad * 100) / 100;
    const depositoEnCustodia =
      contrato.estadoDeposito === 'RETENIDO' ? Number(contrato.depositoGarantia ?? 0) : 0;
    const dv = Math.round(deudaVencida * 100) / 100;
    const saldoNeto = Math.round((dv + penalidadSugerida - depositoEnCustodia) * 100) / 100;
    return {
      deudaVencida: dv,
      cuotasImpagas,
      cuotasFuturasAAnular,
      pagosEnRevision,
      coInquilinos,
      reclamosAbiertos,
      // Datos de rescisión (el diálogo los usa sólo si el operador elige RESCINDIDO):
      depositoEnCustodia,
      mesesPenalidad,
      penalidadSugerida,
      saldoNeto,
      moneda: contrato.moneda,
    };
  });

  // ===== Ajuste del alquiler (manual-asistido) =====
  // El operador confirma el nuevo canon y desde qué período aplica. Antes el alquiler
  // NUNCA subía: el devengo usaba siempre contrato.monto fijo. Ahora ajustar actualiza el
  // monto del contrato + las cuotas FUTURAS impagas, y registra el historial (antes/después).
  app.post('/contratos/:id/ajustar', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'contratos.crear');
    if (!u) return;
    if (u.rol === 'CARGA') return reply.code(403).send({ message: 'Solo un Admin u Operador puede ajustar el alquiler' });
    const { id } = request.params as { id: string };
    const parsed = z
      .object({
        montoNuevo: z.number().positive(),
        periodoDesde: z.string().regex(/^\d{4}-\d{2}$/, 'Período inválido (YYYY-MM)'),
        motivo: z.string().trim().max(200).optional(),
      })
      .safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: 'Datos del ajuste inválidos', detalle: parsed.error.flatten() });
    }
    const b = parsed.data;
    const contrato = await prisma.contrato.findFirst({ where: { id, inmobiliariaId: u.inmobiliariaId } });
    if (!contrato) return reply.code(404).send({ message: 'Contrato inexistente' });
    if (contrato.estado !== 'ACTIVO') return reply.code(409).send({ message: 'Solo se ajusta un contrato activo' });
    const montoAnterior = Number(contrato.monto);
    if (b.montoNuevo === montoAnterior) {
      return reply.code(400).send({ message: 'El monto nuevo es igual al actual' });
    }
    const expensas = contrato.montoExpensas != null ? Number(contrato.montoExpensas) : 0;
    const res = await prisma.$transaction(async (tx) => {
      const ajuste = await tx.ajusteAlquiler.create({
        data: {
          inmobiliariaId: u.inmobiliariaId,
          contratoId: id,
          montoAnterior,
          montoNuevo: b.montoNuevo,
          periodoDesde: b.periodoDesde,
          motivo: b.motivo || null,
          creadoPorId: u.userId,
        },
      });
      await tx.contrato.update({ where: { id }, data: { monto: b.montoNuevo } });
      // Cuotas FUTURAS impagas (periodo >= periodoDesde, PENDIENTE, sin pagos) → nuevo canon.
      // NO se tocan las pagadas/parciales/vencidas: ya se devengaron con su monto histórico.
      const upd = await tx.liquidacion.updateMany({
        where: {
          contratoId: id,
          inmobiliariaId: u.inmobiliariaId,
          periodo: { gte: b.periodoDesde },
          estado: 'PENDIENTE',
          pagos: { none: {} },
        },
        data: { montoAlquiler: b.montoNuevo, montoTotal: b.montoNuevo + expensas },
      });
      return { ajusteId: ajuste.id, liquidacionesActualizadas: upd.count };
    });
    return { ok: true, montoAnterior, montoNuevo: b.montoNuevo, ...res };
  });

  app.get('/contratos/:id/ajustes', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'contratos.ver');
    if (!u) return;
    const { id } = request.params as { id: string };
    return prisma.ajusteAlquiler.findMany({
      where: { contratoId: id, inmobiliariaId: u.inmobiliariaId },
      orderBy: { periodoDesde: 'desc' },
    });
  });

  // ===== Renovación del contrato (extiende plazo + nuevo canon) =====
  // El mismo contrato (continuidad de inquilino/depósito/historial): extiende fechaFin, fija
  // el nuevo monto desde un período, actualiza las cuotas futuras impagas y devenga los nuevos.
  app.post('/contratos/:id/renovar', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'contratos.crear');
    if (!u) return;
    if (u.rol === 'CARGA') return reply.code(403).send({ message: 'Solo un Admin u Operador puede renovar contratos' });
    const { id } = request.params as { id: string };
    const parsed = z
      .object({
        fechaFinNueva: z.coerce.date(),
        montoNuevo: z.number().positive(),
        montoDesde: z.string().regex(/^\d{4}-\d{2}$/, 'Período inválido (YYYY-MM)'),
        diaPago: z.number().int().min(1).max(31).optional(),
        motivo: z.string().trim().max(200).optional(),
      })
      .safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: 'Datos de la renovación inválidos', detalle: parsed.error.flatten() });
    }
    const b = parsed.data;
    const contrato = await prisma.contrato.findFirst({ where: { id, inmobiliariaId: u.inmobiliariaId } });
    if (!contrato) return reply.code(404).send({ message: 'Contrato inexistente' });
    if (contrato.estado !== 'ACTIVO') return reply.code(409).send({ message: 'Solo se renueva un contrato activo' });
    if (b.fechaFinNueva <= contrato.fechaFin) {
      return reply.code(400).send({ message: 'La nueva fecha de fin debe ser posterior a la actual' });
    }
    const montoAnterior = Number(contrato.monto);
    const expensas = contrato.montoExpensas != null ? Number(contrato.montoExpensas) : 0;
    const res = await prisma.$transaction(async (tx) => {
      const renov = await tx.renovacionContrato.create({
        data: {
          inmobiliariaId: u.inmobiliariaId,
          contratoId: id,
          fechaFinAnterior: contrato.fechaFin,
          fechaFinNueva: b.fechaFinNueva,
          montoAnterior,
          montoNuevo: b.montoNuevo,
          montoDesde: b.montoDesde,
          motivo: b.motivo || null,
          creadoPorId: u.userId,
        },
      });
      await tx.contrato.update({
        where: { id },
        data: { fechaFin: b.fechaFinNueva, monto: b.montoNuevo, ...(b.diaPago ? { diaPago: b.diaPago } : {}) },
      });
      // Cuotas futuras impagas (>= montoDesde) al nuevo canon (igual que el ajuste).
      await tx.liquidacion.updateMany({
        where: {
          contratoId: id,
          inmobiliariaId: u.inmobiliariaId,
          periodo: { gte: b.montoDesde },
          estado: 'PENDIENTE',
          pagos: { none: {} },
        },
        data: { montoAlquiler: b.montoNuevo, montoTotal: b.montoNuevo + expensas },
      });
      // Devengar los nuevos períodos (hasta el tope del devengo) con la nueva fechaFin + monto.
      // Idempotente (skipDuplicates); el cron completa el resto mes a mes.
      const nuevas = await generarLiquidacionesContrato(tx, {
        ...contrato,
        fechaFin: b.fechaFinNueva,
        monto: b.montoNuevo,
      });
      return { renovacionId: renov.id, liquidacionesNuevas: nuevas };
    });
    return { ok: true, montoAnterior, montoNuevo: b.montoNuevo, ...res };
  });

  app.get('/contratos/:id/renovaciones', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'contratos.ver');
    if (!u) return;
    const { id } = request.params as { id: string };
    return prisma.renovacionContrato.findMany({
      where: { contratoId: id, inmobiliariaId: u.inmobiliariaId },
      orderBy: { createdAt: 'desc' },
    });
  });

  // ===== Depósitos en custodia (plata de terceros que la inmo guarda) =====
  // Suma los depósitos de garantía RETENIDOS (de contratos activos Y de finalizados que
  // todavía no se devolvieron): es el pasivo real de plata de terceros a cuidar.
  app.get('/depositos/en-custodia', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'contratos.ver');
    if (!u) return;
    const contratos = await prisma.contrato.findMany({
      where: {
        inmobiliariaId: u.inmobiliariaId,
        estadoDeposito: 'RETENIDO',
        depositoGarantia: { gt: 0 },
      },
      select: {
        id: true,
        moneda: true,
        depositoGarantia: true,
        estado: true,
        fechaInicio: true,
        propiedad: { select: { direccion: true } },
        inquilinoTitular: { select: { nombre: true, apellido: true } },
      },
      orderBy: { fechaInicio: 'desc' },
    });
    const porMonedaMap = new Map<string, { total: number; cantidad: number }>();
    const items = contratos.map((c) => {
      const monto = Number(c.depositoGarantia ?? 0);
      const cur = porMonedaMap.get(c.moneda) ?? { total: 0, cantidad: 0 };
      cur.total += monto;
      cur.cantidad += 1;
      porMonedaMap.set(c.moneda, cur);
      return {
        contratoId: c.id,
        propiedad: c.propiedad?.direccion ?? '—',
        inquilino: `${c.inquilinoTitular?.nombre ?? ''} ${c.inquilinoTitular?.apellido ?? ''}`.trim() || '—',
        monto: Math.round(monto * 100) / 100,
        moneda: c.moneda,
        estadoContrato: c.estado,
        fechaInicio: c.fechaInicio,
      };
    });
    return {
      porMoneda: [...porMonedaMap.entries()].map(([moneda, v]) => ({
        moneda,
        total: Math.round(v.total * 100) / 100,
        cantidad: v.cantidad,
      })),
      contratos: items,
    };
  });

  // ===== Garantes del contrato (contacto/póliza) — activa el modelo Garante =====
  const garanteBody = z.object({
    tipo: z.enum(['PROPIETARIA', 'CAUCION', 'SUELDO', 'DIGITAL']),
    nombreProveedor: z.string().trim().min(2).max(200),
    dni: z.string().trim().max(20).optional(),
    numeroPoliza: z.string().trim().max(100).optional(),
    montoCobertura: z.number().nonnegative().optional(),
    vigenciaHasta: z.coerce.date().optional(),
    contactoNombre: z.string().trim().max(200).optional(),
    contactoTelefono: z.string().trim().min(3).max(50),
    contactoEmail: z.string().trim().email().optional().or(z.literal('')),
  });
  const garanteData = (b: z.infer<typeof garanteBody>) => ({
    tipo: b.tipo,
    nombreProveedor: b.nombreProveedor,
    dni: b.dni || null,
    numeroPoliza: b.numeroPoliza || null,
    montoCobertura: b.montoCobertura ?? null,
    vigenciaHasta: b.vigenciaHasta ?? null,
    contactoNombre: b.contactoNombre || null,
    contactoTelefono: b.contactoTelefono,
    contactoEmail: b.contactoEmail || null,
  });

  app.get('/contratos/:id/garantes', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'contratos.ver');
    if (!u) return;
    const { id } = request.params as { id: string };
    return prisma.garante.findMany({
      where: { contratoId: id, inmobiliariaId: u.inmobiliariaId },
      orderBy: { createdAt: 'asc' },
    });
  });

  app.post('/contratos/:id/garantes', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'contratos.crear');
    if (!u) return;
    const { id } = request.params as { id: string };
    const contrato = await prisma.contrato.findFirst({
      where: { id, inmobiliariaId: u.inmobiliariaId },
      select: { id: true },
    });
    if (!contrato) return reply.code(404).send({ message: 'Contrato inexistente' });
    const parsed = garanteBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: 'Datos del garante incompletos', detalle: parsed.error.flatten() });
    }
    return prisma.garante.create({
      data: { inmobiliariaId: u.inmobiliariaId, contratoId: id, ...garanteData(parsed.data) },
    });
  });

  app.put('/contratos/:id/garantes/:garanteId', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'contratos.crear');
    if (!u) return;
    const { id, garanteId } = request.params as { id: string; garanteId: string };
    const parsed = garanteBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: 'Datos del garante incompletos', detalle: parsed.error.flatten() });
    }
    // updateMany scopeado por contrato + tenant → 404 si no es tuyo (regla de oro).
    const upd = await prisma.garante.updateMany({
      where: { id: garanteId, contratoId: id, inmobiliariaId: u.inmobiliariaId },
      data: garanteData(parsed.data),
    });
    if (upd.count === 0) return reply.code(404).send({ message: 'Garante inexistente' });
    return prisma.garante.findFirst({ where: { id: garanteId, inmobiliariaId: u.inmobiliariaId } });
  });

  app.delete('/contratos/:id/garantes/:garanteId', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'contratos.crear');
    if (!u) return;
    const { id, garanteId } = request.params as { id: string; garanteId: string };
    const del = await prisma.garante.deleteMany({
      where: { id: garanteId, contratoId: id, inmobiliariaId: u.inmobiliariaId },
    });
    if (del.count === 0) return reply.code(404).send({ message: 'Garante inexistente' });
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

  // ===== Personas (identidad reutilizable del inquilino: ficha histórica) =====
  // Lista DEDUPLICADA por persona (no una fila por contrato como /inquilinos). Cada
  // persona con su cantidad de contratos y estado derivado (activo si tiene ≥1 vigente).
  app.get('/personas', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'contratos.ver');
    if (!u) return;
    // `?q=` para el autocomplete del reuso (busca por nombre/apellido/dni/email).
    const { q } = z.object({ q: z.string().trim().optional() }).parse(request.query ?? {});
    const filtroTexto = q
      ? {
          OR: [
            { nombre: { contains: q, mode: 'insensitive' as const } },
            { apellido: { contains: q, mode: 'insensitive' as const } },
            { dni: { contains: q } },
            { email: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {};
    const personas = await prisma.persona.findMany({
      where: { inmobiliariaId: u.inmobiliariaId, ...filtroTexto },
      include: {
        inquilinos: {
          select: { contrato: { select: { id: true, estado: true, propiedad: { select: { direccion: true } } } } },
        },
      },
      orderBy: { nombre: 'asc' },
    });
    return personas.map((p) => {
      const contratos = p.inquilinos.map((i) => i.contrato).filter((c): c is NonNullable<typeof c> => !!c);
      const activo = contratos.find((c) => c.estado === 'ACTIVO');
      return {
        id: p.id,
        nombre: p.nombre,
        apellido: p.apellido,
        dni: p.dni,
        email: p.email,
        telefono: p.telefono,
        totalContratos: contratos.length,
        estado: activo ? 'ACTIVO' : 'INACTIVO',
        // Propiedad de referencia: la del contrato vigente o, si no hay, la más reciente.
        propiedad: activo?.propiedad?.direccion ?? contratos[0]?.propiedad?.direccion ?? null,
      };
    });
  });

  // Ficha de una persona: todos sus contratos → propiedades, sus reclamos (a través de
  // los contratos) y su morosidad (deuda vencida derivada on-read, misma fuente de verdad
  // que /contratos). Tenant-scopeada: una persona de otro tenant → 404.
  app.get('/personas/:id', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'contratos.ver');
    if (!u) return;
    const { id } = request.params as { id: string };
    const persona = await prisma.persona.findFirst({
      where: { id, inmobiliariaId: u.inmobiliariaId },
      include: {
        inquilinos: {
          include: {
            contrato: {
              include: {
                propiedad: { select: { id: true, direccion: true, ciudad: true } },
                liquidaciones: true,
              },
            },
          },
        },
      },
    });
    if (!persona) return reply.code(404).send({ message: 'Persona inexistente' });

    const now = new Date();
    const inmoMora = await prisma.inmobiliaria.findUnique({
      where: { id: u.inmobiliariaId },
      select: { moraTipoDefault: true, moraValorDefault: true },
    });
    const contratosRaw = persona.inquilinos
      .map((i) => i.contrato)
      .filter((c): c is NonNullable<typeof c> => !!c);
    const contratoIds = contratosRaw.map((c) => c.id);
    const pagado = await montoPagadoPorLiquidacion(contratosRaw.flatMap((c) => c.liquidaciones.map((l) => l.id)));

    let tuvoMora = false;
    let deudaVigente = 0;
    const contratos = contratosRaw.map((c) => {
      const esquema = resolverEsquemaMora(c, inmoMora);
      let deuda = 0;
      let vencidas = 0;
      for (const l of c.liquidaciones) {
        if (!(liqVencida(l, now) || l.estado === 'PARCIAL')) continue;
        const punit = calcularMora(
          Number(l.montoTotal),
          esquema,
          l.fechaVencimiento,
          now,
          l.montoPunitorioManual != null ? Number(l.montoPunitorioManual) : null,
        );
        const saldo = conSaldo(l, pagado, punit).saldo;
        if (saldo > 0) {
          deuda += saldo;
          vencidas++;
        }
      }
      if (vencidas > 0) tuvoMora = true;
      deudaVigente += deuda;
      return {
        id: c.id,
        estado: c.estado,
        monto: Number(c.monto),
        moneda: c.moneda,
        fechaInicio: c.fechaInicio,
        fechaFin: c.fechaFin,
        propiedad: c.propiedad ? { id: c.propiedad.id, direccion: c.propiedad.direccion } : null,
        deuda: Math.round(deuda * 100) / 100,
        cuotasVencidas: vencidas,
      };
    });

    const reclamos = contratoIds.length
      ? await prisma.reclamo.findMany({
          where: { contratoId: { in: contratoIds }, inmobiliariaId: u.inmobiliariaId },
          select: {
            id: true,
            contratoId: true,
            categoria: true,
            descripcion: true,
            estado: true,
            urgencia: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        })
      : [];

    return {
      id: persona.id,
      nombre: persona.nombre,
      apellido: persona.apellido,
      dni: persona.dni,
      email: persona.email,
      telefono: persona.telefono,
      cuit: persona.cuit,
      contratos,
      reclamos,
      resumen: {
        totalContratos: contratos.length,
        activos: contratos.filter((c) => c.estado === 'ACTIVO').length,
        deudaVigente: Math.round(deudaVigente * 100) / 100,
        // Morosidad = tiene deuda vencida hoy (derivada on-read, nunca un flag congelado).
        tuvoMora,
        reclamosAbiertos: reclamos.filter((r) => r.estado === 'ABIERTO' || r.estado === 'EN_CURSO').length,
      },
    };
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
    // Mora por defecto del tenant: la heredan los contratos sin esquema propio.
    // Viaja junto a la config de cobranza (es parte de "cómo cobro").
    const inmoMora = await prisma.inmobiliaria.findUnique({
      where: { id: u.inmobiliariaId },
      select: { moraTipoDefault: true, moraValorDefault: true },
    });
    return {
      tieneCuenta: !!(c?.cbu && c?.titular),
      cuenta: {
        banco: c?.banco ?? '',
        titular: c?.titular ?? '',
        cbu: c?.cbu ?? '',
        alias: c?.alias ?? '',
        cuit: c?.cuit ?? '',
      },
      mora: {
        tipoDefault: inmoMora?.moraTipoDefault ?? 'SIN_MORA',
        valorDefault: inmoMora?.moraValorDefault ?? null,
      },
    };
  });

  // Mora POR DEFECTO de la inmobiliaria ("cada inmobiliaria se mueve distinto"):
  // los contratos sin moraTipo propio la heredan on-read (resolverEsquemaMora),
  // así cambiarla acá impacta la cartera heredera SIN tocar contrato por contrato.
  app.put('/cobranza/mora', async (request, reply) => {
    const u = await requireUsuario(request, reply);
    if (!u) return;
    if (u.rol !== 'ADMIN') return reply.code(403).send({ message: 'Solo un Admin puede editar la mora por defecto' });
    const body = z
      .object({
        tipo: z.enum(['SIN_MORA', 'PORCENTAJE_DIARIO', 'MONTO_FIJO', 'PORCENTAJE_MENSUAL']),
        valor: z.number().positive().nullable().optional(),
      })
      .safeParse(request.body ?? {});
    if (!body.success) return reply.code(400).send({ message: 'Esquema de mora inválido' });
    const { tipo, valor } = body.data;
    if (tipo !== 'SIN_MORA' && (valor == null || valor <= 0)) {
      return reply.code(400).send({ message: 'Indicá el valor del interés por mora' });
    }
    const actualizada = await prisma.inmobiliaria.update({
      where: { id: u.inmobiliariaId },
      data: {
        moraTipoDefault: tipo,
        moraValorDefault: tipo !== 'SIN_MORA' ? valor : null,
      },
      select: { moraTipoDefault: true, moraValorDefault: true },
    });
    await registrarEvento({
      inmobiliariaId: u.inmobiliariaId,
      tipo: 'MORA_EDITADA',
      autorId: u.userId,
      rolAutor: u.rol,
      entidadId: u.inmobiliariaId,
      entidadDescripcion: `Mora default → ${tipo}${tipo !== 'SIN_MORA' && valor != null ? ` (${valor})` : ''}`,
    });
    return { tipoDefault: actualizada.moraTipoDefault, valorDefault: actualizada.moraValorDefault };
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

  // ===== Ajuste MANUAL de monto (PATCH /contratos/:id/monto) =====
  // El sistema NO tiene la data del índice (ICL/IPC/UVA...), así que el ajuste
  // por índice es MANUAL: cuando llega la fecha de ajuste, el operador entra el
  // monto nuevo. Este endpoint (a) actualiza contrato.monto, (b) reprograma
  // proximoAjuste (+frecuencia), (c) RE-DEVENGA las liquidaciones FUTURAS sin
  // plata en juego para que tomen el monto nuevo, y (d) deja rastro AJUSTE_APLICADO.
  // Money code: NO toca liquidaciones pagadas/parciales/con-pago ni meses pasados.
  app.patch('/contratos/:id/monto', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'contratos.crear');
    if (!u) return;
    const { id } = request.params as { id: string };
    const body = z
      .object({
        monto: z.number().positive(),
        // Opcional: si el operador quiere fijar a mano la próxima fecha de ajuste;
        // omitido => se calcula sobre la actual (o hoy) + frecuencia.
        proximoAjuste: z.coerce.date().optional(),
        motivo: z.string().optional(),
        pin: z.string().optional(),
      })
      .safeParse(request.body ?? {});
    if (!body.success) return reply.code(400).send({ message: 'Datos del ajuste inválidos' });
    const d = body.data;

    // PIN de seguridad (mismo patrón que plata.ts): verificarPinUsuario agrega el
    // lockout anti-fuerza-bruta; acá traducimos el resultado a la reply.
    const pinCheck = await verificarPinUsuario(u.userId, d.pin);
    if (!pinCheck.ok) return reply.code(pinCheck.code).send({ message: pinCheck.message });

    // Scopeado por inmobiliariaId (multi-tenant): un id de otro tenant => 404.
    const contrato = await prisma.contrato.findFirst({
      where: { id, inmobiliariaId: u.inmobiliariaId },
      select: {
        id: true,
        monto: true,
        montoExpensas: true,
        tipoContrato: true,
        moneda: true,
        proximoAjuste: true,
        frecuenciaAjusteMeses: true,
      },
    });
    if (!contrato) return reply.code(404).send({ message: 'Contrato inexistente' });

    const montoViejo = Number(contrato.monto);
    // Base para reprogramar el próximo ajuste: lo que mande el body pisa; si no,
    // el proximoAjuste actual (la fecha que se cumplió) o, si nunca se fijó, hoy.
    const proximoAjuste = d.proximoAjuste
      ? d.proximoAjuste
      : sumarMesesUTC(contrato.proximoAjuste ?? new Date(), contrato.frecuenciaAjusteMeses);
    const periodoActual = periodoDe(new Date());

    const resultado = await prisma.$transaction(async (tx) => {
      // (a) + (b): nuevo monto y próxima fecha de ajuste.
      await tx.contrato.update({
        where: { id: contrato.id },
        data: { monto: d.monto, proximoAjuste },
      });

      // (c) RE-DEVENGO de futuras. Traemos las liqs candidatas (>= mes actual,
      // PENDIENTE/VENCIDO) con su conteo de pagos, y el filtro PURO decide cuáles
      // reajustar (excluye las que tengan CUALQUIER pago, informado o conciliado).
      const liqs = await tx.liquidacion.findMany({
        where: {
          contratoId: contrato.id,
          inmobiliariaId: u.inmobiliariaId,
          periodo: { gte: periodoActual },
          estado: { in: ['PENDIENTE', 'VENCIDO'] },
        },
        select: {
          id: true,
          periodo: true,
          estado: true,
          montoExpensas: true,
          _count: { select: { pagos: true } },
        },
      });
      const aReajustar = recomputarLiquidacionesFuturas(
        liqs.map((l) => ({
          id: l.id,
          periodo: l.periodo,
          estado: l.estado,
          montoExpensas: l.montoExpensas,
          cantidadPagos: l._count.pagos,
        })),
        { montoNuevo: d.monto, tipoContrato: contrato.tipoContrato, periodoActual },
      );
      for (const r of aReajustar) {
        // updateMany scopeado por inmobiliariaId (defensa cross-tenant redundante).
        await tx.liquidacion.updateMany({
          where: { id: r.id, inmobiliariaId: u.inmobiliariaId },
          data: { montoAlquiler: r.montoAlquiler, montoTotal: r.montoTotal },
        });
      }

      // (d) Evento de contrato AJUSTE_APLICADO (timeline del contrato). Va DENTRO
      // de la tx: el ajuste y su rastro caen juntos (a diferencia de la auditoría
      // best-effort, que es post-commit). 'autor' es el nombre del que ajustó.
      await tx.eventoContrato.create({
        data: {
          inmobiliariaId: u.inmobiliariaId,
          contratoId: contrato.id,
          tipo: 'AJUSTE_APLICADO',
          titulo: `Ajuste de alquiler: ${montoViejo} → ${d.monto} ${contrato.moneda}`,
          detalle: d.motivo ?? null,
          fecha: new Date(),
          autor: u.userId,
        },
      });

      const actualizado = await tx.contrato.findUniqueOrThrow({ where: { id: contrato.id } });
      return { actualizado, reajustadas: aReajustar.length };
    });

    // El rastro "quién ajustó qué" queda en el timeline del contrato como
    // EventoContrato AJUSTE_APLICADO (creado dentro de la tx, arriba) — el tipo
    // semánticamente correcto. No duplicamos en EventoAuditoria porque su enum no
    // tiene un valor de "ajuste de monto" y no vamos a migrar el schema.
    return { contrato: resultado.actualizado, liquidacionesReajustadas: resultado.reajustadas };
  });
}
