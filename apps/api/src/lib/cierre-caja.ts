/**
 * La aritmética del cierre de caja diario, sin base de datos.
 *
 * POR QUÉ VIVE ACÁ Y NO INLINE EN EL HANDLER. `GET /caja/cierre` es el arqueo que la cajera
 * tiene en la mano al final del día, y hasta ahora **no tenía un solo test**: toda su
 * aritmética estaba adentro de un handler que necesita Postgres para ejercitarse, así que
 * quedaba del lado que no corre en CI ni en una máquina cualquiera.
 *
 * Sacarla acá no es armar una capa: es un archivo con un solo llamador. Lo que se gana es que
 * **seis invariantes de plata** pasan al carril que corre siempre —el prorrateo que deja las
 * expensas afuera, el cap de la mora, la guarda del 0/0, el redondeo a centavos, los buckets
 * por moneda y el flag `multiMoneda`—. La query sigue en el handler y el contrato del endpoint
 * no cambia.
 *
 * Dos de esas invariantes ya rompieron una vez en producción: contar los pagos de
 * `PROPIETARIO_DIRECTO` (que se arregla en el `where`, no acá) y el redondeo a peso entero en
 * vez de a centavos.
 */
import { r2c, tasaComisionDeParticipaciones } from './ganancia-contrato.js';

/** Argentina no tiene horario de verano desde 2009: el offset es fijo. */
const OFFSET_AR_MS = 3 * 3600 * 1000;

/**
 * Qué día es "hoy" para la cajera. NO es el día UTC.
 *
 * Entre las 21:00 y la medianoche de Argentina ya es el día siguiente en UTC. Si el cierre
 * usara el día UTC, a las 21:05 la pantalla saltaría al día siguiente —vacía— mientras la
 * cajera todavía está cerrando el suyo.
 */
export function diaDeCierreAR(now: Date): string {
  return new Date(now.getTime() - OFFSET_AR_MS).toISOString().slice(0, 10);
}

/**
 * El rango UTC que cubre un día civil argentino: `[fecha 03:00Z, +24h)`.
 *
 * Un pago conciliado a las 23:30 hora argentina se guarda como 02:30Z del día siguiente. Con
 * un rango UTC ingenuo caería en el arqueo del día equivocado: el de la cajera no cuadra y el
 * del día siguiente aparece inflado con plata que entró ayer.
 */
export function rangoUtcDelDiaAR(fecha: string): { desde: Date; hasta: Date } {
  const desde = new Date(`${fecha}T03:00:00.000Z`);
  return { desde, hasta: new Date(desde.getTime() + 24 * 3600 * 1000) };
}

/**
 * El `where` de los pagos que entran al cierre del día.
 *
 * VIVE ACÁ PARA PODER FIJARLO CON UN TEST. Dos de estos filtros **ya rompieron una vez en
 * producción**, y los dos fallan del mismo modo traicionero: no explotan, inflan. El arqueo
 * queda más alto de lo que entró de verdad y la comisión se cobra sobre plata que la
 * inmobiliaria nunca tocó.
 *
 *  - `condonado: false` — una condonación cancela deuda sin que entre un peso.
 *  - `contrato.modoCobranza: 'INMOBILIARIA'` — en cobranza directa la plata va al CBU del
 *    dueño: la inmo no la cobró ni comisiona sobre ella. Mismo filtro que `/rendiciones`.
 *
 * Y los otros dos no son menos importantes: sin `inmobiliariaId` el cierre mostraría pagos,
 * inquilinos y direcciones de OTRA inmobiliaria; sin `estado: 'CONCILIADO'` entrarían pagos
 * apenas informados, que todavía no validó nadie.
 */
export function whereCierreDelDia(inmobiliariaId: string, fecha: string) {
  const { desde, hasta } = rangoUtcDelDiaAR(fecha);
  return {
    inmobiliariaId,
    estado: 'CONCILIADO' as const,
    condonado: false,
    decididoAt: { gte: desde, lt: hasta },
    contrato: { modoCobranza: 'INMOBILIARIA' as const },
  };
}

/** Lo que el cierre necesita de un pago, ya desacoplado de Prisma. */
export interface PagoParaCierre {
  /** Lo que efectivamente pagó el inquilino. Puede incluir mora. */
  monto: number;
  /** Moneda de la liquidación. Los pagos viejos pueden no tenerla → ARS. */
  moneda?: string | null;
  /** Base de alquiler de la liquidación (sin expensas). */
  liqAlquiler: number;
  /** Total de la liquidación: alquiler + expensas, SIN mora. */
  liqTotal: number;
  /** Dueños de la propiedad, para la tasa ponderada. */
  participaciones: { porcentaje: number; propietario: { comisionPct: number } | null }[];
}

export interface LineaCierre {
  monto: number;
  moneda: string;
  comision: number;
}

export interface TotalCierrePorMoneda {
  moneda: string;
  cobrado: number;
  comision: number;
  cantidad: number;
}

export interface TotalesCierre {
  /** Total plano. Sólo significa algo si `multiMoneda` es false. */
  cobrado: number;
  comision: number;
  cantidad: number;
  multiMoneda: boolean;
  porMoneda: TotalCierrePorMoneda[];
  /** Una línea por pago, en el mismo orden que entraron. */
  lineas: LineaCierre[];
}

/**
 * La porción de ALQUILER que hay adentro de un pago. Es la base de la comisión.
 *
 * Dos reglas viven en esta sola línea, y las dos cuestan plata si se caen:
 *
 *  - **Prorrateo:** se multiplica por `liqAlquiler / liqTotal` para dejar las expensas afuera.
 *    Las expensas van al consorcio; comisionarlas es cobrarle a la inmobiliaria plata que no le
 *    corresponde, y no se nota porque el número igual "se ve razonable".
 *  - **Cap a `liqTotal`:** un pago que incluye mora no infla la base. La mora es ingreso de la
 *    inmobiliaria, no base de comisión ni de rendición. Es la misma regla que aplica el guard de
 *    `alquilerCobradoSinRendir`; si los dos lados se separan, el cierre y la rendición dejan de
 *    cuadrar.
 *
 * Y la guarda `liqTotal > 0` no es defensiva de más: con una liquidación en total 0
 * (`SOLO_EXPENSAS` sin expensas cargadas) la división sería 0/0 = `NaN`, el `NaN` se propaga al
 * total del día y `JSON.stringify` lo serializa como `null` — la cajera cerraría el día sin
 * comisión y la pantalla no fallaría, se vería vacía.
 */
export function porcionAlquilerDelPago(p: Pick<PagoParaCierre, 'monto' | 'liqAlquiler' | 'liqTotal'>): number {
  if (!(p.liqTotal > 0)) return 0;
  return Math.min(p.monto, p.liqTotal) * (p.liqAlquiler / p.liqTotal);
}

/**
 * Comisión de un pago suelto, redondeada a CENTAVOS.
 *
 * El redondeo es a centavos y no a peso entero porque la rendición persiste la comisión en
 * `Decimal(14,2)`: redondear a peso acá reintroduce el drift que ya apareció una vez, y con 200
 * contratos deja de ser invisible.
 */
export function comisionDePago(p: PagoParaCierre): number {
  return r2c(porcionAlquilerDelPago(p) * tasaComisionDeParticipaciones(p.participaciones));
}

/**
 * El fold del día entero.
 *
 * NUNCA suma monedas distintas dentro de un bucket. El total plano (`cobrado`/`comision`) se
 * calcula igual porque con una sola moneda —el 99% de los días— es lo que se muestra, pero
 * `multiMoneda` avisa cuándo deja de significar algo y el front tiene que usar `porMoneda`.
 * Sumar ARS con USD da un número que no existe.
 */
export function totalizarCierre(pagos: PagoParaCierre[]): TotalesCierre {
  const buckets = new Map<string, TotalCierrePorMoneda>();
  const lineas: LineaCierre[] = [];
  let cobrado = 0;
  let comision = 0;

  for (const p of pagos) {
    const moneda = p.moneda ?? 'ARS';
    const comisionPago = comisionDePago(p);
    cobrado += p.monto;
    comision += comisionPago;
    lineas.push({ monto: p.monto, moneda, comision: comisionPago });

    let b = buckets.get(moneda);
    if (!b) {
      b = { moneda, cobrado: 0, comision: 0, cantidad: 0 };
      buckets.set(moneda, b);
    }
    b.cobrado += p.monto;
    b.comision += comisionPago;
    b.cantidad += 1;
  }

  const porMoneda = [...buckets.values()].map((b) => ({
    moneda: b.moneda,
    cobrado: r2c(b.cobrado),
    comision: r2c(b.comision),
    cantidad: b.cantidad,
  }));

  return {
    // Los acumuladores son floats: sin redondear, la suma arrastra artefactos binarios
    // (el clásico 0.1 + 0.2) hasta el JSON.
    cobrado: r2c(cobrado),
    comision: r2c(comision),
    cantidad: pagos.length,
    multiMoneda: porMoneda.length > 1,
    porMoneda,
    lineas,
  };
}
