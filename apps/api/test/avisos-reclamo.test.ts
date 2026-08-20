import { describe, expect, it } from 'vitest';
import {
  enviarReclamoAsignadoInquilino,
  enviarReclamoNuevoInmo,
  enviarReclamoResueltoInquilino,
  mailerConfigured,
} from '../src/mailer.js';

/**
 * Test PURO: no toca la base ni manda mails de verdad.
 *
 * Lo que prueba es la garantía que sostiene toda la tarea T-17: **el aviso es
 * best-effort y NUNCA puede tumbar la operación**. Abrir un reclamo, asignarlo o
 * resolverlo tiene que funcionar igual con el SMTP sin configurar — que es
 * exactamente el estado de los entornos de test y de desarrollo.
 *
 * Sin `SMTP_HOST`/`USER`/`PASS`, `mailerConfigured` es false y `getTransporter()`
 * devuelve null: las tres funciones tienen que salir por `return false` ANTES de
 * intentar cualquier conexión. Si alguien mañana saca ese early-return, este test
 * se pone en rojo en vez de que el fallo aparezca como un reclamo que no se puede
 * crear en producción.
 */
describe('avisos de reclamo — sin SMTP configurado', () => {
  it('el entorno de test no tiene mailer', () => {
    expect(mailerConfigured).toBe(false);
  });

  it('el aviso a la inmobiliaria devuelve false y no tira', async () => {
    await expect(
      enviarReclamoNuevoInmo({
        email: 'inmo@example.com',
        autor: 'Martín Gómez',
        propiedad: 'Lourdes 11 · Artigas 1744',
        categoria: 'PLOMERIA',
        urgencia: 'EMERGENCIA',
        descripcion: 'Se rompió un caño en la cocina.',
        reclamoId: 'rec_1',
      }),
    ).resolves.toBe(false);
  });

  it('el aviso de asignación al inquilino devuelve false y no tira', async () => {
    await expect(
      enviarReclamoAsignadoInquilino({
        email: 'inquilino@example.com',
        profesional: 'Sergio Almeida',
        oficio: 'PLOMERIA',
        inmobiliariaNombre: 'Tapia Propiedades',
        reclamoId: 'rec_1',
      }),
    ).resolves.toBe(false);
  });

  it('el aviso de resolución al inquilino devuelve false y no tira', async () => {
    await expect(
      enviarReclamoResueltoInquilino({
        email: 'inquilino@example.com',
        inmobiliariaNombre: 'Tapia Propiedades',
        notas: null,
        reclamoId: 'rec_1',
      }),
    ).resolves.toBe(false);
  });

  it('tolera el caso sin notas y sin oficio (datos incompletos son normales)', async () => {
    await expect(
      enviarReclamoResueltoInquilino({
        email: 'x@example.com',
        inmobiliariaNombre: 'Tapia',
        notas: 'Se cambió el flexible.',
        reclamoId: 'rec_2',
      }),
    ).resolves.toBe(false);
    await expect(
      enviarReclamoAsignadoInquilino({
        email: 'x@example.com',
        profesional: 'Ana',
        oficio: null,
        inmobiliariaNombre: 'Tapia',
        reclamoId: 'rec_2',
      }),
    ).resolves.toBe(false);
  });
});
