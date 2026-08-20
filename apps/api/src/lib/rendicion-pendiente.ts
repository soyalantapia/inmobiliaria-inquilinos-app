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
  // OJO con `total`: suma TODOS los períodos, sin mirar la moneda. Sirve para lo que lo usa
  // core.ts —"¿hay algo cobrado y sin rendir, sí o no?", un umbral— y NO sirve para mostrarlo.
  // Sumar pesos con dólares no cambia un cero por un no-cero, así que el guard sigue siendo
  // correcto; una pantalla que imprima ese número, no. Para mostrar, agrupá por `moneda`.
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
