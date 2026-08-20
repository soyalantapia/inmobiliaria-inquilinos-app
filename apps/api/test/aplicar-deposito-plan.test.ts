/**
 * `planDeImputacion` — a qué deuda se le aplica el depósito en garantía, y cuánto se le
 * devuelve al inquilino.
 *
 * POR QUÉ IMPORTA. Es el cierre de cuentas de una baja: la garantía del inquilino se usa para
 * cancelar lo que debe y **el resto se le devuelve**. Un error acá le cobra de más a alguien
 * que se está yendo, o le regala plata a alguien que debe — y en los dos casos se ve como un
 * número normal en la pantalla de la baja.
 *
 * El módulo arrastra una historia fea, escrita en su propio docblock: antes marcaba el depósito
 * como NETEADO, cobraba la penalidad y **no tocaba una sola liquidación**. La garantía se
 * consumía y la deuda quedaba intacta, sumando punitorios. El panel mostraba un neto que el
 * backend nunca ejecutaba.
 *
 * Estos tests son puros: la aritmética se separó de las queries justamente para poder correrlos
 * sin base, en CI y en cualquier máquina.
 */
import { describe, it, expect } from 'vitest';
import { planDeImputacion, type CuotaParaImputar } from '../src/lib/aplicar-deposito.js';

const cuota = (id: string, saldo: number, exigible = true): CuotaParaImputar => ({ id, saldo, exigible });

describe('planDeImputacion · la plata no se evapora ni se multiplica', () => {
  it('aplicado + sobrante = disponible, siempre', () => {
    // LA INVARIANTE QUE IMPORTA. Lo que no cancela deuda se le devuelve al inquilino; si esto
    // no cierra, o se le está reteniendo plata sin motivo o se está regalando la de la
    // inmobiliaria.
    const p = planDeImputacion([cuota('a', 30000), cuota('b', 45000)], 100000);
    expect(p.aplicado + p.sobrante).toBe(100000);
  });

  it('cierra también cuando el depósito NO alcanza', () => {
    const p = planDeImputacion([cuota('a', 80000), cuota('b', 90000)], 50000);
    expect(p.aplicado + p.sobrante).toBe(50000);
    expect(p.sobrante).toBe(0);
  });

  it('cierra con centavos, sin arrastrar artefactos binarios', () => {
    const p = planDeImputacion([cuota('a', 0.1), cuota('b', 0.2)], 0.35);
    expect(p.aplicado + p.sobrante).toBe(0.35);
  });
});

describe('planDeImputacion · cuánto se le imputa a cada cuota', () => {
  it('nunca imputa más que el saldo de la cuota', () => {
    // Pagar de más una cuota dejaría al inquilino con crédito en ésa y deuda viva en la
    // siguiente: la deuda total no bajaría lo que debería.
    const p = planDeImputacion([cuota('a', 30000)], 100000);
    expect(p.imputaciones).toHaveLength(1);
    expect(p.imputaciones[0]!.imputa).toBe(30000);
    expect(p.sobrante).toBe(70000);
  });

  it('nunca imputa más que el depósito disponible', () => {
    // Gastar una garantía que no existe: la deuda figuraría cancelada sin que entre la plata.
    const p = planDeImputacion([cuota('a', 500000)], 120000);
    expect(p.imputaciones[0]!.imputa).toBe(120000);
    expect(p.aplicado).toBe(120000);
  });

  it('respeta el orden en que llegan: la más vieja primero', () => {
    // El caller las trae ordenadas por vencimiento. La más vieja es la que más mora acumuló,
    // así que es la que conviene cancelar primero.
    const p = planDeImputacion([cuota('vieja', 40000), cuota('nueva', 40000)], 50000);
    expect(p.imputaciones.map((i) => i.id)).toEqual(['vieja', 'nueva']);
    expect(p.imputaciones[0]!.imputa).toBe(40000);
    expect(p.imputaciones[1]!.imputa).toBe(10000);
  });

  it('se detiene cuando se acabó el depósito, sin tocar el resto', () => {
    const p = planDeImputacion([cuota('a', 50000), cuota('b', 50000), cuota('c', 50000)], 60000);
    expect(p.imputaciones.map((i) => i.id)).toEqual(['a', 'b']);
  });
});

describe('planDeImputacion · qué cuotas NO se tocan', () => {
  it('una cuota FUTURA (no exigible) se saltea', () => {
    // El ex-inquilino no ocupó ese mes: cancelarlo con su garantía sería cobrarle un alquiler
    // que no debe. Mismo criterio que el preview de la baja — si divergen, el diálogo promete
    // un número que el backend no cumple.
    const p = planDeImputacion([cuota('futura', 60000, false), cuota('vencida', 40000)], 100000);
    expect(p.imputaciones.map((i) => i.id)).toEqual(['vencida']);
    expect(p.sobrante).toBe(60000);
  });

  it('una cuota ya saldada (saldo 0) se saltea sin gastar depósito', () => {
    const p = planDeImputacion([cuota('saldada', 0), cuota('debe', 20000)], 50000);
    expect(p.imputaciones.map((i) => i.id)).toEqual(['debe']);
    expect(p.aplicado).toBe(20000);
  });

  it('sin deuda exigible, el depósito vuelve entero', () => {
    // El caso feliz de una baja al día: no se le retiene un peso.
    const p = planDeImputacion([cuota('futura', 90000, false)], 250000);
    expect(p.aplicado).toBe(0);
    expect(p.sobrante).toBe(250000);
    expect(p.imputaciones).toEqual([]);
  });

  it('sin depósito disponible no se imputa nada', () => {
    const p = planDeImputacion([cuota('a', 50000)], 0);
    expect(p).toMatchObject({ aplicado: 0, sobrante: 0, cuotasSaldadas: 0 });
    expect(p.imputaciones).toEqual([]);
  });

  it('un disponible negativo no genera deuda ni sobrante negativo', () => {
    // No debería llegar, pero un sobrante negativo se le "devolvería" al inquilino como un
    // cargo, que es la peor forma de fallar.
    const p = planDeImputacion([cuota('a', 50000)], -1000);
    expect(p.aplicado).toBe(0);
    expect(p.sobrante).toBe(0);
  });
});

describe('planDeImputacion · cuándo una cuota queda saldada', () => {
  it('cubrir el saldo exacto la deja saldada', () => {
    const p = planDeImputacion([cuota('a', 40000)], 40000);
    expect(p.imputaciones[0]!.cubierta).toBe(true);
    expect(p.cuotasSaldadas).toBe(1);
  });

  it('quedarse corto por más de un centavo la deja PARCIAL', () => {
    const p = planDeImputacion([cuota('a', 40000)], 39000);
    expect(p.imputaciones[0]!.cubierta).toBe(false);
    expect(p.cuotasSaldadas).toBe(0);
  });

  it('quedarse corto por UN CENTAVO igual la da por saldada', () => {
    // La tolerancia es la misma que usan validar y el pago manual. Sin ella, una cuota quedaría
    // eternamente PARCIAL por un centavo de redondeo y el contrato no se podría cerrar.
    const p = planDeImputacion([cuota('a', 40000)], 39999.99);
    expect(p.imputaciones[0]!.cubierta).toBe(true);
    expect(p.cuotasSaldadas).toBe(1);
  });

  it('cuenta sólo las saldadas del todo, no las tocadas', () => {
    // `cuotasSaldadas` es lo que se le informa al operador en el cierre de la baja.
    const p = planDeImputacion([cuota('a', 30000), cuota('b', 30000), cuota('c', 30000)], 70000);
    expect(p.imputaciones).toHaveLength(3);
    expect(p.cuotasSaldadas).toBe(2);
  });
});
