import { describe, expect, it } from 'vitest';
import {
  JwtPayloadSchema,
  JwtPersonaSchema,
  JwtProfesionalSchema,
  JwtPropietarioSchema,
} from '@llave/shared';

/**
 * Test PURO (sin DB) de la separación entre tipos de token.
 *
 * POR QUÉ EXISTE: el sistema tiene 4 kinds de sesión que NO son intercambiables, y la
 * separación está sostenida por una convención escrita en comentarios: `persona`,
 * `profesional` y `propietario` quedan **fuera** de `JwtPayloadSchema` a propósito, así
 * `requireAuth` los rechaza y sólo su guard específico los acepta.
 *
 * Una convención que vive sólo en un comentario se rompe sola: alcanza con que alguien
 * "complete" la unión discriminada creyendo que faltaba un caso. Si eso pasa, un token de
 * propietario —que es de LECTURA sobre datos de terceros y se emite con un OTP a un email
 * que la inmobiliaria cargó— entraría por la puerta de los endpoints normales del panel.
 * Estos casos hacen fallar ese cambio en vez de dejarlo pasar.
 */

const usuario = { kind: 'usuario', userId: 'u1', inmobiliariaId: 'i1', rol: 'ADMIN' };
const inquilino = { kind: 'inquilino', inquilinoId: 'q1', inmobiliariaId: 'i1', contratoId: 'c1' };
const coInquilino = { kind: 'co-inquilino', coInquilinoId: 'k1', inmobiliariaId: 'i1', contratoId: 'c1', permiso: 'VER' };
const persona = { kind: 'persona', email: 'a@b.com' };
const profesional = { kind: 'profesional', visitaId: 'v1', inmobiliariaId: 'i1', profesionalId: 'p1' };
const propietario = { kind: 'propietario', propietarioId: 'o1', inmobiliariaId: 'i1' };

describe('JwtPayloadSchema — la puerta de requireAuth', () => {
  it('acepta los tres kinds normales', () => {
    expect(JwtPayloadSchema.safeParse(usuario).success).toBe(true);
    expect(JwtPayloadSchema.safeParse(inquilino).success).toBe(true);
    expect(JwtPayloadSchema.safeParse(coInquilino).success).toBe(true);
  });

  it('RECHAZA los tres kinds especiales — si esto se pone verde para alguno, hay un agujero', () => {
    expect(JwtPayloadSchema.safeParse(persona).success).toBe(false);
    expect(JwtPayloadSchema.safeParse(profesional).success).toBe(false);
    expect(JwtPayloadSchema.safeParse(propietario).success).toBe(false);
  });
});

describe('JwtPropietarioSchema — la puerta del portal', () => {
  it('acepta sólo su propio kind', () => {
    expect(JwtPropietarioSchema.safeParse(propietario).success).toBe(true);
  });

  it('rechaza cualquier otro token, incluido el de un ADMIN del panel', () => {
    for (const otro of [usuario, inquilino, coInquilino, persona, profesional]) {
      expect(JwtPropietarioSchema.safeParse(otro).success).toBe(false);
    }
  });

  it('exige las dos mitades del scoping: sin inmobiliariaId no es un token válido', () => {
    // El aislamiento del portal es el par (propietarioId, inmobiliariaId) y las queries
    // filtran por los dos. Un token al que le falte una mitad no puede existir.
    expect(JwtPropietarioSchema.safeParse({ kind: 'propietario', propietarioId: 'o1' }).success).toBe(false);
    expect(JwtPropietarioSchema.safeParse({ kind: 'propietario', inmobiliariaId: 'i1' }).success).toBe(false);
  });

  it('no acepta campos de más disfrazados de permisos', () => {
    // zod por defecto ignora las claves extra, así que esto documenta el contrato real:
    // lo que llegue de más NO se parsea y por lo tanto no puede influir en nada aguas abajo.
    const parsed = JwtPropietarioSchema.safeParse({ ...propietario, rol: 'ADMIN', permiso: 'COMPLETO' });
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data).toEqual(propietario);
  });
});

describe('los otros dos guards especiales siguen aislados entre sí', () => {
  it('el schema de persona no acepta un propietario, ni al revés', () => {
    expect(JwtPersonaSchema.safeParse(propietario).success).toBe(false);
    expect(JwtPropietarioSchema.safeParse(persona).success).toBe(false);
  });

  it('el schema de profesional no acepta un propietario, ni al revés', () => {
    expect(JwtProfesionalSchema.safeParse(propietario).success).toBe(false);
    expect(JwtPropietarioSchema.safeParse(profesional).success).toBe(false);
  });
});
