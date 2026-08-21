import { randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { PREFIJO_REVERSION_INTERNA } from '../lib/reversion-interna.js';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { rolTienePermiso } from '@llave/shared';
import { resolverEsquemaMora } from '../lib/punitorios.js';
import { prisma } from '../db.js';
import { urlEsDelTenant } from './uploads.js';
import { dineroPositivo } from '../lib/monto.js';
import { puedeAdjuntar } from '../lib/acceso-archivos.js';
import {
  exigirContratoActivo,
  requireAuth,
  requireContratoAcceso,
  requireInquilino,
  requireUsuario,
} from '../auth/guards.js';

/**
 * Fase 6 — Mundo inquilino: certificado del inquilino (el "reemplazo del
 * garante", calculado server-side desde las liquidaciones REALES), screening
 * simulado coherente, co-inquilinos con permisos, boletas de servicios y
 * reportes piloto con tracking server-side completo (el TODO explícito de
 * piloto-storage.ts).
 */

/* ============================================================
 * Certificado — port de calcularHistorial / calcularNivel del mock
 * (apps/inquilino/src/lib/certificado-inquilino.ts), pero alimentado
 * por las liquidaciones reales del contrato en vez de asumir "casi
 * al día".
 * ============================================================ */

/**
 * Prefijo con el que la inmo marca un pago REVERTIDO operativamente (anulado
 * tras conciliar). Un pago así queda estado='RECHAZADO' con observacion
 * `Anulado tras conciliar: <motivo>` — misma convención que plata.ts
 * (/pagos/anular y el mapeo neutro de /mis-liquidaciones).
 */


/**
 * Predicado Prisma reutilizable: pagos RECHAZADOS que SÍ cuentan como rechazo
 * real del inquilino, EXCLUYENDO las anulaciones operativas de la inmo.
 *
 * POR QUÉ: un "anulado tras conciliar" es una reversión que hace la
 * inmobiliaria (p. ej. cargó mal un cobro y lo revierte), NO un comprobante
 * que el inquilino mandó y le rebotó. Contarlo como rechazo le bajaba
 * injustamente el nivel de buen pagador en el certificado por algo que no es
 * su culpa. `not: { startsWith }` deja pasar los rechazos genuinos y descarta
 * las reversiones internas.
 */
const PAGO_RECHAZADO_REAL: Prisma.PagoWhereInput = {
  estado: 'RECHAZADO',
  NOT: { observacion: { startsWith: PREFIJO_REVERSION_INTERNA } },
};

type NivelHistorial = 'EXCELENTE' | 'BUENO' | 'REGULAR' | 'NUEVO';

// type (no interface): los type alias tienen index signature implícita y
// entran directo como Prisma.InputJsonValue al persistir el snapshot.
type HistorialCertificado = {
  cuotasTotales: number;
  cuotasPagadas: number;
  cuotasAlDia: number;
  atrasoPromedioDias: number;
  pagosRechazados: number;
  ratingPromedio: number;
};

interface LiqHistorial {
  fechaVencimiento: Date;
  fechaPago: Date | null;
  estado: string;
}

const DIA_MS = 86_400_000;

function calcularHistorial(
  liqs: LiqHistorial[],
  pagosRechazados: number,
  ratingPromedio: number,
): HistorialCertificado {
  const ahora = Date.now();
  // Comparamos por DÍA (no por timestamp): un pago conciliado el mismo día del
  // vencimiento pero más tarde (fechaPago 14:00 vs vencimiento 00:00 UTC) caía
  // como "demorado". Normalizamos ambos al inicio del día UTC.
  const startOfDayUTC = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  // Cuotas totales = todas las que vencieron hasta hoy. Pagadas = PAGADO.
  const vencidas = liqs.filter((l) => l.fechaVencimiento.getTime() <= ahora);
  const cuotasTotales = vencidas.length;
  const pagadas = vencidas.filter((l) => l.estado === 'PAGADO');
  // Al día = pagadas en o antes del vencimiento (sin fechaPago asumimos al día).
  const alDia = pagadas.filter(
    (l) => !l.fechaPago || startOfDayUTC(l.fechaPago) <= startOfDayUTC(l.fechaVencimiento),
  );
  const demoradas = pagadas.filter(
    (l) => l.fechaPago && startOfDayUTC(l.fechaPago) > startOfDayUTC(l.fechaVencimiento),
  );
  const atrasoPromedioDias =
    demoradas.length > 0
      ? Math.round(
          demoradas.reduce(
            (acc, l) => acc + (startOfDayUTC(l.fechaPago!) - startOfDayUTC(l.fechaVencimiento)) / DIA_MS,
            0,
          ) / demoradas.length,
        )
      : 0;

  return {
    cuotasTotales,
    cuotasPagadas: pagadas.length,
    cuotasAlDia: alDia.length,
    atrasoPromedioDias,
    pagosRechazados,
    ratingPromedio,
  };
}

function calcularNivel(historial: HistorialCertificado): { nivel: NivelHistorial; detalle: string } {
  if (historial.cuotasTotales === 0) {
    return {
      nivel: 'NUEVO',
      detalle: 'Sin historial verificable todavía — contrato recién iniciado.',
    };
  }
  const ratio = historial.cuotasAlDia / Math.max(historial.cuotasTotales, 1);
  if (ratio >= 0.95 && historial.pagosRechazados === 0) {
    return {
      nivel: 'EXCELENTE',
      detalle: `Pagó ${historial.cuotasAlDia} de ${historial.cuotasTotales} cuotas perfectas al día. Cero rechazos.`,
    };
  }
  if (ratio >= 0.8) {
    return {
      nivel: 'BUENO',
      detalle: `Pagó ${historial.cuotasAlDia}/${historial.cuotasTotales} al día (${historial.atrasoPromedioDias} día${historial.atrasoPromedioDias === 1 ? '' : 's'} de atraso promedio en las demoradas).`,
    };
  }
  return {
    nivel: 'REGULAR',
    detalle: `${historial.cuotasPagadas}/${historial.cuotasTotales} pagadas pero con atrasos recurrentes (promedio ${historial.atrasoPromedioDias} días).`,
  };
}

/**
 * Código del certificado: XXXX-XXXX-XXXX, ALEATORIO y opaco.
 *
 * ANTES ERA DERIVABLE. Se calculaba con FNV-1a + djb2 sobre
 * `DNI | contratoId | nombreDeLaInmobiliaria`, sin sal y sin secreto: dos funciones de hash
 * de 32 bits publicadas, truncadas a 12 caracteres. Cualquiera con esos tres datos —y el
 * nombre de la inmobiliaria es público— reproducía el código de otra persona en diez líneas.
 * Y como era determinístico, `revocadoAt` no servía de nada: regenerar daba el MISMO código.
 *
 * Este código está pensado para que lo tipee un tercero (el propietario o la inmobiliaria a
 * la que el inquilino le muestra el certificado), así que el alfabeto excluye los caracteres
 * que se confunden al leer a mano: I/1, O/0, S/5, Z/2. Quedan 32 símbolos × 12 = **60 bits**.
 *
 * `randomBytes` y no `Math.random()`: el código es lo único que va a proteger la página
 * pública de verificación el día que exista, y ahí un PRNG predecible es una llave maestra.
 * Es el mismo patrón que el link mágico de visita (`operacion.ts`, `randomBytes(24)`).
 */
export const ALFABETO_CERT = 'ABCDEFGHJKLMNPQRTUVWXY346789';
/** Exportada para fijar en un test puro que NO toma ningún dato de la persona. */
export function codigoCertificado(): string {
  const bytes = randomBytes(12);
  let out = '';
  for (let i = 0; i < 12; i++) {
    out += ALFABETO_CERT[bytes[i]! % ALFABETO_CERT.length];
    if (i === 3 || i === 7) out += '-';
  }
  return out;
}

/* ============================================================
 * Reportes piloto — helpers de tracking (port de piloto-storage.ts)
 * ============================================================ */

/** Deduce un nombre de navegador legible desde el userAgent. */
function detectarNavegador(ua: string): string {
  // El orden importa: Edge/Opera incluyen "Chrome" en su UA.
  if (/\bEdg\//.test(ua)) return 'Edge';
  if (/\bOPR\//.test(ua) || /\bOpera\//.test(ua)) return 'Opera';
  if (/\bChrome\//.test(ua)) return 'Chrome';
  if (/\bFirefox\//.test(ua)) return 'Firefox';
  if (/\bSafari\//.test(ua)) return 'Safari';
  return 'Navegador';
}

function pantallaDesdeUrl(url: string): string {
  const partes = url.split('?')[0]!.split('/').filter(Boolean);
  if (partes.length === 0) return 'Home';
  const PANTALLAS: Record<string, string> = {
    propiedades: 'Propiedades',
    propietarios: 'Propietarios',
    pagos: 'Pagos',
    caja: 'Caja',
    contratos: 'Contratos',
    renovaciones: 'Renovaciones',
    consorcios: 'Consorcios',
    reclamos: 'Reclamos',
    profesionales: 'Profesionales',
    screening: 'Verificación inquilino',
    configuracion: 'Configuración',
    admin: 'Panel interno',
    // pantallas de la app inquilino
    certificado: 'Certificado',
    boletas: 'Boletas de servicios',
    'co-inquilinos': 'Co-inquilinos',
    documentos: 'Documentos',
  };
  return PANTALLAS[partes[0]!] ?? partes[0]!;
}

/** Prefijo con el que conservamos la autoría real de reportes de inquilinos. */
const SESSION_INQUILINO_PREFIX = 'inquilino:';
const SESSION_COINQUILINO_PREFIX = 'co-inquilino:';

/* ============================================================
 * Rutas
 * ============================================================ */

export async function inquilinoMundoRoutes(app: FastifyInstance) {
  // ===== Contrato del inquilino logueado (alimenta home + /contrato) =====
  app.get('/mi-contrato', async (request, reply) => {
    const inq = await requireContratoAcceso(request, reply);
    if (!inq) return;
    if (!inq.contratoId) {
      return reply.code(404).send({ message: 'No tenés un contrato activo' });
    }
    const contrato = await prisma.contrato.findFirst({
      where: { id: inq.contratoId, inmobiliariaId: inq.inmobiliariaId },
      include: {
        propiedad: { select: { direccion: true, ciudad: true, reglasConvivencia: true, mascotasPermitidas: true } },
        inmobiliaria: {
          select: { nombre: true, telefono: true, moraTipoDefault: true, moraValorDefault: true, monedaDefault: true },
        },
        sociedad: { select: { cuentaCobranza: true } },
        cobraDirectoPropietario: { include: { cuentaCobranza: true } },
      },
    });
    if (!contrato) return reply.code(404).send({ message: 'Contrato inexistente' });

    // Cuenta de cobranza REAL (de la DB) que el inquilino usa para transferir.
    // NUNCA un dato inventado: si no hay cuenta cargada devolvemos null y la app
    // le pide al inquilino que la solicite a la inmobiliaria.
    //  - PROPIETARIO_DIRECTO => cuenta del propietario (CuentaCobranzaDirecta).
    //  - INMOBILIARIA        => cuenta de la sociedad del contrato (o la principal).
    type CuentaJson = { banco?: string; titular?: string; cbu?: string; alias?: string; cuit?: string };
    let datosCobranza:
      | { modo: 'PROPIETARIO_DIRECTO' | 'INMOBILIARIA'; titular: string; cuit: string; banco: string | null; cbu: string; alias: string }
      | null = null;

    if (contrato.modoCobranza === 'PROPIETARIO_DIRECTO') {
      // SOLO la cuenta del dueño. Si no está cargada, datosCobranza queda null
      // (la PWA muestra "pedile los datos a la inmobiliaria") — antes caía en
      // silencio a la cuenta de la INMOBILIARIA y el inquilino transfería el
      // alquiler a la cuenta equivocada: plata del dueño varada en el banco de
      // la inmo, sin circuito de rendición (excluida por PROPIETARIO_DIRECTO).
      const c = contrato.cobraDirectoPropietario?.cuentaCobranza;
      if (c) {
        datosCobranza = { modo: 'PROPIETARIO_DIRECTO', titular: c.titular, cuit: c.cuit, banco: c.banco, cbu: c.cbu, alias: c.alias };
      }
    } else {
      let cuenta = (contrato.sociedad?.cuentaCobranza as CuentaJson | null) ?? null;
      if (!cuenta) {
        const principal = await prisma.sociedad.findFirst({
          where: { inmobiliariaId: inq.inmobiliariaId, esPrincipal: true, activa: true },
          select: { cuentaCobranza: true },
        });
        cuenta = (principal?.cuentaCobranza as CuentaJson | null) ?? null;
      }
      if (cuenta?.cbu && cuenta.titular) {
        datosCobranza = {
          modo: 'INMOBILIARIA',
          titular: cuenta.titular,
          cuit: cuenta.cuit ?? '',
          banco: cuenta.banco ?? null,
          cbu: cuenta.cbu,
          alias: cuenta.alias ?? '',
        };
      }
    }

    // Un contrato que ya no está ACTIVO no expone datos de cobranza (CBU/alias): la
    // PWA NO debe ofrecer transferir a un contrato finalizado — el pago caería en 409
    // recién DESPUÉS de mover la plata. El ex-inquilino conserva la lectura del
    // contrato (dirección, fechas, historial), pero sin CBU para pagar.
    if (contrato.estado !== 'ACTIVO') datosCobranza = null;

    return {
      id: contrato.id,
      estado: contrato.estado,
      direccion: contrato.propiedad.direccion,
      ciudad: contrato.propiedad.ciudad,
      inmobiliaria: contrato.inmobiliaria.nombre,
      inmobiliariaTelefono: contrato.inmobiliaria.telefono ?? null,
      fechaInicio: contrato.fechaInicio.toISOString().slice(0, 10),
      fechaFin: contrato.fechaFin.toISOString().slice(0, 10),
      diaPago: contrato.diaPago,
      indiceAjuste: contrato.indiceAjuste,
      proximoAjuste: contrato.proximoAjuste ? contrato.proximoAjuste.toISOString().slice(0, 10) : null,
      montoActual: Number(contrato.monto),
      montoExpensas: contrato.montoExpensas != null ? Number(contrato.montoExpensas) : null,
      tipoContrato: contrato.tipoContrato,
      // Permiso VIGENTE de quien consulta (el guard ya lo revalida contra la DB en cada
      // request). El front lo tenía sólo en localStorage, escrito UNA vez al aceptar la
      // invitación y nunca refrescado: si el titular ascendía a un co-inquilino de VER a
      // PAGAR, el backend ya lo dejaba pagar pero su app seguía mostrando "solo lectura"
      // para siempre — y el link de invitación ya estaba consumido, así que no había forma
      // de arreglarlo desde la app.
      permiso: inq.permiso,
      esCoInquilino: inq.esCoInquilino,
      // Depósito de garantía REAL. La app lo mostraba como "1 mes" usando el alquiler
      // ACTUAL: tras un par de ajustes por índice ese número no tiene nada que ver con lo
      // que el inquilino entregó al firmar (que suele ser un mes del canon ORIGINAL), y
      // además prometía que se devuelve entero aunque ya hubiera reparaciones imputadas.
      // null = el contrato no tiene depósito cargado → la app no muestra la fila.
      depositoGarantia: contrato.depositoGarantia != null ? Number(contrato.depositoGarantia) : null,
      estadoDeposito: contrato.estadoDeposito,
      depositoDevueltoMonto:
        contrato.depositoDevueltoMonto != null ? Number(contrato.depositoDevueltoMonto) : null,
      // Mascotas (Sí/No/no especificado) y reglas de convivencia: se muestran en
      // el contrato del inquilino para que no tenga que preguntar. Mascotas pasó
      // a ser un atributo de la PROPIEDAD (no del contrato); el fallback al valor
      // legacy del contrato es defensivo por si el backfill de la migración no
      // cubrió algún caso — así ninguna propiedad que hoy muestra el dato deja
      // de mostrarlo.
      mascotasPermitidas: contrato.propiedad.mascotasPermitidas ?? contrato.mascotasPermitidas,
      reglasConvivencia: contrato.propiedad.reglasConvivencia ?? null,
      // Esquema de mora RESUELTO (cascada contrato → default inmobiliaria) para
      // que la app pueda explicar "cómo se calcula el recargo". El campo legacy
      // se mantiene mapeado (solo % diario) por compat de shape.
      mora: (() => {
        const e = resolverEsquemaMora(contrato, contrato.inmobiliaria);
        return { tipo: e.tipo, valor: e.valor };
      })(),
      tasaPunitorioDiaria: (() => {
        const e = resolverEsquemaMora(contrato, contrato.inmobiliaria);
        return e.tipo === 'PORCENTAJE_DIARIO' ? e.valor : null;
      })(),
      moneda: contrato.moneda,
      datosCobranza,
    };
  });

  // ===== Cargos del inquilino (deuda que NO nace de una liquidación) =====
  // Reparación de un reclamo imputada al inquilino (pagador INQUILINO) y penalidad
  // por rescisión anticipada. Antes eran write-only: se creaban en el panel pero el
  // inquilino no los veía ni sumaban a su deuda. Excluye los `contraDeposito` (se
  // netean contra el depósito, no los paga el inquilino ahora) y los ya saldados por
  // la inmo. La LECTURA no exige contrato ACTIVO: un ex-inquilino debe poder ver la
  // penalidad de su rescisión.
  app.get('/mis-cargos', async (request, reply) => {
    const inq = await requireContratoAcceso(request, reply);
    if (!inq) return;
    if (!inq.contratoId) return [];
    const cargos = await prisma.cargoContrato.findMany({
      where: { contratoId: inq.contratoId, contraDeposito: false, saldadoAt: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true, tipo: true, concepto: true, monto: true, moneda: true, createdAt: true, reclamoId: true },
    });
    return cargos.map((c) => ({
      id: c.id,
      tipo: c.tipo,
      concepto: c.concepto,
      monto: Number(c.monto),
      moneda: c.moneda,
      fecha: c.createdAt.toISOString(),
      origen: c.reclamoId ? 'RECLAMO' : c.tipo === 'PENALIDAD_RESCISION' ? 'RESCISION' : 'OTRO',
    }));
  });

  // ===== Certificado del inquilino (el "reemplazo del garante") =====
  app.get('/certificado', async (request, reply) => {
    const inq = await requireInquilino(request, reply);
    if (!inq) return;
    if (!inq.contratoId) {
      return reply.code(400).send({ message: 'No tenés un contrato activo para certificar' });
    }

    const inquilino = await prisma.inquilino.findUnique({ where: { id: inq.inquilinoId } });
    if (!inquilino) return reply.code(404).send({ message: 'Inquilino inexistente' });
    const contrato = await prisma.contrato.findFirst({
      where: { id: inq.contratoId, inmobiliariaId: inq.inmobiliariaId },
      include: {
        propiedad: { select: { direccion: true } },
        inmobiliaria: { select: { nombre: true } },
      },
    });
    if (!contrato) return reply.code(404).send({ message: 'Contrato inexistente' });

    // Historial desde las liquidaciones REALES del contrato — si da REGULAR,
    // se devuelve honesto.
    const liqs = await prisma.liquidacion.findMany({ where: { contratoId: contrato.id } });
    // Rechazos REALES del inquilino: excluimos las anulaciones operativas de la
    // inmo (RECHAZADO + 'Anulado tras conciliar:') para no penalizar el nivel
    // de buen pagador por una reversión que no es culpa suya. Ver PAGO_RECHAZADO_REAL.
    const pagosRechazados = await prisma.pago.count({
      where: { contratoId: contrato.id, ...PAGO_RECHAZADO_REAL },
    });
    const ratings = await prisma.ratingReclamo.aggregate({
      where: { reclamo: { contratoId: contrato.id } },
      _avg: { estrellas: true },
    });
    const ratingPromedio = ratings._avg.estrellas
      ? Math.round(ratings._avg.estrellas * 10) / 10
      : 0;

    const historial = calcularHistorial(liqs, pagosRechazados, ratingPromedio);
    const { nivel, detalle: nivelDetalle } = calcularNivel(historial);

    const ahora = new Date();
    const contratoVigente = contrato.estado === 'ACTIVO';
    // Meses cumplidos: un contrato ACTIVO cuenta hasta hoy; uno dado de baja se CONGELA en
    // la fecha de la baja para que su antigüedad no siga creciendo mes a mes como si el
    // ex-inquilino nunca se hubiera ido (contradiría `vigente: false`). El modelo Contrato
    // no persiste una fecha de baja, así que usamos `updatedAt` como proxy (finalizar/
    // rescindir es el último update típico del contrato) y nunca contamos más allá del fin
    // natural (`fechaFin`). Para una baja EN la fecha de fin (fechaFin ya pasada) esto da
    // fechaFin, igual que antes; el fix cubre la baja ANTICIPADA (fechaFin todavía futura),
    // donde antes caíamos a `ahora` e inflábamos la tenencia sin tope. Nota: si a futuro se
    // persiste un `finalizadoAt` explícito, reemplazar `updatedAt` por ese campo.
    const finBaja =
      contrato.updatedAt < contrato.fechaFin ? contrato.updatedAt : contrato.fechaFin;
    const hastaMeses = contratoVigente ? ahora : finBaja;
    const mesesCumplidos = Math.max(
      0,
      (hastaMeses.getFullYear() - contrato.fechaInicio.getFullYear()) * 12 +
        (hastaMeses.getMonth() - contrato.fechaInicio.getMonth()),
    );

    // El código ya NO se deriva de los datos de la persona (ver `codigoCertificado`), así que
    // hay que LEER el que ya tenga esta persona para este contrato antes de inventar uno.
    //
    // Es la diferencia que trae el cambio: con un código determinístico daba igual, porque
    // recalcularlo devolvía siempre lo mismo. Con uno aleatorio, generarlo antes de mirar
    // rompería dos cosas — el código impreso cambiaría en cada visita, y `urlVerificacion`
    // quedaría apuntando a un código distinto del que guarda la fila.
    const certPrevio = await prisma.certificadoInquilino.findUnique({
      where: { inquilinoId_contratoId: { inquilinoId: inquilino.id, contratoId: contrato.id } },
      select: { hash: true },
    });
    const hash = certPrevio?.hash ?? codigoCertificado();
    // La URL que se IMPRIME en el certificado y que va a tipear o clickear un tercero —el
    // propietario o la inmobiliaria a la que el inquilino se lo muestra—.
    //
    // Estaba hardcodeada a `https://myalquiler.com.ar/...`, y **ese dominio no existe**:
    // verificado el 20/08, no resuelve (sin respuesta), mientras `myalquiler.com` y
    // `admin.myalquiler.com` devuelven 200. O sea que el "certificado verificable" traía
    // impresa una dirección adonde nadie podía llegar: la única parte que lo vuelve
    // verificable era la que no funcionaba.
    //
    // La ruta `/verificar/[hash]` vive en la PWA del inquilino (`apps/inquilino`), que se
    // sirve en `app.myalquiler.com`. Se usa `APP_INQUILINO_URL`, que ya existía y que el
    // mailer usa con el mismo default, en vez de volver a hardcodear un dominio.
    const appInquilino = (process.env.APP_INQUILINO_URL ?? 'https://app.myalquiler.com').replace(/\/$/, '');
    const urlVerificacion = `${appInquilino}/verificar/${hash}`;
    const validoHasta = new Date(ahora.getTime() + 30 * DIA_MS);

    const inquilinoData = {
      nombre: `${inquilino.nombre} ${inquilino.apellido ?? ''}`.trim(),
      dni: inquilino.dni,
      email: inquilino.email,
      telefono: inquilino.telefono,
    };
    const contratoActual = {
      direccion: contrato.propiedad.direccion,
      inmobiliaria: contrato.inmobiliaria.nombre,
      fechaInicio: contrato.fechaInicio.toISOString().slice(0, 10),
      fechaFin: contrato.fechaFin.toISOString().slice(0, 10),
      // Lo que esta persona paga por mes. Para un SOLO_EXPENSAS `contrato.monto` es 0 por
      // diseño (el alta lo permite sólo en ese caso), así que el certificado imprimía
      // "Alquiler mensual $0". El importe que corresponde son las expensas, y el rótulo lo
      // decide el front con `tipoContrato`.
      montoMensual:
        contrato.tipoContrato === 'SOLO_EXPENSAS'
          ? Number(contrato.montoExpensas ?? 0)
          : Number(contrato.monto),
      tipoContrato: contrato.tipoContrato,
      moneda: contrato.moneda,
      mesesCumplidos,
      // El certificado sigue siendo válido como HISTORIAL, pero deja explícito si el
      // contrato está vigente o ya finalizó (la página de verificación no debe
      // presentar un contrato terminado como si el inquilino siguiera viviendo ahí).
      vigente: contratoVigente,
    };

    const cert = await prisma.certificadoInquilino.upsert({
      // La clave del upsert es (inquilino, contrato), NO el código. Antes era `{ hash }` y
      // funcionaba sólo porque el código era determinístico: con un código aleatorio, buscar
      // por hash no encontraría nunca la fila previa y cada visita a /certificado crearía una
      // fila nueva —con un código nuevo— dejando la anterior huérfana con PII adentro.
      where: { inquilinoId_contratoId: { inquilinoId: inquilino.id, contratoId: contrato.id } },
      update: {
        inquilinoData,
        contratoActual,
        historial,
        nivel,
        nivelDetalle,
        generadoAt: ahora,
        validoHasta,
        urlVerificacion,
      },
      create: {
        inmobiliariaId: inq.inmobiliariaId,
        hash,
        inquilinoId: inquilino.id,
        contratoId: contrato.id,
        inquilinoData,
        contratoActual,
        historial,
        nivel,
        nivelDetalle,
        validoHasta,
        urlVerificacion,
      },
    });

    return {
      id: cert.id,
      hash: cert.hash,
      inquilino: inquilinoData,
      contratoActual,
      historial,
      nivel: cert.nivel,
      nivelDetalle: cert.nivelDetalle,
      generadoAt: cert.generadoAt,
      validoHasta: cert.validoHasta,
      urlVerificacion: cert.urlVerificacion,
      revocadoAt: cert.revocadoAt,
    };
  });

  // ===== Screening (panel) =====
  /**
   * ⛔ APAGADO. Devuelve 501 hasta que exista una fuente real de datos crediticios.
   *
   * POR QUÉ: este endpoint no consultaba nada. El informe entero —score, deudas BCRA, cheques
   * rechazados, juicios, familia, domicilio, empleador, patrimonio— salía de un PRNG FNV-1a
   * sembrado con los dígitos del CUIT. Ese generador se borró en este mismo commit.
   * En toda la API no hay una sola llamada a Nosis, BCRA, RENAPER, ARCA ni Veraz: los únicos
   * `fetch()` salientes van al bug tracker.
   *
   * Y lo persistía con `estado: 'COMPLETO'` sobre una **persona real identificada por CUIT y
   * nombre**, devolviendo 201 con un informe que se ve oficial.
   *
   * Lo único que lo contenía era que ningún front lo llama y que la pantalla está gateada en
   * producción. Eso no es un control: el endpoint estaba vivo y autenticado, y alcanzaba con
   * que alguien "terminara de cablear la pantalla" para que una inmobiliaria decidiera a quién
   * le alquila mirando números inventados sobre una persona con nombre y apellido.
   *
   * 501 y no 404: el endpoint EXISTE y está previsto, lo que falta es la integración. Un 404
   * mentiría en la otra dirección y haría que alguien lo reimplemente creyendo que nunca estuvo.
   *
   * Para reactivarlo hace falta, en este orden: contrato con el proveedor (Nosis), la clave en
   * el entorno, el cliente HTTP real, y decidir qué se hace con las filas ya fabricadas que
   * puedan existir en `screenings` (ver la consulta de diagnóstico de T-21-N3-N2). Mientras
   * tanto NO queda nada del generador en el archivo: se borró entero (está en el historial de
   * git). La forma que el proveedor tiene que llenar ya la define el modelo `Screening`.
   */
  app.post('/screening', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'screening.ver');
    if (!u) return;
    return reply.code(501).send({
      message:
        'La verificación crediticia todavía no está disponible: falta conectar la fuente de datos real. No emitimos informes que no podamos respaldar.',
      codigo: 'SCREENING_SIN_FUENTE',
    });
  });

  app.get('/screenings', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'screening.ver');
    if (!u) return;
    return prisma.screening.findMany({
      where: { inmobiliariaId: u.inmobiliariaId },
      orderBy: { createdAt: 'desc' },
    });
  });

  // ===== Co-inquilinos (los del contrato del inquilino logueado) =====
  app.get('/co-inquilinos', async (request, reply) => {
    const inq = await requireContratoAcceso(request, reply);
    if (!inq) return;
    if (!inq.contratoId) return [];
    return prisma.coInquilino.findMany({
      where: { contratoId: inq.contratoId },
      orderBy: { invitadoAt: 'desc' },
    });
  });

  app.post('/co-inquilinos', async (request, reply) => {
    const inq = await requireInquilino(request, reply);
    if (!inq) return;
    if (!inq.contratoId) return reply.code(400).send({ message: 'No tenés un contrato activo' });
    // P10: no se gestionan co-inquilinos sobre un contrato finalizado/borrador.
    if (!(await exigirContratoActivo(inq.contratoId, inq.inmobiliariaId, reply))) return;
    const body = z
      .object({
        nombre: z.string().trim().min(3),
        dni: z.string().optional(),
        email: z.string().email(),
        telefono: z.string().optional(),
        relacion: z.string().trim().min(2),
        permiso: z.enum(['VER', 'PAGAR', 'COMPLETO']),
      })
      .safeParse(request.body ?? {});
    if (!body.success) {
      return reply.code(400).send({ message: 'Datos del co-inquilino incompletos (nombre, email, relación y permiso)' });
    }

    const email = body.data.email.toLowerCase();
    const yaInvitado = await prisma.coInquilino.findFirst({
      where: { contratoId: inq.contratoId, email },
    });
    if (yaInvitado) return reply.code(409).send({ message: 'Ya invitaste a alguien con ese email' });

    let co;
    try {
      co = await prisma.coInquilino.create({
        data: {
          inmobiliariaId: inq.inmobiliariaId,
          contratoId: inq.contratoId,
          nombre: body.data.nombre,
          dni: body.data.dni,
          email,
          telefono: body.data.telefono,
          relacion: body.data.relacion,
          permiso: body.data.permiso,
        },
      });
    } catch (e) {
      // Carrera de doble-invitación concurrente (dos requests pasan el findFirst de
      // arriba): el @@unique([contratoId, email]) la corta con P2002 → mismo 409.
      if (e && typeof e === 'object' && (e as { code?: string }).code === 'P2002') {
        return reply.code(409).send({ message: 'Ya invitaste a alguien con ese email' });
      }
      throw e;
    }
    // El modelo no persiste el token: lo firmamos al vuelo (JWT con el id de
    // la invitación) — es lo que iría en el link/WhatsApp de invitación.
    const tokenInvitacion = app.jwt.sign(
      { kind: 'co-invitacion', coInquilinoId: co.id, contratoId: inq.contratoId },
      { expiresIn: '7d' },
    );
    return reply.code(201).send({ ...co, tokenInvitacion });
  });

  // Regenera el link de invitación de un co-inquilino existente (el titular lo
  // perdió o quiere reenviarlo). Solo el titular del contrato.
  app.post('/co-inquilinos/:id/link', async (request, reply) => {
    const inq = await requireInquilino(request, reply);
    if (!inq) return;
    if (!inq.contratoId) return reply.code(400).send({ message: 'No tenés un contrato activo' });
    // P10: no se regenera el link de invitación sobre un contrato finalizado/borrador.
    if (!(await exigirContratoActivo(inq.contratoId, inq.inmobiliariaId, reply))) return;
    const { id } = request.params as { id: string };
    const co = await prisma.coInquilino.findFirst({ where: { id, contratoId: inq.contratoId ?? '' } });
    if (!co) return reply.code(404).send({ message: 'Co-inquilino inexistente' });
    // Regenerar el link re-arma la invitación: como la aceptación es de un solo uso
    // (ver /co-invitacion/:token/aceptar en auth.ts), volvemos la invitación a
    // PENDIENTE para que el link NUEVO se pueda aceptar. Esto además revoca la sesión
    // vigente del co-inquilino (requireContratoAcceso exige estado=ACEPTADO) →
    // rotación de credencial: reenviar el link invalida el acceso anterior.
    if (co.estado === 'ACEPTADO') {
      await prisma.coInquilino.update({
        where: { id: co.id },
        data: { estado: 'PENDIENTE', aceptadoAt: null },
      });
    }
    const tokenInvitacion = app.jwt.sign(
      { kind: 'co-invitacion', coInquilinoId: co.id, contratoId: co.contratoId },
      { expiresIn: '7d' },
    );
    return { tokenInvitacion };
  });

  app.post('/co-inquilinos/:id/aceptar', async (request, reply) => {
    const inq = await requireInquilino(request, reply);
    if (!inq) return;
    if (!inq.contratoId) return reply.code(400).send({ message: 'No tenés un contrato activo' });
    // Aceptar una co-invitación es una escritura: mismo gate de contrato ACTIVO que el
    // path real (auth.ts) y que los demás mutadores de co-inquilino. Antes este path
    // (demo) lo omitía → asimetría con prod: la demo aceptaba sobre un contrato finalizado.
    if (!(await exigirContratoActivo(inq.contratoId, inq.inmobiliariaId, reply))) return;
    const { id } = request.params as { id: string };
    const co = await prisma.coInquilino.findFirst({ where: { id, contratoId: inq.contratoId } });
    if (!co) return reply.code(404).send({ message: 'Invitación inexistente' });
    if (co.estado === 'ACEPTADO') return reply.code(409).send({ message: 'La invitación ya fue aceptada' });
    if (!app.env.DEMO_MODE) {
      return reply.code(403).send({ message: 'La aceptación real llega por el link de invitación — esto solo se simula en modo demo' });
    }
    return prisma.coInquilino.update({
      where: { id: co.id },
      data: { estado: 'ACEPTADO', aceptadoAt: new Date() },
    });
  });

  app.patch('/co-inquilinos/:id/permiso', async (request, reply) => {
    const inq = await requireInquilino(request, reply);
    if (!inq) return;
    if (!inq.contratoId) return reply.code(400).send({ message: 'No tenés un contrato activo' });
    // P10: no se cambia el permiso de un co-inquilino sobre un contrato finalizado/borrador.
    if (!(await exigirContratoActivo(inq.contratoId, inq.inmobiliariaId, reply))) return;
    const { id } = request.params as { id: string };
    const body = z
      .object({ permiso: z.enum(['VER', 'PAGAR', 'COMPLETO']) })
      .safeParse(request.body ?? {});
    if (!body.success) return reply.code(400).send({ message: 'Permiso inválido (VER, PAGAR o COMPLETO)' });
    const co = await prisma.coInquilino.findFirst({ where: { id, contratoId: inq.contratoId ?? '' } });
    if (!co) return reply.code(404).send({ message: 'Co-inquilino inexistente' });
    return prisma.coInquilino.update({ where: { id: co.id }, data: { permiso: body.data.permiso } });
  });

  app.delete('/co-inquilinos/:id', async (request, reply) => {
    const inq = await requireInquilino(request, reply);
    if (!inq) return;
    if (!inq.contratoId) return reply.code(400).send({ message: 'No tenés un contrato activo' });
    // Gestionar co-inquilinos es una ESCRITURA: un contrato finalizado no la acepta
    // (mismo criterio que invitar/cambiar permiso). Antes esta era la única mutación
    // de co-inquilinos sin el gate.
    if (!(await exigirContratoActivo(inq.contratoId, inq.inmobiliariaId, reply))) return;
    const { id } = request.params as { id: string };
    const co = await prisma.coInquilino.findFirst({ where: { id, contratoId: inq.contratoId } });
    if (!co) return reply.code(404).send({ message: 'Co-inquilino inexistente' });
    await prisma.coInquilino.delete({ where: { id: co.id } });
    return { ok: true };
  });

  // ===== Boletas de servicios =====
  app.get('/boletas', async (request, reply) => {
    const inq = await requireContratoAcceso(request, reply);
    if (!inq) return;
    if (!inq.contratoId) return [];
    return prisma.boletaServicio.findMany({
      where: { contratoId: inq.contratoId },
      orderBy: [{ periodo: 'desc' }, { subidoAt: 'desc' }],
    });
  });

  app.post('/boletas', async (request, reply) => {
    const inq = await requireInquilino(request, reply);
    if (!inq) return;
    if (!inq.contratoId) return reply.code(400).send({ message: 'No tenés un contrato activo' });
    // P10: no se cargan boletas sobre un contrato finalizado/borrador.
    if (!(await exigirContratoActivo(inq.contratoId, inq.inmobiliariaId, reply))) return;
    const body = z
      .object({
        servicio: z.enum(['LUZ', 'GAS', 'AGUA', 'INTERNET', 'ABL', 'CABLE']),
        periodo: z.string().regex(/^\d{4}-\d{2}$/),
        monto: dineroPositivo().optional(),
        vencimiento: z.string().optional(),
        nombreArchivo: z.string().optional(),
        tipoMime: z.string().optional(),
        tamanioBytes: z.number().int().nonnegative().optional(),
        archivoUrl: z.string().optional(),
        notas: z.string().optional(),
      })
      .safeParse(request.body ?? {});
    if (!body.success) {
      return reply.code(400).send({ message: 'Datos de la boleta incompletos (servicio y período YYYY-MM)' });
    }
    const TAMANIO_MAX = 2 * 1024 * 1024;
    if ((body.data.tamanioBytes ?? 0) > TAMANIO_MAX) {
      return reply.code(400).send({ message: 'La boleta no puede superar los 2 MB' });
    }
    // La boleta, si trae archivo, tiene que ser un /uploads de ESTA inmobiliaria.
    if (body.data.archivoUrl && !urlEsDelTenant(body.data.archivoUrl, inq.inmobiliariaId)) {
      return reply.code(400).send({ message: 'Archivo de boleta inválido' });
    }
    if (!(await puedeAdjuntar(body.data.archivoUrl, inq))) {
      // Suyo, no sólo del tenant: sin esto la vía 2 del guard de lectura se auto-anula
      // —alguien con la URL ajena la engancha a una fila propia y se auto-autoriza—.
      return reply.code(403).send({ message: 'Ese archivo no es tuyo' });
    }
    // No se cargan boletas de períodos futuros.
    const [anioBol = 0, mesBol = 0] = body.data.periodo.split('-').map(Number);
    const hoyBol = new Date();
    if (anioBol > hoyBol.getFullYear() || (anioBol === hoyBol.getFullYear() && mesBol > hoyBol.getMonth() + 1)) {
      return reply.code(400).send({ message: 'No podés cargar boletas de períodos futuros' });
    }

    // monto default: consumo promedio del servicio de la propiedad (si está cargado)
    let monto = body.data.monto;
    if (monto === undefined) {
      const contrato = await prisma.contrato.findUnique({
        where: { id: inq.contratoId },
        select: { propiedadId: true },
      });
      const servicio = contrato
        ? await prisma.servicioPublico.findUnique({
            where: { propiedadId_tipo: { propiedadId: contrato.propiedadId, tipo: body.data.servicio } },
          })
        : null;
      monto = servicio?.consumoPromedioMensual ? Number(servicio.consumoPromedioMensual) : 0;
    }

    // vencimiento default: día 10 del mes siguiente al período
    let vencimiento: Date;
    if (body.data.vencimiento) {
      vencimiento = new Date(body.data.vencimiento);
      if (Number.isNaN(vencimiento.getTime())) {
        return reply.code(400).send({ message: 'Fecha de vencimiento inválida' });
      }
    } else {
      const [anio, mes] = body.data.periodo.split('-').map(Number) as [number, number];
      vencimiento = new Date(anio, mes, 10); // mes es 1-based → Date 0-based = mes siguiente
    }

    const PLACEHOLDER =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    const boleta = await prisma.boletaServicio.create({
      data: {
        inmobiliariaId: inq.inmobiliariaId,
        contratoId: inq.contratoId,
        tipo: body.data.servicio,
        periodo: body.data.periodo,
        monto,
        vencimiento,
        nombreArchivo: body.data.nombreArchivo ?? `boleta-${body.data.servicio.toLowerCase()}-${body.data.periodo}.pdf`,
        tipoMime: body.data.tipoMime ?? 'application/pdf',
        tamanioBytes: body.data.tamanioBytes ?? 0,
        archivoUrl: body.data.archivoUrl ?? PLACEHOLDER,
        notas: body.data.notas,
      },
    });
    return reply.code(201).send(boleta);
  });

  // Datos de servicios públicos de la propiedad del inquilino (NIS,
  // distribuidora, medidor) — lo que necesita ver para saber qué boleta subir.
  app.get('/servicios', async (request, reply) => {
    const inq = await requireInquilino(request, reply);
    if (!inq) return;
    if (!inq.contratoId) return [];
    const contrato = await prisma.contrato.findUnique({
      where: { id: inq.contratoId },
      select: { propiedadId: true },
    });
    if (!contrato) return [];
    return prisma.servicioPublico.findMany({
      where: { propiedadId: contrato.propiedadId },
      orderBy: { tipo: 'asc' },
    });
  });

  // Feed de notificaciones del inquilino — DERIVADO del estado real (liquidaciones,
  // pagos, reclamos). Antes la campana era un no-op en prod (if(apiEnabled) return [])
  // → el inquilino nunca recibía alertas (pago rechazado, alquiler vencido, respuesta
  // a reclamo, profesional asignado). El `unread` lo resuelve el cliente (localStorage
  // de leídas); acá devolvemos los eventos accionables ya ordenados por severidad.
  app.get('/mis-notificaciones', async (request, reply) => {
    const inq = await requireContratoAcceso(request, reply);
    if (!inq) return;
    if (!inq.contratoId) return [];
    const contratoId = inq.contratoId;
    // Estado del contrato: si ya no está ACTIVO no generamos alertas de cobro
    // ("tu alquiler está atrasado / vence en N días"). Un contrato finalizado no
    // tiene obligación de pago viva y la PWA ni siquiera ofrece la cuenta para pagar.
    const ctoNotif = await prisma.contrato.findFirst({
      where: { id: contratoId, inmobiliariaId: inq.inmobiliariaId },
      // `moneda` para el aviso de ajuste: el sistema es riguroso con esto y un monto en
      // dólares mostrado con signo de pesos ya fue bug varias veces.
      select: { estado: true, moneda: true },
    });
    const contratoActivo = ctoNotif?.estado === 'ACTIVO';
    const simMoneda = ctoNotif?.moneda === 'USD' ? 'US$' : '$';
    const fmtMonedaContrato = (n: number): string => `${simMoneda} ${n.toLocaleString('es-AR')}`;
    const ahora = Date.now();
    const relativo = (d: Date | string): string => {
      const min = Math.floor((ahora - new Date(d).getTime()) / 60000);
      if (min < 60) return `hace ${Math.max(min, 0)} min`;
      const h = Math.floor(min / 60);
      if (h < 24) return `hace ${h} h`;
      const dd = Math.floor(h / 24);
      return `hace ${dd} día${dd === 1 ? '' : 's'}`;
    };
    const diasHasta = (d: Date | string): number =>
      Math.ceil((new Date(d).getTime() - ahora) / 86400000);

    type Notif = {
      id: string;
      titulo: string;
      detalle: string;
      href: string;
      cuando: string;
      icono: string;
      severidad: 'critica' | 'alta' | 'media' | 'baja';
    };
    const out: Notif[] = [];

    // 1) Liquidaciones impagas: en revisión / vencidas / próximas a vencer.
    const liqs = await prisma.liquidacion.findMany({
      where: { contratoId, estado: { in: ['PENDIENTE', 'VENCIDO', 'PARCIAL'] } },
      orderBy: { fechaVencimiento: 'asc' },
    });
    for (const liq of liqs) {
      const informado = await prisma.pago.findFirst({
        where: { liquidacionId: liq.id, estado: 'INFORMADO' },
        orderBy: { informadoAt: 'desc' },
      });
      if (informado) {
        out.push({
          id: `pago-val-${liq.id}`,
          titulo: 'Comprobante en revisión',
          detalle: 'Te avisamos cuando la inmobiliaria lo valide (24-48 hs).',
          href: `/pago/${liq.id}`,
          cuando: relativo(informado.informadoAt),
          icono: 'pago_validacion',
          severidad: 'media',
        });
        continue;
      }
      // Contrato finalizado/rescindido: no empujamos alertas de cobro (no hay
      // alquiler vivo que pagar). El "comprobante en revisión" de arriba SÍ pasa
      // porque un pago en vuelo se resuelve igual tras la baja.
      if (!contratoActivo) continue;
      const dias = diasHasta(liq.fechaVencimiento);
      if (liq.estado === 'VENCIDO' || dias < 0) {
        out.push({
          id: `pago-venc-${liq.id}`,
          titulo: 'Tu alquiler está atrasado',
          detalle: `Período ${liq.periodo} · pagá cuanto antes para no sumar punitorios.`,
          href: `/pago/${liq.id}`,
          cuando: `venció ${new Date(liq.fechaVencimiento).toLocaleDateString('es-AR')}`,
          icono: 'pago_vencido',
          severidad: 'critica',
        });
      } else if (dias <= 5) {
        out.push({
          id: `pago-prox-${liq.id}`,
          titulo: dias === 0 ? 'Tu alquiler vence hoy' : `Tu alquiler vence en ${dias} día${dias === 1 ? '' : 's'}`,
          detalle: `Período ${liq.periodo}.`,
          href: `/pago/${liq.id}`,
          cuando: dias === 0 ? 'hoy' : `en ${dias}d`,
          icono: 'pago_pendiente',
          severidad: 'alta',
        });
      }
    }

    // 1.b) AJUSTES DE ALQUILER recientes.
    //
    // No existía ningún aviso de ajuste, por ningún canal: al inquilino le subían el
    // alquiler y se enteraba cuando le llegaba la liquidación siguiente más cara
    // (reportado el 03/08: "no me avisó que me subiste, que hubo un aumento"). Además del
    // email que sale al aplicarlo, queda acá para el que no lee el mail.
    //
    // Se deriva de `AjusteAlquiler` —igual que el resto del feed, que es on-read y no
    // guarda notificaciones—. Los DOS caminos de ajuste dejan fila en esa tabla
    // (`POST /contratos/:id/ajustar` y `PATCH /contratos/:id/monto`), así que no importa
    // por dónde entró el operador.
    const hace60 = new Date(ahora - 60 * 86400000);
    const ajustes = await prisma.ajusteAlquiler.findMany({
      where: { contratoId, inmobiliariaId: inq.inmobiliariaId, createdAt: { gte: hace60 } },
      orderBy: { createdAt: 'desc' },
      take: 3,
    });
    for (const a of ajustes) {
      const anterior = Number(a.montoAnterior);
      const nuevo = Number(a.montoNuevo);
      // Un "ajuste" que no cambió el monto no es noticia para el inquilino.
      if (Math.abs(nuevo - anterior) < 0.01) continue;
      const subio = nuevo > anterior;
      out.push({
        id: `ajuste-${a.id}`,
        titulo: subio ? 'Se actualizó tu alquiler' : 'Se corrigió tu alquiler',
        detalle:
          `${fmtMonedaContrato(anterior)} → ${fmtMonedaContrato(nuevo)} desde ${a.periodoDesde}` +
          (a.motivo ? ` · ${a.motivo}` : ''),
        href: '/contrato',
        cuando: relativo(a.createdAt),
        icono: 'ajuste',
        // Alta y no crítica: es importante que lo vea, pero no es una deuda vencida.
        severidad: 'alta',
      });
    }

    // 2) Pagos decididos en los últimos 30 días: rechazado / confirmado.
    const hace30 = new Date(ahora - 30 * 86400000);
    const decididos = await prisma.pago.findMany({
      where: { contratoId, estado: { in: ['RECHAZADO', 'CONCILIADO'] }, decididoAt: { gte: hace30 } },
      orderBy: { decididoAt: 'desc' },
      take: 10,
    });
    for (const p of decididos) {
      // El feed lo consumen TODOS los miembros del contrato (titular + co-inquilinos,
      // mismo requireContratoAcceso) y CUALQUIERA puede pagar. Por eso el copy va
      // NEUTRAL a nivel contrato: a un co-inquilino B no debe llegarle "TU pago
      // fue rechazado" por un pago que informó A. Solo personalizamos a "Tu
      // comprobante…" cuando el pago lo informó exactamente quien consulta.
      const loInformoQuienConsulta =
        (p.informadoPorInquilinoId != null && p.informadoPorInquilinoId === inq.inquilinoId) ||
        (p.informadoPorCoInquilinoId != null && p.informadoPorCoInquilinoId === inq.coInquilinoId);
      if (p.estado === 'RECHAZADO') {
        // Un pago ANULADO por la inmo queda RECHAZADO con observacion interna
        // ('Anulado tras conciliar: …'): es una reversión operativa, NO un rechazo
        // de comprobante. Copy distinto y observacion NUNCA expuesta al inquilino.
        const anulado = (p.observacion ?? '').startsWith(PREFIJO_REVERSION_INTERNA);
        if (anulado) {
          out.push({
            id: `pago-anul-${p.id}`,
            titulo: 'La inmobiliaria revirtió un cobro del contrato',
            detalle: 'Se anuló un pago ya registrado. Si no lo esperabas, consultá el motivo con la inmobiliaria.',
            href: `/pago/${p.liquidacionId}`,
            cuando: p.decididoAt ? relativo(p.decididoAt) : 'reciente',
            icono: 'pago_rechazado',
            severidad: 'critica',
          });
        } else {
          // Motivo de rechazo truncado como antes (80 chars); título neutral salvo
          // que lo haya informado quien consulta.
          const motivo = p.observacion ? p.observacion.slice(0, 80) : null;
          out.push({
            id: `pago-rech-${p.id}`,
            titulo: loInformoQuienConsulta ? 'Tu comprobante fue rechazado' : 'Se rechazó un pago del contrato',
            detalle: motivo ?? 'Hay que volver a enviar el comprobante.',
            href: `/pago/${p.liquidacionId}`,
            cuando: p.decididoAt ? relativo(p.decididoAt) : 'reciente',
            icono: 'pago_rechazado',
            severidad: 'critica',
          });
        }
      } else {
        out.push({
          id: `pago-ok-${p.id}`,
          titulo: loInformoQuienConsulta ? 'Tu comprobante fue confirmado' : `Se confirmó el pago de ${p.periodo}`,
          detalle: `$${Math.round(Number(p.monto)).toLocaleString('es-AR')} acreditado.`,
          href: `/pago/${p.liquidacionId}`,
          cuando: p.decididoAt ? relativo(p.decididoAt) : 'reciente',
          icono: 'pago_confirmado',
          severidad: 'media',
        });
      }
    }

    // 3) Reclamos: respondidos por la inmo / profesional asignado / a calificar.
    const reclamos = await prisma.reclamo.findMany({
      where: { contratoId },
      include: { eventos: { orderBy: { fecha: 'asc' } }, profesional: true, visita: true, rating: true },
    });
    const CERRADOS = ['RESUELTO', 'CERRADO', 'RECHAZADO'];
    for (const r of reclamos) {
      if (!CERRADOS.includes(r.estado)) {
        // El último mensaje del timeline es de la inmo y el inquilino no respondió.
        let mensajeInmo: { contenido: string; fecha: Date } | null = null;
        for (let i = r.eventos.length - 1; i >= 0; i--) {
          const ev = r.eventos[i]!;
          if (ev.tipo === 'MENSAJE_INMO' && ev.contenido) {
            mensajeInmo = { contenido: ev.contenido, fecha: ev.fecha };
            break;
          }
          if (ev.tipo === 'MENSAJE_INQUILINO') break;
        }
        if (mensajeInmo) {
          out.push({
            id: `inmo-${r.id}-${mensajeInmo.fecha.toISOString()}`,
            titulo: 'Te respondieron tu reclamo',
            detalle: mensajeInmo.contenido.slice(0, 70),
            href: `/reclamos/${r.id}`,
            cuando: relativo(mensajeInmo.fecha),
            icono: 'reclamo_inmo',
            severidad: 'alta',
          });
        }
        if (r.profesional && (!r.visita || r.visita.estado === 'ASIGNADO')) {
          out.push({
            id: `prof-${r.id}-${r.profesional.id}`,
            titulo: `Te asignaron a ${r.profesional.nombre}`,
            detalle: 'Coordiná día y hora para que pase a tu propiedad.',
            href: `/reclamos/${r.id}`,
            cuando: 'reciente',
            icono: 'profesional',
            severidad: 'alta',
          });
        }
      }
      if (r.estado === 'RESUELTO' && !r.rating) {
        out.push({
          id: `rating-${r.id}`,
          titulo: 'Calificá tu última reparación',
          detalle: `${r.categoria.toLowerCase()} · contanos cómo fue.`,
          href: `/reclamos/${r.id}`,
          cuando: r.resueltoAt ? relativo(r.resueltoAt) : 'hace poco',
          icono: 'rating',
          severidad: 'baja',
        });
      }
    }

    const sev = { critica: 4, alta: 3, media: 2, baja: 1 } as const;
    out.sort((a, b) => sev[b.severidad] - sev[a.severidad]);
    return out.slice(0, 8);
  });

  // ===== Reportes piloto — tracking ABSOLUTO server-side =====
  app.post('/reportes', async (request, reply) => {
    // Cualquier autenticado: usuario del panel O inquilino.
    const payload = await requireAuth(request, reply);
    if (!payload) return;
    const body = z
      .object({
        tipo: z.enum(['BUG', 'IDEA']),
        titulo: z.string().trim().min(3),
        detalle: z.string().optional(),
        severidad: z.enum(['BLOQUEA', 'MOLESTO', 'MENOR']).optional(),
        url: z.string().optional(),
        urlCompleta: z.string().optional(),
        viewport: z.string().optional(),
      })
      .safeParse(request.body ?? {});
    if (!body.success) {
      return reply.code(400).send({ message: 'Tipo (BUG o IDEA) y título (mínimo 3 caracteres) requeridos' });
    }

    // Tracking capturado AUTOMÁTICAMENTE del lado servidor (el TODO de
    // piloto-storage.ts): nada de esto viene del cliente.
    const ip = request.ip;
    const uaHeader = request.headers['user-agent'];
    const userAgent = typeof uaHeader === 'string' ? uaHeader : null;
    const sessionHeader = request.headers['x-session-id'];
    const buildHeader = request.headers['x-app-build'];
    const url = body.data.url ?? '/';

    let usuarioId: string;
    let rol: string;
    let sessionId: string | null =
      typeof sessionHeader === 'string' && sessionHeader.length > 0 ? sessionHeader : null;
    if (payload.kind === 'usuario') {
      usuarioId = payload.userId;
      rol = payload.rol;
    } else {
      // Limitación del schema: ReportePiloto.usuarioId es obligatorio con FK a
      // Usuario. Para reportes de inquilinos lo atribuimos al ADMIN del tenant
      // como receptor, y conservamos la autoría REAL en rol + sessionId.
      rol = 'INQUILINO';
      // Prefijo distinto por tipo: el id de un co-inquilino vive en la tabla
      // CoInquilino, no en Inquilino → con el prefijo de inquilino su nombre nunca
      // resolvía en GET /reportes (caía al fallback 'Inquilino').
      sessionId =
        payload.kind === 'co-inquilino'
          ? `${SESSION_COINQUILINO_PREFIX}${payload.coInquilinoId}`
          : `${SESSION_INQUILINO_PREFIX}${payload.inquilinoId}`;
      const receptor = await prisma.usuario.findFirst({
        where: { inmobiliariaId: payload.inmobiliariaId, rol: 'ADMIN', activo: true },
        orderBy: { createdAt: 'asc' },
      });
      if (!receptor) {
        return reply
          .code(409)
          .send({ message: 'La inmobiliaria no tiene un administrador activo — contactala directamente.' });
      }
      usuarioId = receptor.id;
    }

    const reporte = await prisma.reportePiloto.create({
      data: {
        inmobiliariaId: payload.inmobiliariaId,
        usuarioId,
        rol,
        tipo: body.data.tipo,
        titulo: body.data.titulo,
        detalle: body.data.detalle?.trim() ?? '',
        url,
        pantalla: pantallaDesdeUrl(url),
        urlCompleta: body.data.urlCompleta,
        navegador: userAgent ? detectarNavegador(userAgent) : null,
        viewport: body.data.viewport,
        severidad: body.data.tipo === 'BUG' ? body.data.severidad : null,
        ip,
        userAgent,
        sessionId,
        build: typeof buildHeader === 'string' ? buildHeader : null,
      },
    });
    return reply.code(201).send(reporte);
  });

  app.get('/reportes', async (request, reply) => {
    const u = await requireUsuario(request, reply);
    if (!u) return;
    // auditoria.ver o ADMIN (hoy ADMIN ya tiene auditoria.ver; el OR queda
    // explícito por si la matriz cambia)
    if (u.rol !== 'ADMIN' && !rolTienePermiso(u.rol, 'auditoria.ver')) {
      return reply.code(403).send({ message: 'Tu rol no permite ver los reportes del piloto' });
    }
    const reportes = await prisma.reportePiloto.findMany({
      where: { inmobiliariaId: u.inmobiliariaId },
      include: { usuario: { select: { nombre: true, apellido: true, rol: true } } },
      orderBy: { reportadoAt: 'desc' },
    });

    // Resolver la autoría real de los reportes hechos por inquilinos Y co-inquilinos
    // (cada uno con su prefijo; el id de un co-inquilino vive en otra tabla).
    const idsConPrefijo = (prefijo: string) => [
      ...new Set(
        reportes
          .filter((r) => r.sessionId?.startsWith(prefijo))
          .map((r) => r.sessionId!.slice(prefijo.length)),
      ),
    ];
    const inquilinoIds = idsConPrefijo(SESSION_INQUILINO_PREFIX);
    const coInquilinoIds = idsConPrefijo(SESSION_COINQUILINO_PREFIX);
    const [inquilinos, coInquilinos] = await Promise.all([
      inquilinoIds.length ? prisma.inquilino.findMany({ where: { id: { in: inquilinoIds } } }) : [],
      coInquilinoIds.length ? prisma.coInquilino.findMany({ where: { id: { in: coInquilinoIds } } }) : [],
    ]);
    const nombrePorId = new Map<string, string>();
    for (const i of inquilinos) nombrePorId.set(i.id, `${i.nombre} ${i.apellido ?? ''}`.trim());
    for (const c of coInquilinos) nombrePorId.set(c.id, c.nombre.trim());

    const nombreAutor = (sessionId: string | null): string => {
      if (sessionId?.startsWith(SESSION_COINQUILINO_PREFIX))
        return `${nombrePorId.get(sessionId.slice(SESSION_COINQUILINO_PREFIX.length)) ?? 'Co-inquilino'} (co-inquilino)`;
      return `${nombrePorId.get(sessionId?.slice(SESSION_INQUILINO_PREFIX.length) ?? '') ?? 'Inquilino'} (inquilino)`;
    };

    return reportes.map((r) => ({
      ...r,
      reportadoPor: r.rol === 'INQUILINO' ? nombreAutor(r.sessionId) : `${r.usuario.nombre} ${r.usuario.apellido}`.trim(),
    }));
  });
}
