import type { Prisma, Moneda, PagadorReclamo } from '@prisma/client';

/** Base de los cortes anti-doble-cobro. El costo del reclamo YA se cobró por algún
 *  camino, así que volver a imputarlo cobraría el mismo arreglo dos veces. La lanzan
 *  los dos caminos que cierran un reclamo (/resolver y /listo) → cada uno la mapea a 409. */
export class ReclamoNoReimputable extends Error {}

/** Ya se le descontó al propietario en una rendición. */
export class ReclamoYaRendido extends ReclamoNoReimputable {
  constructor() {
    super('Este trabajo ya se le descontó al propietario en una rendición. Anulá esa rendición antes de cambiar quién paga.');
    this.name = 'ReclamoYaRendido';
  }
}

/**
 * Se quiso imputar al DEPÓSITO un contrato que no tiene uno vivo.
 *
 * El cargo nacería incobrable por los cuatro caminos: no aparece en
 * `/depositos/en-custodia` (filtra RETENIDO), está excluido de `/mis-cargos`,
 * `/cargos/:id/saldar` lo rechaza y saldar-deuda lo ignora. Plata real que nadie puede
 * cobrar nunca.
 */
export class ReclamoDepositoNoDisponible extends ReclamoNoReimputable {
  constructor(sinDeposito: boolean) {
    super(
      sinDeposito
        ? 'Este contrato no tiene depósito de garantía cargado: elegí si lo paga el propietario o el inquilino.'
        : 'El depósito de este contrato ya fue resuelto: elegí si lo paga el propietario o el inquilino.',
    );
    this.name = 'ReclamoDepositoNoDisponible';
  }
}

/** El inquilino ya pagó el cargo de este reclamo (`saldadoAt`). */
export class ReclamoYaCobradoAlInquilino extends ReclamoNoReimputable {
  constructor() {
    super(
      'El inquilino ya pagó este arreglo. Deshacé ese cobro en el detalle del contrato antes de cambiar el importe o quién paga.',
    );
    this.name = 'ReclamoYaCobradoAlInquilino';
  }
}

/**
 * Imputa el costo de un reclamo resuelto a quien corresponda.
 *
 * ÚNICO lugar donde se decide a dónde va esa plata. Lo llaman los DOS caminos que cierran
 * un reclamo: el panel (`POST /reclamos/:id/resolver`) y el profesional por link mágico
 * (`POST /visitas-publicas/listo`).
 *
 * POR QUÉ EXISTE: antes esta lógica vivía inline sólo en el resolver del panel. Cuando el
 * reclamo lo cerraba el profesional, el costo quedaba escrito en `costoTrabajo` pero NO se
 * le cobraba a nadie si el pagador era INQUILINO o DEPOSITO — no aparecía en `/mis-cargos`,
 * no deducía el depósito, y la rendición lo ignoraba porque no era PROPIETARIO. La plata se
 * evaporaba, y encima quedaba irrecuperable (el reclamo ya RESUELTO hace que `/resolver`
 * responda 409). Tener un solo helper es lo que impide que los dos caminos vuelvan a diverger.
 *
 *   PROPIETARIO → sin cargo: lo toma la rendición del dueño (GastoRendido tipo TRABAJO).
 *   INQUILINO   → CargoContrato (deuda visible en /mis-cargos).
 *   DEPOSITO    → CargoContrato contraDeposito (descuenta del depósito retenido).
 *
 * IDEMPOTENTE por `reclamoId` (@unique): reejecutarlo no duplica el cargo.
 *
 * ⚠️ NO borra cargos ya saldados: si el cargo se cobró (`saldadoAt`), reclasificar a
 * PROPIETARIO lo dejaba sin registro de esa plata. Ahora se conserva.
 */
export async function imputarCostoReclamo(
  tx: Prisma.TransactionClient,
  args: {
    inmobiliariaId: string;
    reclamoId: string;
    contratoId: string;
    pagador: PagadorReclamo | null;
    costo: number;
    moneda: Moneda;
    /** Texto del cargo que ve el inquilino. */
    concepto: string;
    creadoPorId?: string | null;
  },
): Promise<void> {
  const { inmobiliariaId, reclamoId, contratoId, pagador, costo, moneda, concepto, creadoPorId } = args;

  // Anti-doble-cobro #2: el inquilino YA PAGÓ el cargo de este reclamo. El cobro vive
  // sólo en `saldadoAt` —no genera Pago ni movimiento de caja—, así que nada lo revierte
  // ni lo acredita si el costo se reimputa. Sin este corte:
  //   · a PROPIETARIO → el cargo cobrado sobrevive (a propósito, es la evidencia) pero
  //     la rendición igual le descuenta el arreglo al dueño: se cobra dos veces.
  //   · a DEPOSITO → el upsert muta la MISMA fila cobrada poniéndole contraDeposito,
  //     y al egreso se le descuenta del depósito lo que ya había pagado en efectivo.
  //   · mismo pagador con OTRO importe → el update pisa `monto` y el libro pasa a decir
  //     que se cobró una cifra distinta de la que realmente se cobró.
  // Reejecutar el cierre con exactamente lo mismo NO rompe nada, así que eso se deja
  // pasar: el helper tiene que seguir siendo idempotente.
  const previo = await tx.cargoContrato.findUnique({
    where: { reclamoId },
    select: { monto: true, contraDeposito: true, saldadoAt: true },
  });
  if (previo?.saldadoAt) {
    const mismoDestino = pagador === 'INQUILINO' || pagador === 'DEPOSITO';
    const cambia =
      !mismoDestino ||
      previo.contraDeposito !== (pagador === 'DEPOSITO') ||
      Number(previo.monto) !== costo;
    if (cambia) throw new ReclamoYaCobradoAlInquilino();
    return; // re-cierre idéntico: nada que hacer.
  }

  // Sin pagador o sin costo no hay nada que imputar. Limpiamos un cargo previo SOLO si
  // todavía no se cobró: borrar uno saldado destruiría la única evidencia del cobro.
  if (pagador === 'PROPIETARIO' || !pagador || costo <= 0) {
    await tx.cargoContrato.deleteMany({ where: { reclamoId, saldadoAt: null } });
    return;
  }

  // Imputar al DEPÓSITO exige que haya un depósito VIVO. Este guard existía sólo inline en
  // `/resolver` (operacion.ts:578-590) y `/listo` no lo tenía, así que el profesional por link
  // mágico podía crear un cargo `contraDeposito` sobre un contrato sin depósito —o con el
  // depósito ya devuelto, neteado o ejecutado— y ese cargo nace incobrable por los cuatro
  // caminos.
  //
  // Es exactamente la misma regresión que ya había pasado con el guard de `yaRendido` de acá
  // abajo: el commit que mudó ESE al helper (242db1b9, "no sólo en /resolver") fijó la regla del
  // choke point, y el guard de depósito se agregó inline el MISMO día (afb9efe9), sin mudarse.
  //
  // Va DESPUÉS de los dos early-returns de arriba a propósito: un re-cierre idéntico de un cargo
  // ya saldado, y el caso legítimo de resolver el depósito (que salda los cargos contraDeposito),
  // tienen que seguir pasando en 200.
  if (pagador === 'DEPOSITO') {
    const contrato = await tx.contrato.findUnique({
      where: { id: contratoId },
      select: { depositoGarantia: true, estadoDeposito: true },
    });
    const dg = Number(contrato?.depositoGarantia ?? 0);
    if (dg <= 0 || contrato?.estadoDeposito !== 'RETENIDO') throw new ReclamoDepositoNoDisponible(dg <= 0);
  }

  // Anti-doble-cobro (choke point de /resolver y /listo): si el costo YA se le descontó al
  // propietario en una rendición (GastoRendido TRABAJO), imputarlo ahora al inquilino o al
  // depósito lo cobraría DOS VECES —son dos libros sin dedup entre sí y el débito al dueño
  // vive en una rendición ya cerrada que nada revierte—. Se corta de forma ATÓMICA dentro
  // de la tx del cierre. Pasa al reabrir un reclamo (PERSISTE) y reclasificar el pagador.
  // Antes el guard vivía sólo inline en /resolver; /listo no lo tenía → doble-cobro.
  const yaRendido = await tx.gastoRendido.findFirst({
    where: { inmobiliariaId, refId: `reclamo:${reclamoId}`, tipo: 'TRABAJO' },
    select: { id: true },
  });
  if (yaRendido) throw new ReclamoYaRendido();

  await tx.cargoContrato.upsert({
    where: { reclamoId },
    create: {
      inmobiliariaId,
      contratoId,
      reclamoId,
      tipo: 'REPARACION',
      concepto,
      monto: costo,
      moneda,
      contraDeposito: pagador === 'DEPOSITO',
      creadoPorId: creadoPorId ?? null,
    },
    update: { monto: costo, moneda, concepto, contraDeposito: pagador === 'DEPOSITO', tipo: 'REPARACION' },
  });
}

/** Texto por defecto del cargo cuando el operador no escribió notas del costo. */
export function conceptoReclamo(categoria: string, descripcion: string): string {
  return `Reparación (${categoria.toLowerCase()}): ${descripcion.slice(0, 60)}`;
}
