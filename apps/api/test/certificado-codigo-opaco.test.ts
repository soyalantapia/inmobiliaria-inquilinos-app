/**
 * T-71 · El código del certificado era derivable de los datos de la persona.
 *
 * Se calculaba con FNV-1a + djb2 sobre `DNI | contratoId | nombreDeLaInmobiliaria`, sin sal y
 * sin secreto, truncado a 12 caracteres. Dos funciones de hash públicas de 32 bits: cualquiera
 * con esos tres datos —y el nombre de la inmobiliaria es público— reproducía el código de otra
 * persona en diez líneas. Y al ser determinístico, `revocadoAt` no servía de nada: regenerar
 * devolvía el MISMO código.
 *
 * Hoy no hay página pública de verificación, así que el daño es latente. Pero el código es lo
 * único que va a proteger esa página el día que exista, y la tabla ya guarda PII de personas
 * reales (nombre, DNI, email, teléfono, dirección, monto). Por eso se cambia ANTES.
 *
 * LA PROPIEDAD QUE FIJA ESTE TEST, y es la que importa: `codigoCertificado()` **no recibe
 * ningún argumento**. No es que hashee bien los datos de la persona — es que no los toca. Un
 * código que no depende de nada del titular no se puede derivar de nada del titular.
 *
 * Test puro.
 */
import { describe, it, expect } from 'vitest';
import { codigoCertificado, ALFABETO_CERT } from '../src/routes/inquilino-mundo.js';

const FORMATO = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

describe('T-71 — el código es opaco', () => {
  it('no toma ningún dato: la firma no tiene parámetros', () => {
    // ESTE es el arreglo. Con la función vieja la firma era `(input: string)` y ese input eran
    // el DNI, el contrato y el nombre de la inmobiliaria.
    expect(codigoCertificado.length).toBe(0);
  });

  it('mantiene el formato XXXX-XXXX-XXXX que el certificado imprime', () => {
    for (let i = 0; i < 200; i++) expect(codigoCertificado()).toMatch(FORMATO);
  });

  it('dos códigos seguidos son distintos: ya no es determinístico', () => {
    const vistos = new Set(Array.from({ length: 500 }, () => codigoCertificado()));
    // Con la función vieja, misma persona ⇒ mismo código, siempre.
    expect(vistos.size).toBe(500);
  });

  it('el alfabeto evita los caracteres que se confunden al tipear', () => {
    // El código lo tipea un tercero desde un papel: el propietario o la inmobiliaria a la que
    // el inquilino le muestra el certificado. I/1, O/0, S/5 y Z/2 se leen mal.
    for (const c of 'IOSZ01 25') expect(ALFABETO_CERT).not.toContain(c);
    expect(ALFABETO_CERT.length).toBeGreaterThanOrEqual(28);
  });

  it('usa todo el alfabeto: no hay caracteres muertos que achiquen el espacio', () => {
    const usados = new Set(Array.from({ length: 3000 }, () => codigoCertificado()).join('').replace(/-/g, ''));
    for (const c of ALFABETO_CERT) expect(usados.has(c), `nunca salió ${c}`).toBe(true);
  });

  it('el espacio es de al menos 55 bits', () => {
    // 12 símbolos sobre un alfabeto de 28 = ~57,7 bits. La función vieja tenía 64 bits
    // NOMINALES de estado pero cero de secreto: se recomputaba, no se adivinaba.
    expect(12 * Math.log2(ALFABETO_CERT.length)).toBeGreaterThan(55);
  });
});
