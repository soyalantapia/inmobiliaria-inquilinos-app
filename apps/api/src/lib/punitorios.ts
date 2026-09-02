import type { TipoMora } from '@prisma/client';
import { diaCivilAR } from '@llave/shared';

/**
 * Mora (punitorio por pago tardío) DINÁMICA, calculada ON-READ (no se congela
 * en la DB: crece cada día hasta que se paga, salvo override manual).
 *
 * Esquemas (`TipoMora`):
 *  - PORCENTAJE_DIARIO: base × (valor%/100) × díasAtraso        (lineal, modelo original)
 *  - MONTO_FIJO:        valor × meses de atraso INICIADOS       (estilo consorcio: $5k el
 *                       1er mes, $10k el 2do… acumula solo porque cada liquidación vieja
 *                       lleva más meses vencida; en la moneda del contrato)
 *  - PORCENTAJE_MENSUAL: base × (valor%/100) × (días/30)        (tasa mensual prorrateada
 *                       por día, p.ej. la de Banco Nación cargada a mano)
 *  - SIN_MORA:          0
 *
 * `asOf`: hoy para una liquidación impaga (sigue corriendo); la fecha de pago
 * para una ya PAGADA (la mora se congela cuando se saldó). Para elegirlo cuando
 * hay un pago de por medio, usar `asOfMora` (abajo).
 */
export interface EsquemaMora {
  tipo: TipoMora;
  /** % diario, $ fijo por mes de atraso, o % mensual — según `tipo`. */
  valor: number | null;
}

/** Campos de mora que puede traer un contrato (nuevos + legacy). */
export interface ContratoConMora {
  moraTipo?: TipoMora | null;
  moraValor?: number | null;
  tasaPunitorioDiaria?: number | null;
  /**
   * La moneda del contrato. **REQUERIDA a propósito, y ése es todo el arreglo de T-58.**
   *
   * Una mora `MONTO_FIJO` es un importe absoluto, así que heredarla sin mirar la moneda
   * aplica pesos sobre un contrato en dólares: un default de 5.000 pensado en pesos se
   * convertía en **US$ 5.000 de punitorio sobre un alquiler de US$ 800**.
   *
   * Se hizo requerida en vez de opcional porque el riesgo real de este arreglo NO era la
   * regla —es de una línea— sino aplicarla a medias: son 21 call sites, y con un campo
   * opcional los que no lo pasaran seguirían con el comportamiento viejo, dejando **moras
   * distintas según qué endpoint las calcule**. Requerida, el compilador los enumera a todos
   * y no hay forma de olvidarse de uno.
   */
  moneda: string;
}

export interface DefaultsMora {
  moraTipoDefault?: TipoMora | null;
  moraValorDefault?: number | null;
  /**
   * Moneda en la que está expresada `moraValorDefault`. No hay que guardarla en ningún lado
   * nuevo: la pantalla que carga el default no pide moneda, así que el valor está en la
   * moneda por defecto del tenant, que ya existe (`Inmobiliaria.monedaDefault`).
   */
  monedaDefault?: string | null;
}

export type OrigenMora = 'CONTRATO' | 'LEGACY' | 'INMOBILIARIA' | 'SIN_MORA';

/**
 * Resuelve el esquema de mora efectivo de un contrato con la cascada:
 *
 *   contrato.moraTipo (override explícito)
 *     → legacy contrato.tasaPunitorioDiaria (compat: % diario; la migración ya
 *       backfilleó moraTipo, esto cubre datos que entren por caminos viejos)
 *       → default de la inmobiliaria (config de Cobranza)
 *         → SIN_MORA
 *
 * Devuelve también el `origen` para que el panel pueda mostrar "(heredada)".
 */
export function resolverEsquemaMora(
  contrato: ContratoConMora | null | undefined,
  defaults?: DefaultsMora | null,
): EsquemaMora & { origen: OrigenMora } {
  if (contrato?.moraTipo) {
    return { tipo: contrato.moraTipo, valor: contrato.moraValor ?? null, origen: 'CONTRATO' };
  }
  const tasaLegacy = contrato?.tasaPunitorioDiaria;
  if (tasaLegacy != null && Number(tasaLegacy) > 0) {
    return { tipo: 'PORCENTAJE_DIARIO', valor: Number(tasaLegacy), origen: 'LEGACY' };
  }
  if (defaults?.moraTipoDefault && defaults.moraTipoDefault !== 'SIN_MORA') {
    // T-58 · UN MONTO FIJO HEREDADO SÓLO VALE EN SU PROPIA MONEDA.
    //
    // Los otros esquemas son PORCENTAJES: se aplican sobre la base, que ya está en la moneda
    // del contrato, así que heredarlos es correcto siempre. `MONTO_FIJO` no: es un importe
    // absoluto. Un default de 5.000 cargado pensando en pesos —la pantalla que lo carga ni
    // siquiera pide moneda— se aplicaba 1:1 sobre un contrato en dólares y le reclamaba al
    // inquilino US$ 5.000 de punitorio sobre un alquiler de US$ 800.
    //
    // Ante la duda NO se cobra, y no se inventa una conversión: no hay cotización en el
    // sistema, y adivinarla sería reemplazar un número equivocado por otro. Cobrar de menos
    // se corrige cargándole la mora al contrato; cobrar US$ 5.000 de más ya se le reclamó a
    // una persona.
    //
    // `!contrato` entra por acá a propósito: sin contrato no se conoce la moneda, y heredar
    // un monto fijo a ciegas es exactamente el caso que esto evita.
    const heredaImporteAbsoluto = defaults.moraTipoDefault === 'MONTO_FIJO';
    const monedasCoinciden =
      contrato != null &&
      // Esta línea es REDUNDANTE hoy y conviene saberlo: `contrato.moneda` es un string no
      // nulo, así que `'ARS' === undefined` ya da false y el resultado sería el mismo sin
      // ella. Verificado con mutation testing — sacarla no pone ningún test en rojo, y eso
      // es un dato, no un agujero de cobertura. Se deja porque el día que `moneda` se vuelva
      // opcional en alguno de los dos lados, `null === null` heredaría el monto fijo a
      // ciegas, que es exactamente el bug que esto evita.
      defaults.monedaDefault != null &&
      contrato.moneda === defaults.monedaDefault;

    if (heredaImporteAbsoluto && !monedasCoinciden) {
      return { tipo: 'SIN_MORA', valor: null, origen: 'SIN_MORA' };
    }
    return {
      tipo: defaults.moraTipoDefault,
      valor: defaults.moraValorDefault ?? null,
      origen: 'INMOBILIARIA',
    };
  }
  return { tipo: 'SIN_MORA', valor: null, origen: 'SIN_MORA' };
}

const DIA_MS = 86400000;

function diasAtraso(fechaVencimiento: Date | string, asOf: Date): number {
  const venc = new Date(fechaVencimiento);
  venc.setUTCHours(0, 0, 0, 0);
  // `asOf` es un INSTANTE; el vencimiento es un DÍA CIVIL. Normalizarlo con
  // setUTCHours lo llevaba al día UTC, que desde las 21:00 hora argentina ya es
  // el día siguiente: cobraba un día de mora mientras al inquilino todavía le
  // quedaban tres horas del día de pago. El corte va en hora local.
  const ref = diaCivilAR(asOf);
  return Math.max(0, Math.floor((ref.getTime() - venc.getTime()) / DIA_MS));
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * La base sobre la que corre la mora de una liquidación (T-57).
 *
 * NO es el `montoTotal` pelado, y ésa es toda la corrección. Antes se pasaba un `number` y
 * siempre era el total bruto, así que **un pago parcial no frenaba la mora**: una cuota de
 * $600.000 en la que el inquilino pagó $599.000 EL MISMO DÍA DEL VENCIMIENTO seguía devengando
 * punitorios sobre los $600.000 completos. A 30 días con 0,15% diario eran **$27.000 de mora
 * por deber $1.000** — sobre el saldo real serían $450. Y ese total inflado es lo que ve el
 * inquilino en la PWA, lo que topea `POST /pagos/informar` y lo que muestra el panel.
 *
 * REGLA ELEGIDA (opción (a), decisión del dueño el 21/08): se descuenta **sólo lo que entró en
 * fecha**. Lo pagado hasta el vencimiento reduce el capital sobre el que corre toda la mora; lo
 * pagado TARDE no la borra retroactivamente.
 *
 * Por qué no se descuenta todo lo pagado: haría que pagar tarde reduzca punitorios ya
 * devengados, y al inquilino le convendría pagar tarde y de a poco. Y por qué no se hace por
 * tramos (5 días sobre 600.000 + 25 sobre 100.000): es lo que haría un contador, pero es un
 * cambio de fondo en el corazón del cobro. Queda anotado en T-57 como la opción (b).
 *
 * Es un objeto y no dos parámetros a propósito: obliga a cada call site a decir explícitamente
 * cuánto se pagó en fecha. Con un parámetro opcional, el que no lo pasara seguiría con el
 * comportamiento viejo y quedarían **moras distintas según qué endpoint las calcule** — que es
 * peor que el bug.
 */
export interface BaseMora {
  /** `Liquidacion.montoTotal`: alquiler + expensas, sin mora. */
  total: number;
  /**
   * Σ de los pagos CONCILIADOS cuya `fechaTransferencia` es anterior o igual al vencimiento.
   *
   * `fechaTransferencia` y no `decididoAt`: lo que importa es cuándo el inquilino movió la
   * plata, no cuándo la inmobiliaria llegó a validarla. Si valida tres días tarde, la demora
   * es de ella y no puede costarle mora a él.
   */
  pagadoAlVencimiento: number;
}

/** El capital sobre el que corre la mora: lo que se debía, menos lo que entró en fecha. */
export function capitalConMora(base: BaseMora): number {
  return Math.max(0, base.total - Math.max(0, base.pagadoAlVencimiento));
}

/**
 * Mora de UNA liquidación según el esquema, a la fecha `asOf`.
 *
 * `manual` (Liquidacion.montoPunitorioManual) PISA el cálculo: es la mora
 * histórica confirmada al migrar un contrato en curso — congelada (no sigue
 * creciendo) y editable desde el panel. Un manual de 0 también pisa (permite
 * condonar la mora de un período puntual sin tocar el esquema).
 */
export function calcularMora(
  base: BaseMora,
  esquema: EsquemaMora,
  fechaVencimiento: Date | string,
  asOf: Date,
  manual?: number | null,
): number {
  if (manual != null) return r2(Math.max(0, Number(manual)));
  const capital = capitalConMora(base);
  if (capital <= 0 || esquema.tipo === 'SIN_MORA' || !esquema.valor || esquema.valor <= 0) return 0;
  const dias = diasAtraso(fechaVencimiento, asOf);
  if (dias === 0) return 0;
  switch (esquema.tipo) {
    case 'PORCENTAJE_DIARIO':
      return r2(capital * (esquema.valor / 100) * dias);
    case 'MONTO_FIJO':
      // Meses INICIADOS (día 1-30 de atraso = 1 mes, 31-60 = 2…): así el fijo
      // "acumula" como lo describió el piloto ($5k → $10k → $15k).
      return r2(esquema.valor * Math.ceil(dias / 30));
    case 'PORCENTAJE_MENSUAL':
      return r2(capital * (esquema.valor / 100) * (dias / 30));
    default:
      return 0;
  }
}

// El wrapper legacy `calcularPunitorio(base: number, …)` se BORRÓ con T-57. No tenía un solo
// llamador, y era la última forma de calcular mora sobre el total bruto: dejarlo vivo con la
// firma vieja era dejar abierta la puerta a que la mora salga distinta según quién la calcule,
// que es exactamente lo que esta tarea vino a cerrar.

/**
 * Con qué instante se corta la mora de una liquidación que tiene un pago asociado.
 *
 * Existe para que la BANDEJA DE VALIDACIÓN y `POST /pagos/:id/validar` no puedan
 * discrepar. El renglón "si lo validás queda $X" es una PREDICCIÓN de lo que va a
 * hacer validar, y validar congela la mora en la `fechaTransferencia` del pago que
 * está validando. Mientras la bandeja calculaba con `hoy`, cada día de demora en
 * decidir inventaba un saldo residual que al validar valía cero.
 *
 * DÓNDE **NO** VA. En `deudaTotal` (core.ts) ni en las métricas de morosidad
 * (metricas.ts). Ahí un INFORMADO no puede congelar nada: la `fechaTransferencia`
 * la carga el inquilino —con backdate de hasta 30 días, ver el guard de
 * /pagos/informar— y todavía nadie verificó que la plata haya entrado. Si el KPI
 * de mora la respetara, cualquiera se borraría de la lista de morosos informando
 * un pago que no existe, y encima quedaría escondido hasta que alguien lo rechace.
 * En la bandeja no aplica: ahí el operador está mirando esa fila para decidirla.
 */
export function asOfMora(
  pago: { estado: string; fechaTransferencia: Date },
  liquidacion: { estado: string; fechaPago: Date | null },
  hoy: Date,
): Date {
  if (pago.estado === 'INFORMADO') return new Date(pago.fechaTransferencia);
  if (liquidacion.estado === 'PAGADO' && liquidacion.fechaPago)
    return new Date(liquidacion.fechaPago);
  return hoy;
}
