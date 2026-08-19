import { describe, it, expect } from 'vitest';
import { motivoRevocacionInquilino } from '../src/auth/guards.js';

/**
 * CAZABUG — el inquilino titular no era revocable de ninguna forma.
 *
 * `requireInquilino` y la rama `inquilino` de `requireContratoAcceso` devolvían
 * el payload crudo del JWT **sin una sola query**. El titular se autoasignaba
 * permiso COMPLETO desde su propio token, y borrarle la fila `Inquilino` no le
 * sacaba el acceso porque nadie la consultaba. Con un TTL de 15 días, era la
 * ventana más grande del sistema.
 *
 * Lo llamativo es que el razonamiento ya estaba escrito en el mismo archivo: la
 * rama de co-inquilino dice "el token dura 15 días, así que NO confiamos en el
 * permiso/estado del JWT… antes seguía entrando con su permiso viejo = agujero
 * real". Se le aplicó al invitado y no al titular, que es el que más ve.
 *
 * Estos tests fijan la DECISIÓN de revocar, que es la parte con una regla sutil.
 * Puros: la consulta vive aparte.
 */

describe('motivoRevocacionInquilino', () => {
  it('sin fila, se revoca: borrarla ahora sí saca el acceso', () => {
    expect(motivoRevocacionInquilino('cnt_1', null)).toBe('Tu acceso fue dado de baja');
  });

  it('el token apunta a un contrato que ya no es de esta fila → se revoca', () => {
    // Se reasignó el contrato, o se desvinculó al inquilino de él.
    expect(motivoRevocacionInquilino('cnt_1', { contratoId: 'cnt_2' })).toContain('cambió');
  });

  it('la fila se quedó SIN contrato pero el token reclama uno → se revoca', () => {
    expect(motivoRevocacionInquilino('cnt_1', { contratoId: null })).toContain('cambió');
  });

  it('mismo contrato → no se revoca', () => {
    expect(motivoRevocacionInquilino('cnt_1', { contratoId: 'cnt_1' })).toBeNull();
  });

  it('un token SIN contrato NO se revoca aunque la fila ya tenga uno', () => {
    // ESTE es el caso que hay que proteger. Es alguien que se logueó antes de que
    // le dieran de alta el alquiler: su token nunca reclamó ningún contrato, así
    // que no hay nada que se le pueda haber sacado. Cortarlo lo mandaría de vuelta
    // al login sin ninguna ganancia de seguridad.
    //
    // Convertir esto en una igualdad estricta —la "simplificación" obvia— rompe
    // exactamente este caso.
    expect(motivoRevocacionInquilino(null, { contratoId: 'cnt_1' })).toBeNull();
  });

  it('token sin contrato y fila sin contrato → tampoco se revoca', () => {
    expect(motivoRevocacionInquilino(null, { contratoId: null })).toBeNull();
  });

  it('la fila inexistente manda sobre todo lo demás', () => {
    // Aunque el token no reclame contrato, si la fila no está no hay a quién dejar
    // pasar.
    expect(motivoRevocacionInquilino(null, null)).toBe('Tu acceso fue dado de baja');
  });
});
