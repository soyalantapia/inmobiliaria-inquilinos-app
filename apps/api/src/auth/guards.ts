import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  JwtPayloadSchema,
  JwtPersonaSchema,
  JwtProfesionalSchema,
  JwtPropietarioSchema,
  rolTienePermiso,
  type Capacidad,
  type JwtPayload,
  type JwtInquilino,
  type JwtPersona,
  type JwtUsuario,
} from '@llave/shared';
import { prisma } from '../db.js';
import { linkDeVisitaVencido } from '../lib/vigencia-link-visita.js';

/** Verifica el Bearer token y devuelve el payload tipado. 401 si falta/inválido. */
export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<JwtPayload | null> {
  try {
    await request.jwtVerify();
  } catch {
    await reply.code(401).send({ message: 'No autenticado' });
    return null;
  }
  const parsed = JwtPayloadSchema.safeParse(request.user);
  if (!parsed.success) {
    await reply.code(401).send({ message: 'Token inválido' });
    return null;
  }
  return parsed.data;
}

/**
 * Exige un usuario de inmobiliaria (no inquilino), opcionalmente con una capacidad.
 *
 * REVALIDA CONTRA LA DB en cada request, igual que los guards del co-inquilino y
 * del profesional. No es paranoia: el token dura 15 días (TOKEN_TTL), y hasta
 * ahora el rol salía del JWT y `activo` se miraba SÓLO en el login. O sea que
 * dar de baja a un empleado no le sacaba el acceso —seguía conciliando pagos y
 * rindiendo a propietarios desde su sesión abierta hasta que venciera el token—
 * y bajarle el rol de ADMIN a LECTURA tampoco tenía efecto.
 *
 * El rol AUTORITATIVO es el de la tabla, no el del token: se devuelve ese, así
 * que todo lo que lee `u.rol` aguas abajo ve el vigente. El costo es un lookup
 * por PK por request, dentro del datacenter; el agujero que cierra no admite
 * una ventana de 15 días.
 */
export async function requireUsuario(
  request: FastifyRequest,
  reply: FastifyReply,
  capacidad?: Capacidad,
): Promise<JwtUsuario | null> {
  const payload = await requireAuth(request, reply);
  if (!payload) return null;
  if (payload.kind !== 'usuario') {
    await reply.code(403).send({ message: 'Solo para usuarios del panel' });
    return null;
  }
  const vigente = await prisma.usuario.findUnique({
    where: { id: payload.userId },
    select: { activo: true, rol: true, inmobiliariaId: true },
  });
  // Borrado o dado de baja → 401 (no 403): la sesión ya no existe, el panel
  // tiene que mandarlo al login en vez de mostrarle un shell roto.
  if (!vigente || !vigente.activo) {
    await reply.code(401).send({ message: 'Tu acceso fue dado de baja' });
    return null;
  }
  // El tenant también sale de la DB: un token no puede seguir apuntando a la
  // inmobiliaria vieja si el usuario se movió (la regla de oro es el aislamiento
  // por inmobiliariaId, y este es el único lugar donde entra al request).
  const actual: JwtUsuario = {
    ...payload,
    rol: vigente.rol,
    inmobiliariaId: vigente.inmobiliariaId,
  };
  if (capacidad && !rolTienePermiso(actual.rol, capacidad)) {
    await reply.code(403).send({ message: `Tu rol no permite: ${capacidad}` });
    return null;
  }
  return actual;
}

/**
 * Exige un inquilino TITULAR y **revalida contra la DB**.
 *
 * Antes devolvía el payload crudo del JWT sin una sola query, y eso hacía al
 * titular literalmente irrevocable: borrarle la fila `Inquilino` no le sacaba el
 * acceso, porque nadie la consultaba. Con un TTL de 15 días, esa es la ventana
 * más grande del sistema.
 *
 * El razonamiento no es nuevo: es el mismo que ya está escrito tres funciones más
 * abajo, en la rama de co-inquilino de `requireContratoAcceso` —"el token dura 15
 * días, así que NO confiamos en el permiso/estado del JWT… antes seguía entrando
 * con su permiso viejo = agujero real"—. Se aplicó al invitado y no al titular,
 * que es el que más ve.
 *
 * Se revalidan DOS cosas, y ninguna necesitó una columna nueva:
 *
 *  1. **Que la fila siga existiendo** en ese tenant. Borrarla ahora sí revoca.
 *  2. **Que el contrato del token siga siendo el suyo.** Si el token dice
 *     "contrato X" y la fila ya no lo tiene (se reasignó, se desvinculó), el
 *     token quedó apuntando a un alquiler que no le corresponde.
 *
 * Un token SIN contrato (`contratoId: null`, emitido antes de asignarle uno) no
 * se corta: no está reclamando nada. Cortarlo obligaría a re-loguearse a alguien
 * a quien recién le dieron de alta el contrato, que es una regresión de UX sin
 * ninguna ganancia de seguridad.
 */
export async function requireInquilino(request: FastifyRequest, reply: FastifyReply) {
  const payload = await requireAuth(request, reply);
  if (!payload) return null;
  if (payload.kind !== 'inquilino') {
    await reply.code(403).send({ message: 'Solo para inquilinos' });
    return null;
  }
  const revocado = await inquilinoRevocado(payload);
  if (revocado) {
    await reply.code(401).send({ message: revocado });
    return null;
  }
  return payload;
}

/**
 * ¿El token de este titular dejó de valer? Devuelve el mensaje del 401, o null si sigue vigente.
 *
 * Son TRES las puertas del titular, y cada vez que se contaron mal quedó uno abierta:
 *  1. `requireInquilino`
 *  2. la rama `inquilino` de `requireContratoAcceso`
 *  3. `requireAuthOProfesional` (routes/uploads.ts) — **la que faltaba**. Ese guard es propio
 *     de `/uploads` porque además acepta el token del profesional por link mágico, y cuando se
 *     agregó la revalidación se cubrió al co-inquilino y al profesional y se salteó al titular.
 *
 * Por eso está EXPORTADA: el que agregue una cuarta puerta tiene que poder reusar ésta en vez
 * de reimplementarla, que es exactamente cómo se llegó a tener tres versiones de la regla.
 */
export async function inquilinoRevocado(payload: JwtInquilino): Promise<string | null> {
  const fila = await prisma.inquilino.findFirst({
    where: { id: payload.inquilinoId, inmobiliariaId: payload.inmobiliariaId },
    select: { contratoId: true },
  });
  return motivoRevocacionInquilino(payload.contratoId, fila);
}

/**
 * La DECISIÓN, separada de la consulta para poder fijarla con un test puro.
 *
 * `fila: null` = la fila no existe en ese tenant (borrada, o el token apunta a
 * otra inmobiliaria).
 *
 * El caso que hay que proteger es el tercero: un token con `contratoId: null`
 * **no** se revoca aunque la fila ya tenga contrato. Es alguien a quien le dieron
 * de alta el alquiler después de loguearse; cortarlo lo mandaría de vuelta al
 * login sin ganar nada, porque ese token nunca reclamó ningún contrato. La
 * tentación de "simplificar" esto a una igualdad estricta rompe ese caso.
 */
export function motivoRevocacionInquilino(
  contratoIdDelToken: string | null,
  fila: { contratoId: string | null } | null,
): string | null {
  if (!fila) return 'Tu acceso fue dado de baja';
  if (contratoIdDelToken !== null && fila.contratoId !== contratoIdDelToken) {
    return 'Tu acceso a este alquiler cambió. Volvé a entrar.';
  }
  return null;
}

/**
 * ¿El token de este propietario dejó de valer? Devuelve el mensaje del 401, o null.
 *
 * PURA Y EXPORTADA a propósito: la equivalente del inquilino
 * (`motivoRevocacionInquilino`) también lo es, y así se fija en la suite sin base —que corre
 * en segundos— en vez de en la de integración, que tarda horas y por eso no se corre.
 *
 * EL EMAIL ES LA LLAVE DEL PORTAL, y hasta acá nadie lo revalidaba. El staff lo tipea a mano
 * al cargar al propietario y nadie lo verifica nunca: si se carga mal, quien controle esa
 * casilla pide un OTP y entra a ver rendiciones, comisiones, morosidad y nombres de
 * inquilinos. Cuando se detecta y se corrige el mail en la ficha, el token viejo seguía
 * abriendo SIETE DÍAS MÁS —y `/portal/mi-cartera` le devolvía el email nuevo leído de la DB,
 * así que el impostor seguía adentro y encima veía el dato corregido—. La única salida era
 * `activo: false`, que significa otra cosa ("dejó de ser dueño") y se la ve el equipo.
 *
 * ⚠️ ESTO CIERRA LA VENTANA POSTERIOR A LA CORRECCIÓN, NO LA BRECHA. Mientras el typo vive,
 * el que tenga esa casilla entra igual: el OTP se manda al mail que dice la ficha. Lo que se
 * gana es que corregirlo tenga efecto inmediato en vez de en una semana.
 */
export function motivoRevocacionPropietario(
  emailDelToken: string,
  fila: { activo: boolean; email: string | null } | null,
): string | null {
  if (!fila) return 'Sesión vencida';
  if (!fila.activo) return 'Tu acceso fue dado de baja';
  // Insensible a mayúsculas: el OTP normaliza el email a minúsculas antes de buscar la fila,
  // así que un token viejo puede traerlo normalizado y la ficha con la mayúscula que tipeó el
  // operador. Eso no es un cambio de email y no tiene que echar a nadie.
  //
  // Y VACÍO NO MATCHEA CON VACÍO: con un `?? ''` a secas, un token sin email pasaba contra una
  // ficha sin email. `Propietario.email` hoy es obligatorio, pero el día que deje de serlo esa
  // comparación es una puerta abierta, no un caso borde. Lo encontró el test.
  const enLaFicha = (fila.email ?? '').trim().toLowerCase();
  const enElToken = (emailDelToken ?? '').trim().toLowerCase();
  if (!enLaFicha || !enElToken || enLaFicha !== enElToken) {
    // Mensaje DISTINTO al de la baja: al dueño legítimo al que le corrigieron un typo le va a
    // caer este 401, y decirle que lo dieron de baja es falso y genera una llamada.
    return 'Tus datos de acceso cambiaron. Volvé a entrar.';
  }
  return null;
}

/** Datos ya re-validados contra DB del profesional con visita asignada. */
export interface ProfesionalVisitaAcceso {
  visitaId: string;
  inmobiliariaId: string;
  profesionalId: string;
}

/**
 * Exige un profesional con una visita asignada (JWT `kind: 'profesional'`,
 * emitido por GET /visitas-publicas/:token). Re-validamos SIEMPRE contra la DB
 * (no solo el JWT): si la visita se reasignó a otro profesional después de
 * emitido este token, `profesionalId` ya no matchea → 401 (mismo patrón que
 * requireContratoAcceso con co-inquilino: revocación real, no solo confiar en
 * un JWT de larga vida).
 */
export async function requireProfesionalVisita(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<ProfesionalVisitaAcceso | null> {
  // Validamos contra JwtProfesionalSchema directo (NO contra JwtPayloadSchema,
  // que lo excluye a propósito — ver comentario en auth.ts del package shared).
  // Mismo patrón que requirePersona: separación estricta entre tipos de token.
  try {
    await request.jwtVerify();
  } catch {
    await reply.code(401).send({ message: 'No autenticado' });
    return null;
  }
  const parsed = JwtProfesionalSchema.safeParse(request.user);
  if (!parsed.success) {
    await reply.code(403).send({ message: 'Solo para profesionales con visita asignada' });
    return null;
  }
  const payload = parsed.data;
  const visita = await prisma.visitaProfesional.findUnique({
    where: { id: payload.visitaId },
    // `listoAt` y el reclamo, para revalidar la VIGENCIA del link en cada escritura.
    select: {
      inmobiliariaId: true,
      profesionalId: true,
      listoAt: true,
      reclamo: { select: { estado: true, createdAt: true } },
    },
  });
  if (
    !visita ||
    visita.profesionalId !== payload.profesionalId ||
    visita.inmobiliariaId !== payload.inmobiliariaId
  ) {
    await reply.code(401).send({ message: 'Tu acceso a esta visita fue revocado' });
    return null;
  }
  // LA MISMA REGLA QUE EL CANJE DEL LINK, y acá faltaba.
  //
  // La sesión dura tres días; las reglas de vigencia (48 h post-LISTO, reclamo cerrado o
  // rechazado, 60 días de antigüedad) vivían SÓLO en `GET /visitas-publicas/:token`. Así que
  // un JWT emitido antes seguía autorizando escrituras cuando el link ya contestaba 410 —
  // incluido `POST /listo`, que cierra el reclamo, escribe `costoTrabajo` e imputa el costo
  // contra el inquilino o el depósito. `uploads.ts` ya revalidaba para este mismo token: era
  // el vecino que estaba bien.
  if (linkDeVisitaVencido(visita)) {
    await reply.code(401).send({ message: 'Este link ya venció. Pedile uno nuevo a la inmobiliaria.' });
    return null;
  }
  return { visitaId: payload.visitaId, inmobiliariaId: visita.inmobiliariaId, profesionalId: visita.profesionalId };
}

/**
 * Revalida contra la DB un payload YA PARSEADO, sea del kind que sea.
 *
 * POR QUÉ EXISTE. `requireAuth` sólo verifica la firma y el shape: devuelve lo que el token
 * dice, y el token dura 15 días (`TOKEN_TTL`). Todos los guards de este archivo revalidan
 * después contra la tabla — y por eso dar de baja a un empleado, bajarle el rol o revocarle el
 * acceso a un co-inquilino surte efecto al instante. `requireAuth` a secas es la única puerta
 * que NO lo hace, así que llamarlo y usar su resultado es quedarse con la foto de hace 15 días.
 *
 * Se separa del `jwtVerify` a propósito para que `uploads.ts` la pueda usar: ese archivo no
 * puede ARRANCAR con `requireAuth` —también acepta el token del profesional, y una reply no se
 * manda dos veces—, así que parsea primero y revalida después. Antes tenía su propia copia de
 * este dispatch; una segunda copia se desincroniza de la original, que es exactamente cómo
 * nació el bug que ese archivo documenta.
 *
 * Devuelve el payload (con el `rol` VIGENTE de la tabla si es un usuario, no el del token) o
 * null habiendo respondido ya.
 */
export async function revalidarPayload(
  request: FastifyRequest,
  reply: FastifyReply,
  p: JwtPayload,
): Promise<JwtPayload | null> {
  // Se DELEGA en los guards que ya hacen la revalidación en vez de copiarla. Es seguro aunque
  // arranquen con su propio `jwtVerify`: es idempotente —relee el header y vuelve a poblar
  // `request.user`—. Y no manda dos replies: acá ya sabemos qué `kind` es, así que ninguno
  // puede cortar antes de llegar a su propia revalidación.
  if (p.kind === 'usuario') return requireUsuario(request, reply);
  // El titular NO pasa por `exigirContratoActivo`, y eso es a propósito: un ex-inquilino tiene
  // que poder seguir leyendo lo suyo. Lo que sí se corta es la fila borrada o reasignada.
  if (p.kind === 'inquilino') return requireInquilino(request, reply);
  const co = await prisma.coInquilino.findUnique({ where: { id: p.coInquilinoId } });
  if (
    !co ||
    co.estado !== 'ACEPTADO' ||
    co.inmobiliariaId !== p.inmobiliariaId ||
    co.contratoId !== p.contratoId
  ) {
    await reply.code(401).send({ message: 'Tu acceso fue revocado' });
    return null;
  }
  return p;
}

/**
 * `requireAuth` + la revalidación contra la DB. Es lo que hay que usar en un endpoint abierto a
 * cualquier autenticado —sea usuario del panel, inquilino o co-inquilino—; `requireAuth` pelado
 * queda para quien vaya a revalidar por su cuenta (`/auth/me`, que arma la sesión).
 */
export async function requireAuthVigente(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<JwtPayload | null> {
  const p = await requireAuth(request, reply);
  if (!p) return null;
  return revalidarPayload(request, reply, p);
}

/**
 * Exige un token de "persona" (el que emite /auth/otp/verify tras el OTP). Solo
 * habilita listar y elegir alquileres de ese email — NO da acceso a datos de
 * contrato (eso lo gatea requireInquilino con el JwtInquilino de /elegir).
 */
export async function requirePersona(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<JwtPersona | null> {
  // Validamos contra JwtPersonaSchema (NO contra JwtPayloadSchema, que excluye
  // 'persona'). Así un token normal acá da 403 y un token de persona en los
  // endpoints normales da 401 en requireAuth — separación estricta.
  try {
    await request.jwtVerify();
  } catch {
    await reply.code(401).send({ message: 'No autenticado' });
    return null;
  }
  const parsed = JwtPersonaSchema.safeParse(request.user);
  if (!parsed.success) {
    await reply.code(403).send({ message: 'Sesión inválida para esta acción' });
    return null;
  }
  // La identidad de este kind es SÓLO un email adentro del token —no hay id— así
  // que lo único revalidable es que ese email siga siendo el de alguien.
  //
  // SE REVALIDA CONTRA `Inquilino`, NO CONTRA `Persona`, y la distinción no es
  // cosmética: fue un bug. El token se emite en `/auth/otp/verify` desde el email
  // que probó el OTP, que sale de `Inquilino.email`; y el único uso real del
  // token —`/auth/inquilino/elegir`— busca `inquilino.findFirst({ email })`. La
  // `Persona` es la capa que AGRUPA inquilinos, y puede perfectamente no tener
  // email: `buscarOCrearPersona` la crea con `email: null` cuando el alta sólo
  // trajo DNI. Mirando `Persona` acá, ese inquilino sacaba su token del OTP y
  // después se comía un 401 al elegir alquiler — o sea, no podía entrar.
  //
  // Es una revocación más débil que la de los otros guards, y hay que ser claro
  // sobre qué cubre y qué no: cubre el caso real que la motivó, que es un OTP
  // emitido a un email equivocado (un typo, un mail que se corrige después) — al
  // corregirlo, el token viejo deja de abrir. NO cubre revocarle el acceso a
  // alguien cuyo email sigue vigente: para eso hace falta un id en el payload, y
  // eso es cambiar el contrato del token.
  //
  // A propósito SIN scope de inmobiliaria: este kind es cross-tenant por diseño
  // (una persona puede alquilar en varias), así que alcanza con que exista en
  // alguna. El scope por tenant lo hace cada endpoint con el id que elige.
  const existe = await prisma.inquilino.findFirst({
    where: { email: parsed.data.email },
    select: { id: true },
  });
  if (!existe) {
    await reply.code(401).send({ message: 'Tu acceso fue dado de baja' });
    return null;
  }
  return parsed.data;
}

/**
 * Exige un token de PROPIETARIO (portal del propietario, T-23) y revalida contra la DB que
 * la fila siga existiendo.
 *
 * La revalidación no es paranoia: el JWT dura lo que dura, y si al propietario lo borran de
 * la cartera su token seguiría abriendo la puerta hasta que expire. Devolvemos el registro
 * para que el endpoint no lo vuelva a buscar.
 *
 * Valida contra `JwtPropietarioSchema` y NO contra `JwtPayloadSchema` —que excluye este
 * kind— así un token de panel o de inquilino acá da 403, y este token en los endpoints
 * normales da 401 en `requireAuth`. Separación estricta, igual que `persona`.
 */
export async function requirePropietario(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<{ propietarioId: string; inmobiliariaId: string; email: string } | null> {
  try {
    await request.jwtVerify();
  } catch {
    await reply.code(401).send({ message: 'No autenticado' });
    return null;
  }
  const parsed = JwtPropietarioSchema.safeParse(request.user);
  if (!parsed.success) {
    await reply.code(403).send({ message: 'Sesión inválida para esta acción' });
    return null;
  }
  // El par (id, inmobiliariaId) se verifica JUNTO: un token con un propietarioId válido
  // pero el inmobiliariaId de otro tenant no matchea y se cae acá.
  const fila = await prisma.propietario.findFirst({
    where: { id: parsed.data.propietarioId, inmobiliariaId: parsed.data.inmobiliariaId },
    // `email` entra al select porque ahora se revalida: ver `motivoRevocacionPropietario`.
    select: { id: true, inmobiliariaId: true, activo: true, email: true },
  });
  const revocado = motivoRevocacionPropietario(parsed.data.email, fila);
  if (revocado) {
    await reply.code(401).send({ message: revocado });
    return null;
  }
  // ESTE es el único punto de revocación que tiene el portal. El token dura 7 días y no hay
  // logout server-side ni denylist: lo que no se corte acá sigue abierto una semana.
  //
  // 401 y no 403, igual que `requireUsuario`: la sesión ya no existe, el portal tiene que
  // mandarlo al login en vez de mostrarle un shell roto.
  if (!fila) return null; // inalcanzable: `motivoRevocacionPropietario` ya cortó con null.
  // El email va del TOKEN, no de la fila: es el que probó el OTP y no lo puede mover nadie
  // editando el registro. Ver la nota de JwtPropietarioSchema.
  return { propietarioId: fila.id, inmobiliariaId: fila.inmobiliariaId, email: parsed.data.email };
}

type Permiso = 'VER' | 'PAGAR' | 'COMPLETO';
const RANGO_PERMISO: Record<Permiso, number> = { VER: 1, PAGAR: 2, COMPLETO: 3 };

/** Acceso resuelto a un contrato: sea el titular o un co-inquilino. */
export type ContratoAcceso = {
  inmobiliariaId: string;
  /** null solo para un titular sin contrato activo (el endpoint decide). */
  contratoId: string | null;
  permiso: Permiso;
  esCoInquilino: boolean;
  inquilinoId: string | null;
  coInquilinoId: string | null;
};

/**
 * Exige acceso al contrato: lo cumple el inquilino TITULAR (permiso COMPLETO) o
 * un CO-INQUILINO con permiso suficiente. `minPermiso` gatea las acciones de
 * escritura (p.ej. informar un pago exige PAGAR). El titular siempre pasa.
 */
export async function requireContratoAcceso(
  request: FastifyRequest,
  reply: FastifyReply,
  minPermiso: Permiso = 'VER',
): Promise<ContratoAcceso | null> {
  const payload = await requireAuth(request, reply);
  if (!payload) return null;
  if (payload.kind === 'inquilino') {
    // La OTRA puerta del titular. El co-inquilino se revalidaba acá abajo desde
    // siempre; el titular pasaba derecho con permiso COMPLETO sacado del JWT.
    const revocado = await inquilinoRevocado(payload);
    if (revocado) {
      await reply.code(401).send({ message: revocado });
      return null;
    }
    return {
      inmobiliariaId: payload.inmobiliariaId,
      contratoId: payload.contratoId,
      permiso: 'COMPLETO',
      esCoInquilino: false,
      inquilinoId: payload.inquilinoId,
      coInquilinoId: null,
    };
  }
  if (payload.kind === 'co-inquilino') {
    // El token dura 15 días, así que NO confiamos en el permiso/estado del JWT:
    // los revalidamos contra la DB en cada request. Si el titular sacó el acceso
    // o bajó el permiso, surte efecto al instante (antes el co-inquilino seguía
    // entrando con su permiso viejo hasta que venciera el token = agujero real).
    const co = await prisma.coInquilino.findUnique({ where: { id: payload.coInquilinoId } });
    if (!co || co.estado !== 'ACEPTADO') {
      await reply.code(401).send({ message: 'Tu acceso fue revocado' });
      return null;
    }
    if (co.contratoId !== payload.contratoId || co.inmobiliariaId !== payload.inmobiliariaId) {
      await reply.code(401).send({ message: 'Tu acceso fue revocado' });
      return null;
    }
    if (RANGO_PERMISO[co.permiso] < RANGO_PERMISO[minPermiso]) {
      await reply.code(403).send({ message: `Tu acceso (${co.permiso}) no alcanza para esta acción` });
      return null;
    }
    return {
      inmobiliariaId: co.inmobiliariaId,
      contratoId: co.contratoId,
      permiso: co.permiso,
      esCoInquilino: true,
      inquilinoId: null,
      coInquilinoId: co.id,
    };
  }
  await reply.code(403).send({ message: 'Solo para inquilinos' });
  return null;
}

/**
 * Exige que el contrato del inquilino esté ACTIVO. Para acciones de ESCRITURA
 * que crean/mutan la relación viva (informar pago, subir boleta, abrir reclamo,
 * gestionar co-inquilinos): un contrato BORRADOR/FINALIZADO/RESCINDIDO no debe
 * aceptar mutaciones aunque el JWT (15 días) siga vivo después de finalizarlo.
 *
 * La LECTURA NO usa este guard a propósito: un ex-inquilino sigue pudiendo ver su
 * contrato pasado, liquidaciones y comprobantes. Por eso va por-endpoint y NO
 * dentro de requireContratoAcceso. Devuelve false (y ya respondió) si no procede.
 */
export async function exigirContratoActivo(
  contratoId: string,
  inmobiliariaId: string,
  reply: FastifyReply,
): Promise<boolean> {
  const contrato = await prisma.contrato.findFirst({
    where: { id: contratoId, inmobiliariaId },
    select: { estado: true },
  });
  if (!contrato || contrato.estado !== 'ACTIVO') {
    await reply.code(409).send({ message: 'El contrato ya no está activo' });
    return false;
  }
  return true;
}
