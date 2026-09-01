/**
 * CUARTA AUDITORÍA · Las dos cards de la pantalla del reclamo que decían de más.
 *
 * El defecto de fondo es el mismo de `propiedad-timeline`: confundir el RASTRO de un cierre
 * anterior (`resolucion`, `resueltoAt`, la fila `ConfirmacionReclamo`) con el estado de hoy. Acá
 * costaba dos cosas: una card verde de "resuelto" sobre un reclamo en curso, y —la peor— una
 * card que le atribuía al inquilino un reporte que no había hecho.
 */
import { describe, it, expect } from 'vitest';
import { mostrarConfirmadoPorVos, tituloDeReapertura, textoDeReapertura } from './cards-reclamo';

describe('«Resuelto · confirmado por vos»', () => {
  it('va cuando el inquilino confirmó y el reclamo sigue cerrado', () => {
    expect(mostrarConfirmadoPorVos({ decisionActual: 'CONFORME', estado: 'CERRADO', resolucion: 'Se cambió la arandela' })).toBe(true);
    // En demo el CONFORME deja el reclamo en RESUELTO en vez de CERRADO.
    expect(mostrarConfirmadoPorVos({ decisionActual: 'CONFORME', estado: 'RESUELTO', resolucion: 'Se cambió la arandela' })).toBe(true);
  });

  it('🔴 NO va si la inmobiliaria lo reabrió después: la confirmación queda, el cierre no', () => {
    // `ConfirmacionReclamo` es one-shot y nadie la borra; `/reabrir` acepta CERRADO. Con el bug
    // se veía "Resuelto · confirmado por vos" sobre un reclamo en curso, y encima junto a la
    // card ámbar de reabierto.
    expect(mostrarConfirmadoPorVos({ decisionActual: 'CONFORME', estado: 'EN_CURSO', resolucion: 'Se cambió la arandela' })).toBe(false);
  });

  it('no va sin confirmación ni sin resolución', () => {
    expect(mostrarConfirmadoPorVos({ decisionActual: null, estado: 'CERRADO', resolucion: 'Algo' })).toBe(false);
    expect(mostrarConfirmadoPorVos({ decisionActual: 'PERSISTE', estado: 'RESUELTO', resolucion: 'Algo' })).toBe(false);
    expect(mostrarConfirmadoPorVos({ decisionActual: 'CONFORME', estado: 'CERRADO', resolucion: null })).toBe(false);
  });
});

describe('la card de reapertura nombra a quien fue, o a nadie', () => {
  it('🔴 si reabrió la inmobiliaria, no dice que lo reportó el inquilino', () => {
    // Con el bug: "Reportaste que sigue" para alguien que no tocó nada.
    expect(tituloDeReapertura('INMOBILIARIA')).toBe('La inmobiliaria lo reabrió');
    expect(textoDeReapertura('INMOBILIARIA')).not.toMatch(/le avisamos/i);
  });

  it('si reabrió el inquilino, sí es suya', () => {
    expect(tituloDeReapertura('INQUILINO')).toBe('Reportaste que sigue');
    expect(textoDeReapertura('INQUILINO')).toMatch(/le avisamos a la inmobiliaria/i);
  });

  it('si no se sabe, se dice en neutro y no se acusa a nadie', () => {
    expect(tituloDeReapertura(null)).toBe('Se reabrió');
    expect(textoDeReapertura(null)).not.toMatch(/reportaste|le avisamos/i);
  });

  it('los tres títulos son distintos entre sí', () => {
    const titulos = [tituloDeReapertura('INQUILINO'), tituloDeReapertura('INMOBILIARIA'), tituloDeReapertura(null)];
    expect(new Set(titulos).size).toBe(3);
  });
});
