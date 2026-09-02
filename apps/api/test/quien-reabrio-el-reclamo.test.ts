/**
 * CUARTA AUDITORÍA · `origenDeReapertura` — la regla que la pantalla del inquilino estaba
 * adivinando, movida a un lugar donde se puede probar.
 *
 * LO QUE HABÍA. La app del inquilino decidía quién había reabierto un reclamo con esta regla,
 * escrita en un comentario del componente: «en prod no hay `ConfirmacionReclamo` PERSISTE, así
 * que EN_CURSO + resolución previa sólo puede venir del PERSISTE del inquilino». Era cierta el
 * día que se escribió y dejó de serlo cuando se agregó `POST /reclamos/:id/reabrir` (T-63), que
 * produce exactamente la misma combinación. Desde entonces, cuando la inmobiliaria reabría un
 * reclamo para corregir un monto, al inquilino le aparecía **«Reportaste que sigue»**: la app le
 * atribuía una acción que nunca hizo.
 *
 * Este archivo es la razón de que el helper viva del lado del server: cuando aparezca un tercer
 * camino de reapertura, tiene que ponerse rojo ACÁ y no quedar mintiendo en una card.
 *
 * PURO: no toca la base. Corre en la partición `sin-db`.
 */
import { describe, it, expect } from 'vitest';
import { origenDeReapertura } from '../src/lib/reapertura-reclamo.js';

const RESUELTO_EL = new Date('2026-08-12T14:00:00.000Z');
const ev = (tipo: string, minutosDespues: number) => ({
  tipo,
  fecha: new Date(RESUELTO_EL.getTime() + minutosDespues * 60_000),
});

/** El evento que `/resolver` escribe: mismo instante exacto que `resueltoAt`. */
const EVENTO_RESOLUCION = { tipo: 'RESUELTO', fecha: RESUELTO_EL };

describe('quién reabrió el reclamo', () => {
  it('PERSISTE del inquilino → INQUILINO', () => {
    // El PERSISTE deja su MENSAJE_INQUILINO en la misma transacción que el cambio de estado.
    expect(
      origenDeReapertura({
        estado: 'EN_CURSO',
        resueltoAt: RESUELTO_EL,
        eventos: [ev('CREADO', -6000), EVENTO_RESOLUCION, ev('MENSAJE_INQUILINO', 30)],
      }),
    ).toBe('INQUILINO');
  });

  it('🔴 `/reclamos/:id/reabrir` de la inmobiliaria → INMOBILIARIA, no INQUILINO', () => {
    // Éste es el caso que la pantalla le atribuía al inquilino.
    expect(
      origenDeReapertura({
        estado: 'EN_CURSO',
        resueltoAt: RESUELTO_EL,
        eventos: [ev('CREADO', -6000), EVENTO_RESOLUCION, ev('EN_CURSO', 45)],
      }),
    ).toBe('INMOBILIARIA');
  });

  it('🔴 el camino largo: conforme → CERRADO → la inmobiliaria reabre', () => {
    // La fila `ConfirmacionReclamo` CONFORME es one-shot y nadie la borra, así que este reclamo
    // llega a la pantalla con "confirmado por vos" puesto y el estado en curso.
    expect(
      origenDeReapertura({
        estado: 'EN_CURSO',
        resueltoAt: RESUELTO_EL,
        eventos: [EVENTO_RESOLUCION, ev('CERRADO', 60), ev('EN_CURSO', 2880)],
      }),
    ).toBe('INMOBILIARIA');
  });

  it('manda el PRIMERO que la deshizo, no el último que pasó', () => {
    // El inquilino reabre y después la inmobiliaria la toma: sigue siendo del inquilino.
    expect(
      origenDeReapertura({
        estado: 'EN_CURSO',
        resueltoAt: RESUELTO_EL,
        eventos: [EVENTO_RESOLUCION, ev('MENSAJE_INQUILINO', 10), ev('EN_CURSO', 20)],
      }),
    ).toBe('INQUILINO');
    // Y al revés: la inmobiliaria reabre y después el inquilino comenta.
    expect(
      origenDeReapertura({
        estado: 'EN_CURSO',
        resueltoAt: RESUELTO_EL,
        eventos: [EVENTO_RESOLUCION, ev('EN_CURSO', 10), ev('MENSAJE_INQUILINO', 20)],
      }),
    ).toBe('INMOBILIARIA');
  });

  it('lo anterior a la resolución no cuenta', () => {
    // Un mensaje del inquilino de mientras se arreglaba no es una reapertura.
    expect(
      origenDeReapertura({
        estado: 'EN_CURSO',
        resueltoAt: RESUELTO_EL,
        eventos: [ev('MENSAJE_INQUILINO', -120), EVENTO_RESOLUCION, ev('EN_CURSO', 5)],
      }),
    ).toBe('INMOBILIARIA');
  });

  describe('no hay reapertura que atribuir', () => {
    it('un reclamo resuelto o cerrado', () => {
      expect(origenDeReapertura({ estado: 'RESUELTO', resueltoAt: RESUELTO_EL, eventos: [EVENTO_RESOLUCION] })).toBeNull();
      expect(origenDeReapertura({ estado: 'CERRADO', resueltoAt: RESUELTO_EL, eventos: [EVENTO_RESOLUCION] })).toBeNull();
    });

    it('RECHAZADO, aunque conserve la fecha de una resolución anterior', () => {
      // Es terminal: se reabrió y después se rechazó. No hay card de reapertura que mostrar.
      expect(
        origenDeReapertura({
          estado: 'RECHAZADO',
          resueltoAt: RESUELTO_EL,
          eventos: [EVENTO_RESOLUCION, ev('EN_CURSO', 30), ev('RECHAZADO', 60)],
        }),
      ).toBeNull();
    });

    it('uno que nunca se resolvió', () => {
      expect(origenDeReapertura({ estado: 'EN_CURSO', resueltoAt: null, eventos: [ev('CREADO', 0)] })).toBeNull();
    });

    it('reabierto pero sin eventos que lo expliquen → null, no una atribución inventada', () => {
      // Preferir el neutro antes que acusar al inquilino de algo que no hizo: la card sabe
      // decir "se reabrió" sin nombrar a nadie.
      expect(origenDeReapertura({ estado: 'EN_CURSO', resueltoAt: RESUELTO_EL, eventos: [] })).toBeNull();
      expect(origenDeReapertura({ estado: 'EN_CURSO', resueltoAt: RESUELTO_EL })).toBeNull();
      // Y un evento posterior que no dice nada de quién fue tampoco alcanza.
      expect(
        origenDeReapertura({
          estado: 'EN_CURSO',
          resueltoAt: RESUELTO_EL,
          eventos: [EVENTO_RESOLUCION, ev('MENSAJE_INMO', 30)],
        }),
      ).toBeNull();
    });
  });
});
