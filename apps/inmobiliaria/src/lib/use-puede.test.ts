/**
 * El panel no ofrece lo que el server rechaza — y el default es esconder.
 *
 * De la segunda auditoría del 31/08. La pregunta "¿este usuario puede X?" se resolvía a mano en
 * cada pantalla que se acordaba; las que no, ofrecían acciones que terminaban en 403 después de
 * completar el formulario. Entre ellas **"Rendir"**, la acción de plata más grande del mes,
 * ofrecida a LECTURA.
 *
 * Este archivo prueba la REGLA, no el hook de React: `usePuede` es una línea sobre
 * `rolTienePermiso` y el valor está en qué pasa en los bordes — mientras carga y con `/auth/me`
 * caído—, que es donde el criterio se decide.
 */
import { describe, it, expect } from 'vitest';
import { rolTienePermiso } from './permisos';
import { normalizarRol } from './rol-storage';

/** La misma decisión que toma `usePuede`, sin React de por medio. */
const puede = (rolCrudo: string | null | undefined, cap: Parameters<typeof rolTienePermiso>[1], meError = false) =>
  meError || rolTienePermiso(normalizarRol(rolCrudo, 'LECTURA'), cap);

describe('quién puede qué, según la matriz', () => {
  it('🔴 rendir al propietario es sólo del Admin', () => {
    // Se le ofrecía a LECTURA, el rol que la propia app describe como "ve todo sin modificar".
    expect(puede('ADMIN', 'rendicion.confirmar')).toBe(true);
    expect(puede('OPERADOR', 'rendicion.confirmar')).toBe(false);
    expect(puede('CAJA', 'rendicion.confirmar')).toBe(false);
    expect(puede('LECTURA', 'rendicion.confirmar')).toBe(false);
  });

  it('🔴 resolver el depósito, también', () => {
    expect(puede('ADMIN', 'deposito.devolver')).toBe(true);
    expect(puede('CAJA', 'deposito.devolver')).toBe(false);
  });

  it('🔴 y borrar un movimiento de caja', () => {
    // El cajero que carga un gasto con la propiedad equivocada no puede corregir su error.
    expect(puede('ADMIN', 'caja.eliminar')).toBe(true);
    expect(puede('CAJA', 'caja.eliminar')).toBe(false);
  });

  it('cobrar una deuda sí es de CAJA: el corte no se pasa de rosca', () => {
    // El control positivo. Si `pago.conciliar` también cortara a CAJA, el cajero no podría
    // hacer su trabajo y el arreglo estaría de más.
    expect(puede('CAJA', 'pago.conciliar')).toBe(true);
    expect(puede('ADMIN', 'pago.conciliar')).toBe(true);
    expect(puede('LECTURA', 'pago.conciliar')).toBe(false);
  });
});

describe('los bordes, que es donde se decide el criterio', () => {
  it('🔴 mientras /auth/me no contestó, se ESCONDE', () => {
    // `me` es undefined y el rol cae a LECTURA. Esconder un botón un segundo de más cuesta un
    // parpadeo; ofrecerlo cuesta que alguien complete un formulario de plata entero —a veces
    // con PIN— y coma el 403 al final.
    expect(puede(undefined, 'rendicion.confirmar')).toBe(false);
    expect(puede(null, 'deposito.devolver')).toBe(false);
  });

  it('pero con /auth/me CAÍDO se muestra: que decida el server', () => {
    // La asimetría es deliberada. "No sé todavía" y "no puedo preguntar" son cosas distintas:
    // en la segunda, el 403 del server sigue siendo la frontera real y el front no debe
    // recortar en silencio. Es el mismo criterio que ya usan los recortes de datos del panel.
    expect(puede(undefined, 'rendicion.confirmar', true)).toBe(true);
  });

  it('un rol desconocido cae al más restrictivo, no al más permisivo', () => {
    // Si mañana el server devuelve un rol nuevo que el front no conoce, el error menos malo es
    // esconder.
    expect(puede('ROL_QUE_NO_EXISTE', 'rendicion.confirmar')).toBe(false);
    expect(normalizarRol('ROL_QUE_NO_EXISTE', 'LECTURA')).toBe('LECTURA');
  });
});
