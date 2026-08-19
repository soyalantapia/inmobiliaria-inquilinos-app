import { describe, expect, it } from 'vitest';
import { elegirDestinatario } from '../src/lib/destinatario-aviso.js';

/**
 * Test PURO (sin DB) de la regla de fallback.
 *
 * Lo que fija: **no configurar nada no cambia nada**. Es la propiedad que hace que esta feature
 * se pueda deployar sin tocar los datos de nadie — la tabla nace vacía y todas las inmobiliarias
 * siguen recibiendo los avisos en la casilla de siempre.
 */
describe('elegirDestinatario', () => {
  it('sin casilla configurada, va a la de la inmobiliaria', () => {
    expect(elegirDestinatario(null, 'inmo@correo.com')).toBe('inmo@correo.com');
    expect(elegirDestinatario(undefined, 'inmo@correo.com')).toBe('inmo@correo.com');
  });

  it('con casilla configurada, la configurada gana', () => {
    expect(elegirDestinatario('reclamos@correo.com', 'inmo@correo.com')).toBe('reclamos@correo.com');
  });

  it('una casilla en blanco NO pisa a la de la inmobiliaria', () => {
    // El caso real: alguien abre el campo, lo borra y guarda. Eso es "volvé al default",
    // no "no le mandes a nadie".
    expect(elegirDestinatario('', 'inmo@correo.com')).toBe('inmo@correo.com');
    expect(elegirDestinatario('   ', 'inmo@correo.com')).toBe('inmo@correo.com');
  });

  it('recorta los espacios: un email con espacios no es un destinatario válido', () => {
    expect(elegirDestinatario('  reclamos@correo.com  ', 'inmo@correo.com')).toBe('reclamos@correo.com');
  });

  it('sin ninguna de las dos devuelve null, no un string vacío', () => {
    // `Inmobiliaria.email` puede estar vacío (el alta lo permite). Devolver '' haría que
    // nodemailer fallara con "dirección inválida"; null hace que el aviso simplemente no salga,
    // que es lo correcto: no hay a quién mandarle.
    expect(elegirDestinatario(null, null)).toBeNull();
    expect(elegirDestinatario('', '')).toBeNull();
    expect(elegirDestinatario('  ', '  ')).toBeNull();
    expect(elegirDestinatario(undefined, undefined)).toBeNull();
  });

  it('con la de la inmobiliaria vacía pero una configurada, manda igual', () => {
    expect(elegirDestinatario('reclamos@correo.com', '')).toBe('reclamos@correo.com');
  });
});
