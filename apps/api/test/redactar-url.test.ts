import { describe, it, expect } from 'vitest';
import { urlParaLog } from '../src/lib/redactar-url.js';

/**
 * Lo que se escribe —y lo que NO— en el log de producción.
 *
 * Dos fugas distintas cerradas por el mismo serializer:
 *
 *  · **La sesión.** El JWT de 15 días viaja por query en `/uploads/...` porque un
 *    `<img src>` no puede mandar el header Authorization. Sin redactar, cada foto
 *    o comprobante que alguien abría escribía una sesión válida en texto plano.
 *
 *  · **El DNI.** `GET /personas?q=20123456` es cómo el panel busca a una persona
 *    para reusarla. Cargar los ~50 morosos de una migración dejaba 50+ documentos
 *    en el log, más los reintentos por cada typo.
 *
 * Estos tests existen porque el segundo caso demuestra el problema de una
 * denylist: sólo protege lo que alguien se acordó de agregar, y el DNI estuvo
 * logueándose desde que existe la búsqueda de personas.
 *
 * Tests PUROS.
 */

describe('urlParaLog · lo que NO puede quedar en el log', () => {
  it('redacta el JWT que viaja por query en /uploads', () => {
    const r = urlParaLog('/uploads/inmo_1/foto.jpg?token=eyJhbGciOiJIUzI1NiJ9.abc.def');

    expect(r).toBe('/uploads/inmo_1/foto.jpg?token=[REDACTED]');
    expect(r).not.toContain('eyJ');
  });

  it('redacta el DNI de la búsqueda de personas', () => {
    expect(urlParaLog('/personas?q=20123456')).toBe('/personas?q=[REDACTED]');
  });

  it('redacta `q` aunque traiga un nombre o un email: también son datos de un tercero', () => {
    expect(urlParaLog('/personas?q=marta.gomez%40gmail.com')).toBe('/personas?q=[REDACTED]');
    expect(urlParaLog('/personas?q=Marta+G%C3%B3mez')).toBe('/personas?q=[REDACTED]');
  });

  it('redacta los que HOY no viajan por query, para que nazcan cubiertos', () => {
    for (const p of ['dni', 'cuit', 'email', 'telefono']) {
      expect(urlParaLog(`/algo?${p}=20123456`), p).toBe(`/algo?${p}=[REDACTED]`);
    }
  });

  it('redacta el parámetro esté donde esté, no sólo si es el primero', () => {
    expect(urlParaLog('/personas?limit=10&q=20123456&estado=ACTIVO')).toBe(
      '/personas?limit=10&q=[REDACTED]&estado=ACTIVO',
    );
  });

  it('redacta TODOS los sensibles de una misma URL, no sólo el primero', () => {
    expect(urlParaLog('/x?token=abc&q=20123456')).toBe('/x?token=[REDACTED]&q=[REDACTED]');
  });

  it('no le importa el case del nombre del parámetro', () => {
    expect(urlParaLog('/personas?Q=20123456')).toBe('/personas?Q=[REDACTED]');
  });
});

describe('urlParaLog · lo que SÍ tiene que seguir viéndose', () => {
  it('conserva el path y los parámetros que no son sensibles', () => {
    // Redactar de más deja el log inservible para debuggear, que es el otro modo
    // de fallo de esto.
    expect(urlParaLog('/liquidaciones?periodo=2026-08&estado=VENCIDO')).toBe(
      '/liquidaciones?periodo=2026-08&estado=VENCIDO',
    );
  });

  it('conserva el NOMBRE del parámetro redactado: saber que hubo una búsqueda sirve', () => {
    expect(urlParaLog('/personas?q=20123456')).toContain('q=');
  });

  it('no toca un parámetro que apenas CONTIENE un nombre sensible', () => {
    // `busqueda` termina en algo parecido a `q`, y `emailVerificado` empieza con
    // `email`: un regex flojo se los comería y el log perdería información útil.
    expect(urlParaLog('/x?busqueda=hola&emailVerificado=true')).toBe('/x?busqueda=hola&emailVerificado=true');
  });

  it('un valor vacío queda redactado igual, sin romper la URL', () => {
    expect(urlParaLog('/personas?q=&limit=5')).toBe('/personas?q=[REDACTED]&limit=5');
  });

  it('no explota con undefined, null ni una URL sin query', () => {
    expect(urlParaLog(undefined)).toBe('');
    expect(urlParaLog(null)).toBe('');
    expect(urlParaLog('/health')).toBe('/health');
  });
});
