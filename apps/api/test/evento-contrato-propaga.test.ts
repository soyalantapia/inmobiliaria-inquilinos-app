/**
 * T-39 → T-29-N1 · El historial se escribe DESPUÉS del commit, y recién por eso puede
 * tragarse su propio error sin esconder nada.
 *
 * LA HISTORIA, en dos pasos, porque el test cambió con ella:
 *
 * 1. `registrarEventoContrato` se tragaba el error del `create` con este argumento: "un
 *    evento del historial es informativo, no puede voltear la operación que lo generó". La
 *    premisa era falsa, porque los 5 call sites lo llamaban DENTRO de una `$transaction`
 *    pasándole el `tx`. En PostgreSQL un statement que falla deja la transacción abortada:
 *    lo que venga después revienta con 25P02 y el COMMIT se comporta como ROLLBACK. El
 *    `catch` no salvaba la conciliación del pago ni la renovación — se perdían igual. Lo
 *    único que conseguía era que el handler devolviera 200 y el operador creyera que había
 *    quedado hecho. T-39 sacó el catch: la falla dejó de ser silenciosa.
 *
 * 2. T-29-N1 movió los cinco call sites a post-commit y angostó la firma a `PrismaClient`.
 *    Ahí la promesa original pasó a ser cumplible, y el catch volvió — pero ahora sí es una
 *    red y no una tapa.
 *
 * Por eso el test ya no exige que propague: exige que **no pueda volver a llamarse dentro de
 * una transacción**, que es lo que hacía imposible la promesa. Esa garantía la sostiene el
 * compilador; acá sólo se la fija para que nadie la afloje sin darse cuenta.
 *
 * Test puro: el cliente es un doble, no hay base de por medio.
 */
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { registrarEventoContrato } from '../src/lib/evento-contrato.js';

const DATOS = {
  inmobiliariaId: 'inm_1',
  contratoId: 'cnt_1',
  tipo: 'RENOVACION' as const,
  titulo: 'Contrato renovado',
};

/** Un cliente de mentira: sólo tiene lo que el helper toca. */
function txFalso(create: (args: unknown) => Promise<unknown>) {
  return { eventoContrato: { create } } as never;
}

describe('T-39 → T-29-N1 · registrarEventoContrato, ahora post-commit', () => {
  it('un fallo del historial NO voltea la operación que lo generó', async () => {
    const boom = new Error('null value in column "titulo" violates not-null constraint');

    // Esta promesa ahora SÍ se puede cumplir, porque el helper corre post-commit (T-29-N1):
    // la operación ya está guardada y lo único que se pierde es el renglón del timeline.
    await expect(registrarEventoContrato(txFalso(() => Promise.reject(boom)), DATOS)).resolves.toBeUndefined();
  });

  it('la firma NO acepta un TransactionClient — ahí está la garantía', () => {
    // ESTE es el invariante de verdad, y lo sostiene el compilador, no un chequeo en runtime.
    //
    // Mientras la firma aceptaba un `tx`, tragarse el error era mentira: en PostgreSQL una
    // sentencia fallida deja la transacción abortada y el COMMIT se comporta como ROLLBACK,
    // así que la conciliación del pago se perdía igual —en silencio y con un 200—. El
    // `catch` no protegía la operación: escondía que se había perdido.
    //
    // Con el primer parámetro tipado `PrismaClient`, ningún call site puede volver a pasarle
    // su `tx` sin que `tsc` lo rechace. Si alguien ensancha ese tipo, tiene que sacar el
    // catch en el mismo movimiento — y este test se lo recuerda.
    // Se mira la DECLARACIÓN del parámetro y el alias de tipo, no la palabra suelta: el
    // docblock del helper explica todo esto en prosa y menciona `Prisma.TransactionClient`
    // a propósito. Un `not.toMatch(/TransactionClient/)` a secas fallaba por el comentario
    // que documenta el arreglo, que es justo lo que hay que conservar.
    const fuente = readFileSync(new URL('../src/lib/evento-contrato.ts', import.meta.url), 'utf8');
    const codigo = fuente.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

    expect(codigo).toMatch(/^\s*db: PrismaClient,\s*$/m);
    expect(codigo).not.toMatch(/TransactionClient/);
    expect(codigo).not.toMatch(/TxOrClient/);
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
