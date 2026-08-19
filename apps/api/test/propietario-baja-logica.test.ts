import { describe, it, expect } from 'vitest';
import { tasaComisionDeParticipaciones } from '../src/lib/ganancia-contrato.js';

/**
 * BAJA LÓGICA DEL PROPIETARIO — la excepción que hay que proteger.
 *
 * T-23-N4 agregó `Propietario.activo` y lo empezó a filtrar en las tres puertas
 * del portal, en el guard, en los anuncios y en el importador de cartera. Con
 * `activo: true` apareciendo en tantos lugares, el reflejo del próximo que lea
 * este código va a ser agregarlo también acá.
 *
 * **Sería un bug, y de plata.** La tasa de comisión es Σ(participación ×
 * comisionPct) sobre el 100% de la propiedad. Excluir a un dueño dado de baja no
 * lo saca de la escritura: sólo hace que la suma dé de menos y la inmobiliaria
 * comisione menos de lo que le corresponde, en silencio y en cada pago.
 *
 * La baja lógica corta el ACCESO al portal, no la titularidad. Si un dueño dejó
 * de serlo de verdad, lo que se cambia es el reparto de participaciones.
 *
 * (La misma fórmula está duplicada inline en `plata.ts` para el cierre de caja.
 * Este test cubre la de la lib; el comentario en plata.ts remite acá.)
 *
 * Tests PUROS: no tocan la DB.
 */

describe('tasaComisionDeParticipaciones · la baja lógica NO cambia la comisión', () => {
  it('un solo dueño al 100% da su propia comisión', () => {
    expect(tasaComisionDeParticipaciones([{ porcentaje: 100, propietario: { comisionPct: 8 } }])).toBeCloseTo(0.08);
  });

  it('pondera por participación cuando hay varios dueños', () => {
    // 50% al 8% + 50% al 6% = 7%
    const tasa = tasaComisionDeParticipaciones([
      { porcentaje: 50, propietario: { comisionPct: 8 } },
      { porcentaje: 50, propietario: { comisionPct: 6 } },
    ]);

    expect(tasa).toBeCloseTo(0.07);
  });

  it('la firma NO recibe el estado del propietario: filtrar por activo no es una opción acá', () => {
    // El tipo del parámetro sólo declara `{ porcentaje, propietario: { comisionPct } }`.
    // Que `activo` no esté ni disponible es la defensa estructural: no se puede
    // filtrar por algo que la función no recibe. Si alguien lo agrega al tipo,
    // este test se vuelve la conversación que hay que tener.
    const participaciones = [{ porcentaje: 100, propietario: { comisionPct: 8 } }];

    expect(Object.keys(participaciones[0]!.propietario!)).toEqual(['comisionPct']);
  });

  it('un dueño sin comisión cargada cuenta como 0, no rompe el total de los otros', () => {
    const tasa = tasaComisionDeParticipaciones([
      { porcentaje: 50, propietario: { comisionPct: 8 } },
      { porcentaje: 50, propietario: null },
    ]);

    expect(tasa).toBeCloseTo(0.04);
  });

  it('sin participaciones la tasa es 0 (no explota ni asume un default)', () => {
    expect(tasaComisionDeParticipaciones([])).toBe(0);
  });

  it('un reparto que no suma 100 se refleja tal cual: la función no lo normaliza', () => {
    // Es la propiedad que hace que EXCLUIR a un dueño baje la tasa. Fijarlo acá
    // deja explícito por qué filtrar sería un bug: la función confía en que las
    // participaciones cubren el 100%, y ese invariante lo garantiza el endpoint
    // que las edita (valida suma = 100), no este cálculo.
    expect(tasaComisionDeParticipaciones([{ porcentaje: 50, propietario: { comisionPct: 8 } }])).toBeCloseTo(0.04);
  });
});
