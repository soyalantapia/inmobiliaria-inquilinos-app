import { describe, it, expect } from 'vitest';
import {
  CAMPOS_MOROSOS,
  MAX_MESES_DEUDA,
  finDelPeriodo,
  inicioDelPeriodo,
  mesesEntre,
  parsearFilaMoroso,
  parsearPeriodo,
  sugerirMapeoMorosos,
  claveDeduda,
  sugerirDireccionParecida,
  validarFilaMoroso,
} from '../src/lib/importacion-morosos.js';

/**
 * IMPORTACIÓN DE MOROSOS HISTÓRICOS — la capa pura.
 *
 * Todo lo que decide CUÁNTA DEUDA se crea y A QUIÉN pasa por acá. Los dos
 * errores caros que estos tests existen para atrapar:
 *
 *  1. Interpretar mal un mes. "01/06/2024" leído como mm/dd son cinco meses de
 *     diferencia: le cobrás a alguien meses que no debe. Por eso `parsearPeriodo`
 *     NO adivina (nada de nombres de mes en texto) y ante la duda devuelve null,
 *     que la ruta reporta como fila con error para que la corrijan a mano.
 *
 *  2. Colgar la deuda de la propiedad equivocada. El match es por dirección
 *     normalizada y —al revés que la importación de cartera— NO encontrarla es
 *     un error, no una invitación a crear la propiedad. Una planilla de morosos
 *     no puede dar de alta inmuebles.
 *
 * Tests PUROS: no tocan la DB.
 */

const PROPS = new Map([
  ['av colon 1234 3b', 'prop_1'],
  ['rivadavia 500', 'prop_2'],
]);

const HOY = '2026-08';

/** Fila mapeada válida, para pisar sólo el campo que cada test ejercita. */
function fila(over: Partial<Parameters<typeof validarFilaMoroso>[0]> = {}) {
  return {
    direccion: 'Av. Colón 1234 3B',
    inquilinoNombre: 'Marta',
    inquilinoApellido: 'Gómez',
    inquilinoDni: '20111222',
    inquilinoTelefono: null,
    debeDesde: '2024-03',
    debeHasta: '2024-05',
    monto: 95_000,
    montoExpensas: null,
    moneda: 'ARS' as const,
    ...over,
  };
}

describe('parsearPeriodo · los formatos que aparecen en un Excel real', () => {
  it('lee "2024-03" y "2024/03"', () => {
    expect(parsearPeriodo('2024-03')).toBe('2024-03');
    expect(parsearPeriodo('2024/03')).toBe('2024-03');
  });

  it('lee "03/2024" y "3-2024"', () => {
    expect(parsearPeriodo('03/2024')).toBe('2024-03');
    expect(parsearPeriodo('3-2024')).toBe('2024-03');
  });

  it('lee una fecha AR completa con el DÍA primero', () => {
    // El caso caro: si esto se leyera como mm/dd, "01/06/2024" daría enero.
    expect(parsearPeriodo('01/06/2024')).toBe('2024-06');
    expect(parsearPeriodo('31/12/2023')).toBe('2023-12');
  });

  it('lee la fecha serializada por la ruta ("YYYY-MM-DD"), y también un ISO con hora', () => {
    // La ruta serializa las celdas Date como día de calendario local
    // (`fechaDePlanilla`), NO con toISOString(): en un server al este de UTC el
    // día 1 se iría al mes anterior. Igual se acepta el ISO con hora, porque un
    // CSV puede traerlo escrito así.
    expect(parsearPeriodo('2024-03-01')).toBe('2024-03');
    expect(parsearPeriodo('2024-03-31')).toBe('2024-03');
    expect(parsearPeriodo('2024-03-01T03:00:00.000Z')).toBe('2024-03');
  });

  it('lee un Date nativo y un serial de Excel', () => {
    expect(parsearPeriodo(new Date(2024, 2, 15))).toBe('2024-03');
    // 45352 = 2024-03-01 en el calendario serial de Excel.
    expect(parsearPeriodo(45352)).toBe('2024-03');
  });

  it('NO adivina: texto libre, vacío y basura dan null', () => {
    expect(parsearPeriodo('marzo 2024')).toBeNull();
    expect(parsearPeriodo('')).toBeNull();
    expect(parsearPeriodo(null)).toBeNull();
    expect(parsearPeriodo('no sé')).toBeNull();
  });

  it('rechaza meses y años imposibles en vez de arrastrarlos', () => {
    expect(parsearPeriodo('2024-13')).toBeNull();
    expect(parsearPeriodo('2024-00')).toBeNull();
    expect(parsearPeriodo('1899-05')).toBeNull();
  });
});

describe('la ventana de deuda', () => {
  it('cuenta ambos extremos: marzo a mayo son 3 meses, no 2', () => {
    expect(mesesEntre('2024-03', '2024-05')).toBe(3);
  });

  it('un solo mes adeudado es 1', () => {
    expect(mesesEntre('2024-03', '2024-03')).toBe(1);
  });

  it('cruza el año correctamente', () => {
    expect(mesesEntre('2023-11', '2024-02')).toBe(4);
  });

  it('una ventana invertida da 0, no un negativo que después se use como cantidad', () => {
    expect(mesesEntre('2024-05', '2024-03')).toBe(0);
  });

  it('los bordes del período son el primer y el último día del mes', () => {
    expect(inicioDelPeriodo('2024-03').toISOString()).toBe('2024-03-01T00:00:00.000Z');
    expect(finDelPeriodo('2024-05').toISOString()).toBe('2024-05-31T00:00:00.000Z');
    // Febrero bisiesto, que es donde un cálculo casero se rompe.
    expect(finDelPeriodo('2024-02').toISOString()).toBe('2024-02-29T00:00:00.000Z');
    expect(finDelPeriodo('2023-02').toISOString()).toBe('2023-02-28T00:00:00.000Z');
  });
});

describe('validarFilaMoroso · la propiedad tiene que existir', () => {
  it('matchea por dirección normalizada aunque esté escrita distinto', () => {
    const v = validarFilaMoroso(fila({ direccion: 'AV. COLON  1234   3b' }), PROPS, HOY, new Set());

    expect(v.propiedadId).toBe('prop_1');
    expect(v.estado).toBe('OK');
    expect(v.meses).toBe(3);
  });

  it('si la dirección no está en la cartera, es ERROR y NO se inventa la propiedad', () => {
    const v = validarFilaMoroso(fila({ direccion: 'Calle Que No Existe 1' }), PROPS, HOY, new Set());

    expect(v.estado).toBe('ERROR');
    expect(v.propiedadId).toBeNull();
    expect(v.meses).toBe(0);
    expect(v.motivo).toContain('No encontramos esa propiedad');
  });

  it('sin dirección no llega ni a mirar la cartera', () => {
    expect(validarFilaMoroso(fila({ direccion: '' }), PROPS, HOY, new Set()).estado).toBe('ERROR');
  });
});

describe('validarFilaMoroso · lo que impide crear deuda equivocada', () => {
  it('el MES EN CURSO sí entra: es el moroso que se fue este mes', () => {
    // Es el caso más frecuente de una migración —dejó de pagar en julio, se fue en
    // agosto, la propiedad ya está realquilada— y antes no entraba por ningún
    // lado: acá se rechazaba por "ventana abierta" y el alta normal lo rechazaba
    // por propiedad ocupada. Justo la deuda más fresca, que es la que se cobra.
    const v = validarFilaMoroso(fila({ debeDesde: '2026-06', debeHasta: HOY }), PROPS, HOY, new Set());

    expect(v.estado).toBe('OK');
    expect(v.meses).toBe(3);
  });

  it('un mes FUTURO sigue siendo ERROR: cobrarlo sería inventar plata', () => {
    const v = validarFilaMoroso(fila({ debeDesde: '2026-06', debeHasta: '2027-01' }), PROPS, HOY, new Set());

    expect(v.estado).toBe('ERROR');
    expect(v.motivo).toContain('todavía no pasó');
  });

  it('el mes siguiente al actual ya es futuro, aunque sea por uno', () => {
    // El borde: HOY es 2026-08, así que 2026-09 no entra.
    expect(validarFilaMoroso(fila({ debeDesde: '2026-06', debeHasta: '2026-09' }), PROPS, HOY, new Set()).estado).toBe('ERROR');
  });

  it('el mes anterior al actual SÍ es válido: es el moroso más reciente posible', () => {
    const v = validarFilaMoroso(fila({ debeDesde: '2026-07', debeHasta: '2026-07' }), PROPS, HOY, new Set());

    expect(v.estado).toBe('OK');
    expect(v.meses).toBe(1);
  });

  it('la ventana invertida es ERROR', () => {
    const v = validarFilaMoroso(fila({ debeDesde: '2024-05', debeHasta: '2024-03' }), PROPS, HOY, new Set());

    expect(v.estado).toBe('ERROR');
    expect(v.motivo).toContain('anterior');
  });

  it('un año mal tipeado se corta en el tope en vez de crear cientos de cuotas', () => {
    // "2014" en vez de "2024" da ~140 meses de deuda. Es el typo clásico.
    const v = validarFilaMoroso(fila({ debeDesde: '2014-03', debeHasta: '2025-12' }), PROPS, HOY, new Set());

    expect(v.estado).toBe('ERROR');
    expect(v.meses).toBe(0);
    expect(v.motivo).toContain(String(MAX_MESES_DEUDA));
  });

  it('un mes ilegible es ERROR con instrucción de formato, no un default silencioso', () => {
    const v = validarFilaMoroso(fila({ debeDesde: null }), PROPS, HOY, new Set());

    expect(v.estado).toBe('ERROR');
    expect(v.motivo).toContain('2024-03');
  });

  it('monto cero o negativo es ERROR', () => {
    expect(validarFilaMoroso(fila({ monto: 0 }), PROPS, HOY, new Set()).estado).toBe('ERROR');
    expect(validarFilaMoroso(fila({ monto: -1 }), PROPS, HOY, new Set()).estado).toBe('ERROR');
    expect(validarFilaMoroso(fila({ monto: NaN }), PROPS, HOY, new Set()).estado).toBe('ERROR');
  });

  it('sin DNI se importa igual, pero avisando que no se va a unir a su ficha', () => {
    const v = validarFilaMoroso(fila({ inquilinoDni: null }), PROPS, HOY, new Set());

    expect(v.estado).toBe('ADVERTENCIA');
    expect(v.meses).toBe(3);
    expect(v.propiedadId).toBe('prop_1');
  });
});

describe('parsearFilaMoroso · de la celda al dato', () => {
  const MAPEO = {
    direccion: 0,
    inquilinoNombre: 1,
    inquilinoDni: 2,
    debeDesde: 3,
    debeHasta: 4,
    monto: 5,
    montoExpensas: 6,
    moneda: 7,
  };

  it('parsea una fila típica en formato argentino', () => {
    const d = parsearFilaMoroso(
      ['Av. Colón 1234 3B', 'Marta Gómez', '20111222', '2024-03', '2024-05', '95.000,50', '25.000', ''],
      MAPEO,
    );

    expect(d.direccion).toBe('Av. Colón 1234 3B');
    expect(d.monto).toBe(95_000.5);
    expect(d.montoExpensas).toBe(25_000);
    expect(d.moneda).toBe('ARS');
    expect(d.debeDesde).toBe('2024-03');
    expect(d.debeHasta).toBe('2024-05');
  });

  it('parte "Nombre Apellido" cuando no hay columna de apellido', () => {
    const d = parsearFilaMoroso(['x', 'Marta Gómez Pérez', '', '2024-03', '2024-03', '1', '', ''], MAPEO);

    expect(d.inquilinoNombre).toBe('Marta');
    expect(d.inquilinoApellido).toBe('Gómez Pérez');
  });

  it('detecta dólares por la columna moneda', () => {
    expect(parsearFilaMoroso(['x', 'y', '', '2024-03', '2024-03', '500', '', 'USD'], MAPEO).moneda).toBe('USD');
    expect(parsearFilaMoroso(['x', 'y', '', '2024-03', '2024-03', '500', '', 'dólares'], MAPEO).moneda).toBe('USD');
    expect(parsearFilaMoroso(['x', 'y', '', '2024-03', '2024-03', '500', '', 'pesos'], MAPEO).moneda).toBe('ARS');
  });

  it('expensas vacías quedan en null, no en cero', () => {
    // Importa la diferencia: null no toca `tipoContrato`; 0 lo volvería
    // ALQUILER_Y_EXPENSAS con expensas de $0.
    expect(parsearFilaMoroso(['x', 'y', '', '2024-03', '2024-03', '1', '', ''], MAPEO).montoExpensas).toBeNull();
  });

  it('una columna no mapeada no rompe la fila', () => {
    const d = parsearFilaMoroso(['Colón 1', 'Marta'], { direccion: 0, inquilinoNombre: 1 });

    expect(d.direccion).toBe('Colón 1');
    expect(d.debeDesde).toBeNull();
    expect(Number.isNaN(d.monto)).toBe(true);
  });
});

describe('sugerirMapeoMorosos · el auto-mapeo de headers', () => {
  it('reconoce los headers que pondría una inmobiliaria', () => {
    const m = sugerirMapeoMorosos(['Dirección', 'Inquilino', 'DNI', 'Debe desde', 'Debe hasta', 'Monto']);

    expect(m).toEqual({
      direccion: 0,
      inquilinoNombre: 1,
      inquilinoDni: 2,
      debeDesde: 3,
      debeHasta: 4,
      monto: 5,
    });
  });

  it('ignora acentos, mayúsculas y separadores en el header', () => {
    const m = sugerirMapeoMorosos(['DOMICILIO', 'Nombre_Inquilino', 'Adeuda-Desde']);

    expect(m.direccion).toBe(0);
    expect(m.inquilinoNombre).toBe(1);
    expect(m.debeDesde).toBe(2);
  });

  it('un header desconocido simplemente no mapea, sin romper', () => {
    expect(sugerirMapeoMorosos(['columna rara']).direccion).toBeUndefined();
  });

  it('los cuatro campos obligatorios son los que definen la deuda', () => {
    expect(CAMPOS_MOROSOS.filter((c) => c.requerido).map((c) => c.key).sort()).toEqual([
      'debeDesde',
      'debeHasta',
      'direccion',
      'inquilinoNombre',
      'monto',
    ].sort());
  });
});

describe('dedup · volver a subir la planilla no puede duplicar la deuda', () => {
  /**
   * Es el caso REAL de recuperación: de 50 filas entraron 40, Camila corrige las
   * 10 que fallaron y vuelve a subir la planilla entera. Sin dedup, esas 40 se
   * cargan de nuevo y cada moroso pasa a deber el doble.
   *
   * `@@unique([contratoId, periodo])` no salva de esto: cada importación crea un
   * contrato histórico NUEVO, con su propio juego de liquidaciones.
   */
  const claveDeMarta = claveDeduda('prop_1', '20111222', 'Marta', 'Gómez', '2024-03', '2024-05');

  it('una deuda ya cargada se marca DUPLICADO y no aporta meses', () => {
    const v = validarFilaMoroso(fila(), PROPS, HOY, new Set([claveDeMarta]));

    expect(v.estado).toBe('DUPLICADO');
    expect(v.meses).toBe(0);
    expect(v.motivo).toContain('ya está cargada');
  });

  it('la MISMA persona con OTRA ventana de meses sí entra: son dos deudas distintas', () => {
    const v = validarFilaMoroso(
      fila({ debeDesde: '2023-01', debeHasta: '2023-02' }),
      PROPS,
      HOY,
      new Set([claveDeMarta]),
    );

    expect(v.estado).toBe('OK');
    expect(v.meses).toBe(2);
  });

  it('la misma ventana en OTRA propiedad sí entra: alquiló en dos lados', () => {
    const v = validarFilaMoroso(fila({ direccion: 'Rivadavia 500' }), PROPS, HOY, new Set([claveDeMarta]));

    expect(v.estado).toBe('OK');
    expect(v.propiedadId).toBe('prop_2');
  });

  it('OTRA persona con la misma propiedad y ventana entra: se fueron distintos inquilinos', () => {
    const v = validarFilaMoroso(fila({ inquilinoDni: '30999888' }), PROPS, HOY, new Set([claveDeMarta]));

    expect(v.estado).toBe('OK');
  });

  it('el DNI manda sobre el nombre: la misma persona escrita distinto sigue siendo duplicado', () => {
    // "MARTA gomez" vs "Marta Gómez" es la misma señora; el DNI lo zanja.
    const v = validarFilaMoroso(
      fila({ inquilinoNombre: 'MARTA', inquilinoApellido: 'gomez' }),
      PROPS,
      HOY,
      new Set([claveDeMarta]),
    );

    expect(v.estado).toBe('DUPLICADO');
  });

  it('sin DNI cae al nombre normalizado, que igual atrapa el duplicado', () => {
    const porNombre = claveDeduda('prop_1', null, 'Marta', 'Gómez', '2024-03', '2024-05');
    const v = validarFilaMoroso(fila({ inquilinoDni: null }), PROPS, HOY, new Set([porNombre]));

    expect(v.estado).toBe('DUPLICADO');
  });

  it('el dedup NO pisa un error de forma: una fila rota se reporta por lo que está rota', () => {
    // Si la fecha no se pudo leer, no hay clave con la cual comparar. El motivo
    // útil es el de la fecha, no "ya está cargada".
    const v = validarFilaMoroso(fila({ debeDesde: null }), PROPS, HOY, new Set([claveDeMarta]));

    expect(v.estado).toBe('ERROR');
    expect(v.motivo).toContain('debe desde');
  });
});

describe('expensas y moneda · lo que un subagente encontró probando la aritmética', () => {
  const MAPEO = {
    direccion: 0,
    inquilinoNombre: 1,
    debeDesde: 2,
    debeHasta: 3,
    monto: 4,
    montoExpensas: 5,
    moneda: 6,
  };
  const filaCon = (expensas: string, moneda = '') =>
    parsearFilaMoroso(['Av. Colón 1234 3B', 'Marta', '2024-03', '2024-04', '100000', expensas, moneda], MAPEO);

  it('expensas NEGATIVAS son ERROR: restaban del alquiler y subestimaban la deuda', () => {
    const v = validarFilaMoroso(filaCon('-30000'), PROPS, HOY, new Set());

    expect(v.estado).toBe('ERROR');
    expect(v.motivo).toContain('Expensas inválidas');
  });

  it('un negativo CONTABLE entre paréntesis también se corta', () => {
    // parsearMonto lee "(30.000)" como -30000 (convención contable).
    expect(validarFilaMoroso(filaCon('(30.000)'), PROPS, HOY, new Set()).estado).toBe('ERROR');
  });

  it('un RANGO tipeado en la celda es ERROR, no un número absurdo', () => {
    // "1.500 - 2.000" se parsea como -15002000 y hundía el total de cada cuota.
    const d = filaCon('1.500 - 2.000');

    expect(validarFilaMoroso(d, PROPS, HOY, new Set()).estado).toBe('ERROR');
  });

  it('texto en la celda de expensas es ERROR, no un null silencioso', () => {
    // Antes "ver planilla" daba null y las expensas desaparecían sin aviso.
    expect(validarFilaMoroso(filaCon('ver planilla'), PROPS, HOY, new Set()).estado).toBe('ERROR');
  });

  it('la celda VACÍA sí es válida: quiere decir que no hay expensas', () => {
    const d = filaCon('');

    expect(d.montoExpensas).toBeNull();
    // No es OK sino ADVERTENCIA porque esta fila de prueba no trae DNI; lo que
    // se afirma acá es que las expensas vacías NO la invalidan.
    expect(validarFilaMoroso(d, PROPS, HOY, new Set()).estado).not.toBe('ERROR');
  });

  it('un cero explícito también es válido', () => {
    expect(validarFilaMoroso(filaCon('0'), PROPS, HOY, new Set()).estado).not.toBe('ERROR');
  });

  it('todas las formas de escribir dólares se leen como dólares', () => {
    // "US$" y "U$D" caían a PESOS: un error de dos órdenes de magnitud sobre la
    // deuda de alguien.
    for (const m of ['USD', 'usd', 'U$S', 'US$', 'U$D', 'dolares', 'Dólares', 'DOLAR']) {
      expect(filaCon('', m).moneda, `"${m}" debería ser USD`).toBe('USD');
    }
  });

  it('lo que NO es dólar sigue siendo pesos', () => {
    for (const m of ['', 'ARS', 'pesos', '$', 'peso argentino']) {
      expect(filaCon('', m).moneda, `"${m}" debería ser ARS`).toBe('ARS');
    }
  });
});

describe('sugerir la dirección parecida · el cuello de botella real de la feature', () => {
  /**
   * Camila escribió sus direcciones en el Excel hace años y en el sistema están
   * de otra forma. El match exacto normalizado falla en buena parte de las 50
   * filas, y "no encontramos esa propiedad" la manda a Propiedades a buscar cómo
   * está escrita, una por una. Nombrarle la candidata es lo que hace que la
   * importación sirva de verdad.
   */
  const CARTERA = ['Av. Colón 1234 3B', 'Rivadavia 500', 'San Martín 890 Piso 2 Dto A', 'Mitre 1234'];

  it('encuentra la misma calle escrita distinto', () => {
    expect(sugerirDireccionParecida('Colon 1234 3ro B', CARTERA)).toBe('Av. Colón 1234 3B');
    expect(sugerirDireccionParecida('San Martin 890 2A', CARTERA)).toBe('San Martín 890 Piso 2 Dto A');
  });

  it('NO sugiere cuando la altura no coincide: son dos propiedades de la misma cuadra', () => {
    expect(sugerirDireccionParecida('Colón 1500', CARTERA)).toBeNull();
  });

  it('NO sugiere con la altura igual pero otra calle: mandaría la deuda a la propiedad equivocada', () => {
    // "Belgrano 1234" comparte altura con Colón 1234 y con Mitre 1234, y no
    // comparte una sola palabra de calle con ninguna. Callar es lo correcto.
    expect(sugerirDireccionParecida('Belgrano 1234', CARTERA)).toBeNull();
  });

  it('elige la MEJOR entre dos que comparten altura', () => {
    // 1234 lo tienen Colón y Mitre; la palabra "mitre" desempata.
    expect(sugerirDireccionParecida('Mitre 1234 PB', CARTERA)).toBe('Mitre 1234');
  });

  it('sin altura en la dirección buscada no se arriesga una sugerencia', () => {
    expect(sugerirDireccionParecida('Avenida Colón', CARTERA)).toBeNull();
    expect(sugerirDireccionParecida('', CARTERA)).toBeNull();
  });

  it('con la cartera vacía no explota', () => {
    expect(sugerirDireccionParecida('Colón 1234', [])).toBeNull();
  });

  it('el motivo de la fila nombra la candidata, en vez de mandarla a buscar', () => {
    const v = validarFilaMoroso(
      fila({ direccion: 'Colon 1234 3ro B' }),
      PROPS,
      HOY,
      new Set(),
      CARTERA,
    );

    expect(v.estado).toBe('ERROR');
    expect(v.motivo).toContain('Av. Colón 1234 3B');
  });

  it('sin candidata parecida, el motivo sigue siendo el genérico', () => {
    const v = validarFilaMoroso(
      fila({ direccion: 'Belgrano 9999' }),
      PROPS,
      HOY,
      new Set(),
      CARTERA,
    );

    expect(v.motivo).toContain('No encontramos esa propiedad');
  });
});
