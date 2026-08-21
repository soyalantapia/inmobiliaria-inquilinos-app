import type { FastifyInstance, FastifyReply } from 'fastify';
import { esReversionInterna, observacionDeReversion } from '../lib/reversion-interna.js';
import { instanteEnDiaCivilAR, yaVencio } from '@llave/shared';
import { porcionAlquilerCobrada } from '@llave/shared/prorrateo';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../db.js';
import {
  exigirContratoActivo,
  requireContratoAcceso,
  requireInquilino,
  requireUsuario,
} from '../auth/guards.js';
import { verificarPinUsuario } from '../auth/pin.js';
import {
  devengarSiSigueActivo,
  devengarTodosLosTenants,
  generarLiquidacionesContrato,
  marcarLiquidacionesVencidas,
} from '../lib/liquidaciones.js';
import { diaDeCierreAR, totalizarCierre, whereCierreDelDia } from '../lib/cierre-caja.js';
import { parteRendible } from '../lib/parte-rendible.js';
import { descripcionDeReparacion } from '../lib/descripcion-gasto-rendido.js';
import { sePuedeBorrarGastoDeCaja } from '../lib/borrar-gasto-caja.js';
import { conSaldo, montoCobradoRendiblePorLiquidacion, montoPagadoPorLiquidacion } from '../lib/saldos.js';
import { registrarEventoContrato } from '../lib/evento-contrato.js';
import { calcularMora, resolverEsquemaMora, asOfMora } from '../lib/punitorios.js';
import { registrarEvento } from '../lib/auditoria.js';
import { aplicarDepositoADeuda } from '../lib/aplicar-deposito.js';
import { estadoDepositoContrato, cerrarCargosContraDeposito } from '../lib/deposito.js';
import { enviarInvitacionInquilino } from '../mailer.js';
import { borrarArchivoSiHuerfano, urlEsDelTenant } from './uploads.js';
import { aplicarEstadoInicial, EstadoInicialInvalido } from '../lib/estado-inicial-contrato.js';
import { dinero, dineroPositivo } from '../lib/monto.js';

/**
 * Fase 3 — La plata: liquidaciones, validación de pagos informados, caja de
 * gastos, rendiciones (que CONSUMEN los gastos y los marcan descontados — el
 * loop que en el front mock quedaba huérfano) y aprobaciones con PIN.
 */

// Delega en verificarPinUsuario (auth/pin.ts), que agrega bloqueo anti-fuerza-
// bruta (lockout tras N intentos). Acá solo traducimos el resultado a la reply.
async function verificarPin(
  userId: string,
  pin: string | undefined,
  reply: FastifyReply,
): Promise<boolean> {
  const r = await verificarPinUsuario(userId, pin);
  if (!r.ok) {
    await reply.code(r.code).send({ message: r.message });
    return false;
  }
  return true;
}

/** Redondeo a centavos: los Decimal viajan como Number y no queremos que un
 *  artefacto de float rechace un cobro legítimo ni deje una liq PARCIAL por $0.005. */
const r2c = (n: number) => Math.round(n * 100) / 100;

/** Monto de plata que un usuario/API ingresa: positivo y REDONDEADO a centavos.
 *  Sin esto un sub-centavo (0.004) pasaba `.positive()` y se guardaba 0.00 en el
 *  Decimal(14,2) (pago/movimiento fantasma de $0), y un monto tipo 100.006 se
 *  guardaba 100.01 dejando el pago 0.01 por encima del saldo. El `.transform` fija
 *  el valor a 2 decimales antes de usarlo en el guard, el `tipo` y el create. */
const montoCents = z
  .number()
  .positive()
  .transform(r2c)
  .refine((n) => n > 0, { message: 'El monto debe ser mayor a 0' });

export async function plataRoutes(app: FastifyInstance) {
  // ===== Liquidaciones =====
  app.get('/liquidaciones', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'pagos.ver');
    if (!u) return;
    const q = z
      .object({
        periodo: z.string().optional(),
        estado: z.enum(['PENDIENTE', 'PAGADO', 'PARCIAL', 'VENCIDO']).optional(),
      })
      .parse(request.query ?? {});
    const liqs = await prisma.liquidacion.findMany({
      where: {
        inmobiliariaId: u.inmobiliariaId,
        ...(q.periodo ? { periodo: q.periodo } : {}),
        ...(q.estado ? { estado: q.estado } : {}),
      },
      include: {
        contrato: {
          select: {
            id: true,
            tasaPunitorioDiaria: true,
            moneda: true,
            moraTipo: true,
            moraValor: true,
            // La PROPIEDAD y el MODO DE COBRANZA de ESTE contrato, no del que la propiedad
            // tenga como actual. El panel ataba cada liquidación a su dueño buscando
            // `props.find(p => p.contratoActualId === l.contratoId)`, y ese join se corta
            // solo: al finalizar un contrato la propiedad queda con `contratoActualId: null`,
            // y al firmar uno nuevo apunta al nuevo. Desde ese instante la plata cobrada del
            // contrato viejo —cobrada de verdad, en la cuenta de la inmobiliaria— dejaba de
            // encontrar propietario y salía de todas las cuentas del panel.
            propiedadId: true,
            modoCobranza: true,
            propiedad: { select: { direccion: true } },
            inquilinoTitular: { select: { nombre: true, apellido: true } },
          },
        },
      },
      orderBy: { fechaVencimiento: 'desc' },
    });
    // montoPagado/saldo (suma de conciliados) para que las vistas puedan mostrar
    // lo cobrado de un PARCIAL, no sólo el estado. El saldo va CON la mora al
    // día (mismo criterio que /mis-liquidaciones y el tope de /pagos/manual):
    // sin ella, el diálogo de cobro manual prefilleaba un "total" que el server
    // clasificaba PARCIAL y la liquidación quedaba abierta por la mora invisible.
    const pagado = await montoPagadoPorLiquidacion(liqs.map((l) => l.id));
    // Y lo COBRADO RENDIBLE, que es otra cosa: `montoPagado` incluye la deuda condonada y
    // la plata de la migración de cartera, porque mide lo que el inquilino dejó de deber.
    // El panel lo usaba para estimar lo que se le va a rendir al dueño, y ahí ninguna de las
    // dos cuenta — la rendición las filtra. El resultado era que la ficha decía
    // "a recibir $450.000", el operador se lo dictaba por teléfono, y Rendir contestaba 409.
    const cobradoRendible = await montoCobradoRendiblePorLiquidacion(liqs.map((l) => l.id));
    const inmoDefaults = await prisma.inmobiliaria.findUnique({
      where: { id: u.inmobiliariaId },
      select: { moraTipoDefault: true, moraValorDefault: true, monedaDefault: true },
    });
    const hoy = new Date();
    return liqs.map((l) => {
      const asOf = l.estado === 'PAGADO' && l.fechaPago ? new Date(l.fechaPago) : hoy;
      const punitorio = calcularMora(
        Number(l.montoTotal),
        resolverEsquemaMora(l.contrato, inmoDefaults),
        l.fechaVencimiento,
        asOf,
        l.montoPunitorioManual != null ? Number(l.montoPunitorioManual) : null,
      );
      const { moraTipo: _mt, moraValor: _mv, tasaPunitorioDiaria: _tp, ...contrato } = l.contrato;
      return {
        ...conSaldo({ ...l, contrato }, pagado, punitorio),
        // Se manda ADEMÁS de `montoPagado`, no en su lugar: las dos cifras son correctas y
        // contestan preguntas distintas. `montoPagado` es lo que el inquilino dejó de deber
        // —con la condonación adentro—; ésta es lo que se le puede transferir al dueño.
        montoCobradoRendible: cobradoRendible.get(l.id) ?? 0,
      };
    });
  });

  // Devenga (top-up) las liquidaciones de meses futuros de TODOS los contratos
  // ACTIVO del tenant. computarLiquidacionesContrato genera hasta "el mes que
  // viene inclusive"; sin un disparo periódico, un contrato se queda sin
  // liquidaciones a partir del 2º mes (no hay nada que cobrar). Es IDEMPOTENTE
  // (skipDuplicates sobre @@unique([contratoId,periodo])) → se puede llamar
  // cuantas veces se quiera. Hoy lo dispara un botón del panel; mañana un cron de
  // Railway puede pegarle a este mismo endpoint sin cambiar el código (sólo habrá
  // que darle una credencial de servicio para autenticarse).
  app.post('/liquidaciones/devengar', async (request, reply) => {
    const u = await requireUsuario(request, reply);
    if (!u) return;
    if (u.rol !== 'ADMIN' && u.rol !== 'OPERADOR') {
      return reply
        .code(403)
        .send({ message: 'Necesitás permiso de Admin u Operador para generar liquidaciones' });
    }
    const contratos = await prisma.contrato.findMany({
      where: { inmobiliariaId: u.inmobiliariaId, estado: 'ACTIVO' },
      select: {
        id: true,
        inmobiliariaId: true,
        monto: true,
        montoExpensas: true,
        moneda: true,
        fechaInicio: true,
        // Sin esto, el botón "Devengar" del panel devengaba desde `fechaInicio` e ignoraba
        // la decisión de la importación de cartera: le RESUCITABA al cliente los meses
        // históricos como deuda. El cron ya lo respetaba (devengarTodosLosTenants); este
        // camino gemelo se había quedado afuera del fix.
        devengarDesde: true,
        // Mismo caso que arriba, con otro campo: sin `tipoContrato` este botón —el camino
        // gemelo del cron— le devenga alquiler a un contrato de solo expensas.
        // Ver ContratoParaLiquidar.
        tipoContrato: true,
        fechaFin: true,
        diaPago: true,
      },
    });
    let liquidacionesNuevas = 0;
    for (const c of contratos) {
      // Una llamada idempotente por contrato (cada generar es su propio
      // createMany skipDuplicates). No hace falta una tx global: nada se corrompe
      // si falla a la mitad, y un reintento completa lo que falte.
      liquidacionesNuevas += await devengarSiSigueActivo(prisma, c);
    }
    // Marca vencidas las liquidaciones del tenant cuyo vencimiento ya pasó (mora).
    const liquidacionesVencidas = await marcarLiquidacionesVencidas(prisma, u.inmobiliariaId);
    return { contratosProcesados: contratos.length, liquidacionesNuevas, liquidacionesVencidas };
  });

  // Disparo GLOBAL del devengo (TODAS las inmobiliarias). Lo usa un cron externo
  // o un trigger manual: se autentica con un secreto compartido (header
  // x-cron-secret) porque un scheduler no tiene sesión de usuario. El back además
  // corre este mismo devengo solo, in-process (ver cron.ts), así que esto es el
  // camino externo/redundante. Idempotente.
  app.post('/internal/cron/devengar', async (request, reply) => {
    const secret = process.env.CRON_SECRET;
    const provisto = request.headers['x-cron-secret'];
    // Sin secreto configurado el endpoint queda cerrado (nunca abierto por defecto).
    if (!secret || provisto !== secret) {
      return reply.code(401).send({ message: 'No autorizado' });
    }
    return devengarTodosLosTenants(prisma);
  });

  // Cierre de caja del día: lo COBRADO (pagos conciliados) en una fecha + la
  // comisión de la inmobiliaria sobre el alquiler cobrado. Es la "rendición de
  // caja diaria" que pidió la inmobiliaria. Solo lectura. La comisión va SOLO
  // sobre el alquiler (no las expensas) y se prorratea en pagos parciales.
  app.get('/caja/cierre', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'caja.ver');
    if (!u) return;
    const q = z
      .object({
        fecha: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, 'fecha debe ser YYYY-MM-DD')
          .optional(),
      })
      .parse(request.query ?? {});
    // El día civil ARGENTINO y los filtros del cierre viven en `lib/cierre-caja.ts`, sin
    // Prisma, para poder fijarlos con tests que corran en CI: dos de esos filtros
    // —condonados y PROPIETARIO_DIRECTO— ya rompieron una vez, y los dos fallan inflando el
    // arqueo en silencio, que es el modo de falla que nadie nota.
    const fecha = q.fecha ?? diaDeCierreAR(new Date());

    const pagos = await prisma.pago.findMany({
      where: whereCierreDelDia(u.inmobiliariaId, fecha),
      include: {
        liquidacion: {
          select: { montoAlquiler: true, montoTotal: true, periodo: true, moneda: true },
        },
        contrato: {
          select: {
            propiedad: {
              select: {
                direccion: true,
                participaciones: {
                  select: { porcentaje: true, propietario: { select: { comisionPct: true } } },
                },
              },
            },
            inquilinoTitular: { select: { nombre: true, apellido: true } },
          },
        },
      },
      orderBy: { decididoAt: 'asc' },
    });

    // Toda la aritmética vive en `lib/cierre-caja.ts`, sin Prisma: es la única forma de
    // que las seis invariantes de plata de este cierre —prorrateo que deja las expensas
    // afuera, cap de la mora, guarda del 0/0, redondeo a centavos, buckets por moneda y el
    // flag multiMoneda— tengan tests que corran en CI. Acá queda la query y el armado de
    // las filas que ve la pantalla.
    const totales = totalizarCierre(
      pagos.map((p) => ({
        monto: Number(p.monto),
        moneda: p.liquidacion?.moneda ?? 'ARS',
        liqAlquiler: Number(p.liquidacion?.montoAlquiler ?? 0),
        liqTotal: Number(p.liquidacion?.montoTotal ?? 0),
        participaciones: p.contrato?.propiedad?.participaciones ?? [],
      })),
    );

    const items = pagos.map((p, i) => {
      const inq = p.contrato?.inquilinoTitular;
      // `totalizarCierre` devuelve una línea por pago y en el mismo orden, así que el índice
      // siempre existe (hay un test puro que fija ese contrato). El `!` es por
      // `noUncheckedIndexedAccess`, no porque el caso pueda darse.
      const linea = totales.lineas[i]!;
      return {
        id: p.id,
        inquilino: inq ? `${inq.nombre} ${inq.apellido ?? ''}`.trim() : '—',
        direccion: p.contrato?.propiedad?.direccion ?? '—',
        periodo: p.liquidacion?.periodo ?? p.periodo,
        monto: linea.monto,
        moneda: linea.moneda,
        comision: linea.comision,
        metodo: p.metodo,
        hora: p.decididoAt,
      };
    });

    return {
      fecha,
      // Totales planos: correctos con una sola moneda; con multiMoneda el front
      // debe usar porMoneda (sumar ARS+USD acá no significaría nada).
      cobrado: totales.cobrado,
      comision: totales.comision,
      cantidad: totales.cantidad,
      multiMoneda: totales.multiMoneda,
      porMoneda: totales.porMoneda,
      pagos: items,
    };
  });

  // ===== Pagos informados (bandeja a validar) =====
  app.get('/pagos', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'pagos.ver');
    if (!u) return;
    const q = z
      .object({ estado: z.enum(['INFORMADO', 'CONCILIADO', 'RECHAZADO']).optional() })
      .parse(request.query ?? {});
    const pagos = await prisma.pago.findMany({
      where: { inmobiliariaId: u.inmobiliariaId, ...(q.estado ? { estado: q.estado } : {}) },
      include: {
        contrato: {
          select: {
            id: true,
            // El validador necesita saber si la plata fue a la cuenta del DUEÑO
            // (cobranza directa): sin esta señal buscaba la transferencia en el
            // banco de la inmo, no la encontraba y rechazaba pagos legítimos.
            modoCobranza: true,
            cobraDirectoPropietario: { select: { nombre: true, apellido: true } },
            moraTipo: true,
            moraValor: true,
            tasaPunitorioDiaria: true,
            moneda: true,
            propiedad: { select: { direccion: true } },
            inquilinoTitular: { select: { nombre: true, apellido: true } },
          },
        },
        liquidacion: {
          select: {
            id: true,
            periodo: true,
            montoTotal: true,
            estado: true,
            fechaVencimiento: true,
            fechaPago: true,
            montoPunitorioManual: true,
          },
        },
      },
      orderBy: { informadoAt: 'desc' },
    });
    // Saldo REAL de cada liquidación (base + mora al día − conciliados): el panel
    // lo mostraba calculado contra mocks (siempre "saldo = total − este pago"),
    // ignorando parciales ya conciliados y la mora → deuda fantasma al validar.
    const pagadoMap = await montoPagadoPorLiquidacion(pagos.map((p) => p.liquidacion.id));
    const inmo = await prisma.inmobiliaria.findUnique({
      where: { id: u.inmobiliariaId },
      select: { moraTipoDefault: true, moraValorDefault: true, monedaDefault: true },
    });
    const hoy = new Date();
    return pagos.map((p) => {
      const base = Number(p.liquidacion.montoTotal);
      // Congela la mora del renglón igual que lo hará validar (ver `asOfMora`):
      // es exacto por fila porque el índice parcial `pagos_liquidacionId_informado_key`
      // garantiza un único INFORMADO por liquidación — o sea, el que se está por validar.
      const asOf = asOfMora(p, p.liquidacion, hoy);
      const punitorio = calcularMora(
        base,
        resolverEsquemaMora(p.contrato, inmo),
        p.liquidacion.fechaVencimiento,
        asOf,
        p.liquidacion.montoPunitorioManual != null
          ? Number(p.liquidacion.montoPunitorioManual)
          : null,
      );
      const montoPagado = pagadoMap.get(p.liquidacion.id) ?? 0;
      const { moraTipo: _mt, moraValor: _mv, tasaPunitorioDiaria: _tp, ...contrato } = p.contrato;
      return {
        ...p,
        contrato,
        liquidacion: {
          id: p.liquidacion.id,
          periodo: p.liquidacion.periodo,
          estado: p.liquidacion.estado,
          montoTotal: Math.round((base + punitorio) * 100) / 100,
          montoPunitorio: punitorio,
          montoPagado,
          saldo: Math.max(0, Math.round((base + punitorio - montoPagado) * 100) / 100),
        },
      };
    });
  });

  app.post('/pagos/:id/validar', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'pago.conciliar');
    if (!u) return;
    const { id } = request.params as { id: string };
    const body = z.object({ pin: z.string().optional() }).parse(request.body ?? {});
    if (!(await verificarPin(u.userId, body.pin, reply))) return;

    const pago = await prisma.pago.findFirst({
      where: { id, inmobiliariaId: u.inmobiliariaId },
      include: { contrato: { select: { estado: true } } },
    });
    if (!pago) return reply.code(404).send({ message: 'Pago inexistente' });
    if (pago.estado !== 'INFORMADO')
      return reply.code(409).send({ message: 'El pago ya fue decidido' });
    // Un pago EN VUELO (INFORMADO) SÍ se valida aunque el contrato ya esté finalizado:
    // la plata se recibió de verdad y hay que poder conciliarla y rendirla al
    // propietario (decisión del dueño). Un INFORMADO ya existente prueba que la
    // relación estaba viva cuando el inquilino transfirió — `exigirContratoActivo` lo
    // gatea en /pagos/informar. Por eso NO bloqueamos por contrato.estado acá; el único
    // lock es la doble-decisión (updateMany atómico abajo).

    // Atómico:
    //  1) LOCK de la liquidación (FOR UPDATE) + re-tope del saldo. Validar es el
    //     TERCER camino que crea un cobro CONCILIADO y hasta ahora era el ÚNICO
    //     que no re-verificaba el saldo (informar tiene el índice único; manual y
    //     el extracto bancario toman lock+tope). Sin esto, un informe que quedó
    //     colgado + un cobro por otra vía (efectivo/banco) sobre la misma cuota la
    //     SOBRE-COBRABAN: el 2º cobro nace CONCILIADO directo y el índice único de
    //     INFORMADO no lo frena → la liq quedaba con más plata que su total, se
    //     sobre-rendía al dueño y se inflaba la comisión. Espejo de /pagos/manual.
    //  2) La transición INFORMADO→CONCILIADO se hace con updateMany condicionado
    //     (WHERE estado='INFORMADO'). Si otra request (validar/rechazar) ya lo
    //     decidió, count=0 → 409. Cierra la carrera de doble-decisión.
    //  3) La liquidación pasa a PAGADO SÓLO si la suma de conciliados llega al
    //     total; si es parcial, queda PARCIAL.
    let pagoOk;
    // Se calcula adentro de la transacción y se usa DESPUÉS del commit, para el renglón
    // del historial (T-29-N1). Se captura en una variable de afuera en vez de devolverlo
    // junto al pago porque `pagoOk` ES el cuerpo de la respuesta del endpoint: agregarle
    // un campo cambiaría el contrato de la API por un dato interno.
    let cerroElPeriodo = false;
    try {
      pagoOk = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM liquidaciones WHERE id = ${pago.liquidacionId} FOR UPDATE`;
        // Total AUTORITATIVO = base + mora a la FECHA DEL PAGO (no la de hoy): el
        // inquilino que pagó lo que se le mostró no queda PARCIAL por mora que
        // creció mientras la inmo demoraba en validar. El esquema sale de la
        // cascada (contrato → default inmobiliaria); manual pisa. H-2:
        // inmobiliariaId en todas las ops (un ID ajeno no opera cross-tenant).
        const liq = await tx.liquidacion.findFirst({
          where: { id: pago.liquidacionId, inmobiliariaId: u.inmobiliariaId },
          select: {
            montoTotal: true,
            fechaVencimiento: true,
            montoPunitorioManual: true,
            contrato: {
              select: {
                tasaPunitorioDiaria: true,
                moneda: true,
                moraTipo: true,
                moraValor: true,
                inmobiliaria: { select: { moraTipoDefault: true, moraValorDefault: true, monedaDefault: true } },
              },
            },
          },
        });
        const base = Number(liq?.montoTotal ?? pago.montoLiqTotal ?? 0);
        const punitorio = liq
          ? calcularMora(
              base,
              resolverEsquemaMora(liq.contrato, liq.contrato?.inmobiliaria),
              liq.fechaVencimiento,
              pago.fechaTransferencia,
              liq.montoPunitorioManual != null ? Number(liq.montoPunitorioManual) : null,
            )
          : 0;
        const total = r2c(base + punitorio);
        // Conciliados ANTES de este pago (P sigue INFORMADO): si ya cubren el
        // total, o si sumar este pago excede el saldo, otro cobro se adelantó →
        // NO conciliamos (sería over-cobro). El operador rechaza o reasigna el
        // comprobante con un 409 claro.
        const aggPrev = await tx.pago.aggregate({
          where: { liquidacionId: pago.liquidacionId, estado: 'CONCILIADO' },
          _sum: { monto: true },
        });
        const conciliadosPrev = Number(aggPrev._sum.monto ?? 0);
        const saldo = r2c(total - conciliadosPrev);
        if (saldo <= 0.01) throw new ValidarLiquidacionYaCubierta();
        if (Number(pago.monto) > saldo + 0.01) throw new ValidarExcedeSaldo();

        const upd = await tx.pago.updateMany({
          where: { id, estado: 'INFORMADO' },
          data: { estado: 'CONCILIADO', decididoPorId: u.userId, decididoAt: new Date() },
        });
        if (upd.count === 0) return null;
        const cobrado = r2c(conciliadosPrev + Number(pago.monto));
        const cierra = total > 0 && cobrado >= total - 0.01;
        cerroElPeriodo = cierra;
        await tx.liquidacion.updateMany({
          where: { id: pago.liquidacionId, inmobiliariaId: u.inmobiliariaId },
          data: cierra
            ? {
                estado: 'PAGADO',
                fechaPago: pago.fechaTransferencia,
                // Método REAL del pago: MetodoPagoInformado incluye CHEQUE, que no
                // existe en MetodoPago → lo mapeamos a TRANSFERENCIA.
                metodoPago:
                  pago.metodo === 'MERCADOPAGO'
                    ? 'MERCADOPAGO'
                    : pago.metodo === 'EFECTIVO'
                      ? 'EFECTIVO'
                      : 'TRANSFERENCIA',
              }
            : { estado: 'PARCIAL' },
        });
        // El pago que CIERRA el ciclo (con parciales previos) queda etiquetado
        // TOTAL → el toast del panel no muestra un saldo restante falso.
        if (cierra) {
          await tx.pago.updateMany({ where: { id, tipo: 'PARCIAL' }, data: { tipo: 'TOTAL' } });
        }
        return tx.pago.findUnique({ where: { id } });
      });
    } catch (e) {
      if (e instanceof ValidarLiquidacionYaCubierta) {
        return reply
          .code(409)
          .send({
            message:
              'Esta liquidación ya fue cubierta por otro cobro. Rechazá o reasigná este comprobante.',
          });
      }
      if (e instanceof ValidarExcedeSaldo) {
        return reply
          .code(409)
          .send({
            message:
              'El monto supera el saldo pendiente — parte ya fue cubierta por otro cobro. Rechazá o reasigná este comprobante.',
          });
      }
      throw e;
    }
    if (!pagoOk) return reply.code(409).send({ message: 'El pago ya fue decidido' });
    // Rastro en el expediente del contrato: es LA cosa que pasa en la vida de un
    // alquiler y el Historial no la mostraba. Distingue el pago que cierra el
    // período del parcial, porque para leer el caso después no es lo mismo.
    //
    // POST-COMMIT (T-29-N1). De los cinco call sites éste era el más caro: adentro de la
    // transacción, un fallo al escribir el renglón del historial abortaba la conciliación
    // ENTERA. El pago quedaba sin conciliar, la liquidación sin saldar, y el endpoint
    // devolvía 200 igual.
    await registrarEventoContrato(prisma, {
      inmobiliariaId: u.inmobiliariaId,
      contratoId: pagoOk.contratoId,
      tipo: 'PAGO_RECIBIDO',
      titulo: cerroElPeriodo
        ? `Pago recibido — período ${pagoOk.periodo} saldado`
        : `Pago parcial recibido — período ${pagoOk.periodo}`,
      detalle: `${Number(pagoOk.monto)} · ${pagoOk.metodo}`,
      fecha: pagoOk.fechaTransferencia,
      autor: u.userId,
    });
    await registrarEvento({
      inmobiliariaId: u.inmobiliariaId,
      tipo: 'PAGO_CONCILIADO',
      autorId: u.userId,
      rolAutor: u.rol,
      entidadId: pagoOk.id,
      entidadDescripcion: `Pago ${pagoOk.periodo} · $${Number(pagoOk.monto)}`,
    });
    return pagoOk;
  });

  app.post('/pagos/:id/rechazar', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'pago.rechazar');
    if (!u) return;
    const { id } = request.params as { id: string };
    const body = z
      .object({ pin: z.string().optional(), observacion: z.string().min(5) })
      .safeParse(request.body ?? {});
    if (!body.success)
      return reply
        .code(400)
        .send({ message: 'Contale al inquilino por qué se rechaza (mínimo 5 caracteres)' });
    if (!(await verificarPin(u.userId, body.data.pin, reply))) return;

    const pago = await prisma.pago.findFirst({ where: { id, inmobiliariaId: u.inmobiliariaId } });
    if (!pago) return reply.code(404).send({ message: 'Pago inexistente' });
    if (pago.estado !== 'INFORMADO')
      return reply.code(409).send({ message: 'El pago ya fue decidido' });

    // Atómico (igual que validar): WHERE estado='INFORMADO' garantiza que sólo
    // una decisión (validar o rechazar) gane ante requests concurrentes. El
    // findUnique va DENTRO de la tx para no devolver un error engañoso si fallara
    // después de haber cambiado el estado.
    const pagoOk = await prisma.$transaction(async (tx) => {
      const upd = await tx.pago.updateMany({
        where: { id, estado: 'INFORMADO' },
        data: {
          estado: 'RECHAZADO',
          observacion: body.data.observacion,
          decididoPorId: u.userId,
          decididoAt: new Date(),
        },
      });
      if (upd.count === 0) return null;
      return tx.pago.findUnique({ where: { id } });
    });
    if (!pagoOk) return reply.code(409).send({ message: 'El pago ya fue decidido' });
    await registrarEvento({
      inmobiliariaId: u.inmobiliariaId,
      tipo: 'PAGO_RECHAZADO',
      autorId: u.userId,
      rolAutor: u.rol,
      entidadId: pagoOk.id,
      entidadDescripcion: `Pago ${pagoOk.periodo} · $${Number(pagoOk.monto)}`,
      detalle: body.data.observacion,
    });
    return pagoOk;
  });

  // Anular (revertir) un pago YA CONCILIADO: un cobro validado por error o una
  // transferencia que rebotó. Antes un CONCILIADO era terminal (no había forma de
  // deshacerlo) → la inmo quedaba con una liquidación PAGADO falsa que entraba a
  // rendición. Devuelve el pago a no-cobrado (reusa RECHAZADO con observación
  // "Anulado…" para no migrar el enum) y RECOMPUTA la liquidación
  // (PAGADO→PARCIAL/PENDIENTE/VENCIDO según lo que quede conciliado). Tras anular,
  // el inquilino puede volver a informar (la liq deja de estar paga).
  app.post('/pagos/:id/anular', async (request, reply) => {
    // `pago.revertir` (ADMIN) — NO `pago.conciliar`, que incluye a OPERADOR. Anular
    // devuelve la liquidación a PENDIENTE y libera el crédito bancario: el propio handler
    // registra el evento PAGO_REVERTIDO, que la matriz declara ADMIN. La capacidad existía
    // pero no se usaba, así que un OPERADOR podía deshacer cobros ya conciliados.
    const u = await requireUsuario(request, reply, 'pago.revertir');
    if (!u) return;
    const { id } = request.params as { id: string };
    const body = z
      .object({ pin: z.string().optional(), observacion: z.string().min(5) })
      .safeParse(request.body ?? {});
    if (!body.success)
      return reply
        .code(400)
        .send({ message: 'Contá por qué se anula el pago (mínimo 5 caracteres)' });
    if (!(await verificarPin(u.userId, body.data.pin, reply))) return;

    const pago = await prisma.pago.findFirst({ where: { id, inmobiliariaId: u.inmobiliariaId } });
    if (!pago) return reply.code(404).send({ message: 'Pago inexistente' });
    if (pago.estado !== 'CONCILIADO')
      return reply.code(409).send({ message: 'Solo se puede anular un pago ya conciliado' });
    const observacion = observacionDeReversion(body.data.observacion);
    // El chequeo de "¿ya se rindió?" va ADENTRO de la transacción, no acá afuera. Antes se
    // leía con `prisma` en autocommit y después se abría la tx, y en esa ventana la rendición
    // —que es larga: tiene timeout de 30 s y hace mucho trabajo entre leer y commitear— podía
    // colarse entera. Quedaba una `Rendicion` con sus `AlquilerRendido` sobre un pago que un
    // segundo después pasaba a RECHAZADO: al dueño se le transfirió el alquiler de un mes que
    // no se cobró, y no había salida, porque reintentar anular devuelve 409 ("solo se puede
    // anular un pago ya conciliado") con el pago ya rechazado. El descuadre además no se ve:
    // el pendiente saltea la liquidación en vez de mostrarla en negativo.
    //
    // Y se toma EL MISMO advisory lock que toma `POST /rendiciones` (dueño + período), que es
    // lo único que hace que las dos operaciones serialicen de verdad: no comparten ninguna
    // fila escrita —anular escribe pago/liquidacion/credito, la rendición escribe
    // rendicion/alquilerRendido/gastoRendido— así que ningún lock de fila las cruza.
    //
    // El patrón es el mismo que ya está escrito y comentado en `PATCH /modo-cobranza`
    // (core.ts): el guard de afuera decide con una foto, y adentro se re-verifica.
    const duenios = await prisma.participacionPropietario.findMany({
      where: { propiedad: { contratos: { some: { id: pago.contratoId } } }, inmobiliariaId: u.inmobiliariaId },
      select: { propietarioId: true },
    });
    let yaRendidoAlCerrar = false;
    const pagoOk = await prisma.$transaction(async (tx) => {
      // Un lock por cada dueño de la propiedad: la rendición serializa por (dueño, período) y
      // acá no se sabe a cuál de ellos se le va a rendir, así que se toman todos los que
      // podrían. Ordenados para que dos anulaciones concurrentes no se traben entre sí.
      for (const d of [...duenios].sort((a, b) => a.propietarioId.localeCompare(b.propietarioId))) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${u.inmobiliariaId}), hashtext(${`${d.propietarioId}|${pago.periodo}`}))`;
      }
      // Recién ahora, con el lock tomado, la pregunta tiene una respuesta que no se puede
      // volver falsa mientras dure esta transacción.
      const yaRendido = await tx.alquilerRendido.findFirst({
        where: { liquidacionId: pago.liquidacionId, inmobiliariaId: u.inmobiliariaId },
        select: { id: true },
      });
      if (yaRendido) {
        yaRendidoAlCerrar = true;
        return null;
      }
      // updateMany condicionado (WHERE estado='CONCILIADO'): cierra la carrera de
      // doble-anulación o anular-mientras-otro-opera. count=0 → 409.
      const upd = await tx.pago.updateMany({
        where: { id, estado: 'CONCILIADO' },
        data: { estado: 'RECHAZADO', observacion, decididoPorId: u.userId, decididoAt: new Date() },
      });
      if (upd.count === 0) return null;
      // Si el pago nació de la conciliación bancaria, liberar el crédito del
      // extracto: antes quedaba conciliado=true apuntando a un pago anulado y
      // no se podía reasignar a la liquidación correcta (plata huérfana).
      await tx.creditoDetectado.updateMany({
        where: { pagoId: pago.id, inmobiliariaId: u.inmobiliariaId },
        data: { conciliado: false, pagoId: null },
      });
      // Recalcular la liquidación con lo que QUEDA conciliado (incluye inmobiliariaId
      // en ambas ops: un ID ajeno no puede operar cross-tenant).
      const liq = await tx.liquidacion.findFirst({
        where: { id: pago.liquidacionId, inmobiliariaId: u.inmobiliariaId },
        select: {
          montoTotal: true,
          fechaVencimiento: true,
          fechaPago: true,
          montoPunitorioManual: true,
          contrato: {
            select: {
              tasaPunitorioDiaria: true,
              moneda: true,
              moraTipo: true,
              moraValor: true,
              inmobiliaria: { select: { moraTipoDefault: true, moraValorDefault: true, monedaDefault: true } },
            },
          },
        },
      });
      const agg = await tx.pago.aggregate({
        where: { liquidacionId: pago.liquidacionId, estado: 'CONCILIADO' },
        _sum: { monto: true },
      });
      const cobrado = Number(agg._sum.monto ?? 0);
      // Umbral ESPEJO de validar: base + mora (a la fecha en que se cerró el
      // ciclo, o hoy si sigue abierto). Antes se comparaba sólo contra la base:
      // anular el pago que cubría la mora dejaba la liq PAGADO con mora impaga
      // (descuadre silencioso — la mora nunca se podía volver a cobrar).
      const base = Number(liq?.montoTotal ?? 0);
      const punitorio = liq
        ? calcularMora(
            base,
            resolverEsquemaMora(liq.contrato, liq.contrato?.inmobiliaria),
            liq.fechaVencimiento,
            liq.fechaPago ?? new Date(),
            liq.montoPunitorioManual != null ? Number(liq.montoPunitorioManual) : null,
          )
        : 0;
      const total = base + punitorio;
      const vencida = liq ? yaVencio(liq.fechaVencimiento, new Date()) : false;
      // Sigue PAGADO sólo si OTROS conciliados cubren el total; si no, PARCIAL
      // (queda algo) o PENDIENTE/VENCIDO (no queda nada). Al dejar de estar PAGADO
      // limpiamos fechaPago/metodoPago para no dejar un "pagado" fantasma.
      // Tolerancia de 1 centavo (mismo umbral que validar/manual): `base + punitorio`
      // se suma en float sin r2c, así que un epsilon binario podía volver FALSE un
      // `cobrado >= total` que debía ser TRUE y degradar un PAGADO real a PARCIAL.
      const nuevoEstado =
        total > 0 && cobrado >= total - 0.01
          ? 'PAGADO'
          : cobrado > 0
            ? 'PARCIAL'
            : vencida
              ? 'VENCIDO'
              : 'PENDIENTE';
      await tx.liquidacion.updateMany({
        where: { id: pago.liquidacionId, inmobiliariaId: u.inmobiliariaId },
        data:
          nuevoEstado === 'PAGADO'
            ? { estado: 'PAGADO' }
            : { estado: nuevoEstado, fechaPago: null, metodoPago: null },
      });
      return tx.pago.findUnique({ where: { id } });
    });
    // El 409 de la rendición se distingue del de la carrera: son dos cosas distintas y el
    // operador tiene que saber cuál le tocó. Uno se resuelve anulando la rendición; el otro es
    // "alguien te ganó de mano, recargá".
    if (yaRendidoAlCerrar) {
      return reply.code(409).send({
        message:
          'Este pago ya fue rendido al propietario. Anulá primero la rendición del período y volvé a intentar.',
      });
    }
    if (!pagoOk) return reply.code(409).send({ message: 'El pago ya no estaba conciliado' });
    await registrarEvento({
      inmobiliariaId: u.inmobiliariaId,
      tipo: 'PAGO_REVERTIDO',
      autorId: u.userId,
      rolAutor: u.rol,
      entidadId: pagoOk.id,
      entidadDescripcion: `Pago ${pagoOk.periodo} · $${Number(pagoOk.monto)}`,
      detalle: body.data.observacion,
    });
    return pagoOk;
  });

  // Saldar la deuda de un contrato (cuentas por cobrar). La inmo registra el cobro de la
  // deuda vencida (típicamente de un EX-inquilino: /pagos/informar lo gatea exigirContratoActivo
  // → no puede cobrarse un contrato finalizado por la vía del inquilino). Crea un Pago
  // CONCILIADO por cada cuota vencida (o condona la deuda) y las marca PAGADO. Con PIN.
  app.post('/contratos/:id/saldar-deuda', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'pago.conciliar');
    if (!u) return;
    const { id } = request.params as { id: string };
    const parsed = z
      .object({
        pin: z.string().optional(),
        metodo: z
          .enum(['TRANSFERENCIA', 'MERCADOPAGO', 'EFECTIVO', 'CHEQUE'])
          .default('TRANSFERENCIA'),
        condonar: z.boolean().optional(),
      })
      .safeParse(request.body ?? {});
    if (!parsed.success)
      return reply.code(400).send({ message: 'Datos inválidos', detalle: parsed.error.flatten() });
    const b = parsed.data;
    if (!(await verificarPin(u.userId, b.pin, reply))) return;
    const contrato = await prisma.contrato.findFirst({
      where: { id, inmobiliariaId: u.inmobiliariaId },
      include: {
        inmobiliaria: { select: { moraTipoDefault: true, moraValorDefault: true, monedaDefault: true } },
      },
    });
    if (!contrato) return reply.code(404).send({ message: 'Contrato inexistente' });
    // Para el `cargadoPor` del movimiento de caja de los cargos. Fuera de la transacción:
    // no participa del invariante de plata y no tiene por qué alargar el lock.
    const usuarioQueSalda = await prisma.usuario.findUnique({ where: { id: u.userId } });
    const now = new Date();
    const liqs = await prisma.liquidacion.findMany({
      where: {
        contratoId: id,
        inmobiliariaId: u.inmobiliariaId,
        estado: { in: ['PENDIENTE', 'VENCIDO', 'PARCIAL'] },
      },
      orderBy: { fechaVencimiento: 'asc' },
    });
    const esquema = resolverEsquemaMora(contrato, contrato.inmobiliaria);
    const metodoPagoLiq =
      b.metodo === 'MERCADOPAGO'
        ? 'MERCADOPAGO'
        : b.metodo === 'EFECTIVO'
          ? 'EFECTIVO'
          : 'TRANSFERENCIA';
    // El `timeout` NO es de más: esta transacción toma un LOCK PESIMISTA por cuota
    // (`FOR UPDATE`, más abajo) y recorre TODAS las exigibles del contrato. Con varias
    // requests simultáneas —un doble click, dos operadores— las que quedan en la cola
    // detrás del lock esperan a que la primera termine, y con el default de Prisma (5 s)
    // reventaban con un P2028 que el operador veía como "Error interno".
    //
    // Ojo con el diagnóstico, que engaña: el invariante de plata SIEMPRE se cumplió —el
    // lock hace su trabajo y se crea un solo pago—, así que el 500 no es un doble cobro.
    // Es la espera, y el arreglo es esperar. 30 s / 10 s es lo que ya usan las otras
    // transacciones largas del repo (core.ts, importaciones).
    const res = await prisma.$transaction(async (tx) => {
      let saldadas = 0;
      let montoAplicado = 0;
      for (const l of liqs) {
        // Sólo las EXIGIBLES: vencidas o parciales vencidas. Una futura no se salda acá.
        const vencida =
          l.estado === 'VENCIDO' ||
          ((l.estado === 'PENDIENTE' || l.estado === 'PARCIAL') &&
            yaVencio(l.fechaVencimiento, now));
        if (!vencida) continue;
        // LOCK pesimista + re-lectura DENTRO de la tx, igual que /pagos/manual y el
        // conciliar bancario. Antes el saldo salía de un agregado leído FUERA de la
        // transacción: con dos submits simultáneos (doble click, dos operadores) ambos
        // veían el saldo completo y creaban un Pago CONCILIADO por el total → la
        // liquidación quedaba con el doble cobrado, inflando el cierre de caja del día y
        // la comisión. Era el único de los cuatro caminos que crean pagos conciliados sin
        // serializar.
        await tx.$queryRaw`SELECT id FROM liquidaciones WHERE id = ${l.id} FOR UPDATE`;
        const yaConc = await tx.pago.aggregate({
          where: { liquidacionId: l.id, estado: 'CONCILIADO' },
          _sum: { monto: true },
        });
        const punit = calcularMora(
          Number(l.montoTotal),
          esquema,
          l.fechaVencimiento,
          now,
          l.montoPunitorioManual != null ? Number(l.montoPunitorioManual) : null,
        );
        const saldo = r2c(Number(l.montoTotal) + punit - Number(yaConc._sum.monto ?? 0));
        if (saldo <= 0) continue;
        await tx.pago.create({
          data: {
            inmobiliariaId: u.inmobiliariaId,
            contratoId: id,
            liquidacionId: l.id,
            periodo: l.periodo,
            monto: saldo,
            // Cancela el saldo COMPLETO de la cuota (`monto: saldo`), así que es TOTAL.
            tipo: 'TOTAL',
            montoLiqTotal: Number(l.montoTotal) + punit,
            metodo: b.metodo,
            fechaTransferencia: now,
            estado: 'CONCILIADO',
            // Condonar cancela la deuda pero NO es plata que entró: la marca hace que el
            // cierre de caja y la rendición al propietario la ignoren, mientras el saldo
            // del inquilino sí la cuenta (que es el punto de condonar).
            condonado: !!b.condonar,
            decididoPorId: u.userId,
            decididoAt: now,
            observacion: b.condonar
              ? 'Condonación de deuda (ex-inquilino)'
              : 'Cobro registrado por la inmobiliaria',
          },
        });
        await tx.liquidacion.update({
          where: { id: l.id },
          data: { estado: 'PAGADO', fechaPago: now, metodoPago: metodoPagoLiq },
        });
        saldadas++;
        montoAplicado += saldo;
      }
      // Además saldamos los cargos pendientes del inquilino (reparaciones imputadas +
      // penalidad de rescisión) que NO van contra el depósito: "saldar deuda" = dejar
      // la cuenta del inquilino en cero, no sólo las liquidaciones.
      //
      // LA PLATA DEL CARGO TIENE QUE QUEDAR REGISTRADA, igual que en `POST /cargos/:id/saldar`.
      // Ese hermano ya arregló exactamente esto ("plata de cargos sin registrar", 40625049) y
      // el arreglo NO llegó acá: este bloque seguía poniendo `saldadoAt` y nada más. O sea que
      // el mismo cobro entraba a caja o no según por qué pantalla hubiera entrado la operadora
      // — "Marcar cobrado" lo registraba, "Saldar deuda" lo hacía desaparecer. Textual del
      // hermano: "Cobrabas una reparación, al inquilino se le borraba la deuda y en la caja no
      // figuraba un peso" (Camila 46:37).
      //
      // Se recorre de a uno y no con un `updateMany` masivo por la lección de T-55: el
      // `updateMany` condicionado a `saldadoAt: null` ES el lock, y sólo se registra el ingreso
      // del cargo que ESTE request ganó. Con un updateMany masivo no se sabe cuáles ganó, y dos
      // requests concurrentes escribirían dos ingresos por una sola cobranza.
      const cargosPend = await tx.cargoContrato.findMany({
        where: {
          contratoId: id,
          inmobiliariaId: u.inmobiliariaId,
          contraDeposito: false,
          saldadoAt: null,
        },
        select: { id: true, concepto: true, monto: true, moneda: true },
      });
      let cargosSaldados = 0;
      for (const c of cargosPend) {
        const upd = await tx.cargoContrato.updateMany({
          where: { id: c.id, saldadoAt: null },
          data: { saldadoAt: now, saldadoPorId: u.userId },
        });
        if (upd.count === 0) continue; // lo ganó otro request
        cargosSaldados++;
        // Condonar es PERDONAR la deuda: no entró plata, así que no hay ingreso que registrar.
        // (Lo que este fix NO resuelve: el cargo igual queda con `saldadoAt`, y `CargoContrato`
        // no tiene columna que distinga "cobrado" de "condonado" —las liquidaciones sí, por
        // `Pago.condonado`—. Aguas abajo `imputarCostoReclamo` lee ese `saldadoAt` como
        // evidencia de cobro. Arreglarlo pide una columna nueva, o sea una migración.)
        if (b.condonar) continue;
        await tx.movimientoCaja.create({
          data: {
            inmobiliariaId: u.inmobiliariaId,
            propiedadId: contrato.propiedadId,
            contratoId: contrato.id,
            tipo: 'INGRESO_EXTRA',
            categoria: 'OTRO',
            descripcion: `Cobro de cargo al inquilino: ${c.concepto}`,
            monto: c.monto,
            // La moneda DEL CARGO, no el default: `MovimientoCaja.moneda` es @default(ARS) y
            // omitirla dejaría un cargo en dólares registrado como pesos. Misma razón que en
            // el hermano.
            moneda: c.moneda,
            fecha: now,
            cargadoPor: usuarioQueSalda ? `${usuarioQueSalda.nombre} ${usuarioQueSalda.apellido}`.trim() : 'Panel',
          },
        });
      }
      return {
        liquidacionesSaldadas: saldadas,
        montoAplicado: Math.round(montoAplicado * 100) / 100,
        cargosSaldados,
      };
    }, { timeout: 30_000, maxWait: 10_000 });
    await registrarEvento({
      inmobiliariaId: u.inmobiliariaId,
      tipo: 'PAGO_CONCILIADO',
      autorId: u.userId,
      rolAutor: u.rol,
      entidadId: id,
      entidadDescripcion: `${b.condonar ? 'Condonación' : 'Cobro'} de deuda: ${res.liquidacionesSaldadas} cuota(s) por $${res.montoAplicado}`,
    });
    return { ok: true, condonado: !!b.condonar, ...res };
  });

  // Cargos del contrato para el PANEL: reparaciones imputadas (al inquilino o al
  // depósito) + penalidades de rescisión, con su estado (pendiente/saldado). Sirve
  // para surfacearlos en el detalle del contrato y poder marcarlos cobrados.
  app.get('/contratos/:id/cargos', async (request, reply) => {
    const u = await requireUsuario(request, reply);
    if (!u) return;
    const { id } = request.params as { id: string };
    const contrato = await prisma.contrato.findFirst({
      where: { id, inmobiliariaId: u.inmobiliariaId },
      select: { id: true },
    });
    if (!contrato) return reply.code(404).send({ message: 'Contrato inexistente' });
    const cargos = await prisma.cargoContrato.findMany({
      where: { contratoId: id, inmobiliariaId: u.inmobiliariaId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        tipo: true,
        concepto: true,
        monto: true,
        moneda: true,
        contraDeposito: true,
        reclamoId: true,
        saldadoAt: true,
        createdAt: true,
      },
    });
    return cargos.map((c) => ({
      id: c.id,
      tipo: c.tipo,
      concepto: c.concepto,
      monto: Number(c.monto),
      moneda: c.moneda,
      contraDeposito: c.contraDeposito,
      reclamoId: c.reclamoId,
      saldadoAt: c.saldadoAt ? c.saldadoAt.toISOString() : null,
      fecha: c.createdAt.toISOString(),
    }));
  });

  // Marca un cargo del inquilino como cobrado/saldado → deja de ser deuda (sale de
  // /mis-cargos y del total que ve el inquilino). Sólo cargos que NO van contra el
  // depósito (esos se netean en /depositos/en-custodia). Idempotente.
  app.post('/cargos/:id/saldar', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'pago.conciliar');
    if (!u) return;
    const { id } = request.params as { id: string };
    const cargo = await prisma.cargoContrato.findFirst({
      where: { id, inmobiliariaId: u.inmobiliariaId },
    });
    if (!cargo) return reply.code(404).send({ message: 'Cargo inexistente' });
    if (cargo.contraDeposito) {
      return reply
        .code(400)
        .send({ message: 'Ese cargo se descuenta del depósito, no se cobra al inquilino' });
    }
    if (!cargo.saldadoAt) {
      // La plata TIENE que quedar registrada: antes esto sólo marcaba `saldadoAt`, así
      // que el cargo desaparecía de la deuda del inquilino y no entraba a ningún lado.
      // Cobrabas una reparación, al inquilino se le borraba la deuda y en la caja no
      // figuraba un peso ("es plata que pierdo si no entra a caja", Camila 46:37).
      // Se registra como INGRESO_EXTRA de caja —no como Pago— porque `Pago` exige
      // `liquidacionId` (schema: String, no opcional) y un cargo NO es una liquidación:
      // colgarlo de una liquidación ajena le inflaría el monto pagado a ese período.
      // ⚠️ ACÁ DECÍA: "la rendición al propietario filtra `tipo: 'GASTO'`, así que un
      // INGRESO_EXTRA no le altera la liquidación al dueño". Fue cierto y DEJÓ DE SERLO:
      // hoy la rendición levanta explícitamente `tipo: 'INGRESO_EXTRA'` con
      // `descontadoEnRendicion: false` y se lo ACREDITA al propietario (buscá
      // `ingresosPend` en este mismo archivo). O sea que este ingreso SÍ le llega al dueño.
      //
      // Es lo que hay que tener presente al tocar el inverso: `descobrar` tiene que borrar
      // este movimiento, y frenar si ya se rindió. Que no lo hiciera costaba dos ingresos
      // por una sola cobranza.
      const contrato = await prisma.contrato.findFirst({
        where: { id: cargo.contratoId, inmobiliariaId: u.inmobiliariaId },
        select: { id: true, propiedadId: true },
      });
      // Sin contrato no hay dónde registrar el ingreso, y marcar el cargo como
      // saldado igual sería volver al bug exacto que este fix corrige: la deuda
      // desaparece del inquilino y la plata no entra a ningún lado, en silencio.
      // Con el cargo ya scopeado al tenant esto no debería pasar nunca, así que
      // preferimos frenar la operación entera antes que perder el rastro.
      if (!contrato) {
        return reply
          .code(409)
          .send({ message: 'El cargo no tiene un contrato válido en tu cartera' });
      }
      const usuario = await prisma.usuario.findUnique({ where: { id: u.userId } });
      // T-55 — El `if (!cargo.saldadoAt)` de arriba lee FUERA de la transacción, y el update no
      // estaba condicionado: dos requests concurrentes —alcanza un doble click— pasaban los dos
      // el chequeo y creaban DOS `INGRESO_EXTRA` por una sola cobranza. Y ese ingreso no se
      // queda en la caja: la rendición lo levanta y se lo ACREDITA al propietario (ver
      // `ingresosPend` en este archivo), así que el dueño cobraba dos veces el mismo cargo.
      //
      // El `updateMany` condicionado a `saldadoAt: null` es el lock: el segundo request no
      // matchea ninguna fila, sale con `count === 0` y no llega a crear el movimiento. Mismo
      // patrón que validar/rechazar/anular en este mismo archivo.
      const yaSaldado = await prisma.$transaction(async (tx) => {
        const upd = await tx.cargoContrato.updateMany({
          where: { id, inmobiliariaId: u.inmobiliariaId, saldadoAt: null },
          data: { saldadoAt: new Date(), saldadoPorId: u.userId },
        });
        if (upd.count === 0) return true;
        await tx.movimientoCaja.create({
          data: {
            inmobiliariaId: u.inmobiliariaId,
            propiedadId: contrato.propiedadId,
            contratoId: contrato.id,
            tipo: 'INGRESO_EXTRA',
            categoria: 'OTRO',
            descripcion: `Cobro de cargo al inquilino: ${cargo.concepto}`,
            monto: cargo.monto,
            // La moneda DEL CARGO, no el default. `MovimientoCaja.moneda` es `@default(ARS)`,
            // así que omitirla acá no fallaba: escribía ARS igual. Un cargo de US$800 quedaba
            // registrado en caja como $800 —el monto correcto en la unidad equivocada—, y de
            // ahí en más nadie podía notarlo, porque la fila ya no dice de dónde vino.
            moneda: cargo.moneda,
            fecha: new Date(),
            cargadoPor: usuario ? `${usuario.nombre} ${usuario.apellido}`.trim() : 'Panel',
          },
        });
        return false;
      });
      // El que perdió la carrera no registra el evento: el cargo ya lo saldó el otro, y dos
      // eventos por una cobranza ensucian la auditoría igual que dos ingresos la caja.
      if (yaSaldado) return { ok: true };
      await registrarEvento({
        inmobiliariaId: u.inmobiliariaId,
        tipo: 'PAGO_CONCILIADO',
        autorId: u.userId,
        rolAutor: u.rol,
        entidadId: id,
        entidadDescripcion: `Cargo saldado: ${cargo.concepto} · $${Number(cargo.monto)}`,
      });
    }
    return { ok: true };
  });

  // Deshacer un "Marcar cobrado". Existe porque el corte anti-doble-cobro de
  // imputarCostoReclamo le pide al operador exactamente esto cuando quiere reimputar un
  // reclamo cuyo cargo ya se cobró — sin este endpoint ese 409 sería un callejón sin
  // salida (nada en toda la API limpiaba `saldadoAt`). Vuelve a ser deuda del inquilino:
  // reaparece en /mis-cargos y en el total adeudado.
  app.post('/cargos/:id/descobrar', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'pago.conciliar');
    if (!u) return;
    const { id } = request.params as { id: string };
    const cargo = await prisma.cargoContrato.findFirst({
      where: { id, inmobiliariaId: u.inmobiliariaId },
    });
    if (!cargo) return reply.code(404).send({ message: 'Cargo inexistente' });
    if (!cargo.saldadoAt) return { ok: true }; // idempotente, igual que saldar

    // El INGRESO_EXTRA que dejó `saldar` tiene que irse JUNTO con el cobro. Antes no se
    // tocaba, y eso dejaba las dos mitades contradiciéndose: el cargo volvía a ser deuda del
    // inquilino y la caja seguía diciendo que esa plata entró. Peor todavía, la rendición
    // levanta `tipo: 'INGRESO_EXTRA'` con `descontadoEnRendicion: false` y se lo ACREDITA al
    // propietario — así que Cobrado → Deshacer → Cobrado dejaba DOS ingresos por una sola
    // cobranza, los dos rendibles. (El comentario de `saldar` decía que la rendición sólo
    // miraba `tipo: 'GASTO'`: fue cierto y dejó de serlo.)
    //
    // EL VÍNCULO ES LA DESCRIPCIÓN, NO UNA FK: `MovimientoCaja` no tiene `cargoId`. Se
    // reconstruye la misma cadena que escribe `saldar` y se acota por contrato, tipo, monto y
    // moneda. Se borra UNO solo (`saldar` crea exactamente uno por cobro), el más reciente.
    // Es lo mejor que se puede hacer sin tocar el schema; el arreglo de fondo es un `cargoId`
    // en `MovimientoCaja`, que necesita migración y decisión del dueño.
    const descripcionIngreso = `Cobro de cargo al inquilino: ${cargo.concepto}`;
    const mov = await prisma.movimientoCaja.findFirst({
      where: {
        inmobiliariaId: u.inmobiliariaId,
        contratoId: cargo.contratoId,
        tipo: 'INGRESO_EXTRA',
        descripcion: descripcionIngreso,
        monto: cargo.monto,
        moneda: cargo.moneda,
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, descontadoEnRendicion: true },
    });

    // Si esa plata YA se le rindió al propietario, no se deshace nada. Borrar el movimiento
    // acá dejaría a la rendición apuntando (por `IngresoRendido.refId`) a una fila que no
    // existe, y el neto que se le rindió al dueño dejaría de poder reconstruirse. Primero se
    // deshace la rendición, después el cobro.
    //
    // Se miran las DOS señales: `descontadoEnRendicion` y el ledger. En multi-dueño la marca
    // recién se pone cuando las partes cubren el total, así que un movimiento rendido a MEDIAS
    // la tiene en `false` y sólo lo delata `IngresoRendido`.
    // LA PREGUNTA SE HACE ADENTRO DE LA TRANSACCIÓN, no acá afuera.
    //
    // Se leía con `prisma` en autocommit y después se abría la tx, y el borrado era un
    // `delete` por PK pelada, sin condición. En esa ventana la rendición podía levantar este
    // mismo movimiento, crear su `IngresoRendido` y SUMARLO al neto que se le transfiere al
    // dueño; el delete de acá lo borraba igual. Quedaba el cargo otra vez impago para el
    // inquilino, la plata ya transferida al dueño, y un `IngresoRendido` huérfano —`refId` es
    // String sin FK— que hace que el detalle de esa rendición no se pueda reconstruir.
    //
    // El endpoint hermano que borra la MISMA tabla ya lo hace bien y dice por qué:
    // `DELETE /caja/movimientos/:id` mete los dos `count` adentro de la tx y borra con
    // `deleteMany` condicionado. Éste había quedado afuera de ese arreglo.
    let yaRendidoAlCerrar = false;
    const hecho = await prisma.$transaction(async (tx) => {
      if (mov) {
        // Las DOS señales: `descontadoEnRendicion` y el ledger. En multi-dueño la marca recién
        // se pone cuando las partes cubren el total, así que un movimiento rendido A MEDIAS la
        // tiene en `false` y sólo lo delata `IngresoRendido`.
        const rendido = await tx.movimientoCaja.findUnique({
          where: { id: mov.id },
          select: { descontadoEnRendicion: true },
        });
        const enElLedger = await tx.ingresoRendido.count({ where: { refId: mov.id } });
        if (!rendido || rendido.descontadoEnRendicion || enElLedger > 0) {
          yaRendidoAlCerrar = true;
          return false;
        }
      }
      await tx.cargoContrato.update({
        where: { id },
        data: { saldadoAt: null, saldadoPorId: null },
      });
      // Puede no haber movimiento: los cargos saldados ANTES de que `saldar` registrara el
      // ingreso no tienen ninguno. Ahí basta con devolverle la deuda al inquilino.
      //
      // `deleteMany` CONDICIONADO y no `delete` por PK: es el candado atómico contra una
      // rendición que tome el movimiento entre el chequeo de arriba y esta línea. Si lo tomó,
      // el count queda en 0 y abortamos toda la transacción.
      if (mov) {
        const borrado = await tx.movimientoCaja.deleteMany({
          where: { id: mov.id, inmobiliariaId: u.inmobiliariaId, descontadoEnRendicion: false },
        });
        if (borrado.count === 0) {
          yaRendidoAlCerrar = true;
          throw new MovimientoTomadoPorRendicion();
        }
      }
      return true;
    }).catch((e) => {
      if (e instanceof MovimientoTomadoPorRendicion) return false;
      throw e;
    });
    if (!hecho) {
      return reply.code(409).send({
        message: yaRendidoAlCerrar
          ? 'Ese cobro ya se le rindió al propietario. Deshacé primero la rendición y después el cobro.'
          : 'No se pudo deshacer el cobro. Recargá y volvé a intentar.',
      });
    }
    await registrarEvento({
      inmobiliariaId: u.inmobiliariaId,
      tipo: 'PAGO_REVERTIDO',
      autorId: u.userId,
      rolAutor: u.rol,
      entidadId: id,
      entidadDescripcion: `Cobro deshecho: ${cargo.concepto} · ${cargo.moneda === 'USD' ? 'US$' : '$'}${Number(cargo.monto)}`,
    });
    return { ok: true };
  });

  // Resolver el DEPÓSITO de garantía al egreso: devolver todo / netear (devolver
  // menos por deuda o daños) / ejecutar ("pelear"/retener). Antes esto SOLO ocurría en
  // la rescisión → un contrato FINALIZADO natural dejaba el depósito RETENIDO para
  // siempre en /depositos/en-custodia, sin forma de saldarlo. Válido sobre un contrato
  // ya terminado (FINALIZADO/RESCINDIDO) con depósito aún RETENIDO. Idempotente (409).
  app.post('/contratos/:id/deposito/resolver', async (request, reply) => {
    // `deposito.devolver` (ADMIN) — NO `contratos.crear`, que incluye a OPERADOR y CARGA.
    // Devolver o ejecutar el depósito mueve plata de un tercero y es irreversible por API
    // (después el propio handler da 409 si ya no está RETENIDO). La matriz siempre lo
    // declaró ADMIN, pero la capacidad no se usaba en ningún lado: un rol CARGA —"solo
    // carga inicial, queda pendiente de aprobación"— podía retener el depósito entero.
    const u = await requireUsuario(request, reply, 'deposito.devolver');
    if (!u) return;
    const { id } = request.params as { id: string };
    const body = z
      .object({
        decision: z.enum(['DEVOLVER', 'NETEAR', 'EJECUTAR']),
        montoDevuelto: dinero(),
        motivo: z.string().optional(),
      })
      .safeParse(request.body ?? {});
    if (!body.success) return reply.code(400).send({ message: 'Datos de resolución inválidos' });
    const contrato = await prisma.contrato.findFirst({
      where: { id, inmobiliariaId: u.inmobiliariaId },
    });
    if (!contrato) return reply.code(404).send({ message: 'Contrato inexistente' });
    if (contrato.estado !== 'FINALIZADO' && contrato.estado !== 'RESCINDIDO') {
      return reply
        .code(400)
        .send({
          message: 'El depósito se resuelve cuando el contrato termina (finalizado o rescindido)',
        });
    }
    if (contrato.estadoDeposito !== 'RETENIDO') {
      return reply.code(409).send({ message: 'El depósito de este contrato ya fue resuelto' });
    }
    const deposito = Number(contrato.depositoGarantia ?? 0);
    if (deposito <= 0)
      return reply.code(400).send({ message: 'Este contrato no tiene depósito en custodia' });
    const monto = Math.round(body.data.montoDevuelto * 100) / 100;
    // El tope es el DISPONIBLE, no el bruto: si hay reparaciones imputadas contra el
    // depósito (CargoContrato contraDeposito), esa plata ya está comprometida. Antes se
    // validaba contra el bruto y se podía devolver el 100% teniendo arreglos imputados →
    // la inmobiliaria los terminaba pagando de su bolsillo, y sin vuelta atrás (al
    // resolver, el contrato sale de /depositos/en-custodia y el cargo queda huérfano).
    const dep = await estadoDepositoContrato(prisma, {
      contratoId: id,
      inmobiliariaId: u.inmobiliariaId,
      depositoGarantia: contrato.depositoGarantia,
    });
    if (monto > dep.disponible) {
      return reply.code(400).send({
        message:
          dep.deducciones > 0
            ? `Sólo quedan $${dep.disponible} para devolver: hay $${dep.deducciones} en reparaciones imputadas a este depósito.`
            : 'No podés devolver más que el depósito en custodia',
      });
    }
    // DEVOLVER = se devuelve todo; NETEAR = se devuelve una parte; EJECUTAR = se retiene
    // todo ("pelear"). El monto que efectivamente se le devuelve al inquilino queda registrado.
    const estadoDeposito =
      body.data.decision === 'DEVOLVER'
        ? 'DEVUELTO'
        : body.data.decision === 'NETEAR'
          ? 'NETEADO'
          : 'EJECUTADO';
    // Lo que NO se devuelve es lo que la inmobiliaria retiene contra la deuda. Hasta acá se
    // marcaba el depósito NETEADO/EJECUTADO y no se tocaba una sola liquidación: la garantía
    // se consumía, la deuda quedaba intacta sumando punitorios, y el panel mostraba un
    // "saldo a cobrar" con el depósito ya restado que el backend nunca ejecutaba.
    // DEVOLVER no imputa nada (se le devuelve todo al inquilino, no hay retención).
    const aRetener = body.data.decision === 'DEVOLVER' ? 0 : r2c(dep.disponible - monto);
    let aplicacion = { aplicado: 0, sobrante: 0, cuotasSaldadas: 0 };
    // timeout holgado: la aplicación del depósito recorre las cuotas exigibles y con el
    // proxy de por medio la tx se pasaba de los 5s por defecto de Prisma → 500.
    let yaResuelto = false;
    await prisma.$transaction(
      async (tx) => {
        // EL CANDADO, ANTES DE TOCAR NADA.
        //
        // Todo lo de arriba —el estado del contrato, `estadoDeposito === 'RETENIDO'`, el
        // disponible— se leyó con `prisma` en autocommit, y la escritura era un
        // `tx.contrato.update({ where: { id } })` sin condición. Dos operadores apretando
        // "Resolver" a la vez pasaban los dos por el 409 de arriba y los dos ejecutaban
        // `aplicarDepositoADeuda`: el mismo depósito se imputaba DOS VECES contra la misma
        // deuda, saldando cuotas que nadie pagó.
        //
        // `updateMany` condicionado a que siga RETENIDO es el candado atómico: el segundo en
        // llegar cuenta 0 y aborta. Va PRIMERO, antes de imputar, para que no quede plata
        // aplicada de una transacción que después se revierte.
        const tomado = await tx.contrato.updateMany({
          where: { id, inmobiliariaId: u.inmobiliariaId, estadoDeposito: 'RETENIDO' },
          data: {
            estadoDeposito,
            depositoDevueltoMonto: monto,
            depositoDevueltoAt: new Date(),
            motivoDeposito: body.data.motivo?.trim() || null,
          },
        });
        if (tomado.count === 0) {
          yaResuelto = true;
          throw new DepositoYaResuelto();
        }
        if (aRetener > 0) {
          aplicacion = await aplicarDepositoADeuda(tx, {
            contratoId: id,
            inmobiliariaId: u.inmobiliariaId,
            disponible: aRetener,
            usuarioId: u.userId,
          });
        }
        // El monto ya se topeó contra `disponible` arriba, así que cerrar es seguro.
        await cerrarCargosContraDeposito(tx, { contratoId: id, inmobiliariaId: u.inmobiliariaId, usuarioId: u.userId });
      },
      { timeout: 20000 },
    ).catch((e) => {
      if (e instanceof DepositoYaResuelto) return;
      throw e;
    });
    // Mismo mensaje que el 409 de arriba: para el operador es el mismo hecho —el depósito ya
    // está resuelto—, sólo que se descubrió un instante más tarde.
    if (yaResuelto) return reply.code(409).send({ message: 'El depósito de este contrato ya fue resuelto' });
    await registrarEvento({
      inmobiliariaId: u.inmobiliariaId,
      tipo: 'PAGO_CONCILIADO',
      autorId: u.userId,
      rolAutor: u.rol,
      entidadId: id,
      entidadDescripcion: `Depósito ${estadoDeposito.toLowerCase()} · se devolvió $${monto} de $${deposito}${body.data.motivo ? ` · ${body.data.motivo.trim()}` : ''}`,
    });
    // El front necesita saber qué pasó de verdad con la retención: cuánto canceló deuda y
    // cuánto sobró tras cubrirla toda (ese sobrante es plata que sigue siendo del inquilino).
    return {
      ok: true,
      estadoDeposito,
      depositoDevueltoMonto: monto,
      depositoAplicadoADeuda: aplicacion.aplicado,
      depositoSobrante: aplicacion.sobrante,
      cuotasSaldadas: aplicacion.cuotasSaldadas,
    };
  });

  // Cobro MANUAL registrado por la inmobiliaria (con PIN): efectivo en la
  // oficina, o "el dueño confirmó que recibió la plata" en contratos de
  // cobranza directa. Antes NO existía ningún camino en prod para marcar
  // cobrada una liquidación si el inquilino no informaba por la app: la liq
  // de un contrato PROPIETARIO_DIRECTO quedaba VENCIDO acumulando mora para
  // siempre aunque el dueño ya hubiera cobrado. El pago nace CONCILIADO
  // (no hay comprobante que validar: la constancia es la palabra del que cobró)
  // y el recompute de la liquidación es el mismo de /pagos/:id/validar.
  app.post('/pagos/manual', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'pago.conciliar');
    if (!u) return;
    const body = z
      .object({
        liquidacionId: z.string(),
        monto: montoCents,
        metodo: z.enum(['TRANSFERENCIA', 'MERCADOPAGO', 'EFECTIVO', 'CHEQUE']).default('EFECTIVO'),
        // T-56 — El panel manda la fecha CIVIL ("YYYY-MM-DD"). Con `z.coerce.date()` a secas
        // quedaba en `D T00:00Z`, que en Argentina son las 21:00 del día ANTERIOR: la mora se
        // calculaba con un día de menos y el guard rechazaba con 400 el mismo monto que el
        // diálogo había prefilleado. Se la lleva a un instante dentro de ese día argentino.
        fecha: z
          .union([
            z.string().regex(/^\d{4}-\d{2}-\d{2}$/).transform((str) => {
              const [y, m, d] = str.split('-').map(Number);
              return instanteEnDiaCivilAR(new Date(Date.UTC(y!, m! - 1, d!)));
            }),
            z.coerce.date(),
          ]),
        nota: z.string().optional(),
        pin: z.string().optional(),
      })
      .safeParse(request.body ?? {});
    if (!body.success) return reply.code(400).send({ message: 'Datos del cobro incompletos' });
    if (!(await verificarPin(u.userId, body.data.pin, reply))) return;
    // La fecha del cobro fija la mora (umbral PAGADO) y la fechaPago: una fecha
    // futura falsearía ambos. El operador la controla, pero igual la acotamos.
    if (body.data.fecha.getTime() > Date.now() + 24 * 3600 * 1000) {
      return reply.code(400).send({ message: 'La fecha del cobro no puede ser futura.' });
    }

    const liq = await prisma.liquidacion.findFirst({
      where: { id: body.data.liquidacionId, inmobiliariaId: u.inmobiliariaId },
      include: {
        contrato: {
          select: {
            id: true,
            estado: true,
            tasaPunitorioDiaria: true,
            moneda: true,
            moraTipo: true,
            moraValor: true,
            inmobiliaria: { select: { moraTipoDefault: true, moraValorDefault: true, monedaDefault: true } },
          },
        },
      },
    });
    if (!liq) return reply.code(404).send({ message: 'Liquidación inexistente' });
    if (liq.contrato.estado !== 'ACTIVO') {
      return reply
        .code(409)
        .send({ message: 'El contrato ya no está activo — no se puede registrar un cobro.' });
    }
    if (liq.estado === 'PAGADO')
      return reply.code(409).send({ message: 'Esta liquidación ya está paga' });
    // Mismo tope que /pagos/informar: no registrar más que el saldo pendiente
    // (base + mora a la fecha del cobro − conciliados).
    const aggConc = await prisma.pago.aggregate({
      where: { liquidacionId: liq.id, estado: 'CONCILIADO' },
      _sum: { monto: true },
    });
    const punitorio = calcularMora(
      Number(liq.montoTotal),
      resolverEsquemaMora(liq.contrato, liq.contrato?.inmobiliaria),
      liq.fechaVencimiento,
      body.data.fecha,
      liq.montoPunitorioManual != null ? Number(liq.montoPunitorioManual) : null,
    );
    // Pre-check FUERA de la tx sólo para el error amigable rápido; el check
    // AUTORITATIVO se repite adentro, con la liquidación lockeada.
    const saldoPre = r2c(Number(liq.montoTotal) + punitorio - Number(aggConc._sum.monto ?? 0));
    if (saldoPre <= 0) return reply.code(409).send({ message: 'Esta liquidación ya está paga' });
    if (body.data.monto > saldoPre + 0.01) {
      return reply
        .code(400)
        .send({ message: 'El monto supera el saldo pendiente de esta liquidación' });
    }

    let pagoOk;
    try {
      pagoOk = await prisma.$transaction(async (tx) => {
        // LOCK pesimista de la liquidación: este pago NACE CONCILIADO, así que
        // no lo cubre el índice único parcial de INFORMADO ni un updateMany
        // condicionado por estado del pago (los guards del resto del ciclo).
        // Sin el lock, dos submits concurrentes (doble Enter con el request en
        // vuelo, dos operadores registrando el mismo efectivo) pasaban ambos el
        // tope con el mismo aggregate y la misma plata entraba DOS veces a
        // caja y rendición. FOR UPDATE serializa: el segundo espera y re-valida
        // contra los conciliados que ya incluyen al primero.
        await tx.$queryRaw`SELECT id FROM liquidaciones WHERE id = ${liq.id} FOR UPDATE`;
        const aggTx = await tx.pago.aggregate({
          where: { liquidacionId: liq.id, estado: 'CONCILIADO' },
          _sum: { monto: true },
        });
        const conciliados = Number(aggTx._sum.monto ?? 0);
        // Tolerancia de 1 centavo (mismo criterio que el conciliar del extracto):
        // los Decimal viajan como Number y un redondeo no puede rechazar un
        // cobro legítimo ni dejar la liq PARCIAL por $0.005.
        const saldoTx = r2c(Number(liq.montoTotal) + punitorio - conciliados);
        if (saldoTx <= 0) throw new ManualLiquidacionYaPaga();
        if (body.data.monto > saldoTx + 0.01) throw new ManualMontoSuperaSaldo();
        const nuevoPago = await tx.pago.create({
          data: {
            inmobiliariaId: u.inmobiliariaId,
            contratoId: liq.contrato.id,
            liquidacionId: liq.id,
            periodo: liq.periodo,
            tipo: body.data.monto >= saldoTx - 0.01 ? 'TOTAL' : 'PARCIAL',
            monto: body.data.monto,
            montoLiqTotal: liq.montoTotal,
            metodo: body.data.metodo,
            fechaTransferencia: body.data.fecha,
            notaInquilino: body.data.nota
              ? `Cobro manual registrado por la inmobiliaria: ${body.data.nota}`
              : 'Cobro manual registrado por la inmobiliaria',
            estado: 'CONCILIADO',
            decididoPorId: u.userId,
            decididoAt: new Date(),
          },
        });
        const cobrado = r2c(conciliados + body.data.monto);
        const total = r2c(Number(liq.montoTotal) + punitorio);
        await tx.liquidacion.updateMany({
          where: { id: liq.id, inmobiliariaId: u.inmobiliariaId },
          data:
            total > 0 && cobrado >= total - 0.01
              ? {
                  estado: 'PAGADO',
                  fechaPago: body.data.fecha,
                  metodoPago:
                    body.data.metodo === 'MERCADOPAGO'
                      ? 'MERCADOPAGO'
                      : body.data.metodo === 'EFECTIVO'
                        ? 'EFECTIVO'
                        : 'TRANSFERENCIA',
                }
              : { estado: 'PARCIAL' },
        });
        return nuevoPago;
      });
    } catch (e) {
      if (e instanceof ManualLiquidacionYaPaga)
        return reply.code(409).send({ message: 'Esta liquidación ya está paga' });
      if (e instanceof ManualMontoSuperaSaldo) {
        return reply
          .code(400)
          .send({ message: 'El monto supera el saldo pendiente de esta liquidación' });
      }
      throw e;
    }
    await registrarEvento({
      inmobiliariaId: u.inmobiliariaId,
      tipo: 'PAGO_CONCILIADO',
      autorId: u.userId,
      rolAutor: u.rol,
      entidadId: pagoOk.id,
      entidadDescripcion: `Cobro manual ${pagoOk.periodo} · $${Number(pagoOk.monto)}`,
      detalle: body.data.nota ?? 'Cobro registrado a mano (efectivo / cobranza directa)',
    });
    return reply.code(201).send(pagoOk);
  });

  // Inquilino o CUALQUIER co-inquilino del contrato (incluido permiso VER) informa
  // un pago. Decisión del dueño (2026-06-21): pagar el alquiler no se restringe —
  // cualquier miembro del contrato puede hacerlo (el tier PAGAR ya no aplica acá).
  app.post('/pagos/informar', async (request, reply) => {
    const inq = await requireContratoAcceso(request, reply, 'VER');
    if (!inq) return;
    if (!inq.contratoId) return reply.code(400).send({ message: 'No tenés un contrato activo' });
    // P10: un contrato finalizado/borrador no acepta pagos nuevos (aunque el JWT siga vivo).
    if (!(await exigirContratoActivo(inq.contratoId, inq.inmobiliariaId, reply))) return;
    const body = z
      .object({
        liquidacionId: z.string(),
        monto: montoCents,
        metodo: z.enum(['TRANSFERENCIA', 'MERCADOPAGO', 'EFECTIVO', 'CHEQUE']),
        nroOperacion: z.string().optional(),
        // coerce.date rechaza strings que no son fecha (antes new Date('xxx') =
        // Invalid Date hacía explotar el create con 500 en una acción de plata).
        fechaTransferencia: z.coerce.date(),
        nota: z.string().optional(),
        // Comprobante REAL subido a /uploads (Railway Volume). Antes el archivo
        // nunca llegaba al backend (solo metadatos) → la inmo no podía verlo.
        comprobanteUrl: z.string().optional(),
        comprobanteFileName: z.string().optional(),
        comprobanteMime: z.string().optional(),
        comprobanteSize: z.number().int().nonnegative().optional(),
      })
      .safeParse(request.body ?? {});
    if (!body.success) return reply.code(400).send({ message: 'Datos del pago incompletos' });
    // El comprobante, si viene, tiene que ser un archivo /uploads de ESTA
    // inmobiliaria (no una url externa ni de otro tenant).
    if (body.data.comprobanteUrl && !urlEsDelTenant(body.data.comprobanteUrl, inq.inmobiliariaId)) {
      return reply.code(400).send({ message: 'Comprobante inválido' });
    }
    // REGLA: NUNCA borrar del disco un archivo cuya URL vino en el body de la request.
    //
    // El front sube el comprobante a /uploads ANTES de este POST, así que si el informe
    // falla el archivo queda huérfano en el Volume, y este handler lo liberaba. El problema
    // es que el que elige QUÉ URL se borra es quien manda la request. El chequeo anterior
    // ("sólo si ningún Pago lo referencia") no alcanza: cubre los comprobantes de pago y
    // deja expuesto todo el resto. Concretamente, un co-inquilino con permiso VER —el tier
    // más bajo— lee el `archivoUrl` de una boleta de servicio del titular en GET /boletas,
    // la manda acá con una fecha futura a propósito, y el rollback le borra el PDF: la fila
    // BoletaServicio queda apuntando a un 404 y no hay ningún endpoint para borrarla ni
    // resubirla. Irreversible, repetible sobre cada boleta del contrato.
    //
    // `archivoSigueEnUso` (uploads.ts) ya cubre hoy las ~16 tablas que guardan URLs de
    // /uploads, boletas incluidas, y falla cerrado. Aun así este handler no borra: esa
    // lista es la única defensa y se pudre en silencio la próxima vez que alguien agregue
    // un campo de archivo y no la actualice. En los demás sitios eso sólo cuesta un
    // huérfano; acá cuesta el documento de otra persona, porque es el único borrado donde
    // el atacante elige el archivo. Dos capas, no una.
    //
    // Trade-off aceptado: un comprobante huérfano en el Volume por cada informe fallido.
    // Son KB y los limpia un barrido; el documento de otro no se recupera con nada.
    const limpiarComprobante = async () => {
      /* no-op deliberado — ver la regla de arriba */
    };
    // La fecha de transferencia la elige el inquilino. Sin cota, backdatearla
    // esquiva la mora (la validación calcula el umbral con esa fecha) y falsea el
    // certificado de buen pagador. No puede ser futura ni anterior al contrato.
    if (body.data.fechaTransferencia.getTime() > Date.now() + 24 * 3600 * 1000) {
      await limpiarComprobante();
      return reply.code(400).send({ message: 'La fecha de transferencia no puede ser futura.' });
    }

    const liq = await prisma.liquidacion.findFirst({
      where: { id: body.data.liquidacionId, contratoId: inq.contratoId },
      include: {
        contrato: {
          select: {
            fechaInicio: true,
            tasaPunitorioDiaria: true,
            moneda: true,
            moraTipo: true,
            moraValor: true,
            inmobiliaria: { select: { moraTipoDefault: true, moraValorDefault: true, monedaDefault: true } },
          },
        },
      },
    });
    if (!liq) {
      await limpiarComprobante();
      return reply.code(404).send({ message: 'Liquidación inexistente' });
    }
    if (body.data.fechaTransferencia < liq.contrato.fechaInicio) {
      await limpiarComprobante();
      return reply
        .code(400)
        .send({
          message: 'La fecha de transferencia no puede ser anterior al inicio del contrato.',
        });
    }
    // El piso "inicio del contrato" es demasiado laxo: en un contrato de 3 años deja
    // backdatear MESES. Y esa fecha es la que usa la validación como `asOf` de la mora
    // (plata.ts:403), así que el inquilino se auto-condonaba los punitorios fechando la
    // transferencia antes del vencimiento — y de paso se falseaba el certificado de buen
    // pagador. Ventana real: "transferí hace unos días y recién informo". Más atrás que
    // eso no es un olvido de informar, es esquivar la mora.
    const DIAS_BACKDATE = 30;
    const pisoBackdate = new Date(Date.now() - DIAS_BACKDATE * 24 * 3600 * 1000);
    if (body.data.fechaTransferencia < pisoBackdate) {
      await limpiarComprobante();
      return reply.code(400).send({
        message: `La fecha de transferencia no puede ser de hace más de ${DIAS_BACKDATE} días. Si el pago es más viejo, pedile a la inmobiliaria que lo registre.`,
      });
    }
    if (liq.estado === 'PAGADO') {
      await limpiarComprobante();
      return reply.code(409).send({ message: 'Esta liquidación ya está paga' });
    }
    // El monto informado no puede superar el saldo pendiente (total exigible −
    // conciliados). El total exigible = base + mora al día según el ESQUEMA
    // EFECTIVO (para que el inquilino pueda pagar los punitorios). Redondeo a
    // centavos + tolerancia ±0.01 (igual que manual/banco): sin esto, pagar
    // EXACTO el saldo que muestra la app a veces daba "supera el saldo" o nacía
    // PARCIAL por milésimas de float y la cuota nunca cerraba desde el inquilino.
    const aggConc = await prisma.pago.aggregate({
      where: { liquidacionId: liq.id, estado: 'CONCILIADO' },
      _sum: { monto: true },
    });
    const punitorio = calcularMora(
      Number(liq.montoTotal),
      resolverEsquemaMora(liq.contrato, liq.contrato?.inmobiliaria),
      liq.fechaVencimiento,
      new Date(),
      liq.montoPunitorioManual != null ? Number(liq.montoPunitorioManual) : null,
    );
    const saldoPendiente = r2c(
      Number(liq.montoTotal) + punitorio - Number(aggConc._sum.monto ?? 0),
    );
    // Carrera: liq.estado pudo leerse stale como PARCIAL mientras un /validar
    // concurrente ya concilió el total → saldo 0. No dejamos informar sobre una
    // liquidación efectivamente paga (el check de estado=PAGADO de arriba no la agarra).
    if (saldoPendiente <= 0.01) {
      await limpiarComprobante();
      return reply.code(409).send({ message: 'Esta liquidación ya está paga' });
    }
    if (body.data.monto > saldoPendiente + 0.01) {
      await limpiarComprobante();
      return reply
        .code(400)
        .send({ message: 'El monto supera el saldo pendiente de esta liquidación' });
    }

    // Evitar doble-informe: si ya hay un pago INFORMADO esperando validación,
    // no creamos otro (el inquilino no veía el estado "pendiente de validación"
    // en prod y cada toque del botón insertaba otra fila Pago en la bandeja).
    const yaInformado = await prisma.pago.findFirst({
      where: { liquidacionId: liq.id, estado: 'INFORMADO' },
    });
    if (yaInformado) {
      await limpiarComprobante();
      return reply
        .code(409)
        .send({
          message: 'Ya informaste un pago de este mes; esperá que la inmobiliaria lo valide.',
        });
    }

    try {
      return await prisma.pago.create({
        data: {
          inmobiliariaId: inq.inmobiliariaId,
          contratoId: inq.contratoId,
          liquidacionId: liq.id,
          periodo: liq.periodo,
          // Autor del pago (co-inquilinos): quién lo informó, para atribución en
          // notificaciones y en la lista "Pagos informados".
          informadoPorInquilinoId: inq.esCoInquilino ? null : inq.inquilinoId,
          informadoPorCoInquilinoId: inq.coInquilinoId,
          // TOTAL si el monto CIERRA el saldo pendiente (no si iguala el total
          // original): un pago que salda el remanente tras un parcial previo debe
          // nacer TOTAL, no PARCIAL. Tolerancia ±0.01.
          tipo: body.data.monto >= saldoPendiente - 0.01 ? 'TOTAL' : 'PARCIAL',
          monto: body.data.monto,
          montoLiqTotal: liq.montoTotal,
          metodo: body.data.metodo,
          nroOperacion: body.data.nroOperacion,
          fechaTransferencia: body.data.fechaTransferencia,
          notaInquilino: body.data.nota,
          comprobanteUrl: body.data.comprobanteUrl,
          comprobanteFileName: body.data.comprobanteFileName,
          comprobanteMime: body.data.comprobanteMime,
          comprobanteSize: body.data.comprobanteSize,
        },
      });
    } catch (e) {
      // Si el create() falla, el Pago NO se persistió → el comprobante ya subido
      // queda huérfano en el Volume. Lo liberamos SIEMPRE (no solo en P2002),
      // antes de propagar o responder.
      await limpiarComprobante();
      // Carrera de doble-informe concurrente (dos requests pasan el findFirst de
      // arriba a la vez): el índice parcial único (un solo INFORMADO por
      // liquidación) la corta con P2002 → mismo 409 amigable que el caso secuencial.
      if (e && typeof e === 'object' && (e as { code?: string }).code === 'P2002') {
        return reply
          .code(409)
          .send({
            message: 'Ya informaste un pago de este mes; esperá que la inmobiliaria lo valide.',
          });
      }
      throw e;
    }
  });

  // Liquidaciones del inquilino logueado (para informar pagos / comprobantes)
  app.get('/mis-liquidaciones', async (request, reply) => {
    const inq = await requireContratoAcceso(request, reply);
    if (!inq) return;
    if (!inq.contratoId) return [];
    const liqs = await prisma.liquidacion.findMany({
      where: { contratoId: inq.contratoId },
      orderBy: { periodo: 'desc' },
    });
    // CLAVE (bugs 1/3): sin montoPagado/saldo el inquilino veía SIEMPRE el
    // montoTotal completo, aunque hubiera informado/conciliado un parcial. Ahora
    // exponemos cuánto se pagó (conciliado) y el saldo real por liquidación.
    const pagado = await montoPagadoPorLiquidacion(liqs.map((l) => l.id));
    // Los PAGOS del inquilino por liquidación (INFORMADO en revisión, RECHAZADO
    // con motivo, CONCILIADO): sin esto la PWA en prod quedaba ciega — no podía
    // mostrar "pendiente de validación", el motivo de un rechazo ni reabrir el
    // comprobante enviado (las cards existen en el front pero no tenían dato).
    const pagosRows = await prisma.pago.findMany({
      where: { liquidacionId: { in: liqs.map((l) => l.id) } },
      orderBy: { informadoAt: 'asc' },
      select: {
        id: true,
        liquidacionId: true,
        tipo: true,
        estado: true,
        monto: true,
        metodo: true,
        nroOperacion: true,
        fechaTransferencia: true,
        informadoAt: true,
        decididoAt: true,
        observacion: true,
        comprobanteUrl: true,
        comprobanteFileName: true,
        comprobanteMime: true,
        informadoPorInquilinoId: true,
        informadoPorCoInquilinoId: true,
      },
    });
    const pagosPorLiq = new Map<string, Array<Record<string, unknown>>>();
    for (const p of pagosRows) {
      const arr = pagosPorLiq.get(p.liquidacionId) ?? [];
      // Un pago ANULADO por la inmo queda RECHAZADO con una observación interna
      // ("Anulado tras conciliar: <motivo del admin>") que NO es para el
      // inquilino: la reemplazamos por un texto neutro y marcamos anulado para
      // que la PWA pueda distinguirlo de un rechazo de comprobante.
      const anulado =
        p.estado === 'RECHAZADO' && esReversionInterna(p.observacion);
      // Autor del informe (co-inquilinos): "vos" si lo informó quien consulta,
      // "otro" si fue otro miembro del contrato, null si es un cobro registrado
      // por la inmo (efectivo/banco, sin autor inquilino).
      const autor =
        p.informadoPorInquilinoId == null && p.informadoPorCoInquilinoId == null
          ? null
          : (p.informadoPorInquilinoId != null && p.informadoPorInquilinoId === inq.inquilinoId) ||
              (p.informadoPorCoInquilinoId != null &&
                p.informadoPorCoInquilinoId === inq.coInquilinoId)
            ? 'vos'
            : 'otro';
      arr.push({
        id: p.id,
        tipo: p.tipo,
        estado: p.estado,
        anulado,
        autor,
        monto: Number(p.monto),
        metodo: p.metodo,
        nroOperacion: p.nroOperacion,
        fechaTransferencia: p.fechaTransferencia.toISOString(),
        informadoAt: p.informadoAt.toISOString(),
        decididoAt: p.decididoAt ? p.decididoAt.toISOString() : null,
        observacion: anulado
          ? 'La inmobiliaria revirtió este cobro. Si no lo esperabas, consultale el motivo.'
          : p.observacion,
        comprobanteUrl: p.comprobanteUrl,
        comprobanteFileName: p.comprobanteFileName,
        comprobanteMime: p.comprobanteMime,
      });
      pagosPorLiq.set(p.liquidacionId, arr);
    }
    // Mora al día según el ESQUEMA EFECTIVO (todas las liqs son del mismo
    // contrato → un solo esquema). El montoTotal devuelto = base + punitorio;
    // una liq PAGADA congela la mora en su fechaPago y un montoPunitorioManual
    // (migración de contrato en curso) pisa el cálculo.
    const ctto = await prisma.contrato.findUnique({
      where: { id: inq.contratoId },
      select: {
        tasaPunitorioDiaria: true,
        moneda: true,
        moraTipo: true,
        moraValor: true,
        inmobiliaria: { select: { moraTipoDefault: true, moraValorDefault: true, monedaDefault: true } },
      },
    });
    const esquema = resolverEsquemaMora(ctto, ctto?.inmobiliaria);
    const hoy = new Date();
    return liqs.map((l) => {
      // La mora se CONGELA cuando ya hay un pago esperando validación, con la fecha de
      // transferencia declarada — que es exactamente la que usa /pagos/:id/validar para
      // calcular el total autoritativo. Sin esto la app le prometía al inquilino
      // "pausamos los punitorios hasta validar" y al día siguiente le mostraba MÁS deuda,
      // creciendo cada día que la inmo tardara en validar: un número que además el
      // backend nunca iba a cobrar. Si hay varios informados, manda el más viejo.
      const informados = (pagosPorLiq.get(l.id) ?? []).filter((p) => p.estado === 'INFORMADO');
      const congeladoPorInforme = informados.reduce<Date | null>((min, p) => {
        const f = new Date(String(p.fechaTransferencia));
        if (Number.isNaN(f.getTime())) return min;
        return min === null || f < min ? f : min;
      }, null);
      const asOf =
        l.estado === 'PAGADO' && l.fechaPago ? new Date(l.fechaPago) : (congeladoPorInforme ?? hoy);
      const punitorio = calcularMora(
        Number(l.montoTotal),
        esquema,
        l.fechaVencimiento,
        asOf,
        l.montoPunitorioManual != null ? Number(l.montoPunitorioManual) : null,
      );
      return { ...conSaldo(l, pagado, punitorio), pagos: pagosPorLiq.get(l.id) ?? [] };
    });
  });

  // ===== Caja de gastos =====
  app.get('/caja/movimientos', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'caja.ver');
    if (!u) return;
    return prisma.movimientoCaja.findMany({
      where: { inmobiliariaId: u.inmobiliariaId },
      include: {
        propiedad: { select: { id: true, direccion: true } },
        // La cuenta de dónde salió / entró la plata, para mostrarla en la lista.
        cuenta: { select: { id: true, nombre: true } },
      },
      orderBy: { fecha: 'desc' },
    });
  });

  app.post('/caja/movimientos', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'gasto.caja.cargar');
    if (!u) return;
    const body = z
      .object({
        // Opcional: sin propiedad = gasto/ingreso PROPIO de la inmobiliaria (oficina,
        // sueldos, movimiento entre cajas). Ver el comentario del campo en el schema:
        // esos movimientos NO entran a la rendición de ningún propietario, a propósito.
        // Se acepta null además de undefined porque el form manda null cuando no se
        // eligió propiedad (mismo caso que `proveedor` y `comprobante` acá abajo).
        propiedadId: z.string().nullable().optional(),
        // tipo: SALIDA (GASTO) o ENTRADA (INGRESO_EXTRA). Default GASTO (compat).
        tipo: z.enum(['GASTO', 'INGRESO_EXTRA']).default('GASTO'),
        // Categoría obligatoria para gastos; opcional para ingresos (cae a OTRO).
        categoria: z
          .enum([
            'PLOMERIA',
            'ELECTRICIDAD',
            'GAS',
            'CERRAJERIA',
            'PINTURA',
            'EXPENSAS',
            'MATERIALES',
            'OTRO',
          ])
          .optional(),
        descripcion: z.string().min(3),
        monto: montoCents,
        // Moneda del movimiento. La rendición sólo toma los de SU moneda, así que
        // un gasto mal rotulado no se descuenta (mejor que descontarse mal).
        // Default ARS por compatibilidad: es lo que mandaban los clientes viejos.
        moneda: z.enum(['ARS', 'USD']).default('ARS'),
        // coerce.date rechaza strings no-fecha (igual que fechaTransferencia):
        // antes new Date('xxx')=Invalid Date hacía explotar el create con 500.
        fecha: z.coerce.date(),
        // El front manda null cuando el proveedor queda vacío: aceptar null además de undefined.
        proveedor: z.string().nullable().optional(),
        // Comprobante/ticket del gasto (foto o PDF ya subido a /uploads): el
        // respaldo para la rendición al propietario.
        // MISMO caso que `proveedor` de arriba: el form manda null cuando no se
        // adjuntó comprobante (caja/page.tsx es useState<string | null>(null)),
        // y `.optional()` acepta undefined pero RECHAZA null → el safeParse fallaba
        // y TODO movimiento de caja sin comprobante moría en "Datos del movimiento
        // incompletos". Es decir: al agregar el comprobante se rompió la carga de
        // caja entera. El tipo del front (hooks.ts) ya decía `string | null`.
        // (`.nullish()` es exactamente `.nullable().optional()`.)
        comprobanteUrl: z.string().nullish(),
        // Cuenta de caja de dónde sale / a dónde entra la plata (MP Gaspar, efectivo…).
        // Opcional: se puede cargar un movimiento sin cuenta (o si aún no cargó ninguna).
        cuentaId: z.string().nullable().optional(),
      })
      .safeParse(request.body ?? {});
    if (!body.success) return reply.code(400).send({ message: 'Datos del movimiento incompletos' });
    if (body.data.comprobanteUrl && !urlEsDelTenant(body.data.comprobanteUrl, u.inmobiliariaId)) {
      return reply.code(400).send({ message: 'Comprobante inválido' });
    }

    // Cuenta: del tenant + la dirección tiene que permitir el tipo del movimiento
    // (una cuenta "solo entrada" no acepta un gasto; una "solo salida" no acepta un ingreso).
    if (body.data.cuentaId) {
      const cuenta = await prisma.cuentaCaja.findFirst({
        where: { id: body.data.cuentaId, inmobiliariaId: u.inmobiliariaId },
      });
      if (!cuenta) return reply.code(404).send({ message: 'Cuenta inexistente' });
      if (cuenta.direccion === 'ENTRADA' && body.data.tipo === 'GASTO') {
        return reply
          .code(409)
          .send({
            message: `La cuenta "${cuenta.nombre}" es solo de entrada: no podés cargarle un gasto`,
          });
      }
      if (cuenta.direccion === 'SALIDA' && body.data.tipo === 'INGRESO_EXTRA') {
        return reply
          .code(409)
          .send({
            message: `La cuenta "${cuenta.nombre}" es solo de salida: no podés cargarle un ingreso`,
          });
      }
    }

    // Sin propiedad = movimiento propio de la inmobiliaria (oficina, sueldos, entre
    // cajas). Si viene una, se valida contra el tenant como siempre.
    let prop: { id: string; contratoActualId: string | null } | null = null;
    if (body.data.propiedadId) {
      prop = await prisma.propiedad.findFirst({
        where: { id: body.data.propiedadId, inmobiliariaId: u.inmobiliariaId },
        select: { id: true, contratoActualId: true },
      });
      if (!prop) return reply.code(404).send({ message: 'Propiedad inexistente' });
    }
    const usuario = await prisma.usuario.findUnique({ where: { id: u.userId } });
    const esIngreso = body.data.tipo === 'INGRESO_EXTRA';

    const mov = await prisma.movimientoCaja.create({
      data: {
        inmobiliariaId: u.inmobiliariaId,
        propiedadId: prop?.id ?? null,
        contratoId: prop?.contratoActualId ?? null,
        tipo: body.data.tipo,
        categoria: body.data.categoria ?? 'OTRO',
        descripcion: body.data.descripcion,
        monto: body.data.monto,
        moneda: body.data.moneda,
        fecha: body.data.fecha,
        proveedor: body.data.proveedor,
        // Respaldo del gasto (foto/PDF ya subido a /uploads): antes se validaba
        // pero NO se persistía en el create → el comprobante se perdía.
        comprobanteUrl: body.data.comprobanteUrl,
        cuentaId: body.data.cuentaId ?? null,
        cargadoPor: usuario ? `${usuario.nombre} ${usuario.apellido}`.trim() : 'Panel',
      },
    });
    await registrarEvento({
      inmobiliariaId: u.inmobiliariaId,
      tipo: 'GASTO_CAJA_CARGADO',
      autorId: u.userId,
      rolAutor: u.rol,
      entidadId: mov.id,
      entidadDescripcion: `${esIngreso ? 'Entrada' : 'Salida'} · ${body.data.moneda === 'USD' ? 'US$' : '$'}${body.data.monto} · ${body.data.descripcion}`,
    });
    return mov;
  });

  app.delete('/caja/movimientos/:id', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'caja.eliminar');
    if (!u) return;
    const { id } = request.params as { id: string };
    const body = z.object({ pin: z.string().optional() }).parse(request.body ?? {});
    if (!(await verificarPin(u.userId, body.pin, reply))) return;
    // 404 vs 409: distinguimos "no existe" de "ya rendido" con una lectura previa,
    // pero el borrado en sí es ATÓMICO (deleteMany WHERE descontadoEnRendicion=false):
    // si una rendición concurrente toma el gasto entre el check y el delete, el
    // count queda en 0 y devolvemos 409 (antes el delete lo borraba igual y dejaba
    // la rendición apuntando a un gasto inexistente).
    const mov = await prisma.movimientoCaja.findFirst({
      where: { id, inmobiliariaId: u.inmobiliariaId },
      select: { descontadoEnRendicion: true, comprobanteUrl: true },
    });
    if (!mov) return reply.code(404).send({ message: 'Movimiento inexistente' });
    // El candado real es "¿existe un GastoRendido que apunte a este movimiento?", NO el flag
    // `descontadoEnRendicion`. El flag no dice "no se le descontó a nadie": dice "todavía no se
    // cubrió el 100%". Lo explica el propio armado de la rendición, más abajo en este archivo:
    // en multi-dueño el movimiento queda en `false` hasta que las partes suman el total.
    //
    // O sea, con un departamento 50/50: se rinde a la primera dueña, se le descuentan $50.000,
    // el flag sigue en `false` porque falta el hermano, y el borrado pasaba. Ella quedaba con
    // el descuento hecho sobre un gasto que ya no existe, él no lo pagaba nunca, y el
    // movimiento no estaba ni para auditarlo. Con un solo dueño no pasa —la primera rendición
    // cubre el 100%—, que es por qué duró.
    //
    // El `GastoRendido` existe desde la PRIMERA parte rendida, así que es el que hay que mirar.
    // Todo va en una transacción para no reabrir la carrera que el `deleteMany` atómico cerró.
    const res = await prisma.$transaction(async (tx) => {
      const gastosRendidosQueLoApuntan = await tx.gastoRendido.count({
        where: { refId: id, tipo: 'CAJA' },
      });
      // Y el ledger de los INGRESO_EXTRA, que es otro: para un ingreso el contador de gastos
      // es 0 por construcción, así que sin esto el candado no protegía absolutamente nada y el
      // ingreso rendido a medias se borraba dejando el `IngresoRendido` huérfano.
      const ingresosRendidosQueLoApuntan = await tx.ingresoRendido.count({ where: { refId: id } });
      if (
        !sePuedeBorrarGastoDeCaja({
          gastosRendidosQueLoApuntan,
          ingresosRendidosQueLoApuntan,
          descontadoEnRendicion: mov.descontadoEnRendicion,
        })
      ) {
        return { count: 0 };
      }
      // Se conserva `descontadoEnRendicion: false` en el where del delete además del chequeo
      // de arriba: es el candado ATÓMICO contra una rendición concurrente, que es lo que este
      // deleteMany vino a resolver.
      return tx.movimientoCaja.deleteMany({
        where: { id, inmobiliariaId: u.inmobiliariaId, descontadoEnRendicion: false },
      });
    });
    if (res.count === 0) {
      return reply
        .code(409)
        .send({ message: 'Ya fue descontado en una rendición — no se puede eliminar' });
    }
    // Best effort: liberar el comprobante del Volume (mismo patrón que documentos).
    if (mov.comprobanteUrl) {
      const urlMov = mov.comprobanteUrl;
      await borrarArchivoSiHuerfano(urlMov, u.inmobiliariaId);
    }
    await registrarEvento({
      inmobiliariaId: u.inmobiliariaId,
      tipo: 'GASTO_CAJA_ELIMINADO',
      autorId: u.userId,
      rolAutor: u.rol,
      entidadId: id,
      entidadDescripcion: 'Gasto de caja eliminado',
    });
    return { ok: true };
  });

  // ===== Rendiciones (cierra el loop caja→rendición) =====
  //
  // ⚠️ El listado NO filtra por `Propietario.activo`, y es a propósito: una
  // rendición es plata que YA se movió. Ocultar las de un propietario dado de baja
  // haría que los totales históricos dejaran de cuadrar, y el que audita vería
  // menos plata de la que salió. La baja lógica corta el acceso al portal; el
  // historial contable no se toca.
  app.get('/rendiciones', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'pagos.ver');
    if (!u) return;
    const q = z
      .object({ propietarioId: z.string().optional(), incluirAnuladas: z.string().optional() })
      .parse(request.query ?? {});
    return prisma.rendicion.findMany({
      where: {
        inmobiliariaId: u.inmobiliariaId,
        ...(q.propietarioId ? { propietarioId: q.propietarioId } : {}),
        // POR DEFAULT, SÓLO LAS VIGENTES.
        //
        // Desde la baja lógica la fila anulada sobrevive, y este endpoint lo consumen varias
        // pantallas que preguntan "¿ya se le rindió?": el badge Rendido de la ficha, el KPI de
        // "por rendir", el neto histórico, el botón de mandar el comprobante por WhatsApp.
        // Ninguna sabía de la baja lógica, así que anular dejaba de tener efecto apenas se
        // recargaba la página: el badge volvía a decir Rendido y el total seguía sumando plata
        // que se deshizo.
        //
        // Excluirlas por default devuelve a todas esas pantallas la semántica que ya tenían
        // —con el borrado duro, la anulada no estaba— sin tocar ninguna. Quien quiera verlas,
        // que las pida: es UNA pantalla (el historial del propietario) contra cinco que no.
        ...(q.incluirAnuladas === '1' ? {} : { anuladaAt: null }),
      },
      include: { gastos: true, propietario: { select: { nombre: true, apellido: true } } },
      // DOS criterios, no uno. Con `periodo` solo, el orden DENTRO de un período queda a
      // gusto del planner, y un período puede tener varias rendiciones: la incremental de
      // cada tanda de parciales, y una por moneda cuando el dueño cobra en pesos y dólares.
      // El panel se queda con una sola por (dueño, período), así que sin desempate elegía
      // una arbitraria — y de ahí salen el monto del comprobante de WhatsApp y el botón de
      // Deshacer.
      orderBy: [{ periodo: 'desc' }, { rendidoAt: 'desc' }],
    });
  });

  app.post('/rendiciones', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'rendicion.confirmar');
    if (!u) return;
    const body = z
      .object({
        propietarioId: z.string(),
        periodo: z.string().regex(/^\d{4}-\d{2}$/),
        metodo: z.enum(['TRANSFERENCIA', 'MERCADOPAGO', 'EFECTIVO']).default('TRANSFERENCIA'),
        pin: z.string().optional(),
        notas: z.string().optional(),
        // Acota la rendición a UNA moneda. Es la salida del 409 de abajo: el mensaje
        // decía "rendí cada moneda por separado" y no había con qué hacerlo.
        moneda: z.enum(['ARS', 'USD']).optional(),
      })
      .safeParse(request.body ?? {});
    if (!body.success)
      return reply.code(400).send({ message: 'Datos de la rendición incompletos' });
    if (!(await verificarPin(u.userId, body.data.pin, reply))) return;

    const { propietarioId, periodo, moneda: monedaPedida } = body.data;
    const owner = await prisma.propietario.findFirst({
      where: { id: propietarioId, inmobiliariaId: u.inmobiliariaId },
      include: { participaciones: { include: { propiedad: true } } },
    });
    if (!owner) return reply.code(404).send({ message: 'Propietario inexistente' });
    // EL CBU SÓLO HACE FALTA PARA TRANSFERIR.
    //
    // Este 409 era incondicional, antes de mirar el método, aunque el zod de arriba acepta
    // EFECTIVO y MERCADOPAGO y el campo se persiste tal cual. O sea que al dueño que pasa a
    // buscar la plata en efectivo por la oficina —que es justamente el que no tiene CBU
    // cargado— no se le podía rendir por ningún camino.
    //
    // El panel ya asumía esto: el botón de rendir sólo se deshabilita por CBU faltante cuando
    // el método es TRANSFERENCIA (`rendir-propietario-dialog.tsx`). O sea que ofrecía el
    // efectivo, lo recomendaba, y el server lo rechazaba.
    if (body.data.metodo === 'TRANSFERENCIA' && !owner.cbuAlias)
      return reply
        .code(409)
        .send({ message: 'El propietario no tiene CBU cargado — pedíselo antes de rendir, o rendile en efectivo' });

    // Bruto INCREMENTAL: alquiler COBRADO hasta ahora (PAGADO + PARCIAL conciliado)
    // de las propiedades del dueño, × participación, MENOS lo ya rendido de cada
    // liquidación. Así un mes se rinde en varias tandas (a medida que entran los
    // parciales) sin doble-rendir. Antes tomaba sólo estado=PAGADO (mes completo) y
    // el @@unique impedía rendir dos veces → el parcial cobrado no llegaba al dueño.
    const propIds = owner.participaciones.map((p) => p.propiedadId);
    const liqsCobradas = await prisma.liquidacion.findMany({
      where: {
        inmobiliariaId: u.inmobiliariaId,
        periodo,
        estado: { in: ['PAGADO', 'PARCIAL'] },
        contrato: { propiedadId: { in: propIds }, modoCobranza: 'INMOBILIARIA' },
        // Acotar por moneda es lo que hace rendible al dueño que cobra en pesos Y en
        // dólares el mismo mes. Sin esto quedaba trabado para siempre: como máximo se
        // rendía UNA de las dos (la que cobró primero) y la otra ya no salía nunca,
        // porque la moneda ya rendida seguía envenenando el chequeo en cada intento.
        ...(monedaPedida ? { moneda: monedaPedida } : {}),
      },
      include: {
        contrato: { select: { propiedadId: true, propiedad: { select: { direccion: true } } } },
      },
    });
    // Una sola moneda por rendición (la Rendicion guarda un monto). Si el operador no
    // eligió cuál y hay mezcla → 409 pidiéndole que elija, ahora sí con la forma de hacerlo.
    const monedas = [...new Set(liqsCobradas.map((l) => l.moneda))];
    const monedaRendicion = monedaPedida ?? monedas[0] ?? 'ARS';
    if (monedas.length > 1) {
      return reply.code(409).send({
        message: `Este propietario tiene cobros en varias monedas (${monedas.join(', ')}) en ${periodo}. Elegí cuál rendir: se hace una rendición por moneda.`,
        monedas,
      });
    }
    // TODO EL CÁLCULO + ESCRITURA va DENTRO de UNA tx con advisory lock por
    // dueño+período. Antes las lecturas (lo ya rendido, cobrado, gastos) corrían
    // FUERA de la tx: dos rendiciones concurrentes del MISMO dueño+período leían
    // ambas "ya rendido"=0, construían el mismo AlquilerRendido y creaban dos
    // rendiciones → el dueño quedaba rendido DOS veces. Con el lock, la 2ª espera
    // el commit de la 1ª y RE-LEE lo ya rendido adentro, viendo lo recién rendido.
    let rendicion;
    try {
      rendicion = await prisma.$transaction(
        async (tx) => {
          // hashtext(int4)×2 → overload pg_advisory_xact_lock(int4,int4). Se libera
          // al terminar la tx. Serializa SOLO este dueño+período (no bloquea otros).
          // $executeRaw (no $queryRaw): pg_advisory_xact_lock devuelve void y
          // $queryRaw no puede deserializar esa columna → 500. $executeRaw ejecuta
          // el lock e ignora el result set.
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${u.inmobiliariaId}), hashtext(${`${propietarioId}|${periodo}`}))`;

          // ¿YA SE RINDIÓ ESTE PERÍODO, ANTES DE QUE EXISTIERA EL LEDGER?
          //
          // Es la misma regla que `lib/rendicion-pendiente.ts` aplica del lado de lectura, y
          // hasta acá vivía SÓLO ahí: el pendiente tapaba el período pero el write path no
          // tenía con qué frenar, así que rendirlo de nuevo pagaba dos veces en silencio.
          //
          // `anuladaAt: null` es imprescindible y no es simetría cosmética: al anular se
          // borran las líneas y se conserva la cabecera, así que una anulada se ve EXACTAMENTE
          // igual que una pre-ledger. En la anulada, volver a rendir es lo correcto.
          const preLedger = await tx.rendicion.findFirst({
            where: {
              inmobiliariaId: u.inmobiliariaId,
              propietarioId,
              periodo,
              anuladaAt: null,
              alquileresRendidos: { none: {} },
            },
            select: { rendidoAt: true },
            orderBy: { rendidoAt: 'desc' },
          });
          if (preLedger) throw new RendicionPreLedger(preLedger.rendidoAt);

          // Cobrado (CONCILIADO) + lo YA rendido a ESTE dueño por liq — leído DENTRO
          // del lock para ver lo que otra rendición del período ya committeó.
          const liqIds = liqsCobradas.map((l) => l.id);
          const cobradoRows = await tx.pago.groupBy({
            by: ['liquidacionId'],
            where: {
              liquidacionId: { in: liqIds },
              estado: 'CONCILIADO',
              // La deuda condonada no se le rinde al propietario: no entró esa plata.
              condonado: false,
              // Y la de la MIGRACIÓN DE CARTERA tampoco, por el mismo motivo y con más
              // consecuencia: el alta de un contrato en curso registra hasta 120 períodos
              // pasados como pagados para que el saldo del inquilino arranque bien, pero esa
              // plata la cobró la inmobiliaria antes de usar el sistema y ya se la liquidó al
              // dueño por fuera. Sin este filtro, rendir uno de esos períodos le transfiere de
              // nuevo algo que ya tiene. Y el guard de `sinRendir` usa el mismo criterio, así
              // que si acá no estuviera, las dos cuentas dirían cosas distintas.
              migradoDeCartera: false,
            },
            _sum: { monto: true },
          });
          const cobradoMap = new Map(
            cobradoRows.map((row) => [row.liquidacionId, Number(row._sum.monto ?? 0)]),
          );
          const prevRend = await tx.alquilerRendido.groupBy({
            by: ['liquidacionId'],
            where: { liquidacionId: { in: liqIds }, rendicion: { propietarioId } },
            _sum: { monto: true },
          });
          const yaRendMap = new Map(
            prevRend.map((row) => [row.liquidacionId, Number(row._sum.monto ?? 0)]),
          );
          // Lo ya rendido por TODOS los dueños de cada liq (sin filtrar por
          // propietarioId). Sirve para capear el total rendido de una liquidación al
          // alquiler cobrado: si se editó el reparto (un dueño vendió su parte)
          // DESPUÉS de rendir el período al set anterior, el nuevo dueño cobraría su
          // porción ENCIMA de lo ya pagado → la inmobiliaria terminaba rindiendo más
          // que lo cobrado. El cap garantiza Σ rendido por liq ≤ alquiler cobrado.
          const prevRendTotal = await tx.alquilerRendido.groupBy({
            by: ['liquidacionId'],
            where: { liquidacionId: { in: liqIds } },
            _sum: { monto: true },
          });
          const yaRendTotalMap = new Map(
            prevRendTotal.map((row) => [row.liquidacionId, Number(row._sum.monto ?? 0)]),
          );

          let montoBruto = 0;
          const alquilerData: {
            inmobiliariaId: string;
            liquidacionId: string;
            periodo: string;
            monto: number;
            participacion: number;
            propiedadId: string;
            direccion: string;
          }[] = [];
          for (const liq of liqsCobradas) {
            const part = owner.participaciones.find(
              (p) => p.propiedadId === liq.contrato.propiedadId,
            );
            // Acá había un `?? 100`. Hoy es inalcanzable —`propIds` sale de
            // `owner.participaciones`, así que el find siempre matchea— pero es una mina: el
            // día que alguien filtre las participaciones por una ventana de vigencia (que es
            // justo lo que pide T-23-N3), un find que no matchea le rendía el alquiler ENTERO
            // a este dueño, en silencio y sin rastro. Que falle ruidoso mientras el cambio es
            // un no-op verificable es mucho más barato que descubrirlo con una transferencia.
            if (!part) throw new ParticipacionAusente(liq.contrato.propiedadId);
            const porcentaje = part.porcentaje;
            const total = Number(liq.montoTotal);
            // Porción de ALQUILER de lo cobrado, capeada a la base (`montoTotal` sin mora): un
            // pago con mora hace cobrado > total y sin cap la porción de alquiler superaba
            // montoAlquiler×participación → se rendía de más y se comisionaba sobre la mora
            // (viola "comisión sólo sobre alquiler").
            //
            // La regla vive UNA sola vez, en `@llave/shared/prorrateo`. Este es el lugar donde
            // esa cuenta mueve plata de verdad; los otros tres la mostraban.
            const alquilerCobrado = porcionAlquilerCobrada({
              alquiler: Number(liq.montoAlquiler),
              base: total,
              cobrado: cobradoMap.get(liq.id) ?? 0,
            });
            const parteOwner = alquilerCobrado * (porcentaje / 100);
            const yaRend = yaRendMap.get(liq.id) ?? 0;
            const yaRendTotal = yaRendTotalMap.get(liq.id) ?? 0;
            // Doble cap: (1) lo que le falta a ESTE dueño de su parte, y (2) el
            // remanente de alquiler cobrado de la liq sumando TODOS los dueños. El (2)
            // evita el sobre-pago cuando se cambió el reparto tras rendir el período.
            const rendible = Math.min(r2c(parteOwner - yaRend), r2c(alquilerCobrado - yaRendTotal));
            if (rendible <= 0) continue; // ya se rindió todo lo cobrado de esta liq (a este dueño o entre todos)
            montoBruto += rendible;
            alquilerData.push({
              inmobiliariaId: u.inmobiliariaId,
              liquidacionId: liq.id,
              periodo,
              monto: rendible,
              participacion: porcentaje,
              propiedadId: liq.contrato.propiedadId,
              direccion: liq.contrato.propiedad?.direccion ?? '—',
            });
          }
          montoBruto = r2c(montoBruto);
          if (montoBruto <= 0) throw new RendicionSinCobros();

          // Gastos pendientes del período (dentro del lock, misma foto que el bruto).
          const propIdsConIngreso = [...new Set(liqsCobradas.map((l) => l.contrato.propiedadId))];
          const inicioPeriodo = new Date(`${periodo}-01T00:00:00.000Z`);
          const finPeriodo = new Date(inicioPeriodo);
          finPeriodo.setUTCMonth(finPeriodo.getUTCMonth() + 1);
          const gastosPend = await tx.movimientoCaja.findMany({
            where: {
              inmobiliariaId: u.inmobiliariaId,
              propiedadId: { in: propIdsConIngreso },
              tipo: 'GASTO',
              // Sólo los de la MISMA moneda que la rendición: un gasto en pesos no puede
              // restarse del neto de una rendición en dólares (la rendición guarda un solo
              // monto y ya exige una moneda única del lado de las liquidaciones).
              moneda: monedaRendicion,
              descontadoEnRendicion: false,
              // CARRY-OVER: todo gasto pendiente ANTERIOR al fin del período, no sólo los del
              // mes. Con la ventana estricta (`gte: inicioPeriodo`), un gasto cargado tarde
              // —o de un mes ya rendido— quedaba huérfano para siempre: rendir ese período de
              // nuevo daba 409 "sin cobros nuevos" y el período siguiente ya no lo miraba, así
              // que la inmobiliaria nunca lo recuperaba del dueño. El anti-doble no es la
              // fecha sino `descontadoEnRendicion`. Mismo criterio que ya usaban los reclamos
              // (`resueltoAt: { lt: finPeriodo }`), que no se había replicado acá.
              fecha: { lt: finPeriodo },
            },
            include: { propiedad: { select: { direccion: true } } },
          });
          const comisionMonto = r2c(montoBruto * (owner.comisionPct / 100));
          // Lo que ESTE dueño ya tiene rendido de cada gasto. Sin este cap, la parte se
          // calculaba siempre sobre el monto total: en multi-dueño el movimiento queda
          // `descontadoEnRendicion=false` hasta que las partes cubren el 100%, así que una
          // SEGUNDA rendición del MISMO dueño+período (flujo normal: entra otra tanda de
          // alquiler) volvía a tomar el gasto entero y le descontaba su parte DOS VECES —
          // y encima marcaba el gasto como cubierto, dejando al co-dueño sin pagar la suya.
          // Es el mismo cap que el alquiler ya hacía con yaRendMap.
          const gastoIds = gastosPend.map((g) => g.id);
          const míoGastos = gastoIds.length
            ? await tx.gastoRendido.groupBy({
                by: ['refId'],
                where: { refId: { in: gastoIds }, tipo: 'CAJA', rendicion: { propietarioId } },
                _sum: { monto: true },
              })
            : [];
          const míoGastoMap = new Map(míoGastos.map((r) => [r.refId, Number(r._sum.monto ?? 0)]));
          // Tope GLOBAL (todos los dueños juntos), además del tope por dueño de arriba. El
          // cap por dueño solo evita que a UNA persona se le cobre dos veces su parte; no
          // impide que la inmobiliaria recaude más que el gasto cuando el reparto CAMBIA.
          // Caso real: A 50% rinde su mitad; después se re-arma la participación y B pasa a
          // 100% → a B "le toca" el total y nunca rindió nada, así que paga el gasto entero
          // sobre la mitad que A ya pagó. Con el tope global, entre todos nunca se recauda
          // más que el monto del gasto.
          const rendidoGastos = gastoIds.length
            ? await tx.gastoRendido.groupBy({
                by: ['refId'],
                where: { refId: { in: gastoIds }, tipo: 'CAJA' },
                _sum: { monto: true },
              })
            : [];
          const rendidoGastoMap = new Map(
            rendidoGastos.map((r) => [r.refId, Number(r._sum.monto ?? 0)]),
          );

          let totalGastos = 0;
          const gastosData = gastosPend.flatMap((g) => {
            // `propiedadId` es nullable desde que existen los gastos propios de la
            // inmobiliaria (oficina, sueldos). Acá nunca debería entrar uno —la query
            // filtra por `propiedadId IN propIdsConIngreso`— pero se saltea explícitamente
            // en vez de asumirlo: un gasto sin propiedad NO se le rinde a ningún dueño.
            if (!g.propiedadId || !g.propiedad) return [];
            const part = owner.participaciones.find((p) => p.propiedadId === g.propiedadId);
            // Misma mina que en el bucle de alquileres, y por la misma razón: hoy no se
            // alcanza —`propIdsConIngreso` es un subconjunto de las propiedades del dueño—
            // pero un `?? 100` le cargaría el gasto ENTERO a alguien que tiene una parte.
            if (!part) throw new ParticipacionAusente(g.propiedadId);
            const porcentaje = part.porcentaje;
            const parteOwner = r2c(
              parteRendible({
                montoTotal: Number(g.monto),
                porcentaje,
                yaRendidoPorMi: míoGastoMap.get(g.id) ?? 0,
                yaRendidoGlobal: rendidoGastoMap.get(g.id) ?? 0,
              }),
            );
            // Ya rindió todo lo suyo de este gasto: no vuelve a entrar.
            if (parteOwner <= 0.009) return [];
            totalGastos += parteOwner;
            return [
              {
                inmobiliariaId: u.inmobiliariaId,
                refId: g.id,
                tipo: 'CAJA' as const,
                fecha: g.fecha,
                descripcion: g.descripcion,
                proveedor: g.proveedor,
                monto: parteOwner,
                montoTotal: g.monto,
                participacion: porcentaje,
                propiedadId: g.propiedadId,
                direccion: g.propiedad.direccion,
              },
            ];
          });

          // Reclamos resueltos con el costo A CARGO DEL PROPIETARIO: entran a la rendición
          // como GastoRendido tipo TRABAJO (refId `reclamo:<id>`). Antes NO impactaban — el
          // costo quedaba sólo en el reclamo y nunca se descontaba al dueño.
          // CARRY-OVER (fix R22): tomamos los resueltos HASTA el cierre del período (no solo
          // los del mismo mes). Antes, un reclamo resuelto en un mes ya rendido (o en una
          // propiedad sin ingreso ese mes) quedaba fuera de la ventana y el costo desaparecía
          // para siempre. El dedup por `refId` (abajo) garantiza que entre UNA sola vez: una
          // vez rendido, el `GastoRendido reclamo:<id>` existe y lo excluye de futuras rendiciones.
          const reclamosProp = await tx.reclamo.findMany({
            where: {
              inmobiliariaId: u.inmobiliariaId,
              pagador: 'PROPIETARIO',
              estado: { in: ['RESUELTO', 'CERRADO'] },
              costoTrabajo: { gt: 0 },
              propiedadId: { in: propIdsConIngreso },
              resueltoAt: { lt: finPeriodo },
              // Moneda, como ya filtraban los otros dos descuentos. `Reclamo` no tiene columna
              // de moneda —`costoTrabajo` es un Decimal pelado— así que sale del contrato, que
              // es de donde la toma la imputación al inquilino (`operacion.ts`).
              //
              // Sin esto, el número correcto se restaba en la moneda equivocada, y en los dos
              // sentidos: como la query trae los reclamos por PROPIEDAD y sin piso de fecha, un
              // reclamo de un contrato ANTERIOR en pesos entraba a una rendición en dólares y
              // restaba US$350.000 del neto —el dueño no podía cobrar, con un 409 de neto
              // negativo que encima lo manda a revisar gastos de caja que no son el problema— y
              // al revés, un reclamo de US$800 se restaba como $800 y la inmobiliaria se comía
              // el arreglo entero.
              contrato: { moneda: monedaRendicion },
            },
            include: { propiedad: { select: { direccion: true } } },
          });
          // Dedup POR COBERTURA de ESTE dueño, no por existencia del refId. El dedup viejo
          // era un Set binario sobre TODAS las rendiciones: apenas el dueño A rendía su 50%,
          // el `GastoRendido reclamo:<id>` existía y el dueño B quedaba excluido PARA SIEMPRE
          // → la inmobiliaria se comía la mitad del arreglo. Ahora cada dueño paga su parte
          // (y sólo una vez), igual que los gastos de caja.
          const reclamoRefIds = reclamosProp.map((rec) => `reclamo:${rec.id}`);
          const míoReclamos = reclamoRefIds.length
            ? await tx.gastoRendido.groupBy({
                by: ['refId'],
                where: {
                  refId: { in: reclamoRefIds },
                  tipo: 'TRABAJO',
                  rendicion: { propietarioId },
                },
                _sum: { monto: true },
              })
            : [];
          const míoReclamoMap = new Map(
            míoReclamos.map((r) => [r.refId, Number(r._sum.monto ?? 0)]),
          );
          // Tope GLOBAL, igual que en los gastos de caja — y acá es todavía más necesario:
          // el reclamo no tiene NINGÚN estado terminal (el gasto de caja al menos se cierra
          // con descontadoEnRendicion cuando las partes cubren el 100%), así que sin este
          // tope la query lo vuelve a traer para cada dueño nuevo de la propiedad, para
          // siempre. Al vender la propiedad, el dueño entrante se comía entero un arreglo
          // que el saliente ya había pagado, y si era grande frente al alquiler ni siquiera
          // podía cobrar su rendición: saltaba 409 por neto negativo, mandándolo a revisar
          // gastos de caja que no existen.
          const rendidoReclamos = reclamoRefIds.length
            ? await tx.gastoRendido.groupBy({
                by: ['refId'],
                where: { refId: { in: reclamoRefIds }, tipo: 'TRABAJO' },
                _sum: { monto: true },
              })
            : [];
          const rendidoReclamoMap = new Map(
            rendidoReclamos.map((r) => [r.refId, Number(r._sum.monto ?? 0)]),
          );
          const gastosReclamos = reclamosProp
            .filter((rec) => rec.propiedadId != null)
            .flatMap((rec) => {
              // El `.filter` de arriba ya descartó los null, pero se vuelve a chequear acá
              // porque es lo que le da a TS la certeza —y porque el guard de abajo necesita
              // un id de verdad para decir CUÁL propiedad revisar.
              if (!rec.propiedadId) return [];
              const part = owner.participaciones.find((p) => p.propiedadId === rec.propiedadId);
              // Misma mina que en alquileres: el costo del arreglo se repartiría entero.
              if (!part) throw new ParticipacionAusente(rec.propiedadId);
              const porcentaje = part.porcentaje;
              const total = Number(rec.costoTrabajo);
              const parteOwner = r2c(
                parteRendible({
                  montoTotal: total,
                  porcentaje,
                  yaRendidoPorMi: míoReclamoMap.get(`reclamo:${rec.id}`) ?? 0,
                  yaRendidoGlobal: rendidoReclamoMap.get(`reclamo:${rec.id}`) ?? 0,
                }),
              );
              if (parteOwner <= 0.009) return [];
              totalGastos += parteOwner;
              return [
                {
                  inmobiliariaId: u.inmobiliariaId,
                  refId: `reclamo:${rec.id}`,
                  tipo: 'TRABAJO' as const,
                  fecha: rec.resueltoAt ?? rec.updatedAt,
                  descripcion: descripcionDeReparacion(rec.costoTrabajoNotas, rec.categoria),
                  proveedor: null as string | null,
                  monto: parteOwner,
                  montoTotal: total,
                  participacion: porcentaje,
                  propiedadId: rec.propiedadId as string,
                  direccion: rec.propiedad?.direccion ?? '—',
                },
              ];
            });

          totalGastos = r2c(totalGastos);

          // Ingresos extra de caja (INGRESO_EXTRA) del período: plata que entró por
          // la propiedad (ej. un reintegro del propietario) y que le CORRESPONDE al
          // dueño → SUMAN al neto. Antes la rendición solo restaba gastos y jamás
          // sumaba estos ingresos: la plata quedaba en la caja sin rendir nunca.
          // Misma ventana que los gastos (período + propiedades con ingreso). Multi-
          // dueño: se rinde POR PARTES (× %) y se marca el movimiento como descontado
          // SOLO cuando las partes cubren el total (igual que los gastos, con ledger
          // IngresoRendido) — sino un co-dueño se quedaba sin su parte.
          const ingresosPend = await tx.movimientoCaja.findMany({
            where: {
              inmobiliariaId: u.inmobiliariaId,
              propiedadId: { in: propIdsConIngreso },
              tipo: 'INGRESO_EXTRA',
              moneda: monedaRendicion, // idem gastos: no mezclar monedas en el neto
              descontadoEnRendicion: false,
              // CARRY-OVER, igual que los gastos: un ingreso cargado tarde no puede quedar
              // varado. Acá el perjudicado es el PROPIETARIO — es plata suya que nunca se le
              // rendía. El anti-doble sigue siendo `descontadoEnRendicion`, no la fecha.
              fecha: { lt: finPeriodo },
            },
            include: { propiedad: { select: { direccion: true } } },
          });
          // Mismo cap por dueño que gastos y reclamos. Acá el error se paga al revés: sin
          // cap, una segunda rendición del mismo dueño+período le ACREDITABA su parte otra
          // vez (cobraba el ingreso entero de una propiedad que comparte al 50%) y el
          // co-dueño no veía un peso. Es plata que sale de la caja de la inmobiliaria.
          const ingresoIds = ingresosPend.map((m) => m.id);
          const míoIngresos = ingresoIds.length
            ? await tx.ingresoRendido.groupBy({
                by: ['refId'],
                where: { refId: { in: ingresoIds }, rendicion: { propietarioId } },
                _sum: { monto: true },
              })
            : [];
          const míoIngresoMap = new Map(
            míoIngresos.map((r) => [r.refId, Number(r._sum.monto ?? 0)]),
          );
          // Tope GLOBAL, el que faltaba. Los gastos de caja y los reclamos ya lo tenían
          // (el tope global que ya tenían, más arriba); el espejo nunca se aplicó a los ingresos, y acá el
          // error se paga con plata que SALE de la caja de la inmobiliaria: con sólo el cap por
          // dueño, un ingreso de $100 en una propiedad de A(50%) y B(50%) se acreditaba $50 a A y
          // —si después se re-arma la participación y B pasa a 100%— $100 más a B. $150
          // acreditados sobre $100 que entraron. Y peor: el movimiento queda marcado como cubierto
          // (50+100 >= 100), así que el caso se cierra solo y no vuelve a aparecer para auditarlo.
          const rendidoIngresos = ingresoIds.length
            ? await tx.ingresoRendido.groupBy({
                by: ['refId'],
                where: { refId: { in: ingresoIds } },
                _sum: { monto: true },
              })
            : [];
          const rendidoIngresoMap = new Map(
            rendidoIngresos.map((r) => [r.refId, Number(r._sum.monto ?? 0)]),
          );

          let totalIngresos = 0;
          const ingresosData = ingresosPend.flatMap((mov) => {
            // Mismo criterio que los gastos: un ingreso extra sin propiedad es de la
            // inmobiliaria y no se reparte a ningún propietario.
            if (!mov.propiedadId || !mov.propiedad) return [];
            const part = owner.participaciones.find((p) => p.propiedadId === mov.propiedadId);
            // Misma mina que en alquileres, y acá es plata que ENTRA: un `?? 100` le
            // acreditaría el ingreso completo a un dueño que tiene una fracción.
            if (!part) throw new ParticipacionAusente(mov.propiedadId);
            const porcentaje = part.porcentaje;
            const parteOwner = r2c(
              parteRendible({
                montoTotal: Number(mov.monto),
                porcentaje,
                yaRendidoPorMi: míoIngresoMap.get(mov.id) ?? 0,
                yaRendidoGlobal: rendidoIngresoMap.get(mov.id) ?? 0,
              }),
            );
            if (parteOwner <= 0.009) return [];
            totalIngresos += parteOwner;
            return [
              {
                inmobiliariaId: u.inmobiliariaId,
                refId: mov.id,
                fecha: mov.fecha,
                descripcion: mov.descripcion,
                monto: parteOwner,
                montoTotal: mov.monto,
                participacion: porcentaje,
                propiedadId: mov.propiedadId,
                direccion: mov.propiedad.direccion,
              },
            ];
          });
          totalIngresos = r2c(totalIngresos);

          const montoNeto = r2c(montoBruto - comisionMonto - totalGastos + totalIngresos);
          if (montoNeto < 0) {
            throw new RendicionNetoNegativo({
              bruto: montoBruto,
              comision: comisionMonto,
              gastos: totalGastos,
              ingresos: totalIngresos,
              moneda: monedaRendicion,
            });
          }

          const r = await tx.rendicion.create({
            data: {
              inmobiliariaId: u.inmobiliariaId,
              propietarioId,
              periodo,
              montoBruto,
              comisionPct: owner.comisionPct,
              comisionMonto,
              totalGastos,
              totalIngresos,
              montoNeto,
              // La moneda que este mismo handler ya calculó y usó para los gastos, los ingresos
              // y los movimientos de caja. Sin guardarla, aguas abajo hay que adivinarla — y el
              // portal del propietario adivinaba pesos siempre.
              moneda: monedaRendicion,
              metodo: body.data.metodo,
              notas: body.data.notas,
            },
          });
          if (ingresosData.length > 0) {
            // Igual que los gastos (multi-dueño): cada ingreso se rinde por PARTES;
            // se marca descontado-total SOLO cuando las partes rendidas cubren el
            // monto. Sin esto, al rendir al 1er dueño se marcaba completo y los
            // co-dueños perdían su parte (quedaba varada en caja).
            const ids = ingresosPend.map((m) => m.id);
            const previas = await tx.ingresoRendido.groupBy({
              by: ['refId'],
              where: { refId: { in: ids } },
              _sum: { monto: true },
            });
            const yaRendido = new Map(previas.map((p) => [p.refId, Number(p._sum.monto ?? 0)]));
            await tx.ingresoRendido.createMany({
              data: ingresosData.map((g) => ({ ...g, rendicionId: r.id })),
            });
            const idsCompletos = ingresosData
              .filter(
                (g) =>
                  (yaRendido.get(g.refId) ?? 0) + Number(g.monto) >= Number(g.montoTotal) - 0.01,
              )
              .map((g) => g.refId);
            if (idsCompletos.length > 0) {
              const upd = await tx.movimientoCaja.updateMany({
                where: { id: { in: idsCompletos }, descontadoEnRendicion: false },
                data: { descontadoEnRendicion: true, rendicionId: r.id },
              });
              if (upd.count !== idsCompletos.length) throw new GastoYaDescontado();
            }
          }
          if (alquilerData.length > 0) {
            await tx.alquilerRendido.createMany({
              data: alquilerData.map((a) => ({ ...a, rendicionId: r.id })),
            });
          }
          if (gastosData.length > 0) {
            // Cobranza compartida (propiedad multi-dueño): cada gasto se rinde por
            // PARTES; se marca descontado-total SOLO cuando las partes cubren el monto.
            const ids = gastosPend.map((g) => g.id);
            const previas = await tx.gastoRendido.groupBy({
              by: ['refId'],
              where: { refId: { in: ids }, tipo: 'CAJA' },
              _sum: { monto: true },
            });
            const yaRendido = new Map(previas.map((p) => [p.refId, Number(p._sum.monto ?? 0)]));
            await tx.gastoRendido.createMany({
              data: gastosData.map((g) => ({ ...g, rendicionId: r.id })),
            });
            const idsCompletos = gastosData
              .filter(
                (g) =>
                  (yaRendido.get(g.refId) ?? 0) + Number(g.monto) >= Number(g.montoTotal) - 0.01,
              )
              .map((g) => g.refId);
            if (idsCompletos.length > 0) {
              const upd = await tx.movimientoCaja.updateMany({
                where: { id: { in: idsCompletos }, descontadoEnRendicion: false },
                data: { descontadoEnRendicion: true, rendicionId: r.id },
              });
              // ABORT REAL: el comentario viejo prometía este chequeo pero el código no
              // lo hacía. Si otra rendición tomó un gasto entre el findMany y este
              // update (multi-dueño, distinta clave de advisory lock), el count no
              // cuadra → revertimos la tx para no descontar el gasto dos veces.
              if (upd.count !== idsCompletos.length) throw new GastoYaDescontado();
            }
          }
          if (gastosReclamos.length > 0) {
            await tx.gastoRendido.createMany({
              data: gastosReclamos.map((g) => ({ ...g, rendicionId: r.id })),
            });
          }
          return r;
        },
        // La rendición hace MUCHO adentro de la tx (advisory lock, varios groupBy del
        // ledger, createMany de alquileres/gastos/ingresos). Con el default de 5s de Prisma
        // ya rozaba el límite y fallaba con P2028 "Transaction already closed" apenas crecía
        // el trabajo — un error 500 opaco, y la plata sin rendir. El lock por dueño+período
        // sigue serializando, así que un timeout más holgado no aumenta la contención.
        { timeout: 30_000, maxWait: 10_000 },
      );
    } catch (e) {
      if (e instanceof ParticipacionAusente) {
        // No debería pasar nunca con el código de hoy. Si pasa, la alternativa era rendirle
        // el 100% del alquiler a este dueño sin que nadie se entere: mejor frenar y que
        // alguien mire el reparto.
        return reply.code(409).send({
          // Dice "movimientos" y no "una liquidación" porque el guard ya no es sólo el de
          // alquileres: también lo tiran los gastos, los arreglos de reclamos y los otros
          // ingresos (T-44-N2). Nombrar sólo uno mandaría a mirar el lugar equivocado.
          message:
            'No se puede rendir: hay movimientos de una propiedad en la que este propietario no ' +
            'figura en el reparto. Revisá los dueños de esa propiedad antes de rendir.',
          codigo: 'PARTICIPACION_AUSENTE',
          propiedadId: e.propiedadId,
        });
      }
      if (e instanceof RendicionSinCobros) {
        return reply
          .code(409)
          .send({
            message: `No hay cobros nuevos del período ${periodo} para rendir a este propietario`,
          });
      }
      if (e instanceof RendicionPreLedger) {
        const cuando = e.rendidoAt.toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });
        return reply.code(409).send({
          // El operador tiene que poder decidir sin salir a buscar: le decimos cuándo se
          // rindió y por qué el sistema no puede completar la diferencia solo.
          message:
            `El período ${periodo} ya se le rindió a este propietario el ${cuando}, antes de que el ` +
            `sistema guardara el detalle por cuota. Como de esa rendición no queda el desglose, no ` +
            `se puede calcular cuánto faltaría: rendirlo de nuevo le transferiría todo otra vez. Si ` +
            `de verdad quedó plata sin rendir de ese mes, anulá la rendición vieja y rendilo entero.`,
          codigo: 'RENDICION_PRE_LEDGER',
          rendidoAt: e.rendidoAt.toISOString(),
        });
      }
      if (e instanceof RendicionNetoNegativo) {
        const d = e.detalle;
        const sim = d.moneda === 'USD' ? 'US$' : '$';
        const falta = Math.round((d.gastos + d.comision - d.bruto - d.ingresos) * 100) / 100;
        return reply.code(409).send({
          // Los números, no una instrucción vaga: el operador tiene que poder decidir sin
          // salir a buscar. El faltante NO se arrastra solo a la próxima rendición —el
          // panel llegó a prometerlo y no es cierto—, así que el mensaje dice qué hacer.
          message:
            `No se puede rendir: los gastos (${sim}${d.gastos}) más la comisión (${sim}${d.comision}) ` +
            `superan por ${sim}${falta} lo cobrado (${sim}${d.bruto})` +
            (d.ingresos > 0 ? ` más los ingresos extra (${sim}${d.ingresos})` : '') +
            `. Cobrá más del período, cargá un ingreso extra por lo que el propietario aporte, ` +
            `o sacá de la caja el gasto que no corresponda. Ojo: puede tratarse del costo de un ` +
            `reclamo a cargo del propietario, que no figura en la lista de gastos de caja.`,
          detalle: d,
        });
      }
      if (e instanceof GastoYaDescontado) {
        return reply
          .code(409)
          .send({ message: 'Un gasto fue tomado por otra rendición al mismo tiempo. Reintentá.' });
      }
      throw e;
    }

    await registrarEvento({
      inmobiliariaId: u.inmobiliariaId,
      tipo: 'PROPIETARIO_RENDIDO',
      autorId: u.userId,
      rolAutor: u.rol,
      entidadId: rendicion.id,
      entidadDescripcion: `Rendición ${body.data.periodo} a propietario ${body.data.propietarioId} · neto $${Number(rendicion.montoNeto)}`,
    });
    return reply.code(201).send(rendicion);
  });

  // Anular/deshacer una rendición: la MARCA como anulada y deja los gastos otra vez
  // PENDIENTES para la próxima. No se movió plata real (la rendición es un registro), así
  // que es reversible. Requiere PIN y MOTIVO.
  //
  // La cabecera SOBREVIVE y las líneas de los tres ledgers se borran. El porqué está en el
  // docblock de `anuladaAt` en schema.prisma; el resumen es que 20 lugares leen esos ledgers
  // y filtrar "y que no esté anulada" en los 20 es garantizar que un día se olvide uno.
  //
  // ⚠️ Todo lector de la CABECERA sí tuvo que aprender de la baja lógica, y es donde estuvo
  // el riesgo: `GET /rendiciones` excluye las anuladas por default (si no, el panel volvía a
  // decir "Rendido" apenas se recargaba), y la regla pre-ledger de `rendicion-pendiente.ts`
  // también (si no, anular hacía DESAPARECER la plata del pendiente). Si agregás un lector
  // nuevo de esta tabla, decidí explícitamente de qué lado está.
  app.post('/rendiciones/:id/anular', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'rendicion.confirmar');
    if (!u) return;
    const { id } = request.params as { id: string };
    // EL MOTIVO ES OBLIGATORIO. Anular le saca un depósito de la pantalla a una persona que
    // ya lo vio; el rastro sin motivo dice qué pasó y no por qué, que es justo lo que va a
    // preguntar cuando llame. Mismo criterio que anular un pago (`observacion`, min 5).
    const parsed = z
      .object({ pin: z.string().optional(), motivo: z.string().trim().min(5) })
      .safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ message: 'Contá por qué se anula la rendición (mínimo 5 caracteres)' });
    }
    const body = parsed.data;
    if (!(await verificarPin(u.userId, body.pin, reply))) return;
    const r = await prisma.rendicion.findFirst({ where: { id, inmobiliariaId: u.inmobiliariaId } });
    if (!r) return reply.code(404).send({ message: 'Rendición inexistente' });
    // Se corta acá y no recién en el lock: el 409 temprano evita revertir movimientos que ya
    // se revirtieron en la primera anulación.
    if (r.anuladaAt) return reply.code(409).send({ message: 'La rendición ya fue anulada' });
    try {
      await prisma.$transaction(
        async (tx) => {
          // H-3: inmobiliariaId en los deletes/updates para que un id ajeno no opere
          // cross-tenant aunque la verificación previa ya lo garantice por FK.
          await tx.movimientoCaja.updateMany({
            where: { rendicionId: id, inmobiliariaId: u.inmobiliariaId },
            data: { descontadoEnRendicion: false, rendicionId: null },
          });

          // Qué movimientos tocaba esta rendición ANTES de borrar sus filas del ledger.
          // Hace falta para el recálculo de abajo: en multi-dueño el `rendicionId` del
          // movimiento apunta a la rendición que lo COMPLETÓ (la última), no a todas las que
          // aportaron, así que el updateMany de arriba no alcanza.
          const refsGasto = (
            await tx.gastoRendido.findMany({
              where: { rendicionId: id, tipo: 'CAJA' },
              select: { refId: true },
            })
          ).map((g) => g.refId);
          const refsIngreso = (
            await tx.ingresoRendido.findMany({
              where: { rendicionId: id },
              select: { refId: true },
            })
          ).map((g) => g.refId);

          await tx.gastoRendido.deleteMany({ where: { rendicionId: id } });
          // IngresoRendido cuelga con FK RESTRICT (igual que AlquilerRendido): borrarlo
          // ANTES del delete de la rendición, sino P2003. Al revertir el movimiento
          // (updateMany de arriba) el ingreso vuelve a quedar pendiente para rendir.
          await tx.ingresoRendido.deleteMany({ where: { rendicionId: id } });

          // REABRIR lo que dejó de estar cubierto. Escenario: gasto $100 entre dos dueños
          // 50/50. A rinde (ledger 50, movimiento sigue abierto), B rinde y COMPLETA →
          // `descontadoEnRendicion=true, rendicionId=<B>`. Si después se anula la rendición
          // de A, el updateMany de arriba no matchea (el movimiento apunta a B) pero la fila
          // de A sí se borró: el movimiento quedaba cerrado con sólo la mitad rendida y esos
          // $50 no se recuperaban NUNCA. Ahora recalculamos la cobertura real contra el
          // ledger que queda y reabrimos el movimiento si ya no está cubierto.
          const refsTocados = [...new Set([...refsGasto, ...refsIngreso])];
          if (refsTocados.length > 0) {
            const movs = await tx.movimientoCaja.findMany({
              where: {
                id: { in: refsTocados },
                inmobiliariaId: u.inmobiliariaId,
                descontadoEnRendicion: true,
              },
              select: { id: true, monto: true, tipo: true },
            });
            // Cobertura restante EN BATCH (dos groupBy), no una query por movimiento: dentro
            // de la transacción, el N+1 se comía el timeout y tiraba P2028 → 500.
            const [covGasto, covIngreso] = await Promise.all([
              tx.gastoRendido.groupBy({
                by: ['refId'],
                where: { refId: { in: refsTocados }, tipo: 'CAJA' },
                _sum: { monto: true },
              }),
              tx.ingresoRendido.groupBy({
                by: ['refId'],
                where: { refId: { in: refsTocados } },
                _sum: { monto: true },
              }),
            ]);
            const covGastoMap = new Map(covGasto.map((r) => [r.refId, Number(r._sum.monto ?? 0)]));
            const covIngresoMap = new Map(
              covIngreso.map((r) => [r.refId, Number(r._sum.monto ?? 0)]),
            );
            const reabrir = movs
              .filter((mov) => {
                const cubierto =
                  mov.tipo === 'INGRESO_EXTRA'
                    ? (covIngresoMap.get(mov.id) ?? 0)
                    : (covGastoMap.get(mov.id) ?? 0);
                return cubierto < Number(mov.monto) - 0.01;
              })
              .map((m) => m.id);
            if (reabrir.length > 0) {
              await tx.movimientoCaja.updateMany({
                where: { id: { in: reabrir }, inmobiliariaId: u.inmobiliariaId },
                data: { descontadoEnRendicion: false, rendicionId: null },
              });
            }
          }
          // Los AlquilerRendido cuelgan de la Rendicion con FK RESTRICT: sin borrarlos
          // ANTES, cuando esto borraba la rendición, la FK explotaba con P2003 → 500 SIEMPRE
          // (toda rendición real crea ≥1 AlquilerRendido). La anulación era imposible.
          await tx.alquilerRendido.deleteMany({ where: { rendicionId: id } });
          // BAJA LÓGICA: la cabecera se MARCA, no se borra. Las líneas de arriba sí se
          // borran, y eso es deliberado — ver el comentario de `anuladaAt` en el schema: 20
          // lugares leen esos ledgers y filtrar "y que no esté anulada" en los 20 es
          // garantizar que un día se olvide uno.
          //
          // Lock atómico: el updateMany CONDICIONADO A `anuladaAt: null` es el lock. Dos
          // anulaciones concurrentes pasan el findFirst de arriba a la vez; sólo la primera
          // matchea (count 1), la segunda ve 0 → 409. Antes el lock era el deleteMany; la
          // condición cambia pero la propiedad se mantiene.
          const del = await tx.rendicion.updateMany({
            where: { id, inmobiliariaId: u.inmobiliariaId, anuladaAt: null },
            data: {
              anuladaAt: new Date(),
              anuladaPorId: u.userId,
              motivoAnulacion: body.motivo,
            },
          });
          if (del.count === 0) throw new Error('YA_ANULADA');
        },
        // Igual que la tx de rendir: el default de 5s de Prisma queda corto y falla con
        // P2028 (500 opaco, anulación imposible) apenas la rendición tiene varias filas.
        { timeout: 30_000, maxWait: 10_000 },
      );
    } catch (e) {
      if (e instanceof Error && e.message === 'YA_ANULADA') {
        return reply.code(409).send({ message: 'La rendición ya fue anulada' });
      }
      throw e;
    }

    // El rastro de la anulación, que hasta acá no existía.
    //
    // Rendir registra `PROPIETARIO_RENDIDO`; anular borraba la fila y sus tres ledgers sin
    // escribir nada. Es el único registro de plata que el sistema destruye, y encima el único
    // que un TERCERO ya vio: al propietario se le desaparece del portal la tarjeta "Te
    // depositamos $X el 12/08", el total del año le baja solo y la plata le vuelve a figurar
    // como "cobrado y sin rendirte", sin una línea que lo explique. Si llama a preguntar, la
    // inmobiliaria tampoco tenía con qué contestarle.
    //
    // Se guarda el SNAPSHOT de los montos, porque la fila ya no está: es lo único que queda
    // para reconstruir qué se anuló. El paso siguiente —que la rendición quede marcada como
    // anulada en vez de borrarse, y el portal la muestre tachada— está anotado aparte.
    await registrarEvento({
      inmobiliariaId: u.inmobiliariaId,
      tipo: 'PROPIETARIO_RENDICION_ANULADA',
      autorId: u.userId,
      rolAutor: u.rol,
      entidadId: id,
      entidadDescripcion:
        `Anulada rendición ${r.periodo} de ${r.propietarioId} · ` +
        `neto ${r.moneda === 'USD' ? 'US$' : '$'}${Number(r.montoNeto)} · bruto ${Number(r.montoBruto)}`,
    });
    return { ok: true };
  });

  // ===== Aprobaciones (no-monetarias, con PIN) =====
  app.get('/aprobaciones', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'contratos.ver');
    if (!u) return;
    const aprobaciones = await prisma.aprobacion.findMany({
      where: { inmobiliariaId: u.inmobiliariaId },
      include: { cargadoPor: { select: { nombre: true, apellido: true, rol: true } } },
      orderBy: { cargadoAt: 'desc' },
    });

    // QUÉ SE ESTÁ APROBANDO. `Aprobacion` sólo guarda titulo/descripcion/monto y un
    // `entidadId` polimórfico, así que la bandeja mostraba "Aprobar / Rechazar" sin
    // ninguna forma de ver el contrato cargado. En la prueba del 03/08 la
    // administradora lo dijo con todas las letras: "me sale aprobar o rechazar pero no
    // puedo [verlo]" y "no pude visualizar lo que ella estaba cargando". Estaba
    // aprobando a ciegas altas que crean liquidaciones y ocupan una propiedad.
    //
    // Adjuntamos el contrato de las CONTRATO_CARGADO en una sola query (sin N+1),
    // scopeada por tenant. Los otros tipos no lo necesitan: hoy devuelven 501 al
    // aprobar y se resuelven en su propia pantalla.
    const idsContrato = aprobaciones
      .filter((a) => a.tipo === 'CONTRATO_CARGADO')
      .map((a) => a.entidadId);
    if (idsContrato.length === 0) return aprobaciones;

    const contratos = await prisma.contrato.findMany({
      where: { id: { in: idsContrato }, inmobiliariaId: u.inmobiliariaId },
      select: {
        id: true,
        monto: true,
        montoExpensas: true,
        moneda: true,
        fechaInicio: true,
        fechaFin: true,
        diaPago: true,
        depositoGarantia: true,
        modoCobranza: true,
        estado: true,
        periodosAnterioresPendientes: true,
        // `complejo` es el rótulo por el que la inmobiliaria realmente identifica la
        // unidad ("Lourdes 11 1ºA"), no la calle. Si además cuelga de un Consorcio
        // real, ese nombre manda.
        propiedad: {
          select: {
            direccion: true,
            ciudad: true,
            complejo: true,
            consorcio: { select: { nombre: true } },
          },
        },
        inquilinoTitular: {
          select: { nombre: true, apellido: true, email: true, telefono: true, dni: true },
        },
        garantes: { select: { id: true, nombreProveedor: true, tipo: true } },
        documentos: { select: { id: true } },
      },
    });
    const porId = new Map(contratos.map((c) => [c.id, c]));
    return aprobaciones.map((a) =>
      a.tipo === 'CONTRATO_CARGADO' ? { ...a, contrato: porId.get(a.entidadId) ?? null } : a,
    );
  });

  /**
   * Re-validación del estado inicial guardado en el borrador. Ya fue validado por el
   * Zod de POST /contratos al cargarlo, pero es una columna Json: la volvemos a
   * validar antes de tocar plata, en vez de castearla a ciegas.
   */
  const PeriodosAnterioresSchema = z
    .array(
      z.object({
        periodo: z.string().regex(/^\d{4}-\d{2}$/),
        estado: z.enum(['PAGADO', 'PARCIAL', 'ADEUDA']),
        montoPagado: dineroPositivo().optional(),
        moraManual: dinero().optional(),
      }),
    )
    .max(120);

  for (const accion of ['aprobar', 'rechazar'] as const) {
    app.post(`/aprobaciones/:id/${accion}`, async (request, reply) => {
      const u = await requireUsuario(request, reply, 'contrato.aprobar');
      if (!u) return;
      const { id } = request.params as { id: string };
      const body = z
        .object({ pin: z.string().optional(), comentario: z.string().optional() })
        .parse(request.body ?? {});
      if (accion === 'rechazar' && !(body.comentario && body.comentario.trim().length >= 5)) {
        return reply
          .code(400)
          .send({ message: 'Indicá el motivo del rechazo (mínimo 5 caracteres)' });
      }
      if (!(await verificarPin(u.userId, body.pin, reply))) return;

      // TODO atómico en una sola transacción: el updateMany condicionado por
      // estado='PENDIENTE' es el lock (solo la primera request gana), y la
      // activación del contrato + devengo van en la MISMA tx. Antes el update de
      // la aprobación y el del contrato eran awaits sueltos: si el segundo fallaba
      // (P2025, contrato borrado), la aprobación quedaba decidida pero el contrato
      // sin activar (commit parcial + falso error), y dos requests concurrentes
      // pasaban ambas el pre-check.
      const result = await prisma
        .$transaction(
          async (tx) => {
            const apr = await tx.aprobacion.findFirst({
              where: { id, inmobiliariaId: u.inmobiliariaId },
            });
            if (!apr) return { http: 404 as const };
            // APROBAR sólo sabe ejecutar CONTRATO_CARGADO. Los otros tres tipos
            // (DEVOLUCION_DEPOSITO, GASTO_CAJA_ELIMINACION, AJUSTE_FUERA_DE_INDICE)
            // caían igual en el updateMany de abajo: la fila quedaba APROBADA, el
            // panel mostraba el toast verde, y NO pasaba nada. En el seed hay una
            // devolución de depósito de $510.000 que se "aprobaba" y dejaba la
            // garantía RETENIDA. Preferimos fallar fuerte antes que mentir: mientras
            // no exista la ejecución, la aprobación queda PENDIENTE y visible.
            //
            // RECHAZAR sí funciona para todos los tipos: rechazar ES la acción
            // completa (no hay nada que ejecutar cuando la respuesta es "no").
            if (accion === 'aprobar' && apr.tipo !== 'CONTRATO_CARGADO') {
              return { http: 501 as const, tipo: apr.tipo };
            }
            const lock = await tx.aprobacion.updateMany({
              where: { id, inmobiliariaId: u.inmobiliariaId, estado: 'PENDIENTE' },
              data: {
                estado: accion === 'aprobar' ? 'APROBADA' : 'RECHAZADA',
                aprobadoPorId: u.userId,
                aprobadoAt: new Date(),
                comentarioAprobador: body.comentario,
              },
            });
            if (lock.count === 0) return { http: 409 as const };
            // Si es un contrato cargado, al aprobar pasa a ACTIVO / al rechazar queda BORRADOR sin pendiente.
            // H-4: updateMany con inmobiliariaId para defensa en profundidad (apr ya
            // está scoped pero el contrato.update usaría sólo el PK sin esa garantía).
            if (apr.tipo === 'CONTRATO_CARGADO') {
              await tx.contrato.updateMany({
                where: { id: apr.entidadId, inmobiliariaId: u.inmobiliariaId },
                data:
                  accion === 'aprobar'
                    ? { estado: 'ACTIVO', pendienteAprobacion: false, aprobadoAt: new Date() }
                    : // Al rechazar también se limpia el estado inicial declarado en el
                      // alta: el contrato rechazado nunca se va a aprobar, así que esa
                      // deuda histórica queda colgada para siempre si no la borramos acá.
                      // Prisma.DbNull (no `null` pelado): en un campo Json, `null` es
                      // ambiguo entre "borrar la columna" y "no tocarla".
                      { pendienteAprobacion: false, periodosAnterioresPendientes: Prisma.DbNull },
              });
              // Al aprobar, el contrato se activa → reclamar la propiedad + devengar
              // sus liquidaciones, IGUAL que POST /contratos (core.ts). Antes este path
              // activaba el contrato pero NUNCA reclamaba la propiedad: quedaba
              // DISPONIBLE para siempre y dos BORRADOR sobre la misma propiedad (p.ej.
              // cnt_006 + cnt_008) podían activarse ambos. El claim atómico
              // (WHERE contratoActualId=null) es a la vez la corrección (propiedad→
              // ALQUILADA) y el lock anti-doble-activación.
              if (accion === 'aprobar') {
                const contratoActualizado = await tx.contrato.findUniqueOrThrow({
                  where: { id: apr.entidadId },
                });
                const claim = await tx.propiedad.updateMany({
                  where: {
                    id: contratoActualizado.propiedadId,
                    inmobiliariaId: u.inmobiliariaId,
                    contratoActualId: null,
                  },
                  data: { contratoActualId: contratoActualizado.id, estado: 'ALQUILADA' },
                });
                if (claim.count === 0) throw new Error('PROP_OCUPADA');
                await generarLiquidacionesContrato(tx, contratoActualizado);
                // Estado inicial del contrato EN CURSO: el alta lo guardó en el borrador
                // porque todavía no había liquidaciones donde impactarlo. Recién ahora,
                // devengado, se aplica — en la MISMA transacción que la activación: o
                // queda todo el estado inicial o no queda nada.
                //
                // La columna Json distingue dos casos que el safeParse por sí solo NO
                // separaba (ambos fallaban igual con `z.array(...)`): columna null/undefined
                // = NO HAY estado inicial (el camino normal — la inmensa mayoría de los
                // contratos se activan directo), vs. columna CON contenido que no pasa el
                // schema = estado inicial CORRUPTO. Tratar los dos como no-op silencioso
                // (como hacía antes) perdía la deuda histórica del contrato sin dejar
                // rastro: se activaba con 200 como si nunca hubiera habido nada que
                // aplicar. Ahora el caso corrupto EXPLOTA con el mismo mecanismo que un
                // estado inicial inconsistente (EstadoInicialInvalido → 400, rollback,
                // la aprobación queda PENDIENTE y reintentable) en vez de perderse mudo.
                const periodosGuardados = contratoActualizado.periodosAnterioresPendientes;
                if (periodosGuardados != null) {
                  const pendientes = PeriodosAnterioresSchema.safeParse(periodosGuardados);
                  if (!pendientes.success) {
                    throw new EstadoInicialInvalido(
                      'El estado inicial guardado con este contrato está corrupto (no pasa el schema esperado) — revisá periodosAnterioresPendientes antes de volver a aprobar.',
                    );
                  }
                  // Array vacío válido = "no hay períodos anteriores", no un error: no
                  // hace falta aplicar nada ni tocar la columna.
                  if (pendientes.data.length > 0) {
                    await aplicarEstadoInicial(tx, contratoActualizado, pendientes.data, u.userId);
                    await tx.contrato.update({
                      where: { id: contratoActualizado.id },
                      data: { periodosAnterioresPendientes: Prisma.DbNull },
                    });
                  }
                }
              }
              if (accion === 'rechazar') {
                // El borrador rechazado se descarta: borramos el inquilino que se creó
                // para él. Si no, su email queda tomado (@@unique [inmobiliariaId,email])
                // y bloquea para siempre volver a cargar un contrato con ese inquilino.
                // El contrato queda BORRADOR-rechazado (inquilinoTitular pasa a null, ya
                // manejado por los mappers); no genera liquidaciones ni reclamó propiedad.
                // Antes de borrar el inquilino hay que borrar sus hijos con FK requerida
                // (sin onDelete → Restrict por default): CodigoOtp / AnuncioAcuse /
                // Documento / CertificadoInquilino. Si el inquilino abrió la PWA y pidió
                // un OTP (crea un CodigoOtp), el deleteMany tiraría P2003 → rollback → la
                // aprobación volvía a PENDIENTE y no se podía rechazar nunca más.
                const inqs = await tx.inquilino.findMany({
                  where: { contratoId: apr.entidadId, inmobiliariaId: u.inmobiliariaId },
                  select: { id: true },
                });
                const inqIds = inqs.map((i) => i.id);
                if (inqIds.length > 0) {
                  await tx.codigoOtp.deleteMany({ where: { inquilinoId: { in: inqIds } } });
                  await tx.anuncioAcuse.deleteMany({ where: { inquilinoId: { in: inqIds } } });
                  await tx.documento.deleteMany({ where: { inquilinoId: { in: inqIds } } });
                  await tx.certificadoInquilino.deleteMany({
                    where: { inquilinoId: { in: inqIds } },
                  });
                  await tx.inquilino.deleteMany({ where: { id: { in: inqIds } } });
                }
              }
            }
            // Mismo shape que GET /aprobaciones: el front mapea cargadoPor.nombre.
            const updated = await tx.aprobacion.findUniqueOrThrow({
              where: { id },
              include: { cargadoPor: { select: { nombre: true, apellido: true, rol: true } } },
            });
            return { http: 200 as const, updated };
          },
          // timeout 30s (default 5s): al aprobar, esta tx aplica el estado inicial
          // (aplicarEstadoInicial) además de activar el contrato y devengar — hasta
          // 120 períodos con updates secuenciales contra una DB remota. Mismo motivo
          // que core.ts:978 (el alta con periodosAnteriores), pero acá se suma el
          // claim de la propiedad y el devengo: con carteras de ~30 períodos el
          // default de 5s ya se pasaba y tiraba P2028 (500 opaco, determinístico —
          // el admin reintenta y le sigue saliendo 500).
          { timeout: 30_000, maxWait: 10_000 },
        )
        .catch((e: unknown) => {
          // PROP_OCUPADA: al aprobar, la propiedad ya fue reclamada por otro contrato
          // (carrera o un segundo BORRADOR sobre la misma propiedad). El throw hizo
          // rollback TOTAL → la aprobación vuelve a PENDIENTE. Lo mapeamos a 409 acá
          // porque el handler global no mapea un Error genérico (caería en 500).
          if (e instanceof Error && e.message === 'PROP_OCUPADA')
            return { http: 409 as const, motivo: 'PROP_OCUPADA' as const };
          // Estado inicial inconsistente (período que no existe, parcial sin monto…):
          // 400 con el detalle, igual que hace POST /contratos. La transacción ya
          // revirtió, así que la aprobación sigue PENDIENTE y se puede reintentar.
          if (e instanceof EstadoInicialInvalido) return { http: 400 as const, mensaje: e.message };
          throw e;
        });
      if (result.http === 400) return reply.code(400).send({ message: result.mensaje });
      if (result.http === 404) return reply.code(404).send({ message: 'Aprobación inexistente' });
      if (result.http === 501) {
        // Ver el comentario en la transacción: aprobar estos tipos todavía no
        // ejecuta nada, así que no los damos por aprobados. El mensaje le dice
        // al operador qué hacer mientras tanto, en vez de dejarlo esperando.
        const comoResolver: Record<string, string> = {
          DEVOLUCION_DEPOSITO:
            'Resolvé la devolución desde Depósitos de garantía o al cerrar el contrato.',
          GASTO_CAJA_ELIMINACION: 'Eliminá el gasto desde Caja de gastos.',
          AJUSTE_FUERA_DE_INDICE: 'Aplicá el ajuste desde la ficha del contrato.',
        };
        const tipo = 'tipo' in result ? String(result.tipo) : '';
        return reply.code(501).send({
          message:
            `Aprobar desde acá todavía no ejecuta esta acción, así que la dejamos pendiente. ${comoResolver[tipo] ?? ''}`.trim(),
        });
      }
      if (result.http === 409) {
        return reply
          .code(409)
          .send({
            message:
              'motivo' in result ? 'La propiedad ya tiene un contrato activo' : 'Ya fue decidida',
          });
      }
      if (result.updated.tipo === 'CONTRATO_CARGADO') {
        await registrarEvento({
          inmobiliariaId: u.inmobiliariaId,
          tipo: accion === 'aprobar' ? 'CONTRATO_APROBADO' : 'CONTRATO_RECHAZADO',
          autorId: u.userId,
          rolAutor: u.rol,
          entidadId: result.updated.entidadId,
          entidadDescripcion: result.updated.titulo,
        });
        // Al APROBAR, el contrato pasa a ACTIVO → recién ahí le mandamos al
        // inquilino el email de bienvenida/onboarding (los contratos cargados por
        // rol CARGA nacen BORRADOR y no lo reciben en POST /contratos). Best-effort.
        if (accion === 'aprobar') {
          try {
            const contrato = await prisma.contrato.findUnique({
              where: { id: result.updated.entidadId },
              select: {
                propiedad: { select: { direccion: true } },
                inquilinoTitular: { select: { nombre: true, email: true } },
                inmobiliaria: {
                  select: {
                    nombre: true,
                    email: true,
                    telefono: true,
                    direccionCalle: true,
                    direccionAltura: true,
                    direccionCiudad: true,
                    direccionProvincia: true,
                  },
                },
              },
            });
            const inq = contrato?.inquilinoTitular;
            if (inq?.email && contrato?.inmobiliaria) {
              const inmo = contrato.inmobiliaria;
              const direccionInmo = [
                `${inmo.direccionCalle} ${inmo.direccionAltura}`.trim(),
                inmo.direccionCiudad,
                inmo.direccionProvincia,
              ]
                .filter((p) => p && p.trim())
                .join(', ');
              const enviado = await enviarInvitacionInquilino({
                email: inq.email,
                inquilinoNombre: inq.nombre,
                inmobiliaria: {
                  nombre: inmo.nombre,
                  telefono: inmo.telefono,
                  email: inmo.email,
                  direccion: direccionInmo || null,
                },
                propiedadDireccion: contrato.propiedad?.direccion ?? null,
              });
              if (enviado)
                request.log.info(
                  { email: inq.email },
                  'Invitación de inquilino enviada (aprobación)',
                );
            }
          } catch (err) {
            request.log.error(
              { err: (err as Error).message },
              'Invitación de inquilino (aprobación): fallo el envío (no bloquea)',
            );
          }
        }
      }
      return result.updated;
    });
  }
}

// Señales internas de la tx de /pagos/manual (el re-check con lock decide
// adentro; el handler las traduce a 409/400 sin filtrar detalles del error).
class ManualLiquidacionYaPaga extends Error {}
class ManualMontoSuperaSaldo extends Error {}
// Señales de la tx de /pagos/:id/validar (lock + re-tope): otro cobro cubrió la
// liq antes de validar este informe → no conciliar (sería over-cobro).
class ValidarLiquidacionYaCubierta extends Error {}
class ValidarExcedeSaldo extends Error {}
// Señales de la tx de POST /rendiciones (todo el cálculo va dentro del advisory
// lock por dueño+período): el handler las traduce a 409 claros.
/** Lleva la propiedad: sin ella el 409 manda a "revisar el reparto" sin decir de cuál. */
class ParticipacionAusente extends Error {
  constructor(readonly propiedadId: string) {
    super('participacion ausente');
  }
}
/**
 * Aborta el `descobrar` cuando la rendición tomó el movimiento de caja entre el chequeo y el
 * borrado. Existe para revertir la transacción entera: sin tirar, el `cargoContrato.update` ya
 * hecho quedaría commiteado y el cargo volvería a estar impago con la plata igual rendida.
 */
class MovimientoTomadoPorRendicion extends Error {}
/** Aborta el `deposito/resolver` cuando otro operador lo resolvió primero. */
class DepositoYaResuelto extends Error {}
class RendicionSinCobros extends Error {}
/**
 * Ya hay una rendición de este dueño y este período que es ANTERIOR AL LEDGER.
 *
 * `alquileres_rendidos` nació el 01/07/2026 y su migración la creó vacía, sin backfill —no se
 * puede backfillear: `Rendicion` guarda un total por (dueño, período), no el desglose por
 * liquidación—. En la misma migración se soltó el `@@unique(propietarioId, periodo)`, porque
 * desde entonces un período se rinde en varias tandas a medida que entran los parciales.
 *
 * Resultado: para todo período rendido ANTES de esa fecha, el anti-doble del handler —que se
 * apoya entero en las líneas de ese ledger— lee cero y da vía libre. El operador elige un mes
 * viejo en el selector, confirma, y la inmobiliaria transfiere de nuevo plata que ya depositó.
 *
 * La regla existía sólo del lado de LECTURA (`lib/rendicion-pendiente.ts`), así que el portal
 * del dueño y el "por rendir" tapaban el período y nadie se enteraba del cobro doble.
 */
class RendicionPreLedger extends Error {
  constructor(readonly rendidoAt: Date) {
    super('rendicion pre-ledger');
  }
}
/** Lleva los números: sin ellos el 409 mandaba al operador a "revisar los gastos" sin
 *  decirle cuánto falta ni cuál gasto lo traba, y el que traba puede ser el arreglo de un
 *  reclamo —que no figura en la lista de gastos de caja que el mensaje lo manda a mirar. */
class RendicionNetoNegativo extends Error {
  constructor(
    readonly detalle: {
      bruto: number;
      comision: number;
      gastos: number;
      ingresos: number;
      moneda: string;
    },
  ) {
    super('RendicionNetoNegativo');
  }
}
class GastoYaDescontado extends Error {}
