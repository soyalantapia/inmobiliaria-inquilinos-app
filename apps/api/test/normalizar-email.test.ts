import { describe, expect, it } from 'vitest';
import { normalizarEmail } from '../src/lib/normalizar-email.js';

/**
 * Test PURO (sin DB).
 *
 * POR QUÉ EXISTE: el email del propietario es la CREDENCIAL del portal, y los tres logins por
 * OTP buscan en minúsculas. Si lo guardado no está normalizado, esa persona no entra nunca —y
 * el fallo es MUDO, porque el endpoint responde `ok` igual (no revela si el email existe).
 * Nadie se entera hasta que el propietario llama por teléfono.
 *
 * Cada caso de acá corresponde a algo que un operador tipea de verdad en el panel.
 */
describe('normalizarEmail', () => {
  it('baja a minúsculas: es lo que hacía imposible el login', () => {
    // El caso real: el operador escribe el nombre con mayúscula, como escribiría un nombre.
    expect(normalizarEmail('Juan.Perez@Gmail.com')).toBe('juan.perez@gmail.com');
    expect(normalizarEmail('CONTACTO@INMOBILIARIA.COM.AR')).toBe('contacto@inmobiliaria.com.ar');
  });

  it('recorta los espacios del borde, que llegan al pegar desde un Excel', () => {
    expect(normalizarEmail('  duenio@correo.com  ')).toBe('duenio@correo.com');
    expect(normalizarEmail('\tduenio@correo.com\n')).toBe('duenio@correo.com');
  });

  it('un email ya normalizado no cambia: es idempotente', () => {
    // Importa porque la migración de backfill corre este mismo criterio en SQL y tiene que
    // poder correrse dos veces sin efecto.
    const ya = 'duenio@correo.com';
    expect(normalizarEmail(ya)).toBe(ya);
    expect(normalizarEmail(normalizarEmail('Duenio@Correo.com'))).toBe(ya);
  });

  it('la ausencia de email sigue siendo string vacío, no null', () => {
    // La columna es NOT NULL y el alta permite no cargar email (`.or(z.literal(''))`).
    // Devolver null acá rompería el insert.
    expect(normalizarEmail(undefined)).toBe('');
    expect(normalizarEmail(null)).toBe('');
    expect(normalizarEmail('')).toBe('');
    expect(normalizarEmail('   ')).toBe('');
  });

  it('no toca la parte local más allá del caso: no valida ni reescribe', () => {
    // Validar es trabajo del zod de cada endpoint. Y normalizar de más —sacar puntos de
    // Gmail, cortar un +etiqueta— cambiaría a QUÉ casilla se manda el código.
    expect(normalizarEmail('juan+alquileres@gmail.com')).toBe('juan+alquileres@gmail.com');
    expect(normalizarEmail('j.u.a.n@gmail.com')).toBe('j.u.a.n@gmail.com');
  });
});
