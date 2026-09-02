/**
 * El reclamo abierto no desaparece cuando se va el inquilino.
 *
 * De la segunda auditoría del 31/08. El conteo matcheaba el reclamo contra el **contrato
 * actual** de la propiedad, y al finalizar un contrato el server pone `contratoActualId: null`.
 */
import { describe, it, expect } from 'vitest';
import { esDeLaPropiedad, estaAbierto, reclamosAbiertosDe } from './reclamos-abiertos';

const HUMEDAD = { estado: 'ABIERTO', propiedadId: 'prp-1', contratoId: 'cnt-viejo' };
const BELGRANO = { id: 'prp-1', contratoActualId: 'cnt-viejo' as string | null };

describe('qué cuenta como abierto', () => {
  it('ABIERTO y EN_CURSO sí; el resto no', () => {
    expect(estaAbierto({ estado: 'ABIERTO' })).toBe(true);
    expect(estaAbierto({ estado: 'EN_CURSO' })).toBe(true);
    expect(estaAbierto({ estado: 'RESUELTO' })).toBe(false);
    expect(estaAbierto({ estado: 'CERRADO' })).toBe(false);
    // El RECHAZADO sumaba a "abiertos" en /estadísticas.
    expect(estaAbierto({ estado: 'RECHAZADO' })).toBe(false);
  });
});

describe('de qué propiedad es el reclamo', () => {
  it('🔴 sigue siendo de la propiedad cuando el contrato se finaliza', () => {
    // ÉSTE ES EL CASO. El inquilino se va el 31/08 y el server pone contratoActualId: null.
    const trasLaBaja = { id: 'prp-1', contratoActualId: null };
    expect(reclamosAbiertosDe([HUMEDAD], BELGRANO)).toBe(1);
    expect(reclamosAbiertosDe([HUMEDAD], trasLaBaja)).toBe(1); // ← antes daba 0
  });

  it('🔴 y cuando se firma un contrato NUEVO en la misma unidad', () => {
    // La otra mitad: el `contratoActualId` se reapunta al contrato nuevo, y el reclamo del
    // viejo tampoco matcheaba.
    const conInquilinoNuevo = { id: 'prp-1', contratoActualId: 'cnt-nuevo' };
    expect(reclamosAbiertosDe([HUMEDAD], conInquilinoNuevo)).toBe(1);
  });

  it('no se cuenta en OTRA propiedad', () => {
    // El control que le da sentido: si el arreglo fuera "contar todo", este caso lo delata.
    expect(reclamosAbiertosDe([HUMEDAD], { id: 'prp-2', contratoActualId: null })).toBe(0);
  });

  it('un reclamo viejo SIN propiedadId cae al match por contrato', () => {
    // Respaldo declarado: si mañana ese caso no existe, la rama se puede borrar.
    const viejo = { estado: 'ABIERTO', propiedadId: null, contratoId: 'cnt-viejo' };
    expect(esDeLaPropiedad(viejo, BELGRANO)).toBe(true);
    expect(esDeLaPropiedad(viejo, { id: 'prp-1', contratoActualId: null })).toBe(false);
  });

  it('sin propiedadId NI contratoId no se le cuelga a nadie', () => {
    const huerfano = { estado: 'ABIERTO', propiedadId: null, contratoId: null };
    expect(esDeLaPropiedad(huerfano, BELGRANO)).toBe(false);
    // Y no matchea "por casualidad" con una propiedad cuyo contratoActualId también es null.
    expect(esDeLaPropiedad(huerfano, { id: 'prp-1', contratoActualId: null })).toBe(false);
  });

  it('el control que le da sentido: con la regla vieja el reclamo se caía', () => {
    const viejo = (r: typeof HUMEDAD, p: typeof BELGRANO) =>
      r.contratoId === p.contratoActualId && estaAbierto(r);
    const trasLaBaja = { id: 'prp-1', contratoActualId: null };
    expect(viejo(HUMEDAD, trasLaBaja)).toBe(false); // ← el tablero decía 0
    expect(reclamosAbiertosDe([HUMEDAD], trasLaBaja)).toBe(1);
  });
});
