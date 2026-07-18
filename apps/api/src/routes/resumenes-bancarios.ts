import * as XLSX from 'xlsx';
import { z } from 'zod';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { prisma } from '../db.js';
import { requireUsuario } from '../auth/guards.js';
import { verificarPinUsuario } from '../auth/pin.js';
import { calcularMora, resolverEsquemaMora } from '../lib/punitorios.js';
import { parsearFilasResumen, sugerirMatch, type CandidatoLiquidacion, type CandidatoPago } from '../lib/matching-bancario.js';
import { guardarBufferSubido } from './uploads.js';

/**
 * Validador de resumen bancario REAL (auditoría "archivos" — feature elegida
 * como CSV/Excel del banco, matching determinístico, sin IA). El admin sube
 * el extracto que exporta su banco (columnas fecha/concepto/monto/titular/
 * CBU/nro operación — con sinónimos, ver matching-bancario.ts), parseamos
 * las filas, sugerimos a qué pago/liquidación corresponde cada crédito, y el
 * admin concilia con un click (con PIN, como el resto de las acciones de plata).
 *
 * A diferencia del demo (que generaba créditos sintéticos SIN leer el
 * archivo), acá el parseo es real: xlsx lee tanto .xlsx como .csv.
 */

async function verificarPin(userId: string, pin: string | undefined, reply: FastifyReply): Promise<boolean> {
  const r = await verificarPinUsuario(userId, pin);
  if (!r.ok) {
    await reply.code(r.code).send({ message: r.message });
    return false;
  }
  return true;
}

/** Candidatos vivos para el matching: pagos INFORMADO + liquidaciones con saldo pendiente. */
async function candidatosVigentes(inmobiliariaId: string): Promise<{ pagos: CandidatoPago[]; liquidaciones: CandidatoLiquidacion[] }> {
  const [pagosInformados, liquidacionesAbiertas, inmo] = await Promise.all([
    prisma.pago.findMany({
      // SOLO cobranza por inmobiliaria: la plata de un contrato PROPIETARIO_DIRECTO
      // va a la cuenta del dueño y NUNCA puede aparecer en el extracto de la inmo —
      // ofrecerla como candidata permitía marcar paga una deuda ajena con la
      // transferencia de otro inquilino (mismo filtro que /caja/cierre y /rendiciones).
      where: { inmobiliariaId, estado: 'INFORMADO', contrato: { modoCobranza: 'INMOBILIARIA' } },
      select: {
        id: true,
        monto: true,
        contratoId: true,
        liquidacionId: true,
        contrato: { select: { inquilinoTitular: { select: { nombre: true, apellido: true } } } },
      },
    }),
    prisma.liquidacion.findMany({
      where: { inmobiliariaId, estado: { in: ['PENDIENTE', 'VENCIDO', 'PARCIAL'] }, contrato: { modoCobranza: 'INMOBILIARIA' } },
      // Vencimiento más antiguo primero: si un contrato tiene varios períodos
      // impagos con el mismo monto, un crédito ambiguo debe sugerirse contra
      // la deuda MÁS VIEJA primero (FIFO — misma lógica que cobranza real).
      orderBy: { fechaVencimiento: 'asc' },
      select: {
        id: true,
        contratoId: true,
        montoTotal: true,
        fechaVencimiento: true,
        montoPunitorioManual: true,
        contrato: {
          select: {
            tasaPunitorioDiaria: true,
            moraTipo: true,
            moraValor: true,
            inquilinoTitular: { select: { nombre: true, apellido: true } },
          },
        },
      },
    }),
    prisma.inmobiliaria.findUnique({ where: { id: inmobiliariaId }, select: { moraTipoDefault: true, moraValorDefault: true } }),
  ]);

  const liqIds = liquidacionesAbiertas.map((l) => l.id);
  const pagadoRows = liqIds.length
    ? await prisma.pago.groupBy({ by: ['liquidacionId'], where: { liquidacionId: { in: liqIds }, estado: 'CONCILIADO' }, _sum: { monto: true } })
    : [];
  const pagadoMap = new Map(pagadoRows.map((r) => [r.liquidacionId, Number(r._sum.monto ?? 0)]));

  const pagos: CandidatoPago[] = pagosInformados.map((p) => ({
    pagoId: p.id,
    contratoId: p.contratoId,
    liquidacionId: p.liquidacionId,
    monto: Number(p.monto),
    inquilino: p.contrato.inquilinoTitular ? `${p.contrato.inquilinoTitular.nombre} ${p.contrato.inquilinoTitular.apellido ?? ''}`.trim() : '',
  }));

  const ahora = new Date();
  const liquidaciones: CandidatoLiquidacion[] = liquidacionesAbiertas.map((l) => {
    // Mora con el ESQUEMA EFECTIVO (cascada contrato → default inmobiliaria,
    // manual pisa) — antes usaba el wrapper legacy (% diario) e ignoraba los
    // esquemas nuevos: el saldo sugerido no coincidía con el que veía el inquilino.
    const punitorio = calcularMora(
      Number(l.montoTotal),
      resolverEsquemaMora(l.contrato, inmo),
      l.fechaVencimiento,
      ahora,
      l.montoPunitorioManual != null ? Number(l.montoPunitorioManual) : null,
    );
    const total = Number(l.montoTotal) + punitorio;
    const pagado = pagadoMap.get(l.id) ?? 0;
    return {
      liquidacionId: l.id,
      contratoId: l.contratoId,
      saldo: Math.max(0, total - pagado),
      inquilino: l.contrato.inquilinoTitular ? `${l.contrato.inquilinoTitular.nombre} ${l.contrato.inquilinoTitular.apellido ?? ''}`.trim() : '',
    };
  });

  return { pagos, liquidaciones };
}

export async function resumenesBancariosRoutes(app: FastifyInstance): Promise<void> {
  app.post('/resumenes-bancarios', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'pago.conciliar');
    if (!u) return;

    const data = await request.file();
    if (!data) return reply.code(400).send({ message: 'Falta el archivo' });
    const nombreOk = /\.(xlsx|xls|csv)$/i.test(data.filename ?? '');
    if (!nombreOk) {
      return reply.code(415).send({ message: 'Subí el extracto en Excel (.xlsx/.xls) o CSV — el que exporta tu banco.' });
    }
    const buffer = await data.toBuffer();
    if (buffer.length > 10 * 1024 * 1024) {
      return reply.code(413).send({ message: 'El archivo supera los 10 MB.' });
    }

    let filas: unknown[][];
    try {
      const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
      const nombreHoja = wb.SheetNames[0];
      if (!nombreHoja) return reply.code(400).send({ message: 'El archivo no tiene hojas para leer' });
      const hoja = wb.Sheets[nombreHoja]!;
      filas = XLSX.utils.sheet_to_json(hoja, { header: 1, raw: true }) as unknown[][];
    } catch {
      return reply.code(400).send({ message: 'No pudimos leer el archivo. ¿Es un Excel o CSV válido?' });
    }

    const parseo = parsearFilasResumen(filas);
    if (parseo.columnasFaltantes.length > 0) {
      return reply.code(400).send({
        message: `No encontramos las columnas ${parseo.columnasFaltantes.join(' y ')}. Revisá que el archivo tenga fecha y monto (con esos nombres u otros habituales del banco).`,
      });
    }
    if (parseo.creditos.length === 0) {
      return reply.code(400).send({ message: 'No detectamos ningún crédito (monto positivo) en el archivo.' });
    }

    // Archivamos el original para trazabilidad (best-effort: si falla, igual persistimos los créditos parseados).
    let archivoUrl: string | null = null;
    try {
      const ext = /\.(xlsx|xls|csv)$/i.exec(data.filename ?? '')?.[0] ?? '.xlsx';
      archivoUrl = await guardarBufferSubido(buffer, u.inmobiliariaId, ext);
    } catch {
      archivoUrl = null;
    }

    const resumen = await prisma.$transaction(async (tx) => {
      const r = await tx.resumenBancario.create({
        data: {
          inmobiliariaId: u.inmobiliariaId,
          fileName: data.filename ?? 'extracto',
          fileSize: buffer.length,
          archivoUrl,
          subidoPor: u.userId,
        },
      });
      await tx.creditoDetectado.createMany({
        data: parseo.creditos.map((c) => ({
          inmobiliariaId: u.inmobiliariaId,
          resumenBancarioId: r.id,
          fecha: c.fecha,
          concepto: c.concepto,
          monto: c.monto,
          titularOrigen: c.titularOrigen,
          cbuOrigen: c.cbuOrigen,
          nroOperacion: c.nroOperacion,
          bancoOrigen: c.bancoOrigen,
        })),
      });
      return r;
    });

    return reply.code(201).send({ id: resumen.id, creditosDetectados: parseo.creditos.length, filasIgnoradas: parseo.filasIgnoradas });
  });

  app.get('/resumenes-bancarios', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'pago.conciliar');
    if (!u) return;
    const resumenes = await prisma.resumenBancario.findMany({
      where: { inmobiliariaId: u.inmobiliariaId },
      orderBy: { subidoAt: 'desc' },
      include: { _count: { select: { creditos: true } } },
    });
    const conciliadosPorResumen = await prisma.creditoDetectado.groupBy({
      by: ['resumenBancarioId'],
      where: { inmobiliariaId: u.inmobiliariaId, conciliado: true },
      _count: { _all: true },
    });
    const conciliadosMap = new Map(conciliadosPorResumen.map((r) => [r.resumenBancarioId, r._count._all]));
    return resumenes.map((r) => ({
      id: r.id,
      fileName: r.fileName,
      fileSize: r.fileSize,
      subidoAt: r.subidoAt.toISOString(),
      totalCreditos: r._count.creditos,
      conciliados: conciliadosMap.get(r.id) ?? 0,
    }));
  });

  app.get('/resumenes-bancarios/:id', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'pago.conciliar');
    if (!u) return;
    const { id } = request.params as { id: string };
    const resumen = await prisma.resumenBancario.findFirst({
      where: { id, inmobiliariaId: u.inmobiliariaId },
      include: { creditos: { orderBy: { fecha: 'desc' } } },
    });
    if (!resumen) return reply.code(404).send({ message: 'Resumen inexistente' });

    // Matching LIVE: recalculado contra el estado ACTUAL de pagos/liquidaciones
    // (no lo que había cuando se subió el archivo — evita sugerir un match ya
    // resuelto por otra vía mientras tanto).
    const { pagos, liquidaciones } = await candidatosVigentes(u.inmobiliariaId);
    const creditos = resumen.creditos.map((c) => {
      const sugerido = c.conciliado
        ? { confianza: 'ALTA' as const, motivo: 'Ya conciliado', pagoId: c.pagoId, contratoId: null, liquidacionId: null, inquilino: null }
        : sugerirMatch({ monto: Number(c.monto), titularOrigen: c.titularOrigen }, pagos, liquidaciones);
      return {
        id: c.id,
        fecha: c.fecha.toISOString(),
        concepto: c.concepto,
        monto: Number(c.monto),
        titularOrigen: c.titularOrigen,
        cbuOrigen: c.cbuOrigen,
        nroOperacion: c.nroOperacion,
        bancoOrigen: c.bancoOrigen,
        conciliado: c.conciliado,
        pagoId: c.pagoId,
        sugerido,
      };
    });

    return {
      id: resumen.id,
      fileName: resumen.fileName,
      fileSize: resumen.fileSize,
      archivoUrl: resumen.archivoUrl,
      subidoAt: resumen.subidoAt.toISOString(),
      creditos,
      // Opciones para el dropdown "elegir manualmente" en el front.
      opciones: liquidaciones.map((l) => ({ liquidacionId: l.liquidacionId, contratoId: l.contratoId, inquilino: l.inquilino })),
    };
  });

  const conciliarSchema = z.object({ liquidacionId: z.string().min(1), pin: z.string().optional() });

  app.post('/resumenes-bancarios/:id/creditos/:creditoId/conciliar', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'pago.conciliar');
    if (!u) return;
    const { id, creditoId } = request.params as { id: string; creditoId: string };
    const body = conciliarSchema.safeParse(request.body ?? {});
    if (!body.success) return reply.code(400).send({ message: 'Indicá a qué liquidación corresponde este crédito' });
    if (!(await verificarPin(u.userId, body.data.pin, reply))) return;

    const credito = await prisma.creditoDetectado.findFirst({ where: { id: creditoId, resumenBancarioId: id, inmobiliariaId: u.inmobiliariaId } });
    if (!credito) return reply.code(404).send({ message: 'Crédito inexistente' });
    if (credito.conciliado) return reply.code(409).send({ message: 'Este crédito ya fue conciliado' });

    const liq = await prisma.liquidacion.findFirst({
      where: { id: body.data.liquidacionId, inmobiliariaId: u.inmobiliariaId },
      select: {
        id: true,
        contratoId: true,
        periodo: true,
        estado: true,
        montoTotal: true,
        fechaVencimiento: true,
        montoPunitorioManual: true,
        contrato: {
          select: {
            tasaPunitorioDiaria: true,
            moraTipo: true,
            moraValor: true,
            estado: true,
            modoCobranza: true,
            inmobiliaria: { select: { moraTipoDefault: true, moraValorDefault: true } },
          },
        },
      },
    });
    if (!liq) return reply.code(404).send({ message: 'Liquidación inexistente' });
    if (liq.contrato.estado !== 'ACTIVO') {
      return reply.code(409).send({ message: 'El contrato ya no está activo — no se puede conciliar sobre esta liquidación.' });
    }
    // La plata de un contrato de cobranza directa entra al banco del DUEÑO: un
    // crédito del extracto de la inmo no puede saldarla (candidatosVigentes ya
    // no la ofrece; este guard cubre el API directo y carreras).
    if (liq.contrato.modoCobranza !== 'INMOBILIARIA') {
      return reply.code(409).send({ message: 'Ese contrato cobra directo al propietario — este crédito no puede corresponderle.' });
    }
    if (liq.estado === 'PAGADO') {
      return reply.code(409).send({ message: 'Esa liquidación ya está paga — elegí otra.' });
    }
    // Tope de saldo (mismo criterio que /pagos/informar): sin esto se podía
    // asignar una transferencia de 2 meses a UNA liquidación → sobre-pago que
    // inflaba rendición y comisión mientras el otro mes seguía VENCIDO con mora.
    const aggConc = await prisma.pago.aggregate({
      where: { liquidacionId: liq.id, estado: 'CONCILIADO' },
      _sum: { monto: true },
    });
    const punitorioGuard = calcularMora(
      Number(liq.montoTotal),
      resolverEsquemaMora(liq.contrato, liq.contrato.inmobiliaria),
      liq.fechaVencimiento,
      credito.fecha,
      liq.montoPunitorioManual != null ? Number(liq.montoPunitorioManual) : null,
    );
    const saldoPendiente = Number(liq.montoTotal) + punitorioGuard - Number(aggConc._sum.monto ?? 0);
    if (saldoPendiente <= 0) return reply.code(409).send({ message: 'Esa liquidación ya está paga — elegí otra.' });
    if (Number(credito.monto) > saldoPendiente + 0.01) {
      return reply.code(400).send({
        message: 'El crédito supera el saldo de esa liquidación — asignalo a la liquidación correcta (¿son dos meses juntos?).',
      });
    }

    try {
      const pago = await prisma.$transaction(async (tx) => {
        // Lock: si otro admin ya concilió este crédito concurrentemente, count=0 → aborta.
        const marcado = await tx.creditoDetectado.updateMany({ where: { id: creditoId, conciliado: false }, data: { conciliado: true } });
        if (marcado.count === 0) throw new ConflictoCreditoConciliado();

        // Lock de la LIQUIDACIÓN + re-check del tope DENTRO de la tx: el lock
        // del crédito impide conciliar el MISMO crédito dos veces, pero no que
        // dos créditos DISTINTOS sobre-paguen la misma liquidación en paralelo
        // (ambos pasaban el guard de afuera con el mismo aggregate).
        await tx.$queryRaw`SELECT id FROM liquidaciones WHERE id = ${liq.id} FOR UPDATE`;
        const aggTx = await tx.pago.aggregate({ where: { liquidacionId: liq.id, estado: 'CONCILIADO' }, _sum: { monto: true } });
        const saldoTx = Number(liq.montoTotal) + punitorioGuard - Number(aggTx._sum.monto ?? 0);
        if (saldoTx <= 0) throw new ConflictoLiquidacionYaPaga();
        if (Number(credito.monto) > saldoTx + 0.01) throw new ConflictoSobrePago();

        // El crédito bancario YA es una acreditación real: nace directo CONCILIADO
        // (no pasa por INFORMADO — no hubo autoreporte del inquilino, lo detectó el banco).
        const nuevoPago = await tx.pago.create({
          data: {
            inmobiliariaId: u.inmobiliariaId,
            contratoId: liq.contratoId,
            liquidacionId: liq.id,
            periodo: liq.periodo,
            monto: credito.monto,
            montoLiqTotal: liq.montoTotal,
            metodo: 'TRANSFERENCIA',
            nroOperacion: credito.nroOperacion,
            fechaTransferencia: credito.fecha,
            notaInquilino: `Conciliado desde extracto bancario · ${credito.bancoOrigen || 'banco'} · op. ${credito.nroOperacion}`,
            estado: 'CONCILIADO',
            decididoPorId: u.userId,
            decididoAt: new Date(),
          },
        });
        await tx.creditoDetectado.update({ where: { id: creditoId }, data: { pagoId: nuevoPago.id } });

        // Recomputar estado de la liquidación (mismo criterio que /pagos/:id/validar:
        // mora del ESQUEMA EFECTIVO a la fecha del crédito, manual pisa).
        const agg = await tx.pago.aggregate({ where: { liquidacionId: liq.id, estado: 'CONCILIADO' }, _sum: { monto: true } });
        const cobrado = Number(agg._sum.monto ?? 0);
        const punitorio = calcularMora(
          Number(liq.montoTotal),
          resolverEsquemaMora(liq.contrato, liq.contrato.inmobiliaria),
          liq.fechaVencimiento,
          credito.fecha,
          liq.montoPunitorioManual != null ? Number(liq.montoPunitorioManual) : null,
        );
        // Tolerancia de 1 centavo, igual que validar/manual (plata.ts): `montoTotal
        // + punitorio` en float puede quedar epsilon por encima de `cobrado` y dejar
        // la liq PARCIAL con saldo fantasma de fracción de centavo.
        const total = Number(liq.montoTotal) + punitorio;
        const cubierta = total > 0 && cobrado >= total - 0.01;
        await tx.liquidacion.update({
          where: { id: liq.id },
          data: cubierta ? { estado: 'PAGADO', fechaPago: credito.fecha, metodoPago: 'TRANSFERENCIA' } : { estado: 'PARCIAL' },
        });
        if (cubierta) {
          await tx.pago.update({ where: { id: nuevoPago.id }, data: { tipo: 'TOTAL' } });
        }
        return nuevoPago;
      });
      return pago;
    } catch (e) {
      if (e instanceof ConflictoCreditoConciliado) return reply.code(409).send({ message: 'Este crédito ya fue conciliado' });
      if (e instanceof ConflictoLiquidacionYaPaga) return reply.code(409).send({ message: 'Esa liquidación ya está paga — elegí otra.' });
      if (e instanceof ConflictoSobrePago) {
        return reply.code(400).send({
          message: 'El crédito supera el saldo de esa liquidación — asignalo a la liquidación correcta (¿son dos meses juntos?).',
        });
      }
      throw e;
    }
  });
}

class ConflictoCreditoConciliado extends Error {}
class ConflictoLiquidacionYaPaga extends Error {}
class ConflictoSobrePago extends Error {}
