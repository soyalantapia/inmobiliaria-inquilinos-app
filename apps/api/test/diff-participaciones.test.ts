import { describe, expect, it } from 'vitest';
import { diffParticipaciones } from '../src/lib/diff-participaciones.js';

/**
 * Test PURO (sin DB).
 *
 * De este diff va a colgar un recorte de PRIVACIDAD: "desde cuándo esta persona es dueña de
 * esta propiedad" se responde con su primer registro. Si el diff mete filas de más —un dueño
 * que no cambió— ese primer registro deja de significar lo que tiene que significar, y el
 * recorte le muestra de menos a alguien que sí tiene derecho a ver. Si mete de menos, le muestra
 * de más a alguien que no.
 */
const p = (propietarioId: string, porcentaje: number) => ({ propietarioId, porcentaje });

describe('diffParticipaciones', () => {
  it('sin cambios no registra nada', () => {
    expect(diffParticipaciones([p('a', 100)], [p('a', 100)])).toEqual([]);
    expect(diffParticipaciones([p('a', 50), p('b', 50)], [p('b', 50), p('a', 50)])).toEqual([]);
  });

  it('alguien ENTRA: anterior null', () => {
    expect(diffParticipaciones([], [p('a', 100)])).toEqual([
      { propietarioId: 'a', porcentajeAnterior: null, porcentajeNuevo: 100 },
    ]);
  });

  it('alguien SALE: nuevo null', () => {
    expect(diffParticipaciones([p('a', 100)], [])).toEqual([
      { propietarioId: 'a', porcentajeAnterior: 100, porcentajeNuevo: null },
    ]);
  });

  it('cambia el porcentaje: los dos con valor', () => {
    expect(diffParticipaciones([p('a', 100)], [p('a', 60)])).toEqual([
      { propietarioId: 'a', porcentajeAnterior: 100, porcentajeNuevo: 60 },
    ]);
  });

  it('la venta típica: uno sale, otro entra, y quien no cambió NO aparece', () => {
    // Es el caso que motivó todo: A le vende su mitad a C, B sigue igual. Si B apareciera,
    // su "primer registro" pasaría a ser hoy y el portal le recortaría el historial de una
    // unidad de la que es dueño desde siempre.
    const cambios = diffParticipaciones(
      [p('a', 50), p('b', 50)],
      [p('c', 50), p('b', 50)],
    );
    expect(cambios).toHaveLength(2);
    expect(cambios.find((c) => c.propietarioId === 'a')).toEqual({
      propietarioId: 'a', porcentajeAnterior: 50, porcentajeNuevo: null,
    });
    expect(cambios.find((c) => c.propietarioId === 'c')).toEqual({
      propietarioId: 'c', porcentajeAnterior: null, porcentajeNuevo: 50,
    });
    expect(cambios.find((c) => c.propietarioId === 'b')).toBeUndefined();
  });

  it('re-reparto entre los mismos: los dos cambian', () => {
    const cambios = diffParticipaciones([p('a', 50), p('b', 50)], [p('a', 70), p('b', 30)]);
    expect(cambios).toHaveLength(2);
  });

  it('de cero a cero no inventa filas', () => {
    expect(diffParticipaciones([], [])).toEqual([]);
  });
});
