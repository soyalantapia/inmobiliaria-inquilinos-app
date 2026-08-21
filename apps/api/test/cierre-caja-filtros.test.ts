/**
 * Los FILTROS del cierre de caja: qué pagos entran al arqueo del día, y cuáles no.
 *
 * POR QUÉ ESTÁ SEPARADO DE `cierre-caja.test.ts`. Aquél cubre la aritmética —cuánto suma cada
 * pago—. Éste cubre la pregunta anterior: **cuáles se cuentan**. Es la mitad que faltaba, y la
 * que más veces rompió.
 *
 * DOS DE ESTOS FILTROS YA FALLARON EN PRODUCCIÓN, y los dos del mismo modo traicionero: no
 * explotan, **inflan**. El arqueo queda más alto de lo que entró de verdad y la comisión se
 * cobra sobre plata que la inmobiliaria nunca tocó. Nadie lo nota mirando la pantalla, porque
 * un número más grande no se ve mal.
 *
 * CÓMO SE PUEDE TESTEAR ESTO SIN BASE. La construcción del `where` se extrajo a una función
 * pura: entra el tenant y la fecha, sale el objeto que se le pasa a Prisma. El test afirma
 * sobre ESE objeto. Es honesto decir qué prueba y qué no: prueba **la consulta que armamos**,
 * no lo que Postgres devuelve. No sustituye a un test de integración —si Prisma interpretara
 * `contrato: { modoCobranza }` distinto, esto no lo vería—. Lo que sí agarra, y es lo que pasó
 * las dos veces, es que **alguien borre un filtro**.
 */
import { describe, it, expect } from 'vitest';
import { diaDeCierreAR, rangoUtcDelDiaAR, whereCierreDelDia } from '../src/lib/cierre-caja.js';

const TENANT = 'inmo-abc';

describe('el día civil argentino, no el día UTC', () => {
  it('a las 23:30 de Argentina todavía es HOY, aunque en UTC ya sea mañana', () => {
    // 2026-08-20T02:30:00Z = 23:30 del 19 en Argentina. Si el cierre usara el día UTC, a las
    // 21:05 hora local la pantalla saltaría al día siguiente —vacía— con la cajera todavía
    // cerrando el suyo.
    expect(diaDeCierreAR(new Date('2026-08-20T02:30:00.000Z'))).toBe('2026-08-19');
  });

  it('a las 00:30 de Argentina ya es el día nuevo', () => {
    // 03:30Z = 00:30 AR del mismo día.
    expect(diaDeCierreAR(new Date('2026-08-20T03:30:00.000Z'))).toBe('2026-08-20');
  });

  it('justo a las 03:00Z arranca el día argentino', () => {
    // El borde exacto: 03:00Z = 00:00 AR.
    expect(diaDeCierreAR(new Date('2026-08-20T03:00:00.000Z'))).toBe('2026-08-20');
    expect(diaDeCierreAR(new Date('2026-08-20T02:59:59.999Z'))).toBe('2026-08-19');
  });

  it('el rango del día va de las 03:00Z a las 03:00Z del día siguiente', () => {
    const { desde, hasta } = rangoUtcDelDiaAR('2026-08-19');
    expect(desde.toISOString()).toBe('2026-08-19T03:00:00.000Z');
    expect(hasta.toISOString()).toBe('2026-08-20T03:00:00.000Z');
  });

  it('un pago de las 23:30 AR cae DENTRO del rango de su día, no del siguiente', () => {
    // Es el caso concreto que descuadra el arqueo: el pago se guarda como 02:30Z del 20.
    const pago = new Date('2026-08-20T02:30:00.000Z');
    const suDia = rangoUtcDelDiaAR('2026-08-19');
    expect(pago >= suDia.desde && pago < suDia.hasta).toBe(true);

    const diaSiguiente = rangoUtcDelDiaAR('2026-08-20');
    expect(pago >= diaSiguiente.desde).toBe(false);
  });

  it('el rango es semiabierto: el borde superior pertenece al día siguiente', () => {
    // Con `lte` en vez de `lt`, un pago exactamente a las 03:00:00.000Z se contaría DOS veces:
    // en el cierre de un día y en el del otro.
    const { hasta } = rangoUtcDelDiaAR('2026-08-19');
    const maniana = rangoUtcDelDiaAR('2026-08-20');
    expect(hasta.getTime()).toBe(maniana.desde.getTime());
  });
});

describe('qué pagos entran al arqueo', () => {
  const where = whereCierreDelDia(TENANT, '2026-08-19');

  it('sólo los CONCILIADOS', () => {
    // Sin esto entrarían los apenas INFORMADOS: plata que todavía no validó nadie, contada
    // como si hubiera entrado a la caja.
    expect(where.estado).toBe('CONCILIADO');
  });

  it('los CONDONADOS quedan afuera', () => {
    // Ya rompió una vez. Condonar cancela una deuda sin que entre un peso; contarlo infla el
    // arqueo y encima genera comisión sobre un perdón.
    expect(where.condonado).toBe(false);
  });

  it('los de PROPIETARIO_DIRECTO quedan afuera', () => {
    // Ya rompió una vez (B1). En cobranza directa el inquilino transfiere al CBU del dueño: la
    // inmobiliaria no cobró esa plata ni gana comisión sobre ella. Contarla infla el cierre con
    // dinero que nunca pasó por la caja.
    expect(where.contrato).toEqual({ modoCobranza: 'INMOBILIARIA' });
  });

  it('siempre va scopeado a la inmobiliaria', () => {
    // El cierre expone monto, inquilino y dirección. Una fuga acá no es un número mal: son
    // datos y plata de otra inmobiliaria en la pantalla de arqueo.
    expect(where.inmobiliariaId).toBe(TENANT);
  });

  it('acota por la fecha de CONCILIACIÓN, no por la de pago', () => {
    // El arqueo del día es de lo que se validó ese día. `fechaPago` es cuándo el inquilino dice
    // que transfirió, que puede ser de la semana pasada.
    expect(where.decididoAt.gte.toISOString()).toBe('2026-08-19T03:00:00.000Z');
    expect(where.decididoAt.lt.toISOString()).toBe('2026-08-20T03:00:00.000Z');
  });

  it('la plata MIGRADA DE CARTERA queda afuera', () => {
    // El alta de un contrato EN CURSO registra los períodos anteriores como pagados
    // (`lib/estado-inicial-contrato.ts`) con `decididoAt` = vencimiento de cada cuota: plata
    // que la inmobiliaria cobró y le liquidó al dueño antes de usar el sistema. Entra al
    // arqueo del día en que venció cada una e infla el cobrado Y la comisión, que sale del
    // mismo array. La rendición y el cobrado rendible ya la excluían; el cierre no.
    expect(where.migradoDeCartera).toBe(false);
  });

  it('no arrastra ningún filtro de más que recorte el arqueo en silencio', () => {
    // Al revés que los otros: un filtro EXTRA haría desaparecer plata que sí entró. Fijar la
    // forma exacta obliga a que agregar uno sea una decisión consciente, no un descuido.
    expect(Object.keys(where).sort()).toEqual(
      [
        'condonado',
        'contrato',
        'decididoAt',
        'estado',
        'inmobiliariaId',
        'migradoDeCartera',
      ].sort(),
    );
  });
});
