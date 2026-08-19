/**
 * T-39 · El historial no puede fallar en silencio dentro de una transacción.
 *
 * `registrarEventoContrato` se tragaba el error del `create` con este argumento: "un evento
 * del historial es informativo, no puede voltear la operación que lo generó". La premisa es
 * falsa acá, porque los 5 call sites lo llaman DENTRO de una `$transaction` pasándole el `tx`.
 *
 * En PostgreSQL un statement que falla deja la transacción abortada: lo que venga después
 * revienta con 25P02 y el COMMIT se comporta como ROLLBACK. Así que el `catch` no salvaba la
 * conciliación del pago ni la renovación del contrato — se perdían igual. Lo único que
 * conseguía era que el handler devolviera 200 y el operador creyera que había quedado hecho.
 *
 * Test puro: el `tx` es un doble, no hay base de por medio.
 */
import { describe, it, expect, vi } from 'vitest';
import { registrarEventoContrato } from '../src/lib/evento-contrato.js';

const DATOS = {
  inmobiliariaId: 'inm_1',
  contratoId: 'cnt_1',
  tipo: 'RENOVACION' as const,
  titulo: 'Contrato renovado',
};

/** Un `tx` de mentira: sólo tiene lo que el helper toca. */
function txFalso(create: (args: unknown) => Promise<unknown>) {
  return { eventoContrato: { create } } as never;
}

describe('T-39 — registrarEventoContrato dentro de una transacción', () => {
  it('propaga el error en vez de tragárselo', async () => {
    const boom = new Error('null value in column "titulo" violates not-null constraint');
    const tx = txFalso(() => Promise.reject(boom));

    // Lo que importa: que el caller SE ENTERE. Con el catch viejo esto resolvía sin ruido y
    // el handler seguía como si nada, con la transacción ya condenada al rollback.
    await expect(registrarEventoContrato(tx, DATOS)).rejects.toThrow(boom);
  });

  it('en el camino feliz escribe una sola vez y con los datos que le pasaron', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'ev_1' });
    await registrarEventoContrato(txFalso(create), DATOS);

    expect(create).toHaveBeenCalledTimes(1);
    const args = create.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(args.data.contratoId).toBe('cnt_1');
    expect(args.data.tipo).toBe('RENOVACION');
    expect(args.data.titulo).toBe('Contrato renovado');
  });

  it('los opcionales tienen default: detalle null y autor "Sistema"', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'ev_1' });
    await registrarEventoContrato(txFalso(create), DATOS);

    const args = create.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(args.data.detalle).toBeNull();
    expect(args.data.autor).toBe('Sistema');
    expect(args.data.fecha).toBeInstanceOf(Date);
  });

  it('respeta el autor y la fecha cuando se los pasan', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'ev_1' });
    const fecha = new Date('2026-08-01T10:00:00.000Z');
    await registrarEventoContrato(txFalso(create), { ...DATOS, autor: 'usr_9', fecha, detalle: 'hasta 2028' });

    const args = create.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(args.data.autor).toBe('usr_9');
    expect(args.data.fecha).toBe(fecha);
    expect(args.data.detalle).toBe('hasta 2028');
  });
});
