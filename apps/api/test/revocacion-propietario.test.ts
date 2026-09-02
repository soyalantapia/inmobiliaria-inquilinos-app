/**
 * Cuándo deja de valer el token de un propietario.
 *
 * EL EMAIL ES LA LLAVE DEL PORTAL. El staff lo tipea a mano al cargar al dueño y nadie lo
 * verifica nunca: si se carga mal, quien controle esa casilla pide un OTP y entra a ver
 * rendiciones, comisiones, morosidad y nombres de inquilinos. Hasta este cambio, corregir el
 * mail en la ficha NO cerraba la sesión del impostor —el token dura 7 días y no hay denylist—,
 * y `/portal/mi-cartera` le devolvía el email nuevo leído de la DB, así que seguía adentro y
 * encima veía el dato corregido. La única salida era `activo: false`, que significa otra cosa.
 *
 * PUROS a propósito, igual que los del inquilino: la decisión vive separada de la query para
 * poder fijarla en la suite que corre en segundos, no en la de integración que tarda horas.
 */
import { describe, it, expect } from 'vitest';
import { motivoRevocacionPropietario } from '../src/auth/guards.js';

const vivo = { activo: true, email: 'duenio@correo.com' };

describe('motivoRevocacionPropietario', () => {
  it('el caso normal: la ficha coincide con el token y pasa', () => {
    expect(motivoRevocacionPropietario('duenio@correo.com', vivo)).toBeNull();
  });

  it('si le corrigen el email, el token viejo deja de valer YA', () => {
    // Es el caso que motiva todo: un typo en la carga le da acceso a un tercero, y hasta acá
    // arreglarlo no lo echaba hasta que expirara el token, una semana después.
    expect(motivoRevocacionPropietario('duenio@correo.com', { activo: true, email: 'otro@correo.com' })).toBe(
      'Tus datos de acceso cambiaron. Volvé a entrar.',
    );
  });

  it('el mensaje de email cambiado NO dice "te dieron de baja"', () => {
    // Al dueño legítimo al que le corrigieron un typo le cae este mismo 401. Decirle que lo
    // dieron de baja es falso y genera una llamada a la inmobiliaria.
    const msg = motivoRevocacionPropietario('duenio@correo.com', { activo: true, email: 'otro@correo.com' });
    expect(msg).not.toContain('baja');
  });

  it('la baja lógica sigue cortando, con su propio mensaje', () => {
    expect(motivoRevocacionPropietario('duenio@correo.com', { activo: false, email: 'duenio@correo.com' })).toBe(
      'Tu acceso fue dado de baja',
    );
  });

  it('la baja MANDA sobre el email: no se filtra que además se lo cambiaron', () => {
    // Orden a propósito. Con el email primero, un dueño dado de baja Y con el mail cambiado
    // recibiría "volvé a entrar" e intentaría el OTP para siempre.
    expect(motivoRevocacionPropietario('duenio@correo.com', { activo: false, email: 'otro@correo.com' })).toBe(
      'Tu acceso fue dado de baja',
    );
  });

  it('si la fila ya no está, es sesión vencida', () => {
    expect(motivoRevocacionPropietario('duenio@correo.com', null)).toBe('Sesión vencida');
  });

  it('las mayúsculas no echan a nadie', () => {
    // El OTP normaliza a minúsculas antes de buscar la fila, así que el token puede traerlo
    // normalizado y la ficha con la mayúscula que tipeó el operador. No es un cambio de email.
    expect(motivoRevocacionPropietario('duenio@correo.com', { activo: true, email: 'Duenio@Correo.com' })).toBeNull();
  });

  it('una ficha sin email no deja pasar a nadie', () => {
    // `Propietario.email` es obligatorio hoy, pero el tipo del select admite null y un
    // fallback a "" que matchee un token vacío sería una puerta abierta.
    expect(motivoRevocacionPropietario('', { activo: true, email: null })).toBe(
      'Tus datos de acceso cambiaron. Volvé a entrar.',
    );
  });
});
