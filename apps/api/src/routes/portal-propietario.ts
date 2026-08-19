import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { randomInt } from 'node:crypto';
import { z } from 'zod';
import { OtpRequestSchema, OtpVerifySchema, type JwtPropietario } from '@llave/shared';
import { prisma } from '../db.js';
import { requirePropietario } from '../auth/guards.js';
import { enviarOtp } from '../mailer.js';

/**
 * PORTAL DEL PROPIETARIO (T-23).
 *
 * Camila `[1:04:59]`: *"Yo quiero rendirle al propietario y cargarle ahí y rendirle la cuenta
 * ahí"*, y `[1:05:10]` *"lo que se gastó, lo que se hizo, el cobro de la administración mía por
 * mes, el 10% de descuento que tiene, más lo que se le pagó; que se le rinda todo y él lo vea
 * mediante la aplicación"*.
 *
 * TODO LO QUE MUESTRA YA EXISTÍA: `Rendicion` con su `comisionMonto` congelado, `GastoRendido`,
 * `AlquilerRendido`, las liquidaciones de sus inquilinos. Lo que faltaba era la PUERTA: un tipo
 * de sesión para el propietario y endpoints scopeados a él.
 *
 * ── SEGURIDAD ─────────────────────────────────────────────────────────────────────────────
 * Es una superficie de LECTURA sobre datos sensibles de terceros, así que:
 *
 * 1. **Sólo lectura.** No hay un solo endpoint de escritura acá. Si mañana hace falta uno
 *    (aprobar una rendición, por ejemplo), va con su propia revisión.
 * 2. **Doble scoping siempre.** Cada query filtra por `propietarioId` **e** `inmobiliariaId`,
 *    los dos del token ya revalidado contra la DB por `requirePropietario`. Nunca se toma un
 *    id del path o del body como fuente de a quién pertenece algo.
 * 3. **Nada de tokens caseros.** El acceso es un JWT firmado, igual que el resto del sistema.
 *    El repo tiene dos precedentes que NO se repiten acá: el token de garante, que es base64
 *    de un JSON con un "secreto" que el propio archivo declara *"no-secret: es sólo ofuscación
 *    visual"*, y el hash del certificado, que es FNV-1a + djb2 truncado, sin sal.
 * 4. **El OTP no dice si el email existe.** A diferencia del login del panel —que devuelve
 *    `existe` a propósito, porque el alta es self-service y hay que poder mandar a /registro—
 *    acá no hay registro público: revelarlo sólo serviría para enumerar la cartera de una
 *    inmobiliaria. La respuesta es siempre la misma.
 */

/** Vida del token del portal. Más corto que los 15 días del panel: es un portal de consulta
 *  ocasional, no una herramienta de trabajo diaria, y acorta la ventana de un token robado. */
const TOKEN_TTL = '7d';
const OTP_TTL_MS = 10 * 60 * 1000;

/** Mismo criterio que el resto del auth: el código NUNCA se loguea en producción. */
const codeEnLog = (code: string): { code?: string } =>
  process.env.NODE_ENV === 'production' ? {} : { code };

const dec = (v: unknown): number => Number(v ?? 0);

export async function portalPropietarioRoutes(app: FastifyInstance) {
  // ===== Login por OTP =====

  // Mismos topes que el OTP del panel: dejan aire para un uso normal y hacen impracticable
  // adivinar 6 dígitos.
  app.post(
    '/auth/propietario/otp/request',
    { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } },
    async (request, reply) => {
      const body = OtpRequestSchema.safeParse(request.body);
      if (!body.success) return reply.code(400).send({ message: 'Email requerido' });
      const emailLc = body.data.email.toLowerCase();

      // Una misma persona puede ser propietaria en VARIAS inmobiliarias: cada cartera es una
      // fila distinta. Emitimos un código para todas y la identidad sale después de la fila
      // de OTP que matchee.
      const propietarios = await prisma.propietario.findMany({
        where: { email: emailLc },
        select: { id: true },
      });

      // Respuesta idéntica exista o no el email (ver nota 4 del encabezado). El trabajo de
      // generar el código sólo se hace si hay a quién mandárselo, pero eso no se nota afuera.
      if (propietarios.length > 0) {
        const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
        const codeHash = bcrypt.hashSync(code, 8);
        const expiresAt = new Date(Date.now() + OTP_TTL_MS);
        // Invalidar los anteriores ANTES de emitir: pedir un código nuevo deja sin efecto al
        // viejo (que es lo que la persona espera) y, sobre todo, evita que pidiendo N veces
        // queden N códigos vivos multiplicando por N la chance de acertar al azar.
        await prisma.codigoOtpPropietario.updateMany({
          where: { propietarioId: { in: propietarios.map((p) => p.id) }, usedAt: null },
          data: { usedAt: new Date() },
        });
        await prisma.codigoOtpPropietario.createMany({
          data: propietarios.map((p) => ({ propietarioId: p.id, codeHash, expiresAt })),
        });
        try {
          const enviado = await enviarOtp(emailLc, code);
          if (!enviado)
            app.log.info({ email: emailLc, ...codeEnLog(code) }, 'OTP propietario generado (SMTP no configurado)');
          else app.log.info({ email: emailLc }, 'OTP propietario enviado por email');
        } catch (err) {
          app.log.error(
            { email: emailLc, ...codeEnLog(code), err: (err as Error).message },
            'OTP propietario: fallo el envío SMTP',
          );
        }
      }
      return { ok: true };
    },
  );

  app.post(
    '/auth/propietario/otp/verify',
    { config: { rateLimit: { max: 20, timeWindow: '15 minutes' } } },
    async (request, reply) => {
      const body = OtpVerifySchema.safeParse(request.body);
      if (!body.success) return reply.code(400).send({ message: 'Email y código de 6 dígitos requeridos' });
      const emailLc = body.data.email.toLowerCase();

      const propietarios = await prisma.propietario.findMany({
        where: { email: emailLc },
        select: { id: true, inmobiliariaId: true, nombre: true, apellido: true, inmobiliaria: { select: { nombre: true } } },
      });
      if (propietarios.length === 0) return reply.code(401).send({ message: 'Código inválido o vencido' });

      // La identidad sale de la fila de OTP que matchea, NO de un findFirst por email.
      const otps = await prisma.codigoOtpPropietario.findMany({
        where: {
          propietarioId: { in: propietarios.map((p) => p.id) },
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: 'desc' },
      });
      let elegido: (typeof propietarios)[number] | null = null;
      for (const otp of otps) {
        if (bcrypt.compareSync(body.data.code, otp.codeHash)) {
          await prisma.codigoOtpPropietario.update({ where: { id: otp.id }, data: { usedAt: new Date() } });
          elegido = propietarios.find((p) => p.id === otp.propietarioId) ?? null;
          break;
        }
      }
      if (!elegido) return reply.code(401).send({ message: 'Código inválido o vencido' });

      const payload: JwtPropietario = {
        kind: 'propietario',
        propietarioId: elegido.id,
        inmobiliariaId: elegido.inmobiliariaId,
      };
      return {
        token: app.jwt.sign(payload, { expiresIn: TOKEN_TTL }),
        nombre: `${elegido.nombre} ${elegido.apellido}`.trim(),
        inmobiliaria: elegido.inmobiliaria.nombre,
        // Si administra con más de una inmobiliaria, el front tiene que poder ofrecer el
        // cambio: sin esto entraría a una cartera al azar y no sabría que las otras existen.
        carteras: propietarios.map((p) => ({
          propietarioId: p.id,
          inmobiliaria: p.inmobiliaria.nombre,
          actual: p.id === elegido!.id,
        })),
      };
    },
  );

  /**
   * Cambiar de cartera sin volver a pedir un código. Sólo entre carteras del MISMO email:
   * se relee el email del propietario del token y se exige que el destino coincida. Un id de
   * otra persona no matchea, aunque quien lo pida tenga un token válido.
   */
  app.post('/auth/propietario/elegir', async (request, reply) => {
    const actual = await requirePropietario(request, reply);
    if (!actual) return;
    const body = z.object({ propietarioId: z.string().min(1) }).safeParse(request.body);
    if (!body.success) return reply.code(400).send({ message: 'propietarioId requerido' });

    const yo = await prisma.propietario.findUnique({
      where: { id: actual.propietarioId },
      select: { email: true },
    });
    if (!yo) return reply.code(401).send({ message: 'Sesión vencida' });

    const destino = await prisma.propietario.findFirst({
      where: { id: body.data.propietarioId, email: yo.email },
      select: { id: true, inmobiliariaId: true, nombre: true, apellido: true, inmobiliaria: { select: { nombre: true } } },
    });
    // 404 y no 403: no confirmamos que el id exista pero sea de otro. Es el mismo criterio
    // que usa el resto del sistema para no filtrar la existencia de recursos ajenos.
    if (!destino) return reply.code(404).send({ message: 'No encontramos esa cartera' });

    const payload: JwtPropietario = {
      kind: 'propietario',
      propietarioId: destino.id,
      inmobiliariaId: destino.inmobiliariaId,
    };
    return {
      token: app.jwt.sign(payload, { expiresIn: TOKEN_TTL }),
      nombre: `${destino.nombre} ${destino.apellido}`.trim(),
      inmobiliaria: destino.inmobiliaria.nombre,
    };
  });

  // ===== Lectura, toda scopeada al propietario del token =====

  /** Quién soy y con qué inmobiliaria. Lo primero que pide el front al abrir. */
  app.get('/portal/mi-cartera', async (request, reply) => {
    const p = await requirePropietario(request, reply);
    if (!p) return;
    const yo = await prisma.propietario.findFirst({
      where: { id: p.propietarioId, inmobiliariaId: p.inmobiliariaId },
      select: {
        nombre: true,
        apellido: true,
        email: true,
        telefono: true,
        cuit: true,
        comisionPct: true,
        // `cbuAlias` NO se devuelve: el propietario ya sabe su CBU y exponerlo acá sólo
        // agranda lo que se filtra si el token se pierde.
        inmobiliaria: { select: { nombre: true, telefono: true, email: true } },
      },
    });
    if (!yo) return reply.code(401).send({ message: 'Sesión vencida' });
    return {
      nombre: `${yo.nombre} ${yo.apellido}`.trim(),
      email: yo.email,
      telefono: yo.telefono,
      cuit: yo.cuit,
      comisionPct: yo.comisionPct,
      inmobiliaria: yo.inmobiliaria,
    };
  });

  /**
   * Sus propiedades, con el estado de pago del inquilino de cada una.
   *
   * Camila `[1:05:30]`: *"Y vos también me estás auditando a mí mediante esa aplicación, que
   * ves el día que pagó esa persona"*. Por eso va la fecha real de cobro, no sólo el estado.
   */
  app.get('/portal/propiedades', async (request, reply) => {
    const p = await requirePropietario(request, reply);
    if (!p) return;
    // El vínculo propietario→propiedad es la participación, que además dice CUÁNTO le toca.
    const participaciones = await prisma.participacionPropietario.findMany({
      where: { propietarioId: p.propietarioId, inmobiliariaId: p.inmobiliariaId },
      select: {
        porcentaje: true,
        propiedad: {
          select: {
            id: true,
            direccion: true,
            ciudad: true,
            complejo: true,
            consorcio: { select: { nombre: true } },
            contratoActual: {
              select: {
                id: true,
                estado: true,
                monto: true,
                moneda: true,
                tipoContrato: true,
                fechaInicio: true,
                fechaFin: true,
                inquilinoTitular: { select: { nombre: true, apellido: true } },
                liquidaciones: {
                  orderBy: { periodo: 'desc' },
                  take: 6,
                  select: {
                    periodo: true,
                    estado: true,
                    montoTotal: true,
                    fechaVencimiento: true,
                    // La fecha REAL en que entró la plata, que es lo que ella quiere auditar.
                    pagos: {
                      where: { estado: 'CONCILIADO' },
                      orderBy: { fechaTransferencia: 'desc' },
                      take: 1,
                      select: { fechaTransferencia: true, monto: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    return participaciones.map((part) => {
      const prop = part.propiedad;
      const c = prop.contratoActual;
      return {
        id: prop.id,
        direccion: prop.direccion,
        ciudad: prop.ciudad,
        // Mismo rótulo que ve la inmobiliaria: el complejo manda, la calle queda de dato
        // secundario (T-06). El propietario también reconoce su unidad por el nombre.
        complejo: prop.consorcio?.nombre ?? prop.complejo ?? null,
        participacionPct: part.porcentaje,
        contrato: c
          ? {
              estado: c.estado,
              tipoContrato: c.tipoContrato,
              monto: dec(c.monto),
              moneda: c.moneda,
              desde: c.fechaInicio.toISOString().slice(0, 10),
              hasta: c.fechaFin.toISOString().slice(0, 10),
              inquilino: c.inquilinoTitular
                ? `${c.inquilinoTitular.nombre} ${c.inquilinoTitular.apellido ?? ''}`.trim()
                : null,
              periodos: c.liquidaciones.map((l) => ({
                periodo: l.periodo,
                estado: l.estado,
                monto: dec(l.montoTotal),
                vence: l.fechaVencimiento.toISOString().slice(0, 10),
                pagoAt: l.pagos[0]?.fechaTransferencia?.toISOString().slice(0, 10) ?? null,
              })),
            }
          : null,
      };
    });
  });

  /** Sus rendiciones, de la más nueva a la más vieja. El detalle va aparte para no traer
   *  todos los gastos de todos los períodos en una sola respuesta. */
  app.get('/portal/rendiciones', async (request, reply) => {
    const p = await requirePropietario(request, reply);
    if (!p) return;
    const rends = await prisma.rendicion.findMany({
      where: { propietarioId: p.propietarioId, inmobiliariaId: p.inmobiliariaId },
      orderBy: [{ periodo: 'desc' }, { rendidoAt: 'desc' }],
      select: {
        id: true,
        periodo: true,
        montoBruto: true,
        comisionPct: true,
        comisionMonto: true,
        totalGastos: true,
        totalIngresos: true,
        montoNeto: true,
        rendidoAt: true,
        metodo: true,
      },
    });
    return rends.map((r) => ({
      id: r.id,
      periodo: r.periodo,
      // Los cinco números que Camila enumeró, con los mismos nombres con los que los pensó.
      cobrado: dec(r.montoBruto),
      comisionPct: r.comisionPct,
      comision: dec(r.comisionMonto),
      gastos: dec(r.totalGastos),
      otrosIngresos: dec(r.totalIngresos),
      teDepositamos: dec(r.montoNeto),
      rendidoAt: r.rendidoAt.toISOString(),
      metodo: r.metodo,
    }));
  });

  /** El detalle de UNA rendición: de dónde salió cada peso. */
  app.get('/portal/rendiciones/:id', async (request, reply) => {
    const p = await requirePropietario(request, reply);
    if (!p) return;
    const { id } = request.params as { id: string };
    // El `where` lleva el propietario y el tenant, no sólo el id: pedir el id de la rendición
    // de otro propietario devuelve 404, no su contenido.
    const r = await prisma.rendicion.findFirst({
      where: { id, propietarioId: p.propietarioId, inmobiliariaId: p.inmobiliariaId },
      select: {
        id: true,
        periodo: true,
        montoBruto: true,
        comisionPct: true,
        comisionMonto: true,
        totalGastos: true,
        totalIngresos: true,
        montoNeto: true,
        rendidoAt: true,
        metodo: true,
        notas: true,
        alquileresRendidos: {
          select: { periodo: true, monto: true, participacion: true, direccion: true },
          orderBy: { periodo: 'asc' },
        },
        gastos: {
          select: { fecha: true, tipo: true, descripcion: true, proveedor: true, monto: true },
          orderBy: { fecha: 'asc' },
        },
        ingresosRendidos: {
          select: { fecha: true, descripcion: true, monto: true, participacion: true },
          orderBy: { fecha: 'asc' },
        },
      },
    });
    if (!r) return reply.code(404).send({ message: 'No encontramos esa rendición' });

    return {
      id: r.id,
      periodo: r.periodo,
      cobrado: dec(r.montoBruto),
      comisionPct: r.comisionPct,
      comision: dec(r.comisionMonto),
      gastos: dec(r.totalGastos),
      otrosIngresos: dec(r.totalIngresos),
      teDepositamos: dec(r.montoNeto),
      rendidoAt: r.rendidoAt.toISOString(),
      metodo: r.metodo,
      notas: r.notas,
      detalleAlquileres: r.alquileresRendidos.map((a) => ({
        periodo: a.periodo,
        direccion: a.direccion,
        participacionPct: a.participacion,
        monto: dec(a.monto),
      })),
      detalleGastos: r.gastos.map((g) => ({
        fecha: g.fecha.toISOString().slice(0, 10),
        tipo: g.tipo,
        descripcion: g.descripcion,
        proveedor: g.proveedor,
        monto: dec(g.monto),
      })),
      detalleIngresos: r.ingresosRendidos.map((i) => ({
        fecha: i.fecha.toISOString().slice(0, 10),
        descripcion: i.descripcion,
        participacionPct: i.participacion,
        monto: dec(i.monto),
      })),
    };
  });

  /** Los reclamos de SUS propiedades: qué se rompió y en qué anda. */
  app.get('/portal/reclamos', async (request, reply) => {
    const p = await requirePropietario(request, reply);
    if (!p) return;
    // Las propiedades salen de la participación, no de un id que venga de afuera.
    const propIds = (
      await prisma.participacionPropietario.findMany({
        where: { propietarioId: p.propietarioId, inmobiliariaId: p.inmobiliariaId },
        select: { propiedadId: true },
      })
    ).map((x) => x.propiedadId);
    if (propIds.length === 0) return [];

    const reclamos = await prisma.reclamo.findMany({
      where: { inmobiliariaId: p.inmobiliariaId, propiedadId: { in: propIds } },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        descripcion: true,
        categoria: true,
        urgencia: true,
        estado: true,
        createdAt: true,
        resueltoAt: true,
        costoTrabajo: true,
        pagador: true,
        propiedad: { select: { direccion: true, complejo: true, consorcio: { select: { nombre: true } } } },
      },
    });
    return reclamos.map((r) => ({
      id: r.id,
      descripcion: r.descripcion,
      categoria: r.categoria,
      urgencia: r.urgencia,
      estado: r.estado,
      creadoAt: r.createdAt.toISOString(),
      resueltoAt: r.resueltoAt?.toISOString() ?? null,
      // Va la descripción del desperfecto —es su propiedad, tiene derecho a saber qué se
      // rompió— pero NO las fotos ni los `eventos`, que son la conversación con el inquilino.
      // Eso es de él y el propietario no lo necesita para saber qué se arregló y cuánto salió.
      costo: r.costoTrabajo != null ? dec(r.costoTrabajo) : null,
      pagador: r.pagador,
      direccion: r.propiedad?.direccion ?? null,
      complejo: r.propiedad?.consorcio?.nombre ?? r.propiedad?.complejo ?? null,
    }));
  });
}
