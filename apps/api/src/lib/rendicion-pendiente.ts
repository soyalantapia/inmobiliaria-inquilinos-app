import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../db.js';

/** Mismo patrón que `deposito.ts` / `evento-contrato.ts`: sirve dentro y fuera de una
 *  transacción. El guard de modo-cobranza lo necesita ADENTRO para no decidir con una
 *  foto vieja. */
type TxOrClient = Prisma.TransactionClient | PrismaClient;

/** Un período con alquiler cobrado que todavía no se le rindió al propietario. */
export interface PeriodoSinRendir {
  periodo: string;
  monto: number;
  /**
   * La moneda de ESA liquidación, no la del contrato vigente de la propiedad.
   *
   * Importa porque este cálculo mira TODOS los contratos de la propiedad, incluidos los
   * terminados: una unidad puede tener plata sin rendir de un contrato en dólares que ya
   * venció y hoy estar alquilada en pesos —o no estar alquilada—. Quien muestre estos
   * montos tiene que separarlos por moneda; sumarlos da un número que no existe.
   */
  moneda: string;
}

/**
 * Alquiler COBRADO que todavía NO se le rindió al propietario.
 *
 * POR QUÉ EXISTE: `POST /rendiciones` y `GET /caja/cierre` filtran por
 * `contrato.modoCobranza` **actual**, en CUALQUIER período. Entonces cambiar el modo
 * de cobranza mueve plata vieja de circuito:
 *
 *  - INMOBILIARIA → PROPIETARIO_DIRECTO: lo cobrado y no rendido queda FUERA del
 *    filtro de la rendición ⇒ la inmobiliaria tiene la plata y no hay ningún camino
 *    en el código para rendírsela al dueño.
 *  - PROPIETARIO_DIRECTO → INMOBILIARIA: los pagos que se conciliaron mientras el
 *    inquilino transfería al dueño (validar NO mira el modo) pasan a ser rendibles
 *    ⇒ la inmobiliaria le transfiere al propietario plata que el propietario ya cobró.
 *
 * En los DOS sentidos el dato en riesgo es el mismo: alquiler cobrado y sin rendir.
 * Por eso este helper es el guard de las dos direcciones.
 *
 * La aritmética replica EXACTAMENTE la de `POST /rendiciones` (plata.ts, paso BRUTO):
 * cap del cobrado a `montoTotal` (deja la MORA afuera) y prorrateo por
 * `montoAlquiler / montoTotal` (deja las EXPENSAS afuera, que van al consorcio).
 * Si divergiera, el guard bloquearía por plata que la rendición no rinde —o al revés.
 *
 * Excluye `condonado: true`: una condonación cancela deuda sin ingresar plata, así que
 * no hay nada para rendir (mismo criterio que la rendición y el cierre de caja).
 *
 * El CÁLCULO en sí vive en `calcularPendienteSinRendir`, acá abajo: es puro y está
 * testeado en `test/rendicion-pendiente.test.ts`.
 */

/**
 * Una liquidación, con lo mínimo que hace falta para la cuenta.
 *
 * `unknown` en la plata y no `number`: los montos llegan como `Decimal` de Prisma y la
 * conversión se hace acá adentro (`Number(...)`). Tipar `number` obligaría a cada lector a
 * convertir antes, y alcanzaría con que uno se olvidara para que la cuenta se hiciera sobre
 * un objeto Decimal y diera cualquier cosa sin avisar.
 */
export interface LiquidacionParaPendiente {
  id: string;
  periodo: string;
  montoAlquiler: unknown;
  montoTotal: unknown;
  /** `Liquidacion.moneda`, que en la base es NOT NULL con default ARS. */
  moneda: string;
}

/**
 * El CÁLCULO, sin base de datos.
 *
 * Está separado del lector a propósito, igual que `computarLiquidacionesContrato` vs
 * `generarLiquidacionesContrato`: es aritmética de plata que decide si se puede cambiar
 * el modo de cobranza de un contrato, y tiene que poder testearse sin una Postgres
 * remota. Si esta cuenta se desincroniza de la de `POST /rendiciones`, el guard bloquea
 * por plata que la rendición no rinde —o peor, deja pasar plata que sí— y eso no se ve
 * hasta que a un propietario le falta un mes.
 */
export function calcularPendienteSinRendir(
  liqs: LiquidacionParaPendiente[],
  cobradoPorLiq: Map<string, number>,
  rendidoPorLiq: Map<string, number>,
): { total: number; periodos: PeriodoSinRendir[] } {
  // OJO con `total`: suma TODOS los períodos, sin mirar la moneda. Como UMBRAL está bien
  // —sumar pesos con dólares no convierte un cero en un no-cero, así que el "¿hay algo sin
  // rendir?" de core.ts sigue siendo correcto—, pero NO se puede mostrar.
  //
  // Y ojo con creer que core.ts sólo lo usa de umbral: `PUT /propiedades/:id/participaciones`
  // arma con `periodos[]` el detalle del 409 que ve el operador. Ahí lo que se muestra es cada
  // período por separado, con SU moneda, no este total. Para mostrar, agrupá por `moneda`.
  const periodos: PeriodoSinRendir[] = [];
  let total = 0;
  for (const l of liqs) {
    const cobrado = cobradoPorLiq.get(l.id) ?? 0;
    if (cobrado <= 0) continue;
    const liqTotal = Number(l.montoTotal);
    const liqAlq = Number(l.montoAlquiler);
    // `liqTotal > 0` no es defensa de más: una liquidación en 0 (contrato SOLO_EXPENSAS
    // sin expensas cargadas, o un dato viejo) haría 0/0 = NaN, y NaN > 0.01 es false,
    // así que el guard dejaría pasar el cambio en silencio.
    const alquilerCobrado = liqTotal > 0 ? Math.min(cobrado, liqTotal) * (liqAlq / liqTotal) : 0;
    const pendiente = Math.round((alquilerCobrado - (rendidoPorLiq.get(l.id) ?? 0)) * 100) / 100;
    // Tolerancia de 1 centavo: el mismo umbral que usa la rendición para decidir si
    // algo es rendible (`rendible <= 0` ⇒ se saltea). Sin esto, un resto de redondeo
    // del prorrateo bloquearía el cambio de modo para siempre.
    if (pendiente > 0.01) {
      periodos.push({ periodo: l.periodo, monto: pendiente, moneda: l.moneda });
      total += pendiente;
    }
  }
  periodos.sort((a, b) => a.periodo.localeCompare(b.periodo));
  return { total: Math.round(total * 100) / 100, periodos };
}

/** Lo pendiente de UN contrato. `db` permite llamarlo dentro de una transacción. */
export async function alquilerCobradoSinRendir(
  contratoId: string,
  db: TxOrClient = prisma,
): Promise<{ total: number; periodos: PeriodoSinRendir[] }> {
  return pendienteDeLiquidaciones({ contratoId }, db);
}

/**
 * Lo mismo, pero de TODOS los contratos de una propiedad.
 *
 * POR QUÉ EXISTE: `PUT /propiedades/:id/participaciones` borra y recrea el reparto de dueños
 * (`core.ts`, `deleteMany` + `createMany`), y la rendición decide a quién le transfiere leyendo
 * la participación **de hoy** (`plata.ts` arma el universo de propiedades del dueño desde sus
 * participaciones actuales, y aplica el porcentaje actual). El `periodo` que se rinde lo elige
 * el operador y puede ser de hace dos años.
 *
 * Entonces, si se cambia el reparto con plata cobrada y sin rendir en el medio: el dueño
 * ENTRANTE cobra lo del período del saliente, y el SALIENTE desaparece de `propIds` y no hay
 * ningún camino en el código para rendirle lo suyo. El cap cruzado de la rendición evita pagar
 * de MÁS; no dice nada sobre A QUIÉN. Es mis-atribución, no doble pago, y no deja rastro.
 *
 * La cuenta es por propiedad y no por contrato porque el reparto de dueños cuelga de la
 * PROPIEDAD: al cambiarlo quedan afectados todos sus contratos, incluidos los terminados que
 * todavía tienen alquiler cobrado sin rendir.
 */
export async function alquilerCobradoSinRendirDePropiedad(
  propiedadId: string,
  db: TxOrClient = prisma,
  inmobiliariaId?: string,
  /**
   * T-52 — `soloRendible` acota al MISMO universo que `POST /rendiciones`, que filtra
   * `modoCobranza: 'INMOBILIARIA'` (plata.ts:221 y :1929).
   *
   * POR QUÉ HACE FALTA: en un contrato PROPIETARIO_DIRECTO el inquilino transfiere al CBU del
   * dueño, pero conciliar el pago NO mira el modo — así que esos cobros quedan CONCILIADOS y,
   * como la rendición los excluye, **nunca va a existir un `AlquilerRendido` que los baje**. El
   * número no llega a cero por ningún camino.
   *
   * POR QUÉ NO SE FILTRA SIEMPRE, adentro: dos llamadores necesitan lo OPUESTO. El guard de
   * `PATCH /contratos/:id/modo-cobranza` tiene que VER esa plata: es lo único que impide que al
   * pasar de directo a inmobiliaria el sistema le transfiera al dueño algo que ya cobró. Si el
   * filtro fuera incondicional se abriría ese agujero. Por eso es opt-in y ese guard no lo pasa.
   */
  opts?: { soloRendible?: boolean },
): Promise<{ total: number; periodos: PeriodoSinRendir[] }> {
  // `inmobiliariaId` es opcional pero NO decorativo. Los llamadores de core.ts ya vienen de un
  // handler que resolvió la propiedad dentro de su tenant; el portal del propietario, en cambio,
  // es una superficie de lectura sobre plata ajena, y su guard estructural
  // (`test/portal-aislamiento.test.ts`) sólo lee `portal-propietario.ts`: no puede ver este
  // archivo. Sin el filtro explícito, la garantía de ese endpoint dependía de una cadena de
  // razonamientos entre dos archivos en vez de estar escrita en la query — que es justo lo que
  // ese test dice que no hay que aceptar.
  return pendienteDeLiquidaciones(
    {
      contrato: {
        propiedadId,
        ...(inmobiliariaId ? { inmobiliariaId } : {}),
        ...(opts?.soloRendible ? { modoCobranza: 'INMOBILIARIA' as const } : {}),
      },
    },
    db,
  );
}

/** El lector: una sola forma de traer los datos, dos formas de acotarlos. */
async function pendienteDeLiquidaciones(
  where:
    | { contratoId: string }
    | { contrato: { propiedadId: string; inmobiliariaId?: string; modoCobranza?: 'INMOBILIARIA' } },
  db: TxOrClient,
): Promise<{ total: number; periodos: PeriodoSinRendir[] }> {
  const liqs = await db.liquidacion.findMany({
    where,
    select: { id: true, periodo: true, montoAlquiler: true, montoTotal: true, moneda: true },
  });
  if (liqs.length === 0) return { total: 0, periodos: [] };
  const ids = liqs.map((l) => l.id);

  const [cobros, rendidos] = await Promise.all([
    db.pago.groupBy({
      by: ['liquidacionId'],
      where: { liquidacionId: { in: ids }, estado: 'CONCILIADO', condonado: false },
      _sum: { monto: true },
    }),
    db.alquilerRendido.groupBy({
      by: ['liquidacionId'],
      where: { liquidacionId: { in: ids } },
      _sum: { monto: true },
    }),
  ]);
  const cobradoMap = new Map(cobros.map((c) => [c.liquidacionId, Number(c._sum.monto ?? 0)]));
  const rendidoMap = new Map(rendidos.map((r) => [r.liquidacionId, Number(r._sum.monto ?? 0)]));

  return calcularPendienteSinRendir(liqs, cobradoMap, rendidoMap);
}

// ─── Lo que le falta a UN dueño, que no es lo mismo que lo que le falta a la unidad ──────

/**
 * Alquiler cobrado que todavía no se le rindió **a este propietario en particular**.
 *
 * POR QUÉ EXISTE, SI YA ESTÁ `alquilerCobradoSinRendirDePropiedad`. Porque esa otra
 * función contesta una pregunta DISTINTA —"¿queda algo sin rendir en esta unidad, de
 * cualquiera?"—, que es justo la que necesita el guard de modo de cobranza de `core.ts`, y
 * es la pregunta equivocada para mostrarle un número a un dueño.
 *
 * Con un solo dueño al 100% las dos dan lo mismo, y por eso el bug no se veía. Con dos, el
 * remanente de la unidad deja de ser proporcional apenas se le rinde a uno: rendido A (60%)
 * de una liquidación de 100.000, quedan 40.000 que son ÍNTEGRAMENTE de B. Mostrar esos
 * 40.000 a los dos, con el rótulo "te corresponde el X%", le miente a ambos a la vez —de más
 * al que ya cobró (lee 24.000 cuando le corresponde 0) y de MENOS al que falta (lee 16.000
 * cuando le deben 40.000, dos veces y media)—. El aviso del porcentaje no acota nada: invita
 * a multiplicar por una base que ya no es proporcional.
 *
 * LA CUENTA ES LA MISMA QUE LA DE `POST /rendiciones` (plata.ts, paso BRUTO), a propósito y
 * al pie de la letra, incluido el DOBLE CAP:
 *   rendible = min( parteDelDueño − yaRendidoAEsteDueño , alquilerCobrado − yaRendidoAtodos )
 * El primero es lo que le falta a él; el segundo evita el sobre-pago cuando se cambió el
 * reparto después de rendir. Si esta cuenta se desincroniza de aquella, el portal le promete
 * al dueño un número que el depósito no le va a dar.
 *
 * Y FILTRA `modoCobranza: 'INMOBILIARIA'`, que es el otro motivo por el que este endpoint
 * mentía. En `PROPIETARIO_DIRECTO` el inquilino le transfiere al CBU del dueño y la
 * inmobiliaria igual concilia el pago (validar no mira el modo, a propósito). Pero
 * `POST /rendiciones` sí excluye esos contratos, así que NUNCA va a existir un
 * `AlquilerRendido` que salde esa liquidación: sin este filtro el portal le muestra al dueño
 * "cobrado y todavía sin rendirte", creciendo un período por mes para siempre, por plata que
 * él mismo ya tiene en la mano y que la inmobiliaria nunca tuvo. En la pantalla que abre
 * justamente para controlar a su inmobiliaria.
 */
export async function pendienteDeRendirAPropietario(
  opts: {
    propiedadId: string;
    propietarioId: string;
    /** El porcentaje de participación VIGENTE del dueño en esa propiedad. */
    porcentaje: number;
    inmobiliariaId: string;
  },
  db: TxOrClient = prisma,
): Promise<{ total: number; periodos: PeriodoSinRendir[] }> {
  const liqs = await db.liquidacion.findMany({
    where: {
      contrato: {
        propiedadId: opts.propiedadId,
        inmobiliariaId: opts.inmobiliariaId,
        // Ver el docblock: sin esto se cuenta plata que la rendición no puede rendir.
        modoCobranza: 'INMOBILIARIA',
      },
    },
    select: { id: true, periodo: true, montoAlquiler: true, montoTotal: true, moneda: true },
  });
  if (liqs.length === 0) return { total: 0, periodos: [] };
  const ids = liqs.map((l) => l.id);

  const [cobros, rendidoTodos, rendidoEste] = await Promise.all([
    db.pago.groupBy({
      by: ['liquidacionId'],
      where: { liquidacionId: { in: ids }, estado: 'CONCILIADO', condonado: false },
      _sum: { monto: true },
    }),
    db.alquilerRendido.groupBy({
      by: ['liquidacionId'],
      where: { liquidacionId: { in: ids } },
      _sum: { monto: true },
    }),
    // `AlquilerRendido` no tiene propietarioId: la única forma de acotar por dueño es el
    // join contra su Rendicion. Es exactamente lo que hace POST /rendiciones para armar
    // su `yaRendMap`, y lo que le faltaba a este endpoint.
    db.alquilerRendido.groupBy({
      by: ['liquidacionId'],
      where: { liquidacionId: { in: ids }, rendicion: { propietarioId: opts.propietarioId } },
      _sum: { monto: true },
    }),
  ]);
  const suma = (rows: { liquidacionId: string; _sum: { monto: unknown } }[]) =>
    new Map(rows.map((r) => [r.liquidacionId, Number(r._sum.monto ?? 0)]));

  return calcularPendienteDeDuenio(
    liqs,
    suma(cobros),
    suma(rendidoEste),
    suma(rendidoTodos),
    opts.porcentaje,
  );
}

/**
 * El CÁLCULO por dueño, sin base de datos. Separado por el mismo motivo que
 * `calcularPendienteSinRendir`: es aritmética de plata y tiene que poder testearse sin una
 * Postgres remota.
 */
export function calcularPendienteDeDuenio(
  liqs: LiquidacionParaPendiente[],
  cobradoPorLiq: Map<string, number>,
  rendidoAEsteDuenio: Map<string, number>,
  rendidoATodos: Map<string, number>,
  porcentaje: number,
): { total: number; periodos: PeriodoSinRendir[] } {
  const r2c = (n: number) => Math.round(n * 100) / 100;
  const periodos: PeriodoSinRendir[] = [];
  let total = 0;
  for (const l of liqs) {
    const cobrado = cobradoPorLiq.get(l.id) ?? 0;
    if (cobrado <= 0) continue;
    const liqTotal = Number(l.montoTotal);
    const liqAlq = Number(l.montoAlquiler);
    // Mismo guard que la otra cuenta: una liquidación en 0 daría 0/0 = NaN, y NaN no se
    // filtra con ninguna comparación.
    const alquilerCobrado = liqTotal > 0 ? Math.min(cobrado, liqTotal) * (liqAlq / liqTotal) : 0;
    const parteOwner = alquilerCobrado * (porcentaje / 100);
    const yaEste = rendidoAEsteDuenio.get(l.id) ?? 0;
    const yaTodos = rendidoATodos.get(l.id) ?? 0;
    const pendiente = Math.min(r2c(parteOwner - yaEste), r2c(alquilerCobrado - yaTodos));
    // Misma tolerancia de un centavo que usa la rendición para decidir si algo es rendible.
    if (pendiente > 0.01) {
      periodos.push({ periodo: l.periodo, monto: r2c(pendiente), moneda: l.moneda });
      total += pendiente;
    }
  }
  periodos.sort((a, b) => a.periodo.localeCompare(b.periodo));
  return { total: r2c(total), periodos };
}
