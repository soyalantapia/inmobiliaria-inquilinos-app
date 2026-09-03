/**
 * El dato que nadie leía.
 *
 * `emailVerificadoAt` existía desde el 31/08 con su migración, se escribía al canjear el OTP, se
 * invalidaba sola al editar el email y tenía tests propios en la API. Y no aparecía en un solo
 * tipo del panel ni en una sola pantalla: el «primero se mide» que la tarea declara no se podía
 * hacer desde el producto, sólo por SQL.
 *
 * Este archivo cuida la regla que decide qué se le dice a la administradora, que es la parte que
 * se puede equivocar en las dos direcciones: callar a un dueño al que no le llega nada, o mandar
 * a perseguir a uno que está perfecto.
 */
import { describe, it, expect } from 'vitest';
import { accesoDelPropietario } from './acceso-del-propietario';

const FECHA = '2026-08-31T12:00:00.000Z';

describe('acceso del propietario', () => {
  it('nunca entró: hay que reenviarle el link', () => {
    expect(accesoDelPropietario({ ultimoAccesoAt: null, emailVerificadoAt: null })).toBe('nunca-entro');
  });

  it('🔴 entró y DESPUÉS le cambiaron el mail: el caso que no tenía cómo verse', () => {
    // Verificar y entrar son el mismo gesto, así que al que nunca entró ya lo delata el otro
    // rótulo. Éste es el único que no se delata solo: figura como activo y su casilla de hoy
    // no la probó nadie. Es donde vive el typo — y un mail equivocado no rebota.
    expect(accesoDelPropietario({ ultimoAccesoAt: FECHA, emailVerificadoAt: null })).toBe(
      'mail-sin-verificar',
    );
  });

  it('entró y el mail de hoy es el que usó: no se dice nada', () => {
    // El caso normal no necesita un renglón. Si se rotulara siempre, el que importa se
    // pierde entre los demás.
    expect(accesoDelPropietario({ ultimoAccesoAt: FECHA, emailVerificadoAt: FECHA })).toBe('ok');
  });

  it('si el backend no manda el dato, NO se afirma nada', () => {
    // `undefined` no es `null`. Afirmar que nunca entró sin saberlo manda a la administradora
    // a perseguir a alguien que sí usa el portal — y era el riesgo real: el hook aplastaba
    // `undefined` contra `null` con un `?? null`.
    expect(accesoDelPropietario({})).toBe('desconocido');
    expect(accesoDelPropietario({ ultimoAccesoAt: FECHA })).toBe('desconocido');
  });

  it('el orden importa: al que nunca entró no se le dice además que el mail está sin confirmar', () => {
    // Los dos son ciertos a la vez, pero decir dos cosas del mismo dueño en la misma card es
    // ruido: la acción es la misma —reenviarle el link— y ya la nombra el primer rótulo.
    expect(accesoDelPropietario({ ultimoAccesoAt: null, emailVerificadoAt: null })).not.toBe(
      'mail-sin-verificar',
    );
  });
});
