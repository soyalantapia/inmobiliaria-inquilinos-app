/**
 * El dueño que cobró en dos monedas SÍ tiene algo para rendir.
 *
 * De la auditoría del 31/08 (`work-agent/AUDITORIA-2026-08-31.md`). El defecto no era una
 * condición mal escrita: era que el mismo número —`totalRecibirMes`— significaba dos cosas.
 * El hook lo pone en **0** cuando hay mezcla de monedas, a propósito, para no mostrar una suma
 * cruda de pesos con dólares; y la pantalla leía ese cero defensivo como "no hay nada que
 * rendir", en las tres copias del predicado.
 */
import { describe, it, expect } from 'vitest';
import { faltaRendirle, tieneMezclaDeMonedas } from './falta-rendirle';

const enPesos = { totalRecibirMes: 480_000, monedasMes: ['ARS'] };
const mezclado = { totalRecibirMes: 0, monedasMes: ['ARS', 'USD'] };
const sinCobros = { totalRecibirMes: 0, monedasMes: [] };

describe('a quién le falta que le rindan', () => {
  it('🔴 el que cobró en pesos Y dólares tiene algo para rendir, aunque el total diga 0', () => {
    // Éste es el caso. El 0 no es "no cobró": es "no existe UN número que lo resuma".
    expect(faltaRendirle(mezclado, false)).toBe(true);
    expect(tieneMezclaDeMonedas(mezclado)).toBe(true);
  });

  it('el de una sola moneda sigue funcionando igual que antes', () => {
    expect(faltaRendirle(enPesos, false)).toBe(true);
  });

  it('🔴 el que NO cobró nada no tiene mezcla — y por eso no le sale el cartel', () => {
    // La otra cara: sin cobros, `monedaMensual` también era null y salía el aviso de mezcla
    // de monedas. Con el rol CARGA (403 en /liquidaciones) salía en TODAS las tarjetas,
    // siempre: un semáforo que está rojo siempre deja de avisar.
    expect(tieneMezclaDeMonedas(sinCobros)).toBe(false);
    expect(faltaRendirle(sinCobros, false)).toBe(false);
  });

  it('si ya se le rindió, no falta nada — ni siquiera con mezcla', () => {
    expect(faltaRendirle(mezclado, true)).toBe(false);
    expect(faltaRendirle(enPesos, true)).toBe(false);
  });

  it('sin `monedasMes` (dato viejo o respuesta incompleta) no se inventa una mezcla', () => {
    // Control defensivo: el campo es opcional en el tipo. Si no viene, el criterio cae al
    // total, que es el comportamiento de antes — nunca a "hay mezcla".
    expect(tieneMezclaDeMonedas({ totalRecibirMes: 0 })).toBe(false);
    expect(faltaRendirle({ totalRecibirMes: 0 }, false)).toBe(false);
    expect(faltaRendirle({ totalRecibirMes: 100 }, false)).toBe(true);
  });

  it('el control que le da sentido: con la regla vieja, el mezclado quedaba afuera', () => {
    const viejo = (p: { totalRecibirMes: number }, yaRendido: boolean) => !yaRendido && p.totalRecibirMes > 0;
    expect(viejo(mezclado, false)).toBe(false); // ← invisible
    expect(faltaRendirle(mezclado, false)).toBe(true);
    // Y en el caso normal las dos reglas coinciden: el arreglo no mueve nada más.
    expect(viejo(enPesos, false)).toBe(faltaRendirle(enPesos, false));
    expect(viejo(sinCobros, false)).toBe(faltaRendirle(sinCobros, false));
  });
});
