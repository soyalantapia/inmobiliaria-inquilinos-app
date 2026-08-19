/**
 * Importación de MOROSOS HISTÓRICOS: inquilinos que ya se fueron debiendo.
 *
 * Es prima de la importación de cartera (`importacion-cartera.ts`) y comparte
 * su gramática —mapeo flexible de columnas, sinónimos de header, `parsearMonto`—
 * pero NO su semántica, y por eso vive aparte en vez de ser un flag adentro:
 *
 *   · La de cartera CREA la propiedad en cada fila y RECHAZA la fila si esa
 *     dirección ya existe. Ésta hace exactamente lo inverso: la propiedad tiene
 *     que existir, y si no existe la fila es un error. Un moroso de hace tres
 *     años vivió en una propiedad que hoy ya está cargada y alquilada a otro.
 *   · La de cartera fuerza `devengarDesde` = mes actual justamente para NO
 *     fabricar deuda pasada (ver importaciones-cartera.ts). Acá la deuda pasada
 *     ES el objetivo.
 *
 * Mezclar las dos en un solo pipeline habría puesto un `if (tipo === ...)` en
 * cada paso de una máquina que ya está llena de comentarios sobre bugs de
 * duplicación en carteras reales de clientes. No vale la pena.
 *
 * UNA FILA = UN MOROSO: persona + propiedad + ventana de meses adeudados. Se
 * traduce a un contrato FINALIZADO que no ocupa la propiedad (ver
 * POST /contratos/historico), cuyas liquidaciones son la deuda.
 */
import { parsearMonto } from './monto.js';
import { normalizarHeader, normalizarDireccion, type CampoImportacion } from './importacion-cartera.js';

export { normalizarDireccion };

/**
 * Campos destino. El admin mapea las columnas de SU planilla a estos.
 *
 * `debeDesde`/`debeHasta` delimitan la VENTANA DE DEUDA, no el alquiler: si
 * alquiló dos años y se fue debiendo los últimos tres meses, son esos tres. El
 * label lo dice así de explícito porque es el malentendido caro de esta pantalla
 * (cargar el contrato entero generaría 24 cuotas adeudadas en vez de 3).
 */
export const CAMPOS_MOROSOS: CampoImportacion[] = [
  {
    key: 'direccion',
    label: 'Dirección de la propiedad',
    requerido: true,
    sinonimos: ['direccion', 'domicilio', 'propiedad', 'inmueble', 'direccion propiedad', 'unidad'],
  },
  {
    key: 'inquilinoNombre',
    label: 'Inquilino que debe (nombre)',
    requerido: true,
    sinonimos: ['inquilino', 'nombre inquilino', 'locatario', 'nombre', 'inquilino nombre', 'deudor', 'moroso'],
  },
  {
    key: 'inquilinoApellido',
    label: 'Inquilino (apellido)',
    requerido: false,
    sinonimos: ['apellido', 'apellido inquilino'],
  },
  {
    key: 'inquilinoDni',
    label: 'Inquilino (DNI)',
    requerido: false,
    sinonimos: ['dni', 'documento', 'cuit', 'cuil'],
  },
  {
    key: 'inquilinoTelefono',
    label: 'Inquilino (teléfono)',
    requerido: false,
    sinonimos: ['telefono', 'celular', 'tel', 'cel', 'telefono inquilino'],
  },
  {
    key: 'debeDesde',
    label: 'Debe desde (mes)',
    requerido: true,
    sinonimos: ['debe desde', 'desde', 'periodo desde', 'mes desde', 'primer mes adeudado', 'adeuda desde'],
  },
  {
    key: 'debeHasta',
    label: 'Debe hasta (mes)',
    requerido: true,
    sinonimos: ['debe hasta', 'hasta', 'periodo hasta', 'mes hasta', 'ultimo mes adeudado', 'adeuda hasta'],
  },
  {
    key: 'monto',
    label: 'Alquiler por mes',
    requerido: true,
    sinonimos: ['monto', 'alquiler', 'importe', 'valor', 'precio', 'monto alquiler', 'canon', 'monto mensual'],
  },
  {
    key: 'montoExpensas',
    label: 'Expensas por mes',
    requerido: false,
    sinonimos: ['expensas', 'monto expensas', 'expensa'],
  },
  {
    key: 'moneda',
    label: 'Moneda',
    requerido: false,
    sinonimos: ['moneda'],
  },
];

/** Sugiere { campoKey: columnaIndex } por sinónimo exacto del header normalizado. */
export function sugerirMapeoMorosos(headers: string[]): Record<string, number> {
  const norm = headers.map(normalizarHeader);
  const mapeo: Record<string, number> = {};
  for (const campo of CAMPOS_MOROSOS) {
    const idx = norm.findIndex((h) => campo.sinonimos.includes(h));
    if (idx >= 0) mapeo[campo.key] = idx;
  }
  return mapeo;
}

function celda(fila: unknown[], mapeo: Record<string, number>, key: string): unknown {
  const idx = mapeo[key];
  return idx === undefined ? undefined : fila[idx];
}

function texto(v: unknown): string {
  return v == null ? '' : String(v).trim();
}

function periodoDe(y: number, m: number): string | null {
  if (!Number.isInteger(y) || !Number.isInteger(m) || m < 1 || m > 12) return null;
  if (y < 1990 || y > 2200) return null;
  return `${y}-${String(m).padStart(2, '0')}`;
}

/**
 * Un mes de la planilla → `"YYYY-MM"`.
 *
 * Acepta lo que realmente aparece en un Excel de inmobiliaria: una fecha real
 * (Excel con `cellDates`), un serial de Excel, `"2024-03"`, `"03/2024"` y fechas
 * completas `"01/03/2024"` en formato AR (día primero).
 *
 * NO adivina nombres de mes en texto ("marzo 2024"). Acá una interpretación
 * equivocada no es un typo: crea deuda de meses que la persona no debe. Ante la
 * duda devolvemos null y la fila se reporta como error para que la corrijan.
 */
export function parsearPeriodo(v: unknown): string | null {
  if (v == null || v === '') return null;

  if (v instanceof Date) {
    return Number.isNaN(v.getTime()) ? null : periodoDe(v.getFullYear(), v.getMonth() + 1);
  }

  if (typeof v === 'number') {
    // Serial de Excel (mismo origen que parsearFecha de la importación de cartera).
    if (!Number.isFinite(v) || v <= 0) return null;
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return Number.isNaN(d.getTime()) ? null : periodoDe(d.getUTCFullYear(), d.getUTCMonth() + 1);
  }

  const s = texto(v);
  if (!s) return null;

  // "2024-03" / "2024/03"
  const isoMes = /^(\d{4})[/-](\d{1,2})$/.exec(s);
  if (isoMes) return periodoDe(Number(isoMes[1]), Number(isoMes[2]));

  // "03/2024" / "3-2024"
  const mesAnio = /^(\d{1,2})[/-](\d{4})$/.exec(s);
  if (mesAnio) return periodoDe(Number(mesAnio[2]), Number(mesAnio[1]));

  // "2024-03-15" (ISO completo)
  const isoFecha = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (isoFecha) return periodoDe(Number(isoFecha[1]), Number(isoFecha[2]));

  // "01/03/2024" — AR: día primero. Es la razón por la que el CSV se lee con
  // raw:true en la ruta: si dejáramos que xlsx coercione, "01/06/2024" entraría
  // como 6 de enero.
  const ar = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/.exec(s);
  if (ar) {
    let anio = Number(ar[3]);
    if (anio < 100) anio += 2000;
    return periodoDe(anio, Number(ar[2]));
  }

  return null;
}

/** Primer día del período, en UTC. `"2024-03"` → 2024-03-01. */
export function inicioDelPeriodo(periodo: string): Date {
  const [y, m] = periodo.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, 1));
}

/** Último día del período, en UTC. `"2024-05"` → 2024-05-31. */
export function finDelPeriodo(periodo: string): Date {
  const [y, m] = periodo.split('-').map(Number);
  return new Date(Date.UTC(y!, m!, 0));
}

/** Cuántos meses cubre la ventana, ambos extremos incluidos. 0 si está invertida. */
export function mesesEntre(desde: string, hasta: string): number {
  const [ya, ma] = desde.split('-').map(Number);
  const [yb, mb] = hasta.split('-').map(Number);
  const n = (yb! - ya!) * 12 + (mb! - ma!) + 1;
  return n > 0 ? n : 0;
}

export interface FilaMoroso {
  direccion: string;
  inquilinoNombre: string;
  inquilinoApellido: string | null;
  inquilinoDni: string | null;
  inquilinoTelefono: string | null;
  /** `"YYYY-MM"` o null si no se pudo interpretar. */
  debeDesde: string | null;
  debeHasta: string | null;
  monto: number;
  montoExpensas: number | null;
  moneda: 'ARS' | 'USD';
}

export function parsearFilaMoroso(fila: unknown[], mapeo: Record<string, number>): FilaMoroso {
  const nombreRaw = texto(celda(fila, mapeo, 'inquilinoNombre'));
  let nombre = nombreRaw;
  let apellido = texto(celda(fila, mapeo, 'inquilinoApellido')) || null;
  // Sin columna de apellido pero con "Juan Pérez" en una sola: se parte. Mismo
  // criterio que la importación de cartera, para que las dos planillas de la
  // misma inmobiliaria agrupen igual bajo la misma Persona.
  if (!apellido && mapeo.inquilinoApellido === undefined && nombreRaw.includes(' ')) {
    const partes = nombreRaw.split(/\s+/);
    nombre = partes[0]!;
    apellido = partes.slice(1).join(' ');
  }

  const monto = parsearMonto(celda(fila, mapeo, 'monto'));

  // Expensas: se distingue VACÍO de ILEGIBLE, y la diferencia importa.
  // Vacío → null (el contrato queda como ALQUILER a secas). Ilegible → NaN, que
  // la validación convierte en error de fila. Antes las dos daban null, así que
  // una celda con "ver planilla" hacía desaparecer las expensas en silencio y la
  // deuda quedaba subestimada sin que nadie se enterara.
  const expensasRaw = celda(fila, mapeo, 'montoExpensas');
  const expensas = expensasRaw == null || texto(expensasRaw) === '' ? null : parsearMonto(expensasRaw);

  // "US$" y "U$D" también son dólares. Con el chequeo anterior (usd/dolar/u$s)
  // caían a PESOS: una deuda en dólares cargada como pesos es un error de dos
  // órdenes de magnitud. `normalizarHeader` ya bajó a minúsculas y sacó tildes,
  // pero deja el "$" en pie, que es de lo que se agarra este patrón.
  const monedaRaw = normalizarHeader(texto(celda(fila, mapeo, 'moneda')));
  const moneda: 'ARS' | 'USD' = /u\$|us\$|usd|dolar/.test(monedaRaw) ? 'USD' : 'ARS';

  return {
    direccion: texto(celda(fila, mapeo, 'direccion')),
    inquilinoNombre: nombre,
    inquilinoApellido: apellido,
    inquilinoDni: texto(celda(fila, mapeo, 'inquilinoDni')) || null,
    inquilinoTelefono: texto(celda(fila, mapeo, 'inquilinoTelefono')) || null,
    debeDesde: parsearPeriodo(celda(fila, mapeo, 'debeDesde')),
    debeHasta: parsearPeriodo(celda(fila, mapeo, 'debeHasta')),
    monto: Number.isFinite(monto) ? monto : NaN,
    // NaN pasa a propósito (celda ilegible): lo atrapa `validarFilaMoroso`.
    montoExpensas: expensas,
    moneda,
  };
}

/**
 * La dirección de la cartera más parecida a la que trae la planilla, o null.
 *
 * Existe porque sin esto la feature no sirve. Las direcciones de Camila están
 * escritas como las tipeó ella hace años ("Colón 1234 3ro B") y en el sistema
 * están de otra forma ("Av. Colón 1234 3B"): el match exacto normalizado falla
 * en buena parte de las 50 filas, y el mensaje "no encontramos esa propiedad" la
 * deja yendo a Propiedades a buscar cómo está escrita, una por una. Nombrarle la
 * candidata convierte 30 idas y vueltas en 30 correcciones obvias.
 *
 * La heurística se apoya en cómo son las direcciones argentinas: **la altura es
 * la señal fuerte**. Sin número coincidente no se sugiere nada — preferimos no
 * sugerir a mandarla a cargar deuda en la propiedad equivocada. Con el número
 * igual, se rankea por cuántas palabras de la calle comparten.
 *
 * Sólo SUGIERE: la fila sigue siendo un error y no se importa. La corrección la
 * hace una persona.
 */
export function sugerirDireccionParecida(
  direccion: string,
  candidatas: Iterable<string>,
): string | null {
  const palabras = (s: string) => normalizarDireccion(s).split(' ').filter(Boolean);
  const numeros = (ps: string[]) => ps.filter((p) => /^\d+$/.test(p));

  const buscada = palabras(direccion);
  const numBuscada = numeros(buscada);
  if (numBuscada.length === 0) return null;

  let mejor: string | null = null;
  let mejorPuntaje = 0;

  for (const cand of candidatas) {
    const ps = palabras(cand);
    // La altura tiene que coincidir. "Colón 1234" y "Colón 1500" son dos
    // propiedades distintas de la misma cuadra, no una escrita de dos formas.
    if (!numeros(ps).some((n) => numBuscada.includes(n))) continue;

    const texto = new Set(ps.filter((p) => !/^\d+$/.test(p)));
    const comunes = buscada.filter((p) => !/^\d+$/.test(p) && texto.has(p)).length;
    const totalTexto = buscada.filter((p) => !/^\d+$/.test(p)).length;
    // Con la altura igual ya hay señal; el texto desempata. Si la buscada es sólo
    // un número ("1234"), el puntaje base alcanza para sugerir la única con esa
    // altura, que es lo razonable.
    const puntaje = totalTexto === 0 ? 0.5 : 0.5 + 0.5 * (comunes / totalTexto);

    if (puntaje > mejorPuntaje) {
      mejorPuntaje = puntaje;
      mejor = cand;
    }
  }

  // Con la altura igual pero CERO palabras en común ("Colón 1234" vs "Mitre
  // 1234") no se sugiere: sería mandarla a la propiedad equivocada.
  return mejorPuntaje > 0.5 ? mejor : null;
}

/**
 * Clave para no cargar dos veces la misma deuda.
 *
 * Hace falta porque re-subir la planilla es el camino NORMAL de recuperación:
 * Camila corrige las filas que fallaron y la vuelve a subir. Sin esto, las 40
 * que sí habían entrado se cargarían de nuevo y el moroso pasaría a deber el
 * doble. `@@unique([contratoId, periodo])` no la salva: cada importación crea un
 * contrato histórico NUEVO, con su propio juego de liquidaciones.
 *
 * Identidad = DNI si lo hay; si no, nombre + apellido normalizados. No es
 * perfecto (dos "Juan Pérez" sin DNI en la misma propiedad y la misma ventana
 * colisionan) pero ese caso es indistinguible de un duplicado real, y el costo
 * de equivocarse es que se lo marque para revisar a mano — no que se le invente
 * deuda.
 */
export function claveDeduda(
  propiedadId: string,
  dni: string | null,
  nombre: string,
  apellido: string | null,
  desde: string,
  hasta: string,
): string {
  const identidad = dni?.trim()
    ? `dni:${dni.trim()}`
    : `nom:${normalizarHeader(`${nombre} ${apellido ?? ''}`)}`;
  return `${propiedadId}|${identidad}|${desde}|${hasta}`;
}

export type EstadoFilaMoroso = 'OK' | 'ADVERTENCIA' | 'ERROR' | 'DUPLICADO';

export interface ValidacionFilaMoroso {
  estado: EstadoFilaMoroso;
  motivo: string | null;
  /** Propiedad de la cartera que matcheó por dirección. null si no matcheó. */
  propiedadId: string | null;
  /** Cuántas cuotas de deuda va a crear esta fila. 0 si no es importable. */
  meses: number;
}

/** Tope de meses por fila. Ver `validarFilaMoroso`. */
export const MAX_MESES_DEUDA = 120;

/**
 * Valida una fila ya mapeada.
 *
 * `propiedadesPorDireccion` = direcciones NORMALIZADAS de la cartera del tenant →
 * id. Es lo contrario del dedup de la importación de cartera: allá encontrar la
 * dirección rechaza la fila, acá NO encontrarla la rechaza. Una planilla de
 * morosos no puede dar de alta propiedades: si la dirección no está, o está
 * escrita distinto o esa propiedad nunca se cargó, y en los dos casos hay que
 * mirarlo a mano antes de crear deuda.
 *
 * `periodoHoy` = `"YYYY-MM"` del mes en curso, en día civil AR.
 */
export function validarFilaMoroso(
  d: FilaMoroso,
  propiedadesPorDireccion: Map<string, string>,
  periodoHoy: string,
  /**
   * Claves (`claveDeduda`) de la deuda histórica que YA está cargada, más las de
   * las filas anteriores de esta misma planilla. OBLIGATORIO aunque se pueda
   * pasar vacío: cuando un parámetro así es opcional, un caller nuevo se lo
   * saltea en silencio y el dedup queda apagado sin que nada falle — le pasó a
   * la importación de cartera con `direccionesExistentes` (ver el comentario en
   * `validarFila`).
   */
  deudaYaCargada: Set<string>,
  /**
   * Direcciones de la cartera tal como están escritas, para poder sugerir la más
   * parecida cuando el match exacto falla. Vacío = no se sugiere nada.
   */
  direccionesConocidas: Iterable<string> = [],
): ValidacionFilaMoroso {
  const nada = { propiedadId: null, meses: 0 };

  if (!d.direccion) return { estado: 'ERROR', motivo: 'Falta la dirección de la propiedad', ...nada };
  if (!d.inquilinoNombre) return { estado: 'ERROR', motivo: 'Falta el nombre del inquilino', ...nada };

  const propiedadId = propiedadesPorDireccion.get(normalizarDireccion(d.direccion)) ?? null;
  if (!propiedadId) {
    // Sin match exacto, nombramos la candidata más parecida. Es la diferencia
    // entre "andá a buscar cómo la escribiste" y "copiá esto".
    const parecida = sugerirDireccionParecida(d.direccion, direccionesConocidas);
    return {
      estado: 'ERROR',
      motivo: parecida
        ? `No encontramos "${d.direccion}" en tu cartera. ¿Será "${parecida}"? Corregila en la planilla y volvé a subirla`
        : 'No encontramos esa propiedad en tu cartera. Cargala primero, o revisá cómo está escrita la dirección',
      ...nada,
    };
  }

  if (!Number.isFinite(d.monto) || d.monto <= 0) {
    return { estado: 'ERROR', motivo: 'Monto del alquiler inválido', propiedadId, meses: 0 };
  }
  // Las expensas NO se validaban y son parte del total de cada cuota. Dos casos
  // reales que entraban sin chistar y subestimaban la deuda:
  //  · un negativo ("-30.000", o "(30.000)" que `parsearMonto` lee como negativo
  //    contable) restaba del alquiler;
  //  · un rango tipeado en la celda ("1.500 - 2.000") se parsea como -15002000 y
  //    hundía el total a un número absurdo.
  // Un cero explícito sí se acepta: quiere decir "no tiene expensas".
  if (d.montoExpensas != null && (!Number.isFinite(d.montoExpensas) || d.montoExpensas < 0)) {
    return {
      estado: 'ERROR',
      motivo: 'Expensas inválidas: tiene que ser un número mayor o igual a cero, o la celda vacía',
      propiedadId,
      meses: 0,
    };
  }
  if (!d.debeDesde) {
    return { estado: 'ERROR', motivo: 'No pudimos leer el mes "debe desde" (usá 2024-03 o 03/2024)', propiedadId, meses: 0 };
  }
  if (!d.debeHasta) {
    return { estado: 'ERROR', motivo: 'No pudimos leer el mes "debe hasta" (usá 2024-03 o 03/2024)', propiedadId, meses: 0 };
  }

  const meses = mesesEntre(d.debeDesde, d.debeHasta);
  if (meses === 0) {
    return { estado: 'ERROR', motivo: 'El mes "hasta" es anterior al mes "desde"', propiedadId, meses: 0 };
  }
  // Mismo tope que el estado inicial del alta manual. Una ventana absurda suele
  // ser un año mal tipeado (2014 en vez de 2024) y crearía cientos de cuotas de
  // deuda que después hay que borrar a mano.
  if (meses > MAX_MESES_DEUDA) {
    return {
      estado: 'ERROR',
      motivo: `La ventana da ${meses} meses de deuda. Revisá las fechas: el máximo por fila es ${MAX_MESES_DEUDA}`,
      propiedadId,
      meses: 0,
    };
  }
  // La ventana tiene que estar CERRADA. Si el último mes adeudado es el actual o
  // uno futuro, esto no es un moroso histórico: es el inquilino que vive ahí, y
  // va por el alta normal (que sí ocupa la propiedad y devenga mes a mes).
  if (d.debeHasta >= periodoHoy) {
    return {
      estado: 'ERROR',
      motivo: 'La deuda histórica es de meses ya terminados. Si el inquilino sigue viviendo ahí, cargalo como contrato normal',
      propiedadId,
      meses: 0,
    };
  }

  // Va DESPUÉS de todas las validaciones de forma (una fila con la fecha rota no
  // tiene clave con la cual compararse) y ANTES del aviso por DNI faltante: si
  // esta deuda ya está cargada, que falte el DNI es lo de menos.
  const clave = claveDeduda(propiedadId, d.inquilinoDni, d.inquilinoNombre, d.inquilinoApellido, d.debeDesde, d.debeHasta);
  if (deudaYaCargada.has(clave)) {
    return {
      estado: 'DUPLICADO',
      motivo: 'Esta deuda ya está cargada (mismo inquilino, misma propiedad, mismos meses)',
      propiedadId,
      meses: 0,
    };
  }

  if (!d.inquilinoDni) {
    return {
      estado: 'ADVERTENCIA',
      motivo: 'Sin DNI no podemos unirlo a su ficha si ya está en tu cartera: se crea como persona nueva',
      propiedadId,
      meses,
    };
  }

  return { estado: 'OK', motivo: null, propiedadId, meses };
}
