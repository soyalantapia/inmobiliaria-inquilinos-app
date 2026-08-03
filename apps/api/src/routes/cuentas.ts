import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireUsuario } from '../auth/guards.js';

/**
 * Cuentas de caja (pedido de Camila): la inmobiliaria define sus cuentas a gusto
 * ("Gaspar Mercado Pago", "efectivo", "Líder"…), cada una con una dirección permitida
 * (solo entrada / solo salida / ambas). Cada movimiento de caja sale de / entra a una,
 * y acá se ven los totales por cuenta. SOLO el admin las define (la cajera no las toca).
 */

const r2 = (n: number) => Math.round(n * 100) / 100;
const DIRECCION = z.enum(['ENTRADA', 'SALIDA', 'AMBAS']);

export async function cuentasRoutes(app: FastifyInstance) {
  // Lista de cuentas con su total: entradas (INGRESO_EXTRA), salidas (GASTO) y saldo.
  app.get('/cuentas', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'cuentas.ver');
    if (!u) return;
    const cuentas = await prisma.cuentaCaja.findMany({
      where: { inmobiliariaId: u.inmobiliariaId },
      orderBy: [{ activa: 'desc' }, { nombre: 'asc' }],
    });
    // El `groupBy` incluye `moneda` a propósito. Sin ella los totales sumaban dólares y
    // pesos uno a uno y devolvían UN saldo plano: US$2.000 se leían como $2.000. Antes no
    // se notaba porque el panel nunca reenviaba la moneda y todo se guardaba en ARS —
    // pero ese era el bug que este mismo cambio arregla, así que ahora la mezcla es real.
    // Y es justo el número que las cuentas existen para hacer cerrar contra la caja, que
    // sí desglosa por moneda.
    const agg = await prisma.movimientoCaja.groupBy({
      by: ['cuentaId', 'tipo', 'moneda'],
      where: { inmobiliariaId: u.inmobiliariaId, cuentaId: { not: null } },
      _sum: { monto: true },
    });
    const porCuenta = new Map<string, Map<string, { entradas: number; salidas: number }>>();
    for (const a of agg) {
      if (!a.cuentaId) continue;
      const monedas = porCuenta.get(a.cuentaId) ?? new Map();
      const t = monedas.get(a.moneda) ?? { entradas: 0, salidas: 0 };
      const monto = Number(a._sum.monto ?? 0);
      if (a.tipo === 'INGRESO_EXTRA') t.entradas += monto;
      else if (a.tipo === 'GASTO') t.salidas += monto;
      monedas.set(a.moneda, t);
      porCuenta.set(a.cuentaId, monedas);
    }
    return cuentas.map((c) => {
      const monedas = porCuenta.get(c.id);
      // ARS primero (el caso normal). Una cuenta sin movimientos devuelve un renglón en
      // cero, para que la card siempre tenga algo que mostrar.
      const totales = monedas
        ? [...monedas.entries()]
            .sort(([m1], [m2]) => (m1 === 'ARS' ? -1 : m2 === 'ARS' ? 1 : m1.localeCompare(m2)))
            .map(([moneda, t]) => ({
              moneda,
              entradas: r2(t.entradas),
              salidas: r2(t.salidas),
              saldo: r2(t.entradas - t.salidas),
            }))
        : [{ moneda: 'ARS', entradas: 0, salidas: 0, saldo: 0 }];
      return {
        id: c.id,
        nombre: c.nombre,
        direccion: c.direccion,
        activa: c.activa,
        esPredeterminada: c.esPredeterminada,
        totales,
        cantidadMovimientos: 0, // (el detalle por movimiento va en /cuentas/:id/movimientos)
      };
    });
  });

  // Los movimientos de UNA cuenta (para ver el detalle de sus entradas y salidas).
  app.get('/cuentas/:id/movimientos', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'cuentas.ver');
    if (!u) return;
    const { id } = request.params as { id: string };
    const cuenta = await prisma.cuentaCaja.findFirst({ where: { id, inmobiliariaId: u.inmobiliariaId } });
    if (!cuenta) return reply.code(404).send({ message: 'Cuenta inexistente' });
    const movimientos = await prisma.movimientoCaja.findMany({
      where: { inmobiliariaId: u.inmobiliariaId, cuentaId: id },
      select: {
        id: true,
        tipo: true,
        categoria: true,
        descripcion: true,
        monto: true,
        // Sin la moneda el detalle pinta todo con el símbolo de pesos: un movimiento en
        // dólares se leía como uno en pesos, y los renglones no cerraban con el total.
        moneda: true,
        fecha: true,
        proveedor: true,
        propiedad: { select: { direccion: true } },
      },
      orderBy: { fecha: 'desc' },
      take: 200,
    });
    return movimientos.map((m) => ({ ...m, monto: Number(m.monto) }));
  });

  // Crear una cuenta — SOLO admin (la cajera no define cuentas).
  app.post('/cuentas', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'cuentas.gestionar');
    if (!u) return;
    const body = z
      .object({ nombre: z.string().trim().min(2).max(80), direccion: DIRECCION.default('AMBAS') })
      .safeParse(request.body ?? {});
    if (!body.success) return reply.code(400).send({ message: 'Poné un nombre de al menos 2 letras' });

    // La PRIMERA cuenta que pueda recibir los cobros automáticos queda predeterminada
    // sola. Sin esto la feature no hace nada hasta que alguien descubra el botón de
    // marcarla, y mientras tanto esos cobros siguen entrando a la caja sin cuenta — el
    // mismo agujero silencioso que estamos cerrando. Sólo aplica si no hay ninguna
    // marcada: nunca le pisa la elección a quien ya decidió.
    const aceptaEntradas = body.data.direccion !== 'SALIDA';
    const yaHayPredeterminada =
      aceptaEntradas &&
      (await prisma.cuentaCaja.count({
        where: { inmobiliariaId: u.inmobiliariaId, esPredeterminada: true },
      })) > 0;
    const data = {
      inmobiliariaId: u.inmobiliariaId,
      nombre: body.data.nombre,
      direccion: body.data.direccion,
      esPredeterminada: aceptaEntradas && !yaHayPredeterminada,
    };
    try {
      return reply.code(201).send(await prisma.cuentaCaja.create({ data }));
    } catch (e) {
      // Dos altas simultáneas viendo las dos que no hay predeterminada: el índice único
      // parcial rechaza a la segunda. La cuenta se crea igual, sin la marca — perderla
      // no vale romperle el alta al usuario.
      if (e && typeof e === 'object' && 'code' in e && e.code === 'P2002') {
        return reply.code(201).send(await prisma.cuentaCaja.create({ data: { ...data, esPredeterminada: false } }));
      }
      throw e;
    }
  });

  // Editar nombre / dirección / archivar / marcar como predeterminada.
  app.patch('/cuentas/:id', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'cuentas.gestionar');
    if (!u) return;
    const { id } = request.params as { id: string };
    const body = z
      .object({
        nombre: z.string().trim().min(2).max(80).optional(),
        direccion: DIRECCION.optional(),
        activa: z.boolean().optional(),
        // Cuenta a la que van los movimientos que crea el sistema solo (el ingreso al
        // saldar un cargo). Una sola por inmobiliaria: marcar una desmarca la anterior.
        esPredeterminada: z.boolean().optional(),
      })
      .safeParse(request.body ?? {});
    if (!body.success) return reply.code(400).send({ message: 'Datos inválidos' });
    const cuenta = await prisma.cuentaCaja.findFirst({ where: { id, inmobiliariaId: u.inmobiliariaId } });
    if (!cuenta) return reply.code(404).send({ message: 'Cuenta inexistente' });

    const data = { ...body.data };
    // Estado que va a quedar después del PATCH (lo que se manda, o lo que ya tenía).
    const direccionFinal = data.direccion ?? cuenta.direccion;
    const activaFinal = data.activa ?? cuenta.activa;

    // Dos situaciones MUY distintas, y antes las trataba a las dos con un 409:
    //
    // 1) Pedido EXPLÍCITO e incoherente ("marcá como predeterminada esta cuenta de solo
    //    salida"): quien lo mandó se equivocó y hay que decírselo. El movimiento
    //    automático es un INGRESO y ahí no puede caer.
    if (data.esPredeterminada === true) {
      if (direccionFinal === 'SALIDA') {
        return reply.code(409).send({
          message:
            'Una cuenta de solo salida no puede ser la predeterminada: ahí entran los cobros que registra el sistema. Marcá una que acepte entradas.',
        });
      }
      if (!activaFinal) {
        return reply.code(409).send({ message: 'Una cuenta archivada no puede ser la predeterminada' });
      }
    }
    // 2) Conflicto INCIDENTAL: la cuenta YA era la predeterminada y este PATCH la vuelve
    //    incompatible (le cambian la dirección a solo salidas, o la archivan) sin decir
    //    nada de la marca. Acá rechazar era un callejón sin salida: como la primera
    //    cuenta que acepta entradas se marca sola y el diálogo de edición manda siempre
    //    la dirección, alguien que nunca marcó nada no podía editar su única cuenta —
    //    y el error le pedía "marcá otra que acepte entradas", que no tenía. Se resuelve
    //    quitando la marca, que es lo que el cambio implica.
    else if (data.esPredeterminada === undefined && cuenta.esPredeterminada && (direccionFinal === 'SALIDA' || !activaFinal)) {
      data.esPredeterminada = false;
    }

    // Marcarla predeterminada desmarca a la anterior, en una sola transacción: hay un
    // índice UNIQUE PARCIAL por inmobiliaria y sin esto el update chocaría con un P2002.
    if (data.esPredeterminada === true) {
      try {
        const [, actualizada] = await prisma.$transaction([
          prisma.cuentaCaja.updateMany({
            where: { inmobiliariaId: u.inmobiliariaId, esPredeterminada: true, id: { not: id } },
            data: { esPredeterminada: false },
          }),
          prisma.cuentaCaja.update({ where: { id }, data }),
        ]);
        return actualizada;
      } catch (e) {
        // Dos admins marcando cuentas distintas a la vez: una de las dos transacciones
        // choca contra el índice UNIQUE PARCIAL. Es una carrera legítima, no un error
        // del servidor — que reintente en vez de comerse un 500 sin explicación.
        if (e && typeof e === 'object' && 'code' in e && e.code === 'P2002') {
          return reply.code(409).send({
            message: 'Alguien más está cambiando la cuenta predeterminada en este momento. Probá de nuevo.',
          });
        }
        throw e;
      }
    }
    return prisma.cuentaCaja.update({ where: { id }, data });
  });

  // Borrar: si la cuenta ya tiene movimientos, se ARCHIVA (activa=false) para no romper
  // el historial de caja; si nunca se usó, se elimina de verdad.
  app.delete('/cuentas/:id', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'cuentas.gestionar');
    if (!u) return;
    const { id } = request.params as { id: string };
    const cuenta = await prisma.cuentaCaja.findFirst({ where: { id, inmobiliariaId: u.inmobiliariaId } });
    if (!cuenta) return reply.code(404).send({ message: 'Cuenta inexistente' });
    const nMov = await prisma.movimientoCaja.count({ where: { cuentaId: id } });
    if (nMov > 0) {
      // `esPredeterminada: false` acá también, no sólo en el PATCH: ESTE es el camino que
      // usa el botón Archivar de la pantalla (llama al DELETE, no al PATCH). Sin esto la
      // marca quedaba en una cuenta archivada, el lookup del cobro automático —que exige
      // `activa: true`— no encontraba ninguna, y cada cobro pasaba a registrarse sin
      // cuenta mientras la card seguía diciendo "acá entran los cobros automáticos".
      await prisma.cuentaCaja.update({ where: { id }, data: { activa: false, esPredeterminada: false } });
      return { archivada: true, movimientos: nMov };
    }
    await prisma.cuentaCaja.delete({ where: { id } });
    return { eliminada: true };
  });
}
