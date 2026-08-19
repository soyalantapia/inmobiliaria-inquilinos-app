import type { Prisma, PrismaClient } from '@prisma/client';
import { diaCivilAR, enumerarPeriodosContrato } from '@llave/shared/periodos';

type TxOrClient = Prisma.TransactionClient | PrismaClient;

export type ContratoParaLiquidar = {
  id: string;
  inmobiliariaId: string;
  monto: Prisma.Decimal | number;
  montoExpensas: Prisma.Decimal | number | null;
  moneda: 'ARS' | 'USD';
  fechaInicio: Date;
  fechaFin: Date;
  diaPago: number;
  /**
   * Mes desde el que ESTE contrato devenga, si difiere de `fechaInicio` (cartera
   * importada). null = devengar desde `fechaInicio`.
   *
   * OBLIGATORIO a propósito (aunque acepte null). Cuando era opcional, de los cinco callers
   * sólo DOS lo pasaban: el cron y la importación. Los otros tres —el botón "Devengar" del
   * panel, la activación de contrato y la renovación— lo omitían en silencio y devengaban
   * desde `fechaInicio`, RESUCITANDO la deuda histórica que la importación había decidido no
   * cobrar. Requerido, el compilador no deja que un caller nuevo se lo saltee.
   */
  devengarDesde: Date | null;
  /**
   * Qué se le factura a este contrato. `SOLO_EXPENSAS` = no devenga alquiler nunca.
   *
   * OBLIGATORIO por la misma razón que `devengarDesde`: hasta ahora el devengo no lo
   * recibía, y un contrato de solo expensas daba alquiler 0 **por casualidad**, sólo porque
   * `contrato.monto` había quedado en 0. No había ninguna defensa: cualquier camino que
   * escribiera un canon positivo (ajustar, renovar, un alta con monto) hacía que el cron le
   * facturara alquiler a alguien que no paga alquiler. Requerido, así el compilador no deja
   * que un caller nuevo se lo saltee.
   *
   * El síntoma observable, que es lo que lo hacía difícil de ver: `PATCH /contratos/:id/monto`
   * exige un monto POSITIVO, lo guarda en `contrato.monto` y recién después llama a
   * `recomputarLiquidacionesFuturas`, que sí respetaba el tipo y dejaba las cuotas futuras en
   * 0. Pero `contrato.monto` quedaba positivo, así que la SIGUIENTE corrida del cron volvía a
   * generar cuotas con alquiler > 0. O sea: **el ajuste se "deshacía solo" seis horas después.**
   */
  tipoContrato: 'ALQUILER' | 'SOLO_EXPENSAS' | 'ALQUILER_Y_EXPENSAS';
};

/**
 * Una vigencia de canon TODAVÍA NO EN VIGOR (ajuste o renovación con período futuro).
 * `montoAnterior` es el canon que seguía rigiendo ANTES de esa vigencia.
 */
export type VigenciaCanon = { desde: string; montoAnterior: number };

/**
 * Canon que corresponde a `periodo`.
 *
 * `contrato.monto` es la AUTORIDAD (lo pisa el ajuste masivo PATCH /contratos/:id/monto,
 * que no deja fila de ajuste). Las vigencias sólo sirven para RETROCEDER los períodos
 * anteriores a un ajuste/renovación que todavía no entró en vigor: manda la PRIMera
 * vigencia posterior al período, y su `montoAnterior` es el canon que aún regía.
 *
 * Sin esto, ajustar o renovar con vigencia futura (renovar por adelantado es el flujo
 * normal: se pacta el canon nuevo para cuando termina el plazo) bumpeaba contrato.monto
 * al toque y el devengo cobraba los meses intermedios —que todavía son del canon viejo—
 * al canon NUEVO. Sobrecobro al inquilino y comisión inflada (sale de montoAlquiler).
 */
export function canonDelPeriodo(periodo: string, montoActual: number, vigencias?: VigenciaCanon[]): number {
  if (!vigencias || vigencias.length === 0) return montoActual;
  let proxima: VigenciaCanon | undefined;
  for (const v of vigencias) {
    if (v.desde > periodo && (!proxima || v.desde < proxima.desde)) proxima = v;
  }
  return proxima ? proxima.montoAnterior : montoActual;
}

/**
 * Calcula (puro, sin tocar la DB) las liquidaciones que corresponden a un
 * contrato a una fecha `now` dada. Separado del writer para poder testear el
 * cómputo de períodos/vencimientos sin una base de datos, y para que `now` sea
 * inyectable (determinismo en los tests).
 *
 * Criterio: una liquidación por mes, desde `fechaInicio` hasta el MES QUE VIENE
 * inclusive (para no pre-facturar todo el futuro, pero dejando siempre el
 * próximo período disponible), sin pasar nunca de `fechaFin`. Así, al activar
 * un contrato nuevo el inquilino ya tiene el período actual + el siguiente para
 * pagar (cubre 1er y 2º pago del circuito).
 *
 * Vencimiento = `diaPago` de cada mes (clamp al último día del mes).
 * `montoPunitorio` queda en 0: se recalcula al día en el cliente/checkout.
 */
export function computarLiquidacionesContrato(
  contrato: ContratoParaLiquidar,
  now: Date,
  vigencias?: VigenciaCanon[],
): Prisma.LiquidacionCreateManyInput[] {
  const montoActual = Number(contrato.monto);
  const expensas = contrato.montoExpensas != null ? Number(contrato.montoExpensas) : null;

  // La ENUMERACIÓN de períodos (arranque = max(devengarDesde, fechaInicio), skip
  // del primer mes cuando vence antes del inicio, tope al mes que viene / fin del
  // contrato) es la FUENTE ÚNICA compartida con el front (@llave/shared): el
  // wizard de alta usa la MISMA función para ofrecer los "períodos anteriores",
  // así nunca manda un período que este devengo no haya generado (era el bug i36:
  // período huérfano → 400 en aplicarEstadoInicial → rollback del alta entera).
  // Acá sólo le agregamos los montos/estado propios de la liquidación.
  return enumerarPeriodosContrato(contrato, now).map((p) => {
    // Canon POR PERÍODO: un ajuste/renovación con vigencia futura no puede cobrarle el
    // canon nuevo a los meses intermedios, que todavía son del viejo.
    // `montoAlquilerSegunTipo` va DESPUÉS de resolver el canon del período, no antes: un
    // SOLO_EXPENSAS tiene que dar 0 aunque el contrato haya quedado con un canon positivo
    // (por un ajuste viejo, una renovación, o un alta mal cargada). Es la única defensa del
    // devengo: antes dependía de que `contrato.monto` valiera 0. Es la misma regla que ya
    // aplicaba `recomputarLiquidacionesFuturas`; acá faltaba, y por eso las dos divergían.
    const alquiler = montoAlquilerSegunTipo(
      contrato.tipoContrato,
      canonDelPeriodo(p.periodo, montoActual, vigencias),
    );
    return {
      inmobiliariaId: contrato.inmobiliariaId,
      contratoId: contrato.id,
      periodo: p.periodo,
      montoAlquiler: alquiler,
      montoExpensas: expensas,
      montoTotal: alquiler + (expensas ?? 0),
      fechaVencimiento: p.vencimiento,
      estado: p.vencido ? 'VENCIDO' : 'PENDIENTE',
      moneda: contrato.moneda,
    };
  });
}

/**
 * Genera (persiste) las liquidaciones de un contrato.
 *
 * Antes el API NO generaba liquidaciones en ningún lado (solo el seed) → un
 * contrato nuevo no tenía nada que cobrar. Esta función lo resuelve: al activar
 * el contrato se devengan los períodos.
 *
 * Es IDEMPOTENTE (skipDuplicates sobre @@unique([contratoId, periodo])), así se
 * puede llamar de nuevo sin duplicar. Para devengar meses nuevos con el correr
 * del tiempo, volver a llamarla (cron / acción del panel). Devuelve cuántas
 * liquidaciones nuevas se crearon.
 */
/**
 * Ajustes y renovaciones del contrato cuya vigencia TODAVÍA no llegó. Sólo esas importan
 * (`canonDelPeriodo`), así que filtramos por período en la query: en la enorme mayoría de
 * los contratos devuelve 0 filas y no pesa en el barrido del cron.
 */
async function vigenciasFuturas(tx: TxOrClient, contratoId: string, now: Date): Promise<VigenciaCanon[] | undefined> {
  const periodo = periodoDe(now);
  const [ajustes, renovaciones] = await Promise.all([
    tx.ajusteAlquiler.findMany({
      where: { contratoId, periodoDesde: { gt: periodo } },
      select: { periodoDesde: true, montoAnterior: true },
    }),
    tx.renovacionContrato.findMany({
      where: { contratoId, montoDesde: { gt: periodo } },
      select: { montoDesde: true, montoAnterior: true },
    }),
  ]);
  const vigencias = [
    ...ajustes.map((a) => ({ desde: a.periodoDesde, montoAnterior: Number(a.montoAnterior) })),
    ...renovaciones.map((r) => ({ desde: r.montoDesde, montoAnterior: Number(r.montoAnterior) })),
  ];
  return vigencias.length > 0 ? vigencias : undefined;
}

export async function generarLiquidacionesContrato(
  tx: TxOrClient,
  contrato: ContratoParaLiquidar,
): Promise<number> {
  const now = new Date();
  const data = computarLiquidacionesContrato(contrato, now, await vigenciasFuturas(tx, contrato.id, now));
  if (data.length === 0) return 0;
  const res = await tx.liquidacion.createMany({ data, skipDuplicates: true });
  return res.count;
}

/**
 * Devenga UN contrato tomado de un snapshot, re-verificando BAJO LOCK que siga
 * ACTIVO.
 *
 * Los dos barridos (el cron global y el disparo del panel) empiezan con un
 * `findMany({ estado: 'ACTIVO' })` y recién después iteran contra la DB remota:
 * con carteras grandes ese loop dura minutos y el snapshot envejece. Si en el
 * medio alguien finaliza un contrato, el barrido le seguía creando cuotas — y
 * como finalizar ya había anulado las futuras impagas, el barrido LAS VOLVÍA A
 * CREAR: deuda fantasma a nombre de un inquilino que se fue, que además pasa a
 * VENCIDO sola y devenga mora.
 *
 * El `FOR UPDATE` serializa contra finalizar/rescindir (que hacen UPDATE del
 * contrato) y por eso alcanza en los DOS órdenes posibles: si el devengo entra
 * primero, finalizar espera y después borra lo que se creó; si finalizar entra
 * primero, acá ya se lee el estado nuevo y no se crea nada. Un re-`findFirst`
 * sin lock no serviría: entre leer y crear la otra transacción puede commitear.
 */
export async function devengarSiSigueActivo(
  prisma: PrismaClient,
  contrato: ContratoParaLiquidar,
): Promise<number> {
  return prisma.$transaction(async (tx) => {
    const filas = await tx.$queryRaw<{ estado: string }[]>`
      SELECT estado FROM contratos WHERE id = ${contrato.id} FOR UPDATE
    `;
    if (filas[0]?.estado !== 'ACTIVO') return 0;
    return generarLiquidacionesContrato(tx, contrato);
  });
}

/**
 * Marca VENCIDO las liquidaciones PENDIENTE cuyo vencimiento ya pasó.
 *
 * El estado se congelaba al CREAR (computarLiquidacionesContrato:67, `venc < now`)
 * y NADA lo re-evaluaba después: una liquidación devengada con vencimiento futuro
 * nacía PENDIENTE y NUNCA pasaba a VENCIDO al vencer, así que los morosos reales
 * figuraban PENDIENTE y la cobranza no los veía. Este barrido (idempotente) lo
 * corrige. Se dispara junto al devengo (cron in-process + endpoint del panel).
 * NO toca PARCIAL (mantiene el dato "pagó una parte"); la mora de un parcial
 * vencido la resuelve la derivación on-read de estadoPagoActual (core.ts).
 * `inmobiliariaId` opcional: acota el barrido al tenant (disparo del panel).
 */
export async function marcarLiquidacionesVencidas(
  tx: TxOrClient,
  inmobiliariaId?: string,
  now: Date = new Date(),
): Promise<number> {
  const res = await tx.liquidacion.updateMany({
    where: {
      estado: 'PENDIENTE',
      // El corte va en el DÍA CIVIL argentino, no en el instante UTC: los
      // vencimientos se guardan como medianoche UTC del día (`Date.UTC(y,m,dia)`),
      // así que `< new Date()` daba por vencida la cuota del 10 a las 21:00 del 9
      // —hora local— y el inquilino aparecía moroso con el día de pago sin empezar.
      // `lt` contra el día civil de hoy: vence recién cuando el día de pago pasó.
      fechaVencimiento: { lt: diaCivilAR(now) },
      // Sólo contratos ACTIVO: una liquidación remanente de un contrato finalizado
      // NO debe vencerse sola y convertirse en morosidad fantasma (finalizar ya
      // anula las cuotas futuras sin pago; esto es el cinturón de seguridad).
      contrato: { estado: 'ACTIVO' },
      ...(inmobiliariaId ? { inmobiliariaId } : {}),
    },
    data: { estado: 'VENCIDO' },
  });
  return res.count;
}

/**
 * Devenga (top-up) las liquidaciones de TODOS los contratos ACTIVO de TODAS las
 * inmobiliarias. Es la versión global (no tenant-scopeada) que dispara el cron:
 * el endpoint POST /liquidaciones/devengar solo cubre el tenant del usuario, y
 * sin un disparo periódico global cada contrato se queda sin liquidaciones a
 * partir del 2º mes. IDEMPOTENTE (skipDuplicates) → seguro de repetir y seguro
 * aunque corran dos réplicas a la vez. Además marca vencidas (top-up + mora).
 */
export async function devengarTodosLosTenants(
  prisma: PrismaClient,
): Promise<{ contratosProcesados: number; liquidacionesNuevas: number; liquidacionesVencidas: number; fallidos: { contratoId: string; error: string }[] }> {
  const contratos = await prisma.contrato.findMany({
    where: { estado: 'ACTIVO' },
    select: {
      id: true,
      inmobiliariaId: true,
      monto: true,
      montoExpensas: true,
      moneda: true,
      fechaInicio: true,
      // Sin esto el cron devengaba desde fechaInicio e ignoraba la decisión de la
      // importación de cartera → resucitaba los meses históricos como deuda falsa.
      devengarDesde: true,
      // Sin esto el barrido no sabe que un SOLO_EXPENSAS no factura alquiler y le devenga
      // el canon que haya quedado en el contrato. Ver ContratoParaLiquidar.
      tipoContrato: true,
      fechaFin: true,
      diaPago: true,
    },
  });
  let liquidacionesNuevas = 0;
  // AISLAMIENTO POR CONTRATO. Este barrido es GLOBAL (todos los tenants), así que sin el
  // try/catch un solo contrato con datos raros —o un error transitorio de la DB— tiraba la
  // función entera: los contratos siguientes se quedaban sin devengar Y, peor, el barrido de
  // vencidos de abajo NUNCA corría, para TODAS las inmobiliarias. Un dato malo de un cliente
  // dejaba sin facturar a los demás.
  const fallidos: { contratoId: string; error: string }[] = [];
  for (const c of contratos) {
    try {
      liquidacionesNuevas += await devengarSiSigueActivo(prisma, c);
    } catch (e) {
      fallidos.push({ contratoId: c.id, error: e instanceof Error ? e.message : String(e) });
    }
  }
  // El barrido de vencidos corre SIEMPRE, aunque algún contrato haya fallado: marcar la mora
  // no depende de haber devengado bien, y saltearlo deja morosos invisibles para la cobranza.
  let liquidacionesVencidas = 0;
  try {
    liquidacionesVencidas = await marcarLiquidacionesVencidas(prisma);
  } catch (e) {
    fallidos.push({ contratoId: '(barrido de vencidos)', error: e instanceof Error ? e.message : String(e) });
  }
  // `fallidos` viaja en el resultado: un devengo que se comió errores en silencio es
  // indistinguible de uno que anduvo bien, y el cron lo loguea.
  return { contratosProcesados: contratos.length, liquidacionesNuevas, liquidacionesVencidas, fallidos };
}

/**
 * Suma `meses` a una fecha en UTC, con clamp de fin de mes ("month-end aware"):
 * 31/01 + 1 mes = 28/02 (no 03/03, como haría el rollover nativo de Date). Se
 * usa para calcular `proximoAjuste` (fechaInicio/último ajuste + frecuencia) sin
 * desbordes de días largos. Trabaja SOLO en UTC (evita el corrimiento por huso
 * que daría usar los getters/setters locales del server).
 */
export function sumarMesesUTC(fecha: Date, meses: number): Date {
  const y = fecha.getUTCFullYear();
  const m = fecha.getUTCMonth();
  const d = fecha.getUTCDate();
  const totalMes = m + meses;
  const targetY = y + Math.floor(totalMes / 12);
  // ((totalMes % 12) + 12) % 12 => índice de mes 0-11 aunque `meses` fuera negativo.
  const targetM = ((totalMes % 12) + 12) % 12;
  // Días del mes destino: si el día original no existe (31 en un mes de 30),
  // clampeamos al último día del mes destino.
  const diasMesDestino = new Date(Date.UTC(targetY, targetM + 1, 0)).getUTCDate();
  const targetD = Math.min(d, diasMesDestino);
  return new Date(
    Date.UTC(
      targetY,
      targetM,
      targetD,
      fecha.getUTCHours(),
      fecha.getUTCMinutes(),
      fecha.getUTCSeconds(),
      fecha.getUTCMilliseconds(),
    ),
  );
}

/**
 * Alquiler que corresponde según el tipo de contrato: en SOLO_EXPENSAS el
 * alquiler es SIEMPRE 0 (solo se cobran expensas), en el resto es el `monto`
 * base del contrato. Aísla la regla para que el ajuste manual (PATCH monto) y el
 * devengo compartan el mismo criterio y no dupliquen el `if`.
 */
export function montoAlquilerSegunTipo(
  tipoContrato: 'ALQUILER' | 'SOLO_EXPENSAS' | 'ALQUILER_Y_EXPENSAS',
  monto: number,
): number {
  return tipoContrato === 'SOLO_EXPENSAS' ? 0 : monto;
}

/** Período 'YYYY-MM' (UTC) de una fecha. El corte de "liquidación futura" del
 *  ajuste manual usa el período (mes calendario), no la fecha exacta. */
export function periodoDe(fecha: Date): string {
  return `${fecha.getUTCFullYear()}-${String(fecha.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Liquidación tal como la necesita el recompute del ajuste manual. */
export type LiquidacionParaReajustar = {
  id: string;
  periodo: string;
  estado: 'PENDIENTE' | 'PAGADO' | 'PARCIAL' | 'VENCIDO';
  montoExpensas: Prisma.Decimal | number | null;
  /** Cantidad de pagos (de cualquier estado) asociados a la liquidación. */
  cantidadPagos: number;
};

/**
 * Filtra (PURO, sin DB) qué liquidaciones deben RE-DEVENGARSE al aplicar un
 * ajuste manual de monto, y devuelve el nuevo montoAlquiler/montoTotal de cada
 * una. Criterio (money code — conservador a propósito):
 *
 *  - período >= mes actual (`periodoActual`): NO tocamos meses pasados (histórico
 *    cerrado; el inquilino ya vio/pagó ese valor).
 *  - estado PENDIENTE o VENCIDO: NO tocamos PAGADO ni PARCIAL (ya hay plata en
 *    juego contra el monto viejo).
 *  - SIN ningún pago (cantidadPagos === 0): defensa extra — aunque una liq siga
 *    PENDIENTE/VENCIDO, si tiene un pago INFORMADO en revisión no la reajustamos
 *    (el inquilino informó contra el total que vio).
 *
 * El montoAlquiler nuevo respeta el tipo de contrato (SOLO_EXPENSAS => 0) y el
 * total = alquiler + expensas de LA liquidación (no del contrato: una liq pudo
 * tener expensas distintas). Devuelve solo las que cambian.
 */
export function recomputarLiquidacionesFuturas(
  liquidaciones: LiquidacionParaReajustar[],
  params: {
    montoNuevo: number;
    tipoContrato: 'ALQUILER' | 'SOLO_EXPENSAS' | 'ALQUILER_Y_EXPENSAS';
    periodoActual: string;
  },
): Array<{ id: string; montoAlquiler: number; montoTotal: number }> {
  const alquilerNuevo = montoAlquilerSegunTipo(params.tipoContrato, params.montoNuevo);
  const out: Array<{ id: string; montoAlquiler: number; montoTotal: number }> = [];
  for (const l of liquidaciones) {
    // Comparación lexicográfica de 'YYYY-MM': correcta porque ambos tienen el
    // mismo formato ancho-fijo (2026-07 >= 2026-07 incluye el mes en curso).
    if (l.periodo < params.periodoActual) continue;
    if (l.estado !== 'PENDIENTE' && l.estado !== 'VENCIDO') continue;
    if (l.cantidadPagos > 0) continue;
    const expensas = l.montoExpensas != null ? Number(l.montoExpensas) : 0;
    out.push({ id: l.id, montoAlquiler: alquilerNuevo, montoTotal: alquilerNuevo + expensas });
  }
  return out;
}

/** Igual que `LiquidacionParaReajustar`, pero del lado de las EXPENSAS: acá el
 *  alquiler es lo que se conserva y las expensas lo que cambia. */
export type LiquidacionParaReexpensar = {
  id: string;
  periodo: string;
  estado: 'PENDIENTE' | 'PAGADO' | 'PARCIAL' | 'VENCIDO';
  montoAlquiler: Prisma.Decimal | number;
  montoExpensas: Prisma.Decimal | number | null;
  /** Cantidad de pagos (de cualquier estado) asociados a la liquidación. */
  cantidadPagos: number;
};

/**
 * Espejo de `recomputarLiquidacionesFuturas` para un cambio de EXPENSAS.
 *
 * Las expensas suben todos los meses, así que esto se usa seguido — y por eso
 * comparte el criterio conservador del ajuste de canon, línea por línea:
 *
 *  - período >= mes actual: no se tocan meses pasados (el inquilino ya vio ese
 *    valor y probablemente lo pagó);
 *  - estado PENDIENTE o VENCIDO: no se tocan PAGADO ni PARCIAL;
 *  - sin ningún pago asociado: aunque siga PENDIENTE, si hay un pago INFORMADO
 *    en revisión el inquilino ya informó contra el total que vio.
 *
 * La diferencia con el ajuste de canon es cuál de los dos montos se conserva:
 * acá el `montoAlquiler` de CADA liquidación queda como está (puede diferir del
 * canon del contrato si hubo un ajuste con vigencia futura) y sólo se pisa la
 * parte de expensas. Devuelve sólo las que cambian.
 */
export function recomputarExpensasFuturas(
  liquidaciones: LiquidacionParaReexpensar[],
  params: { expensasNuevas: number; periodoActual: string },
): Array<{ id: string; montoExpensas: number; montoTotal: number }> {
  const out: Array<{ id: string; montoExpensas: number; montoTotal: number }> = [];
  for (const l of liquidaciones) {
    // Comparación lexicográfica de 'YYYY-MM': correcta porque ambos tienen el
    // mismo formato ancho-fijo.
    if (l.periodo < params.periodoActual) continue;
    if (l.estado !== 'PENDIENTE' && l.estado !== 'VENCIDO') continue;
    if (l.cantidadPagos > 0) continue;
    const expensasViejas = l.montoExpensas != null ? Number(l.montoExpensas) : 0;
    if (expensasViejas === params.expensasNuevas) continue;
    const alquiler = Number(l.montoAlquiler);
    out.push({
      id: l.id,
      montoExpensas: params.expensasNuevas,
      montoTotal: alquiler + params.expensasNuevas,
    });
  }
  return out;
}
