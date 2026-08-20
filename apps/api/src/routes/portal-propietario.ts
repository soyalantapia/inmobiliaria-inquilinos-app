import type { FastifyInstance, FastifyReply } from 'fastify';
import bcrypt from 'bcryptjs';
import { randomInt } from 'node:crypto';
import { z } from 'zod';
import { OtpRequestSchema, OtpVerifySchema, yaVencio, type JwtPropietario } from '@llave/shared';
import { prisma } from '../db.js';
import { requirePropietario } from '../auth/guards.js';
import { enviarOtp } from '../mailer.js';
import { alquilerCobradoSinRendirDePropiedad } from '../lib/rendicion-pendiente.js';

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
 *    inmobiliaria. La respuesta es siempre la misma, y el bcrypt —la parte cara— se ejecuta
 *    igual en las dos ramas para que el TIEMPO tampoco lo delate.
 *    ⚠️ Queda una diferencia menor: cuando el email existe hay además dos escrituras a la DB.
 *    Es un orden de magnitud menos que el bcrypt, pero no es cero. Cerrarlo del todo pide
 *    encolar el envío y responder antes de tocar la base.
 * 5. **Deuda conocida, compartida con los otros dos logins:** el rate limit del verify se
 *    keyea por IP, así que un atacante distribuido lo diluye, y no hay contador de intentos
 *    POR CÓDIGO. `auth.ts` ya documenta esa deuda y pide una migración para cerrarla; el
 *    portal la hereda igual y no la empeora.
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
      // `activo: true` en las TRES puertas del portal (pedir código, verificarlo y
      // cambiar de cartera). La baja es POR FILA, no por persona: el mismo email
      // puede ser propietario en varias inmobiliarias, y que una lo dé de baja no
      // puede cerrarle el acceso a las otras.
      const propietarios = await prisma.propietario.findMany({
        where: { email: emailLc, activo: true },
        select: { id: true },
      });

      // El bcrypt va SIEMPRE, exista o no el email. Es la parte cara del request (bcryptjs es
      // JS puro y bloquea el event loop), así que hacerlo sólo en la rama "existe" convertía
      // el tiempo de respuesta en un oráculo de enumeración: cientos de milisegundos contra
      // unos pocos. Calcularlo igual y tirarlo empareja el costo dominante.
      const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
      const codeHash = bcrypt.hashSync(code, 8);
      if (propietarios.length > 0) {
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
        // T-53-N1 — El envío NO se espera, y es por lo mismo que el bcrypt de arriba se
        // calcula siempre: con SMTP configurado, el envío es el costo DOMINANTE del request
        // (cientos de ms contra los pocos del bcrypt) y corre sólo en esta rama, la del email
        // que existe. Awaitearlo devolvía el tiempo de respuesta como oráculo de enumeración y
        // deshacía el emparejamiento de arriba.
        //
        // Nada de la respuesta depende del resultado: se contesta `{ ok: true }` igual salga o
        // falle. El error se sigue logueando, sólo que fuera del camino del request.
        void enviarOtp(emailLc, code)
          .then((enviado) => {
            if (!enviado)
              app.log.info({ email: emailLc, ...codeEnLog(code) }, 'OTP propietario generado (SMTP no configurado)');
            else app.log.info({ email: emailLc }, 'OTP propietario enviado por email');
          })
          .catch((err: unknown) => {
            app.log.error(
              { email: emailLc, ...codeEnLog(code), err: (err as Error).message },
              'OTP propietario: fallo el envío SMTP',
            );
          });
      }
      return { ok: true };
    },
  );

  /**
   * Todos los rechazos de `verify` tardan lo mismo, midan lo que midan por dentro.
   *
   * `request` está hecho para no revelar si un email es propietario: contesta `{ ok: true }`
   * siempre. Pero `verify` lo delataba por el RELOJ. Medido acá el 20/08 con un código
   * equivocado en los dos casos: 703 ms para un email real con OTP pendiente contra 253 ms
   * para uno inexistente. El ataque es de dos pasos: pedir el código —200, no dice nada— y
   * después mandar cualquiera y cronometrar.
   *
   * LA DIFERENCIA NO ERA `bcrypt`, que en esta máquina cuesta 19 ms. Era que el camino del
   * email inexistente hace UNA QUERY MENOS, y contra la base remota cada una son ~450 ms.
   * Primero probé igualar el trabajo con una query señuelo: bajó de 451 a 259 ms de spread y
   * ahí se estancó, porque igualar costos de I/O es perseguir un número que depende de la red,
   * del pool y del planner. Un piso fijo no depende de nada de eso: si el handler tardó menos,
   * espera; si tardó más, no espera. Plano por construcción y verificable con un cronómetro.
   *
   * Sólo se aplica a los RECHAZOS. El camino feliz no necesita padding: para llegar hay que
   * saber un código válido, y quien lo sabe ya sabe que el email existe.
   */
  const PISO_RECHAZO_MS = 900;
  const rechazar = async (desde: bigint, reply: FastifyReply, mensaje: string) => {
    const transcurrido = Number(process.hrtime.bigint() - desde) / 1e6;
    if (transcurrido < PISO_RECHAZO_MS) {
      await new Promise((r) => setTimeout(r, PISO_RECHAZO_MS - transcurrido));
    }
    return reply.code(401).send({ message: mensaje });
  };

  app.post(
    '/auth/propietario/otp/verify',
    {
      config: {
        rateLimit: {
          /**
           * EL TOPE ES POR CUENTA, no por IP.
           *
           * El código es de SEIS DÍGITOS y vive diez minutos. Los topes que había —300/min
           * global y 20 cada 15' en esta ruta— son los dos por IP, así que acotaban al
           * atacante y no a la cuenta: con varias IPs (un proxy rotativo alcanza) los
           * intentos contra UN propietario no tenían ningún techo. El costo del ataque
           * escalaba con las IPs del atacante, no con las defensas de la cuenta.
           *
           * Con la key por email, ese propietario recibe 10 intentos cada 15 minutos venga
           * de donde venga. El límite por IP no se pierde: el global de 300/min sigue
           * aplicando y es el que frena a quien barre muchas cuentas.
           *
           * CONTRA: alguien puede quemarle los 10 intentos a un dueño y hacerlo esperar. Es
           * una molestia acotada a 15 minutos, y el intercambio es a favor: sin esto, lo que
           * está en juego no es esperar sino que le entren a ver su plata.
           */
          keyGenerator: (req) => {
            const email = (req.body as { email?: unknown } | undefined)?.email;
            return typeof email === 'string' && email.trim()
              ? `otp-prop:${email.trim().toLowerCase()}`
              : `otp-prop-ip:${req.ip}`;
          },
          // `preHandler` y no el `onRequest` por default: ahí el body todavía no está
          // parseado y `req.body` sería undefined, o sea que la key caería SIEMPRE a la IP
          // y este cambio no haría nada. Silenciosamente.
          hook: 'preHandler',
          max: 10,
          timeWindow: '15 minutes',
        },
      },
    },
    async (request, reply) => {
      const desde = process.hrtime.bigint();
      const body = OtpVerifySchema.safeParse(request.body);
      // El 400 no se empareja: es un payload mal formado, no dice nada de ningún email.
      if (!body.success) return reply.code(400).send({ message: 'Email y código de 6 dígitos requeridos' });
      const emailLc = body.data.email.toLowerCase();

      const propietarios = await prisma.propietario.findMany({
        where: { email: emailLc, activo: true },
        select: { id: true, inmobiliariaId: true, nombre: true, apellido: true, inmobiliaria: { select: { nombre: true } } },
      });
      if (propietarios.length === 0) return rechazar(desde, reply, 'Código inválido o vencido');

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
          // Se consumen TODAS las filas del mismo email, no sólo la que matcheó. Con varias
          // carteras se emite una fila por cada una con el MISMO hash: marcar sólo una dejaba
          // las otras vivas 10 minutos, o sea el código ya usado seguía sirviendo para entrar.
          await prisma.codigoOtpPropietario.updateMany({
            where: { propietarioId: { in: propietarios.map((p) => p.id) }, usedAt: null },
            data: { usedAt: new Date() },
          });
          elegido = propietarios.find((p) => p.id === otp.propietarioId) ?? null;
          break;
        }
      }
      if (!elegido) return rechazar(desde, reply, 'Código inválido o vencido');

      // Queda registrado que entró. BEST-EFFORT y sin await bloqueante en el camino feliz:
      // un rastro que rompe el login es peor que no tener rastro. Hasta acá no había forma
      // de contestar "¿algún dueño usó el portal alguna vez?" — el único dato era
      // `CodigoOtpPropietario.usedAt`, que es ambiguo porque también se escribe al invalidar
      // los códigos anteriores.
      //
      // Se marca SÓLO la cartera con la que entró, no las otras del mismo email: si un dueño
      // tiene dos y sólo abre una, decir que accedió a las dos sería mentira.
      await prisma.propietario
        .update({ where: { id: elegido.id }, data: { ultimoAccesoAt: new Date() } })
        .catch((e: unknown) => {
          app.log.warn({ propietarioId: elegido?.id, e }, 'no se pudo registrar el acceso del propietario');
        });

      // RIESGO RESIDUAL, deliberadamente visible: `Propietario.email` lo tipea a mano el staff
      // de cada inmobiliaria y nadie lo verifica nunca. Si el mismo string aparece en dos
      // tenants —un typo, un mail placeholder tipo info@…, el mail del contador usado para
      // varios dueños— quien controle esa casilla ve las dos carteras. Es inherente a que el
      // email sea la credencial, no un bug de scoping, pero tiene que ser DETECTABLE: sin este
      // log no habría forma de enterarse. La persona además lo ve, porque el selector le
      // muestra el nombre de cada inmobiliaria.
      const tenants = new Set(propietarios.map((x) => x.inmobiliariaId));
      if (tenants.size > 1) {
        app.log.warn(
          { email: emailLc, tenants: tenants.size, propietarios: propietarios.length },
          'Portal propietario: un mismo email es propietario en varias inmobiliarias',
        );
      }

      const payload: JwtPropietario = {
        kind: 'propietario',
        propietarioId: elegido.id,
        inmobiliariaId: elegido.inmobiliariaId,
        // El email que ACABA de probarse, no el de la fila: queda congelado en el token y es
        // lo único que autoriza cambiar de cartera. Ver JwtPropietarioSchema.
        email: emailLc,
      };
      return {
        token: app.jwt.sign(payload, { expiresIn: TOKEN_TTL }),
        nombre: `${elegido.nombre} ${elegido.apellido}`.trim(),
        inmobiliaria: elegido.inmobiliaria.nombre,
        // Si administra con más de una inmobiliaria, el front tiene que poder ofrecer el
        // cambio: sin esto entraría a una cartera al azar y no sabría que las otras existen.
        // Va también el NOMBRE de cada ficha, no sólo la inmobiliaria: dos propietarios de la
        // MISMA inmobiliaria pueden compartir email legítimamente —un matrimonio, el contador
        // de varios dueños— y sin el nombre el selector mostraba dos filas idénticas, imposible
        // de elegir. (Por eso tampoco se hizo el email único por tenant: rompería esos casos
        // reales sin cerrar el problema de fondo, que es entre tenants.)
        carteras: propietarios.map((p) => ({
          propietarioId: p.id,
          nombre: `${p.nombre} ${p.apellido}`.trim(),
          inmobiliaria: p.inmobiliaria.nombre,
          actual: p.id === elegido!.id,
        })),
      };
    },
  );

  /**
   * Cambiar de cartera sin volver a pedir un código. Sólo entre carteras del MISMO email.
   *
   * ⚠️ El email sale del TOKEN (lo probó el OTP y quedó firmado), NUNCA de la base. Releerlo
   * de la fila era un pivote CROSS-TENANT: `Propietario.email` lo edita a mano cualquier
   * ADMIN/OPERADOR/CARGA de cualquier inmobiliaria por `PUT /propietarios/:id`, así que
   * alcanzaba con darse de alta a uno mismo como propietario, sacar un token legítimo,
   * después cambiarle el email al de la víctima y pedir su cartera: el chequeo releía el
   * email nuevo y matcheaba. Es el mismo motivo por el que `/auth/inquilino/elegir` usa
   * `persona.email` del JWT y no un lookup.
   */
  app.post('/auth/propietario/elegir', async (request, reply) => {
    const actual = await requirePropietario(request, reply);
    if (!actual) return;
    const body = z.object({ propietarioId: z.string().min(1) }).safeParse(request.body);
    if (!body.success) return reply.code(400).send({ message: 'propietarioId requerido' });

    const destino = await prisma.propietario.findFirst({
      where: { id: body.data.propietarioId, email: actual.email, activo: true },
      select: { id: true, inmobiliariaId: true, nombre: true, apellido: true, inmobiliaria: { select: { nombre: true } } },
    });
    // 404 y no 403: no confirmamos que el id exista pero sea de otro. Es el mismo criterio
    // que usa el resto del sistema para no filtrar la existencia de recursos ajenos.
    if (!destino) return reply.code(404).send({ message: 'No encontramos esa cartera' });

    const payload: JwtPropietario = {
      kind: 'propietario',
      propietarioId: destino.id,
      inmobiliariaId: destino.inmobiliariaId,
      // El MISMO email probado, no el de la fila destino: si alguien le cambió el email a esa
      // fila después del login, el token nuevo no puede heredar esa identidad nueva.
      email: actual.email,
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
        // `cbuAlias` se trae para saber SI HAY, no para mandarlo. Abajo sale como booleano.
        //
        // El número no se devuelve nunca: el dueño ya sabe su CBU, y ponerlo acá sólo agranda
        // lo que se filtra si el token se pierde. Ni el número ni sus últimos cuatro dígitos.
        cbuAlias: true,
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
      /**
       * Si la inmobiliaria tiene su CBU cargado. SÓLO el booleano.
       *
       * POR QUÉ EXISTE: `POST /rendiciones` corta con 409 cuando falta (plata.ts:1970), así que
       * el dueño sin CBU cargado ve el "cobrado y todavía sin rendirte" crecer mes a mes sin
       * ninguna pista de por qué no le depositan. El panel hasta tiene un KPI de "propietarios
       * sin CBU"; el único que no se enteraba era el que puede resolverlo en treinta segundos.
       */
      tieneCbu: Boolean(yo.cbuAlias?.trim()),
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
    // Una sola foto del tiempo para todas las filas: si cada `new Date()` fuera distinto, dos
    // cuotas que vencen el mismo día podrían salir con estados distintos en la misma respuesta.
    const ahora = new Date();
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
                // CUÁNDO Y CON QUÉ ÍNDICE LE SUBE EL ALQUILER.
                //
                // Es una de las dos preguntas con las que el dueño llama —la otra es "¿ya me
                // depositaste?"—, y el sistema tenía la respuesta guardada sin mostrarla. Sin
                // esto sólo ve el monto de hoy, que no le dice si le va a cambiar el mes que
                // viene ni cuánto.
                indiceAjuste: true,
                frecuenciaAjusteMeses: true,
                proximoAjuste: true,
                // El último ajuste aplicado, con su motivo ("ICL 12 meses (+45%)"): es lo que
                // convierte "te sube en octubre" en algo que el dueño puede dimensionar,
                // porque ya vio cuánto le subió la vez pasada.
                ajustes: {
                  where: { inmobiliariaId: p.inmobiliariaId },
                  orderBy: { periodoDesde: 'desc' },
                  take: 1,
                  select: { montoAnterior: true, montoNuevo: true, periodoDesde: true, motivo: true },
                },
                inquilinoTitular: { select: { nombre: true, apellido: true } },
                liquidaciones: {
                  // El tenant, otra vez y explícito. Acá ya viene garantizado por la cadena
                  // —la participación de arriba filtra por `p.inmobiliariaId`—, pero esa
                  // garantía son cuatro saltos de relación de razonamiento. Nombrarlo cuesta
                  // una línea y es lo que el guard de `portal-aislamiento.test.ts` exige del
                  // resto del archivo; este tramo se le escapaba por estar anidado.
                  where: { inmobiliariaId: p.inmobiliariaId },
                  orderBy: { periodo: 'desc' },
                  // Doce y no seis: el dueño mira su propiedad por AÑO —para el contador, para
                  // decidir si renueva, para ver si el inquilino se atrasa siempre en el mismo
                  // mes—, y con seis se quedaba sin la mitad del período fiscal sin saberlo.
                  // Son 12 filas livianas por propiedad (período, estado, monto, vencimiento y
                  // el último pago conciliado), no un join caro.
                  take: 12,
                  select: {
                    periodo: true,
                    estado: true,
                    montoTotal: true,
                    fechaVencimiento: true,
                    // La fecha REAL en que entró la plata, que es lo que ella quiere auditar.
                    //
                    // Se trae `condonado` y se decide en el mapeo, NO acá: condonar una deuda
                    // crea un Pago CONCILIADO con `condonado: true` y fecha de hoy
                    // (plata.ts:738) — plata que NUNCA entró. Sin distinguirlo, el portal le
                    // decía al propietario "pagó el 19/08" por algo que la inmobiliaria le
                    // perdonó al inquilino, y la rendición —que sí filtra condonado
                    // (rendicion-pendiente.ts:95)— nunca se lo iba a depositar. Es
                    // exactamente el número que este portal existe para que él audite.
                    //
                    // Sin `take: 1`: una cuota puede tener un pago real Y una condonación del
                    // resto. Filtrando en la query con take 1 nos quedábamos con la más nueva
                    // —la condonación— y se perdía la fecha del pago que sí entró.
                    pagos: {
                      where: { estado: 'CONCILIADO', inmobiliariaId: p.inmobiliariaId },
                      orderBy: { fechaTransferencia: 'desc' },
                      select: { fechaTransferencia: true, monto: true, condonado: true },
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
              /**
               * El ajuste del alquiler: cuándo, con qué índice y cuánto fue la vez pasada.
               *
               * `proximoAjuste` puede ser null —contratos viejos, o FIJO sin fecha cargada— y
               * eso se dice como "no hay fecha cargada", no se inventa una calculándola de
               * `fechaInicio + frecuencia`: si la inmobiliaria no la cargó, cualquier fecha
               * que pongamos acá es una promesa que el sistema no puede sostener.
               */
              ajuste: {
                indice: c.indiceAjuste,
                cadaMeses: c.frecuenciaAjusteMeses,
                proximo: c.proximoAjuste ? c.proximoAjuste.toISOString().slice(0, 10) : null,
                ultimo: c.ajustes[0]
                  ? {
                      desde: c.ajustes[0].periodoDesde,
                      de: dec(c.ajustes[0].montoAnterior),
                      a: dec(c.ajustes[0].montoNuevo),
                      motivo: c.ajustes[0].motivo,
                    }
                  : null,
              },
              inquilino: c.inquilinoTitular
                ? `${c.inquilinoTitular.nombre} ${c.inquilinoTitular.apellido ?? ''}`.trim()
                : null,
              periodos: c.liquidaciones.map((l) => ({
                periodo: l.periodo,
                // El estado se DERIVA, no se copia de la base — igual que en el panel
                // (`liqVencida` en core.ts). El barrido del devengo sólo toca filas
                // PENDIENTE y a propósito NO toca las PARCIAL, así que una cuota de abril
                // en la que el inquilino puso 50.000 de 500.000 sigue diciendo `PARCIAL`
                // en la fila cuatro meses después. Copiándola, el dueño la veía en ámbar
                // como "parcial · pagó el 5 de abril" mientras la inmobiliaria la cobra
                // como morosa: dos versiones del mismo hecho, en la pantalla que existe
                // justamente para que él la audite.
                // `yaVencio` y no una comparación a mano: respeta el día civil argentino, así
                // que la cuota que vence HOY no le figura vencida al dueño antes de tiempo.
                estado:
                  (l.estado === 'PENDIENTE' || l.estado === 'PARCIAL') &&
                  yaVencio(l.fechaVencimiento, ahora)
                    ? 'VENCIDO'
                    : l.estado,
                // Lo que el estado no dice: de un parcial, CUÁNTO entró. Es lo que explica
                // por qué la rendición de ese mes vino corta, y la API ya lo tenía a mano.
                pagado: l.pagos.filter((pg) => !pg.condonado).reduce((a, pg) => a + dec(pg.monto), 0) || null,
                monto: dec(l.montoTotal),
                vence: l.fechaVencimiento.toISOString().slice(0, 10),
                // Sólo los pagos REALES dan fecha de cobro. Ver el comentario del select.
                pagoAt:
                  l.pagos.find((pg) => !pg.condonado)?.fechaTransferencia?.toISOString().slice(0, 10) ?? null,
                // Y la condonación se dice, en vez de desaparecer: una cuota saldada sin
                // fecha de pago, al lado de otras con fecha, deja al propietario suponiendo
                // lo que quiera —incluido que se la quedaron—. Que figure por qué.
                condonada: l.pagos.some((pg) => pg.condonado),
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
        moneda: true,
        rendidoAt: true,
        metodo: true,
        // ANULADA: se manda, no se oculta. Al dueño ya le apareció ese depósito en la
        // pantalla y probablemente lo imprimió; hacerla desaparecer sin decir nada es
        // exactamente el problema que la baja lógica viene a resolver.
        anuladaAt: true,
        motivoAnulacion: true,
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
      // Sin esto el front formatea todo como pesos: una rendición en dólares se le mostraba
      // al dueño como "$ 237.960" en vez de "US$ 237.960".
      moneda: r.moneda,
      rendidoAt: r.rendidoAt.toISOString(),
      metodo: r.metodo,
      anulada: r.anuladaAt
        ? { fecha: r.anuladaAt.toISOString(), motivo: r.motivoAnulacion }
        : null,
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
        moneda: true,
        rendidoAt: true,
        metodo: true,
        // Si está anulada, el detalle lo dice. Sin esto el dueño despliega la tarjeta tachada
        // y adentro lee el desglose entero sin una marca —y encima puede imprimirlo—: un papel
        // que afirma un depósito que la inmobiliaria deshizo.
        anuladaAt: true,
        motivoAnulacion: true,
        // `notas` NO se expone. En el panel el campo se rotula sólo "Notas (opcional)" y el
        // equipo lo viene escribiendo hace meses dando por sentado que es interno (por qué se
        // retuvo plata, comentarios sobre el dueño o el inquilino, arreglos de palabra).
        // Publicarlo ahora sería filtrar retroactivamente todo eso por un cambio de audiencia,
        // no por una query mal filtrada. Si se quiere una nota PARA el propietario, va un campo
        // nuevo y rotulado como tal.
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
      anulada: r.anuladaAt
        ? { fecha: r.anuladaAt.toISOString(), motivo: r.motivoAnulacion }
        : null,
      cobrado: dec(r.montoBruto),
      comisionPct: r.comisionPct,
      comision: dec(r.comisionMonto),
      gastos: dec(r.totalGastos),
      otrosIngresos: dec(r.totalIngresos),
      teDepositamos: dec(r.montoNeto),
      moneda: r.moneda,
      rendidoAt: r.rendidoAt.toISOString(),
      metodo: r.metodo,
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
    // Traemos también el contrato ACTUAL de cada una: es el recorte temporal (ver abajo).
    const participaciones = await prisma.participacionPropietario.findMany({
      where: { propietarioId: p.propietarioId, inmobiliariaId: p.inmobiliariaId },
      select: { propiedad: { select: { id: true, contratoActual: { select: { id: true } } } } },
    });
    // Sólo los contratos VIGENTES. `ParticipacionPropietario` no tiene `desde`/`hasta`, así
    // que no hay forma de saber desde cuándo esta persona es dueña — y sin ese recorte, quien
    // compra un departamento en marzo abre el portal y lee los reclamos de 2024 de un inquilino
    // con el que no tuvo ninguna relación, con la `descripcion` en texto libre que esa persona
    // escribió. El contrato vigente es el recorte más preciso que el dato de hoy permite.
    // Cuando exista la vigencia de la participación, esto se puede ampliar a "desde que sos
    // dueño" — queda anotado como tarea nueva.
    const contratoIds = participaciones
      .map((x) => x.propiedad.contratoActual?.id)
      .filter((id): id is string => !!id);
    if (contratoIds.length === 0) return [];

    const reclamos = await prisma.reclamo.findMany({
      where: { inmobiliariaId: p.inmobiliariaId, contratoId: { in: contratoIds } },
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
        // El costo del reclamo se denomina en la moneda DEL CONTRATO (operacion.ts, al
        // imputarlo) y la rendición sólo levanta los de su misma moneda. Sin mandarla, el
        // portal mostraba "costó $1.200" por un arreglo de US$1.200.
        contrato: { select: { moneda: true } },
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
      monedaCosto: r.contrato?.moneda ?? 'ARS',
      pagador: r.pagador,
      direccion: r.propiedad?.direccion ?? null,
      complejo: r.propiedad?.consorcio?.nombre ?? r.propiedad?.complejo ?? null,
    }));
  });

  /**
   * Los avisos que la inmobiliaria le mandó a sus propietarios.
   *
   * POR QUÉ FALTABA Y POR QUÉ IMPORTA: cada anuncio se crea con `canales: ['APP', 'EMAIL']` —
   * el comentario del panel dice "decisión de producto: siempre ambos canales"— pero para el
   * propietario el canal APP no existía en ningún lado. Le llegaba el mail y, si lo borraba o
   * se le perdía entre 200 mensajes, no tenía dónde volver a leerlo. El sistema declaraba un
   * canal que no cumplía.
   *
   * Sólo los de audiencia TODOS_PROPIETARIOS: las otras audiencias son de inquilinos o de
   * consorcios y no le corresponden. Y sólo los YA enviados — una fila de `Anuncio` sólo se
   * crea al enviar (`anuncios.ts`), así que no hay borradores que filtrar.
   *
   * Sin acuse de lectura: `AnuncioAcuse` está atado a `inquilinoId`, no al propietario. Marcar
   * como leído pediría una migración y no es lo que falta: lo que falta es poder leerlo.
   */
  app.get('/portal/anuncios', async (request, reply) => {
    const p = await requirePropietario(request, reply);
    if (!p) return;
    const anuncios = await prisma.anuncio.findMany({
      where: { inmobiliariaId: p.inmobiliariaId, audiencia: 'TODOS_PROPIETARIOS' },
      orderBy: { enviadoAt: 'desc' },
      take: 20,
      select: { id: true, titulo: true, cuerpo: true, prioridad: true, enviadoAt: true },
    });
    return anuncios.map((a) => ({
      id: a.id,
      titulo: a.titulo,
      cuerpo: a.cuerpo,
      prioridad: a.prioridad,
      enviadoAt: a.enviadoAt.toISOString(),
    }));
  });

  /**
   * Lo que ya se cobró de sus unidades y todavía NO se le rindió.
   *
   * POR QUÉ EXISTE: la pestaña de Pagos le muestra lo que YA se le depositó, y la de Unidades
   * que el inquilino pagó tal día. Entre las dos quedaba justo el hueco de la llamada más
   * frecuente del dueño: *"¿ya me mandaste lo de agosto?"*. La cuenta existía hace rato en
   * `lib/rendicion-pendiente.ts` —la usan los guards de cambio de modo de cobranza y de reparto
   * de dueños— y el portal no la exponía.
   *
   * SE INFORMA EL NÚMERO DE LA PROPIEDAD, NO UN NETO ESTIMADO. Es alquiler cobrado y sin rendir
   * de la unidad: de ahí la rendición todavía va a descontar la comisión y los gastos, y a
   * repartir por participación si hay más de un dueño. Anticipar ese neto exigiría replicar la
   * aritmética de `POST /rendiciones` —con sus dos caps— y un número que no coincida con el
   * depósito real sería peor que no mostrar ninguno. El front lo dice con esas palabras.
   *
   * Excluye mora, expensas y condonaciones, igual que la rendición: el helper es el mismo.
   */
  app.get('/portal/pendiente', async (request, reply) => {
    const p = await requirePropietario(request, reply);
    if (!p) return;
    const participaciones = await prisma.participacionPropietario.findMany({
      where: { propietarioId: p.propietarioId, inmobiliariaId: p.inmobiliariaId },
      select: {
        porcentaje: true,
        propiedad: {
          select: {
            id: true,
            direccion: true,
            complejo: true,
            consorcio: { select: { nombre: true } },
            // NO se trae `contratoActual.moneda`, y no es un olvido: era justamente de donde
            // salía la moneda cuando este endpoint pintaba los dólares con signo de pesos.
            // Dejarlo en el select invita a volver a usarlo. La moneda viaja con cada período.
          },
        },
      },
    });

    // UNA FILA POR (UNIDAD, MONEDA), no una por unidad.
    //
    // La moneda NO puede salir de `contratoActual`: esta cuenta mira todos los contratos de la
    // propiedad, incluidos los TERMINADOS —para eso existe—, así que la plata sin rendir puede
    // ser de un contrato en dólares que ya venció, y entonces `contratoActual` es null (o es
    // otro, en pesos). Con el fallback a 'ARS' el dueño veía dólares con signo de pesos, que es
    // exactamente el bug que se arregló persistiendo `Rendicion.moneda`.
    //
    // Y por lo mismo no se suma un único total: una unidad con historia en dos monedas daría un
    // número que no existe. Se corta por moneda y cada corte lleva la suya.
    const unidades = await Promise.all(
      participaciones.map(async (part) => {
        // T-52 — `soloRendible`: lo que el dueño cobró DIRECTO en su cuenta (contratos
        // PROPIETARIO_DIRECTO) no lo rinde nadie, así que mostrarlo como "todavía sin rendirte"
        // le dice que la inmobiliaria le retiene plata que él ya tiene, y no hay ninguna acción
        // que baje ese número a cero.
        // T-53 — `duenio`: la cuenta pasa a ser LA PARTE DE ÉL, no la de la propiedad.
        // `AlquilerRendido` cuelga de `Rendicion.propietarioId`, así que sin este filtro lo ya
        // rendido a un copropietario descontaba del otro: con dos dueños 60/40, después de
        // rendirle al primero, al segundo le seguía apareciendo la parte del primero como
        // propia. Espeja el doble cap de POST /rendiciones (plata.ts:2042).
        const pend = await alquilerCobradoSinRendirDePropiedad(part.propiedad.id, prisma, p.inmobiliariaId, {
          soloRendible: true,
          duenio: { propietarioId: p.propietarioId, porcentaje: Number(part.porcentaje) },
        });
        const porMoneda = new Map<string, { total: number; periodos: typeof pend.periodos }>();
        for (const per of pend.periodos) {
          const corte = porMoneda.get(per.moneda) ?? { total: 0, periodos: [] };
          corte.total = Math.round((corte.total + per.monto) * 100) / 100;
          corte.periodos.push(per);
          porMoneda.set(per.moneda, corte);
        }
        return [...porMoneda.entries()].map(([moneda, corte]) => ({
          propiedadId: part.propiedad.id,
          direccion: part.propiedad.direccion,
          complejo: part.propiedad.consorcio?.nombre ?? part.propiedad.complejo ?? null,
          participacionPct: part.porcentaje,
          moneda,
          total: corte.total,
          periodos: corte.periodos,
        }));
      }),
    ).then((filas) => filas.flat());
    // Sólo las que tienen algo pendiente: una lista de ceros no contesta nada.
    return unidades.filter((u) => u.total > 0);
  });
}
