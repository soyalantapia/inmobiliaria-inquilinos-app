/**
 * `conSaldo` — cuánto le falta pagar al inquilino de una liquidación.
 *
 * POR QUÉ IMPORTA. Es de las funciones de plata más usadas del backend y **no tenía un solo
 * test**. De su resultado salen la deuda total del contrato (`core.ts`), el "por cobrar" del
 * dashboard (`metricas.ts`), cuánto se descuenta del depósito de garantía
 * (`aplicar-deposito.ts`) y lo que el inquilino ve que debe (`plata.ts`). Un error acá no se ve
 * como un error: se ve como un número.
 *
 * Es pura —no toca base ni red— así que estos tests corren en CI y en cualquier máquina.
 */
import { describe, it, expect } from 'vitest';
import { conSaldo } from '../src/lib/saldos.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const LIQ = { id: 'liq_1', montoTotal: 600000 };
const pagado = (n: number) => new Map([['liq_1', n]]);

describe('conSaldo · lo que falta pagar', () => {
  it('sin pagos, el saldo es el total', () => {
    expect(conSaldo(LIQ, new Map()).saldo).toBe(600000);
  });

  it('una liquidación que no está en el mapa cuenta como 0 pagado, no como NaN', () => {
    // `pagadoMap` sólo trae las liquidaciones que TIENEN pagos: la mayoría no está. Si el
    // default fuera `undefined`, el saldo saldría NaN y se propagaría a la deuda total del
    // contrato y al "por cobrar" del dashboard.
    const r = conSaldo(LIQ, new Map([['otra', 100]]));
    expect(r.montoPagado).toBe(0);
    expect(Number.isNaN(r.saldo)).toBe(false);
  });

  it('un pago parcial baja el saldo', () => {
    expect(conSaldo(LIQ, pagado(200000)).saldo).toBe(400000);
  });

  it('pagado exacto deja saldo 0', () => {
    expect(conSaldo(LIQ, pagado(600000)).saldo).toBe(0);
  });

  it('pagar DE MÁS no genera saldo negativo', () => {
    // Pasa de verdad: el inquilino redondea para arriba, o paga dos veces. Un saldo negativo
    // se restaría de la deuda de las OTRAS cuotas y le bajaría la deuda total del contrato por
    // una plata que no existe.
    expect(conSaldo(LIQ, pagado(650000)).saldo).toBe(0);
  });

  it('el montoPagado se conserva tal cual aunque supere al total', () => {
    // El saldo se capea, el pagado NO: el dato de que pagó de más tiene que sobrevivir para
    // poder verlo y devolvérselo.
    expect(conSaldo(LIQ, pagado(650000)).montoPagado).toBe(650000);
  });
});

describe('conSaldo · la mora va ADENTRO del total', () => {
  it('el montoTotal devuelto es base + punitorio, no la base sola', () => {
    // Es un contrato con el front: el inquilino calcula `montoOriginal = montoTotal −
    // montoPunitorio`. Si acá se devolviera la base pelada, la pantalla mostraría la mora
    // restada dos veces.
    const r = conSaldo(LIQ, new Map(), 30000);
    expect(r.montoTotal).toBe(630000);
    expect(r.montoPunitorio).toBe(30000);
  });

  it('el saldo incluye la mora: con la base pagada, todavía debe los punitorios', () => {
    // Si el saldo ignorara la mora, una cuota pagada tarde figuraría saldada y la mora no se
    // cobraría nunca.
    expect(conSaldo(LIQ, pagado(600000), 30000).saldo).toBe(30000);
  });

  it('sin mora explícita, el punitorio es 0 y el total no se toca', () => {
    // La mayoría de los endpoints no calculan mora. El default no puede inventar deuda.
    const r = conSaldo(LIQ, new Map());
    expect(r.montoPunitorio).toBe(0);
    expect(r.montoTotal).toBe(600000);
  });
});

describe('conSaldo · redondeo y tipos', () => {
  it('redondea a centavos y no arrastra artefactos binarios', () => {
    // `montoTotal` viene de un Decimal y el punitorio de un cálculo con tasas diarias: sin
    // redondear, 0.1 + 0.2 llega al JSON como 0.30000000000000004.
    const r = conSaldo({ id: 'liq_1', montoTotal: 0.1 }, new Map(), 0.2);
    expect(r.montoTotal).toBe(0.3);
  });

  it('el saldo también se redondea a centavos', () => {
    const r = conSaldo({ id: 'liq_1', montoTotal: 1000.555 }, pagado(0.1));
    expect(r.saldo).toBe(1000.46);
  });

  it('acepta el Decimal de Prisma, que no es un number', () => {
    // Prisma devuelve `Decimal`, no `number`; por eso la firma toma `unknown` y hace
    // `Number()`. Un Decimal serializado como string tiene que funcionar igual.
    const r = conSaldo({ id: 'liq_1', montoTotal: '600000.50' }, pagado(0.5));
    expect(r.montoTotal).toBe(600000.5);
    expect(r.saldo).toBe(600000);
  });

  it('conserva el resto de los campos de la liquidación', () => {
    // Varios callers le pasan la liquidación con cosas colgadas (`{ ...l, contrato }`) y usan
    // el resultado directo como respuesta del endpoint. Si esto perdiera campos, la pantalla
    // se quedaría sin el período o sin el contrato.
    const r = conSaldo({ id: 'liq_1', montoTotal: 600000, periodo: '2026-08', extra: 'x' }, new Map());
    expect(r.periodo).toBe('2026-08');
    expect(r.extra).toBe('x');
  });
});

describe('GUARDARRAÍL · el saldo SÍ cuenta las condonaciones, y es a propósito', () => {
  it('`montoPagadoPorLiquidacion` no filtra `condonado`', () => {
    // LA TRAMPA. Condonar crea un `Pago` CONCILIADO con `condonado: true` (plata.ts). Otros
    // tres lugares lo EXCLUYEN a propósito, y con razón: la rendición al propietario
    // (`rendicion-pendiente.ts`), el portal del dueño y el cierre de caja miran PLATA QUE
    // ENTRÓ, y una condonación no entró.
    //
    // Acá es al revés y también con razón: esto mide LO QUE EL INQUILINO DEBE, y una deuda
    // perdonada ya no se debe. Si alguien "unifica la inconsistencia" agregando
    // `condonado: false` a esta query, le vuelve a cobrar al inquilino lo que la inmobiliaria
    // le perdonó — y encima aparece como deuda viva en el dashboard.
    //
    // Se mira el código porque el filtro es una ausencia, y una ausencia no se puede afirmar
    // desde afuera sin una base.
    const src = readFileSync(join(import.meta.dirname, '..', 'src', 'lib', 'saldos.ts'), 'utf8');
    // El corte va hasta la función SIGUIENTE, no hasta `conSaldo`: desde que existe
    // `montoCobradoRendiblePorLiquidacion` —que sí filtra condonado, porque mide lo
    // contrario— el slice viejo se la llevaba adentro y este guardarraíl daba rojo por el
    // filtro correcto de la función de al lado.
    // El corte va de una función a la SIGUIENTE, y sin comentarios.
    //
    // Lo primero, porque el slice viejo llegaba hasta `conSaldo` y desde que existe
    // `montoCobradoRendiblePorLiquidacion` —que sí filtra condonado, porque mide lo
    // contrario— se la llevaba adentro. Lo segundo, porque el DOCBLOCK de esa función
    // explica por qué lo filtra, y la palabra en la prosa hacía dar rojo a este guardarraíl.
    // Lo que se afirma acá es una ausencia EN LA QUERY, no en el texto.
    const sinComentarios = (t: string) =>
      t
        .split(/\r?\n/)
        .filter((l) => {
          const x = l.trim();
          return !(x.startsWith('//') || x.startsWith('*') || x.startsWith('/*'));
        })
        .join('\n');
    const query = sinComentarios(
      src.slice(
        src.indexOf('export async function montoPagadoPorLiquidacion'),
        src.indexOf('export async function montoCobradoRendiblePorLiquidacion'),
      ),
    );

    expect(query).toContain("estado: 'CONCILIADO'");
    expect(
      /condonado/.test(query),
      'Si agregaste `condonado` a montoPagadoPorLiquidacion: NO. Esta función mide lo que el ' +
        'inquilino DEBE, y una deuda condonada ya no se debe. Excluirla le vuelve a cobrar lo ' +
        'que se le perdonó. Los que sí deben excluirla son los que miden plata que ENTRÓ: la ' +
        'rendición, el portal del propietario y el cierre de caja.',
    ).toBe(false);
  });
});

describe('GUARDARRAÍL · y la hermana SÍ las excluye, que es el otro lado', () => {
  it('`montoCobradoRendiblePorLiquidacion` filtra condonado Y migrado', () => {
    // Las dos funciones miden cosas OPUESTAS, y por eso las dos tienen guardarraíl:
    // aquélla contesta "¿cuánto dejó de deber el inquilino?" —donde una condonación SÍ
    // cuenta— y ésta "¿cuánta plata entró que se le pueda transferir al dueño?", donde no.
    // Unificarlas rompe una de las dos.
    //
    // Sin esta mitad, el panel estimaba lo que se le va a rendir con la cifra de la deuda:
    // la ficha decía "a recibir $450.000", el operador se lo dictaba al dueño por teléfono,
    // apretaba Rendir y el server contestaba 409 "todavía no hay cobros nuevos".
    const src = readFileSync(join(import.meta.dirname, '..', 'src', 'lib', 'saldos.ts'), 'utf8');
    const query = src.slice(src.indexOf('export async function montoCobradoRendiblePorLiquidacion'));

    expect(query).toContain("estado: 'CONCILIADO'");
    expect(query, 'una condonación cancela deuda pero no ingresa plata').toContain('condonado: false');
    expect(
      query,
      'la plata de la migración de cartera se cobró y se liquidó antes de que el sistema ' +
        'existiera: rendirla de nuevo es pagarle dos veces al dueño',
    ).toContain('migradoDeCartera: false');
  });
});
