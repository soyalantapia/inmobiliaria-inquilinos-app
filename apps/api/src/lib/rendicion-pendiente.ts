import type { Prisma, PrismaClient } from '@prisma/client';
import { porcionAlquilerCobrada } from '@llave/shared/prorrateo';
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
  /**
   * T-53 — Modo "la parte de ESTE dueño". Sin esto la cuenta es de la PROPIEDAD entera, que es
   * lo que necesitan los guards de core.ts ("¿hay algo cobrado y sin rendir acá, sí o no?"),
   * pero NO lo que hay que mostrarle a un copropietario: con dos dueños 60/40, después de
   * rendirle al primero le seguía apareciendo la parte del segundo como propia.
   *
   * La aritmética espeja el DOBLE CAP de `POST /rendiciones` (plata.ts:2042), que es la
   * invariante que este archivo declara: (1) lo que le falta a este dueño de su parte, y
   * (2) el remanente de la liquidación sumando a TODOS los dueños. El (2) evita el sobre-pago
   * cuando se cambió el reparto después de rendir un período.
   */
  porDuenio?: { porcentaje: number; rendidoMioPorLiq: Map<string, number> },
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
    // Una sola implementación, en `@llave/shared/prorrateo` — incluido el guard de base 0, que
    // no es defensa de más: una liquidación en 0 (un SOLO_EXPENSAS sin expensas cargadas, o un
    // dato viejo) haría 0/0 = NaN, y `NaN > 0.01` es false, así que el guard de más abajo
    // dejaría pasar el cambio en silencio.
    const alquilerCobrado = porcionAlquilerCobrada({
      alquiler: liqAlq,
      base: liqTotal,
      cobrado,
    });
    const r2c = (x: number) => Math.round(x * 100) / 100;
    const yaRendTotal = rendidoPorLiq.get(l.id) ?? 0;
    const pendiente = porDuenio
      ? Math.min(
          // (1) lo que le falta a ESTE dueño de su parte
          r2c(alquilerCobrado * (porDuenio.porcentaje / 100) - (porDuenio.rendidoMioPorLiq.get(l.id) ?? 0)),
          // (2) lo que queda sin rendir de la liquidación entre TODOS los dueños
          r2c(alquilerCobrado - yaRendTotal),
        )
      : r2c(alquilerCobrado - yaRendTotal);
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
  opts?: {
    soloRendible?: boolean;
    /**
     * T-53 — Con esto la cuenta pasa a ser LA PARTE DE ESTE DUEÑO, no la de la propiedad.
     * Sólo lo usa el portal: los guards de core.ts necesitan el total global, ciego a la
     * participación ("¿hay algo cobrado y sin rendir acá, sí o no?").
     */
    duenio?: { propietarioId: string; porcentaje: number };
  },
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
    opts?.duenio,
    opts?.soloRendible ?? false,
  );
}

/** El lector: una sola forma de traer los datos, dos formas de acotarlos. */
async function pendienteDeLiquidaciones(
  where:
    | { contratoId: string }
    | { contrato: { propiedadId: string; inmobiliariaId?: string; modoCobranza?: 'INMOBILIARIA' } },
  db: TxOrClient,
  duenio?: { propietarioId: string; porcentaje: number },
  /**
   * Acota a lo que la rendición puede pagar DE VERDAD. Además del `modoCobranza` que ya
   * filtra el `where` del contrato, tapa las dos fuentes de plata que nunca van a poder
   * bajar a cero — ver los comentarios de cada una, abajo.
   */
  soloRendible = false,
): Promise<{ total: number; periodos: PeriodoSinRendir[] }> {
  const liqs = await db.liquidacion.findMany({
    where,
    select: { id: true, periodo: true, montoAlquiler: true, montoTotal: true, moneda: true },
  });
  if (liqs.length === 0) return { total: 0, periodos: [] };
  const ids = liqs.map((l) => l.id);

  const [cobros, rendidos, rendidosMios] = await Promise.all([
    db.pago.groupBy({
      by: ['liquidacionId'],
      where: {
        liquidacionId: { in: ids },
        estado: 'CONCILIADO',
        condonado: false,
        // La plata de la MIGRACIÓN DE CARTERA no es un cobro de la inmobiliaria: el alta de
        // un contrato en curso registra hasta 120 períodos pasados como pagados para que el
        // saldo del inquilino arranque bien, pero eso se cobró y se liquidó antes de que el
        // sistema existiera. Contarla acá le reclama al dueño plata que ya tiene, y —peor—
        // `POST /rendiciones` se la podría transferir de nuevo si el operador elige uno de
        // esos períodos. Mismo criterio que `condonado`, dos líneas más arriba.
        ...(soloRendible ? { migradoDeCartera: false } : {}),
      },
      _sum: { monto: true },
    }),
    db.alquilerRendido.groupBy({
      by: ['liquidacionId'],
      where: { liquidacionId: { in: ids } },
      _sum: { monto: true },
    }),
    // T-53 — Lo rendido A ESTE dueño. `AlquilerRendido` cuelga de `Rendicion.propietarioId`
    // (schema.prisma:2040: "parte del propietario rendida en esta tanda"), así que el groupBy
    // de arriba —sin filtro— mezcla lo de todos los dueños. Es el mismo filtro que usa
    // `POST /rendiciones` en plata.ts:1985.
    duenio
      ? db.alquilerRendido.groupBy({
          by: ['liquidacionId'],
          where: { liquidacionId: { in: ids }, rendicion: { propietarioId: duenio.propietarioId } },
          _sum: { monto: true },
        })
      : Promise.resolve([] as { liquidacionId: string; _sum: { monto: unknown } }[]),
  ]);
  const cobradoMap = new Map(cobros.map((c) => [c.liquidacionId, Number(c._sum.monto ?? 0)]));
  const rendidoMap = new Map(rendidos.map((r) => [r.liquidacionId, Number(r._sum.monto ?? 0)]));

  // LOS PERÍODOS RENDIDOS ANTES DE QUE EXISTIERA EL LEDGER.
  //
  // `alquileres_rendidos` nació el 01/07/2026 y su migración la creó VACÍA, sin backfill
  // (20260701130000_rendicion_incremental). Toda rendición anterior tiene su `montoBruto` y
  // cero líneas, así que `rendidoMap` no le resta nada y su alquiler figura como pendiente
  // para siempre. Y no se puede backfillear: `Rendicion` guarda un total por (dueño, período),
  // no el desglose por liquidación, así que no hay de dónde sacar cuánto le tocó a cada una.
  //
  // La regla que sí se puede sostener: si existe una rendición de ese período SIN una sola
  // línea, ese período ya se le rindió a ese dueño. Es coarse —no distingue una rendición
  // parcial— pero el error va para el lado seguro: callar plata ya depositada en vez de
  // acusar a la inmobiliaria de retener algo que pagó.
  //
  // Sólo aplica con `soloRendible`, o sea a las superficies que preguntan "¿qué se puede
  // rendir?". El guard de modo-cobranza sigue viendo todo, que es lo que necesita.
  const periodosPreLedger = new Set<string>();
  if (soloRendible) {
    const rendicionesViejas = await db.rendicion.findMany({
      where: {
        ...(duenio ? { propietarioId: duenio.propietarioId } : {}),
        periodo: { in: [...new Set(liqs.map((l) => l.periodo))] },
        alquileresRendidos: { none: {} },
      },
      select: { periodo: true },
    });
    for (const r of rendicionesViejas) periodosPreLedger.add(r.periodo);
  }
  const liqsVivas = periodosPreLedger.size
    ? liqs.filter((l) => !periodosPreLedger.has(l.periodo))
    : liqs;

  return calcularPendienteSinRendir(
    liqsVivas,
    cobradoMap,
    rendidoMap,
    duenio
      ? {
          porcentaje: duenio.porcentaje,
          rendidoMioPorLiq: new Map(rendidosMios.map((r) => [r.liquidacionId, Number(r._sum.monto ?? 0)])),
        }
      : undefined,
  );
}
