import * as XLSX from 'xlsx';
import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';
import { requireUsuario } from '../auth/guards.js';
import { registrarEvento } from '../lib/auditoria.js';
import { crearContratoHistorico } from '../lib/contrato-historico.js';
import { diaCivilAR } from '@llave/shared';
import {
  CAMPOS_MOROSOS,
  claveDeduda,
  finDelPeriodo,
  inicioDelPeriodo,
  normalizarDireccion,
  parsearFilaMoroso,
  sugerirMapeoMorosos,
  validarFilaMoroso,
  type EstadoFilaMoroso,
} from '../lib/importacion-morosos.js';

/**
 * Importar MOROSOS HISTÓRICOS desde una planilla.
 *
 * Camila arranca con ~50 inquilinos que ya se fueron debiendo. Cargarlos de a
 * uno por la ficha de la propiedad funciona pero son 50 formularios, y lo que
 * pidió fue importar.
 *
 * POR QUÉ NO ES UN MODO ADENTRO DE `importaciones-cartera.ts`: esa máquina crea
 * una propiedad nueva por fila y RECHAZA la fila si la dirección ya existe;
 * acá la propiedad tiene que existir y no encontrarla es el error. Además fuerza
 * `devengarDesde` = mes actual justamente para no fabricar deuda pasada, que es
 * lo contrario del objetivo. Meter un `if (tipo)` en cada paso de un pipeline
 * lleno de comentarios sobre bugs de duplicación en carteras reales habría
 * puesto en riesgo un flujo que hoy funciona, para ahorrar un archivo.
 *
 * POR QUÉ NO PERSISTE UNA `ImportacionCartera`: ese modelo existe para poder
 * REANUDAR importaciones de cientos de filas donde cada una crea propiedad +
 * propietario + inquilino + contrato + liquidaciones. Una planilla de morosos es
 * un orden de magnitud más chica y más barata por fila. El flujo es stateless: el
 * front se queda con la matriz parseada entre paso y paso. Eso además evita
 * agregar una columna `tipo` (migración) a una tabla en producción.
 *
 * Flujo: POST analizar (subir+parsear) → POST validar (previsualizar) → POST confirmar.
 */

/**
 * Tope de filas. Más bajo que las 2000 de la cartera a propósito: acá la matriz
 * parseada VUELVE al server en validar/confirmar, y el body limit por defecto de
 * Fastify es 1 MiB. 500 filas × 10 columnas de texto entran con margen de sobra;
 * 2000 podrían no entrar y el fallo sería un 413 opaco a mitad del wizard.
 */
const MAX_FILAS = 500;

/**
 * Una celda-fecha de Excel → `"YYYY-MM-DD"`, leída con los getters LOCALES.
 *
 * NO se usa `toISOString()`, y no es un detalle. `xlsx` con `cellDates` construye
 * los Date en la hora local del proceso: el 1/3/2024 de una planilla es
 * `new Date(2024, 2, 1)`. En un server al ESTE de UTC eso pasado a UTC da
 * `2024-02-29T21:00Z` — y el importador leería FEBRERO. Cada moroso cuya deuda
 * arranca el 1ro entraría con un mes de más, en silencio.
 *
 * Hoy Railway corre en UTC y no muerde, pero es una mina esperando un cambio de
 * región. Una fecha de planilla es un día del calendario, no un instante: se
 * serializa como tal.
 *
 * (La importación de cartera tiene el mismo patrón con `toISOString()`. No se
 * toca desde acá: es un flujo distinto, en producción, y merece su propia tarea.)
 */
function fechaDePlanilla(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dia}`;
}

/** Período `"YYYY-MM"` del mes en curso, en día civil argentino. */
function periodoHoyAR(): string {
  const hoy = diaCivilAR(new Date());
  return `${hoy.getUTCFullYear()}-${String(hoy.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Direcciones de la cartera del tenant, normalizadas → id.
 *
 * Si dos propiedades del tenant normalizan igual (pasa: "Colón 1234" cargada dos
 * veces con distinta puntuación), gana la PRIMERA por fecha de alta y se avisa.
 * Elegir en silencio entre dos propiedades sería peor: la deuda terminaría
 * colgada de la que no es.
 */
async function propiedadesPorDireccion(
  inmobiliariaId: string,
): Promise<{ mapa: Map<string, string>; ambiguas: Set<string>; textos: string[] }> {
  const props = await prisma.propiedad.findMany({
    where: { inmobiliariaId },
    select: { id: true, direccion: true },
    orderBy: { id: 'asc' },
  });
  const mapa = new Map<string, string>();
  const ambiguas = new Set<string>();
  for (const p of props) {
    const clave = normalizarDireccion(p.direccion);
    if (mapa.has(clave)) ambiguas.add(clave);
    else mapa.set(clave, p.id);
  }
  // Las direcciones TAL COMO estan escritas: es lo que se le muestra a quien
  // importa cuando su planilla no matchea ("no encontramos X, sera Y?").
  return { mapa, ambiguas, textos: props.map((p) => p.direccion) };
}

/**
 * Claves de la deuda histórica que este tenant YA tiene cargada.
 *
 * Se arma sobre los contratos FINALIZADOS: son los que produce esta importación
 * y también `POST /contratos/historico`, así que la carga de a uno y la masiva se
 * ven entre sí. Un contrato que terminó de verdad también entra al set, y está
 * bien: si alguien intenta importar deuda con la misma propiedad, la misma
 * persona y exactamente la misma ventana, hay que mirarlo a mano.
 */
async function deudaHistoricaYaCargada(inmobiliariaId: string): Promise<Set<string>> {
  const previos = await prisma.contrato.findMany({
    where: { inmobiliariaId, estado: 'FINALIZADO' },
    select: {
      propiedadId: true,
      fechaInicio: true,
      fechaFin: true,
      inquilinoTitular: { select: { dni: true, nombre: true, apellido: true } },
    },
  });
  const set = new Set<string>();
  for (const c of previos) {
    if (!c.inquilinoTitular) continue;
    set.add(
      claveDeduda(
        c.propiedadId,
        c.inquilinoTitular.dni,
        c.inquilinoTitular.nombre,
        c.inquilinoTitular.apellido,
        periodoDeFecha(c.fechaInicio),
        periodoDeFecha(c.fechaFin),
      ),
    );
  }
  return set;
}

/** `Date` de la DB → `"YYYY-MM"`. Las fechas del contrato se guardan en UTC. */
function periodoDeFecha(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

const filasSchema = z.object({
  filas: z.array(z.array(z.union([z.string(), z.number(), z.null()]))).max(MAX_FILAS),
  mapeo: z.record(z.string(), z.number().int().nonnegative()),
  /** Índices (0-based sobre `filas`) a importar. Omitido = todas las importables. */
  seleccion: z.array(z.number().int().nonnegative()).optional(),
});

export async function importacionMorososRoutes(app: FastifyInstance): Promise<void> {
  /**
   * Gate compartido por los tres endpoints. Mismo criterio que
   * `POST /contratos/historico`: está creando deuda y no hay bandeja de
   * aprobación detrás, así que CARGA y LECTURA quedan afuera. Se aplica desde el
   * PRIMER paso —no sólo al confirmar— para que nadie recorra el wizard entero
   * y se coma un 403 recién al final.
   */
  async function soloAdminUOperador(request: Parameters<typeof requireUsuario>[0], reply: Parameters<typeof requireUsuario>[1]) {
    const u = await requireUsuario(request, reply, 'contratos.crear');
    if (!u) return null;
    if (u.rol !== 'ADMIN' && u.rol !== 'OPERADOR') {
      reply.code(403).send({ message: 'Solo un administrador u operador puede importar deuda histórica' });
      return null;
    }
    return { userId: u.userId, inmobiliariaId: u.inmobiliariaId, rol: u.rol };
  }

  // Campos destino, para que el front arme el UI de mapeo.
  app.get('/importaciones-morosos/campos', async (request, reply) => {
    const u = await soloAdminUOperador(request, reply);
    if (!u) return;
    return CAMPOS_MOROSOS.map((c) => ({ key: c.key, label: c.label, requerido: c.requerido }));
  });

  // Paso 1: subir y parsear. No escribe nada.
  app.post('/importaciones-morosos/analizar', async (request, reply) => {
    const u = await soloAdminUOperador(request, reply);
    if (!u) return;
    const data = await request.file();
    if (!data) return reply.code(400).send({ message: 'Falta el archivo' });
    if (!/\.(xlsx|xls|csv)$/i.test(data.filename ?? '')) {
      return reply.code(415).send({ message: 'Subí la planilla en Excel (.xlsx/.xls) o CSV.' });
    }
    const buffer = await data.toBuffer();

    const esCsv = /\.csv$/i.test(data.filename ?? '');
    let filas: unknown[][];
    try {
      // Mismo criterio que la importación de cartera: CSV raw (las fechas quedan
      // como texto y las interpreta parsearPeriodo en AR), Excel con cellDates.
      // Sin esto xlsx lee "01/06/2024" como mm/dd → mes equivocado, que acá
      // significa cobrarle a alguien meses que no debe.
      const wb = esCsv
        ? XLSX.read(buffer, { type: 'buffer', raw: true })
        : XLSX.read(buffer, { type: 'buffer', cellDates: true });
      const nombreHoja = wb.SheetNames[0];
      if (!nombreHoja) return reply.code(400).send({ message: 'El archivo no tiene hojas para leer' });
      filas = XLSX.utils.sheet_to_json(wb.Sheets[nombreHoja]!, {
        header: 1,
        raw: true,
        blankrows: false,
      }) as unknown[][];
    } catch {
      return reply.code(400).send({ message: 'No pudimos leer el archivo. ¿Es un Excel o CSV válido?' });
    }
    if (filas.length < 2) {
      return reply.code(400).send({ message: 'El archivo no tiene filas de datos (solo el encabezado o vacío).' });
    }

    const headers = (filas[0] ?? []).map((h) => String(h ?? ''));
    // sheet_to_json devuelve arrays ESPARCIDOS; Array.from los rellena (map los
    // saltea, y un hueco rompería el índice del mapeo).
    const cuerpo = filas.slice(1, 1 + MAX_FILAS).map((f) => {
      const fila = f ?? [];
      return Array.from({ length: fila.length }, (_, i) => {
        const c = fila[i];
        if (c === undefined || c === null) return null;
        if (c instanceof Date) return fechaDePlanilla(c);
        return c as string | number;
      });
    });

    return reply.code(200).send({
      columnas: headers,
      filas: cuerpo,
      mapeoSugerido: sugerirMapeoMorosos(headers),
      // El truncado se reporta explícito: una importación que se come 200 filas
      // en silencio es peor que una que falla.
      filasDelArchivo: filas.length - 1,
      filasDescartadas: Math.max(0, filas.length - 1 - cuerpo.length),
      maxFilas: MAX_FILAS,
    });
  });

  // Paso 2: previsualizar. Valida contra la cartera real SIN escribir nada.
  app.post('/importaciones-morosos/validar', async (request, reply) => {
    const u = await soloAdminUOperador(request, reply);
    if (!u) return;
    const parsed = filasSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ message: 'Datos inválidos', issues: parsed.error.issues });

    const faltantes = CAMPOS_MOROSOS.filter((c) => c.requerido && parsed.data.mapeo[c.key] === undefined);
    if (faltantes.length > 0) {
      return reply.code(400).send({ message: `Faltan columnas: ${faltantes.map((c) => c.label).join(', ')}` });
    }

    const { mapa, ambiguas, textos } = await propiedadesPorDireccion(u.inmobiliariaId);
    const hoy = periodoHoyAR();
    // El set arranca con lo que ya está en la DB y CRECE fila a fila: así una
    // planilla que trae dos veces la misma deuda marca la segunda como duplicada,
    // igual que si ya estuviera cargada.
    const yaCargada = await deudaHistoricaYaCargada(u.inmobiliariaId);

    const resumen: Record<EstadoFilaMoroso, number> = { OK: 0, ADVERTENCIA: 0, ERROR: 0, DUPLICADO: 0 };
    const filas = parsed.data.filas.map((f, i) => {
      const datos = parsearFilaMoroso(f, parsed.data.mapeo);
      const v = validarFilaMoroso(datos, mapa, hoy, yaCargada, textos);
      if (v.estado !== 'ERROR' && v.estado !== 'DUPLICADO' && v.propiedadId && datos.debeDesde && datos.debeHasta) {
        yaCargada.add(
          claveDeduda(v.propiedadId, datos.inquilinoDni, datos.inquilinoNombre, datos.inquilinoApellido, datos.debeDesde, datos.debeHasta),
        );
      }
      // Dirección ambigua: matcheó, pero hay más de una propiedad que normaliza
      // igual. Se deja importable (elegimos la primera) pero avisando, para que
      // el operador chequee que la deuda no quede colgada de la que no es.
      // Dirección ambigua: matcheó, pero hay más de una propiedad que normaliza
      // igual. Sólo pisa el estado OK — un DUPLICADO o un ERROR tienen un motivo
      // más importante que mostrar, y perderlo dejaría a la fila con un cartel
      // que no explica por qué no se puede importar.
      const ambigua = v.propiedadId != null && v.estado === 'OK' && ambiguas.has(normalizarDireccion(datos.direccion));
      const estado: EstadoFilaMoroso = ambigua ? 'ADVERTENCIA' : v.estado;
      const motivo = ambigua
        ? 'Tenés más de una propiedad con esa dirección: la deuda va a la primera. Verificá que sea la correcta'
        : v.motivo;
      resumen[estado] += 1;
      return {
        indice: i,
        datos,
        estado,
        motivo,
        propiedadId: v.propiedadId,
        meses: v.meses,
        // DUPLICADO tampoco es importable: ese es todo el punto del dedup.
        importable: estado !== 'ERROR' && estado !== 'DUPLICADO',
      };
    });

    return reply.code(200).send({ filas, resumen });
  });

  // Paso 3: confirmar. Acá sí se crea la deuda.
  app.post('/importaciones-morosos/confirmar', async (request, reply) => {
    const u = await soloAdminUOperador(request, reply);
    if (!u) return;
    const parsed = filasSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ message: 'Datos inválidos', issues: parsed.error.issues });

    const faltantes = CAMPOS_MOROSOS.filter((c) => c.requerido && parsed.data.mapeo[c.key] === undefined);
    if (faltantes.length > 0) {
      return reply.code(400).send({ message: `Faltan columnas: ${faltantes.map((c) => c.label).join(', ')}` });
    }

    // Las filas vuelven del cliente, así que se RE-PARSEAN y RE-VALIDAN acá. No es
    // un problema de privilegio (un cliente malicioso sólo podría crear la misma
    // deuda que ya puede crear de a una por POST /contratos/historico), pero sí de
    // integridad: la validación del paso 2 es un preview, no una autorización.
    const { mapa, textos } = await propiedadesPorDireccion(u.inmobiliariaId);
    const hoy = periodoHoyAR();
    // El dedup se re-arma ACÁ contra la DB, no se confía en el del preview: entre
    // que Camila revisó y apretó Importar pudo pasar cualquier cosa (otra pestaña,
    // un compañero cargando el mismo moroso a mano, un doble click). Es la
    // diferencia entre un aviso y una garantía.
    const yaCargada = await deudaHistoricaYaCargada(u.inmobiliariaId);
    const seleccion = parsed.data.seleccion ? new Set(parsed.data.seleccion) : null;

    const errores: { fila: number; motivo: string }[] = [];
    let creadas = 0;
    let cuotasTotales = 0;

    for (let i = 0; i < parsed.data.filas.length; i++) {
      if (seleccion && !seleccion.has(i)) continue;
      const datos = parsearFilaMoroso(parsed.data.filas[i]!, parsed.data.mapeo);
      const v = validarFilaMoroso(datos, mapa, hoy, yaCargada, textos);
      if (v.estado === 'ERROR' || v.estado === 'DUPLICADO' || !v.propiedadId || !datos.debeDesde || !datos.debeHasta) {
        errores.push({ fila: i, motivo: v.motivo ?? 'Fila inválida' });
        continue;
      }
      const propiedadId = v.propiedadId;
      const direccion = datos.direccion;
      // Se agrega ANTES de crear: si dos filas de esta misma planilla son la misma
      // deuda, la segunda ya la ve. Y si la creación falla, la fila se reporta
      // igual como error, así que no se pierde nada por haberla marcado.
      yaCargada.add(
        claveDeduda(propiedadId, datos.inquilinoDni, datos.inquilinoNombre, datos.inquilinoApellido, datos.debeDesde, datos.debeHasta),
      );
      try {
        // UNA TRANSACCIÓN POR FILA, igual que la importación de cartera: una fila
        // mala no puede tirar abajo las 49 buenas. Y como cada fila COMMITEA antes
        // de la siguiente, el find-or-create de Persona dedupea solo dentro de la
        // misma planilla: si el mismo DNI aparece en dos filas, la segunda
        // encuentra la Persona que creó la primera. Una Persona, dos deudas.
        const r = await prisma.$transaction(
          async (tx) =>
            crearContratoHistorico(
              tx,
              {
                inmobiliariaId: u.inmobiliariaId,
                propiedadId,
                inquilino: {
                  nombre: datos.inquilinoNombre,
                  apellido: datos.inquilinoApellido,
                  telefono: datos.inquilinoTelefono,
                  dni: datos.inquilinoDni,
                },
                monto: datos.monto,
                moneda: datos.moneda,
                montoExpensas: datos.montoExpensas,
                fechaInicio: inicioDelPeriodo(datos.debeDesde!),
                fechaFin: finDelPeriodo(datos.debeHasta!),
                // La planilla no trae día de pago y no cambia cuánto debe: sólo la
                // fecha de vencimiento de cuotas que ya vencieron. 10 es el default
                // del sistema.
                diaPago: 10,
              },
              { userId: u.userId, rol: u.rol },
              direccion,
            ),
          { timeout: 30_000, maxWait: 10_000 },
        );
        creadas += 1;
        cuotasTotales += r.cuotas;
        // Auditoría POR DEUDA, no por lote. `entidadId` es polimórfico y apunta a
        // una entidad concreta: un evento "se importaron 50" no serviría para
        // rastrear de dónde salió UNA deuda que alguien viene a reclamar. Es el
        // mismo evento que escribe la carga de a uno, así que los dos caminos
        // dejan el mismo rastro. Best-effort: nunca propaga error.
        await registrarEvento({
          inmobiliariaId: u.inmobiliariaId,
          tipo: 'CONTRATO_CARGADO',
          autorId: u.userId,
          rolAutor: u.rol,
          entidadId: r.contratoId,
          entidadDescripcion: `Deuda histórica (importada) · ${datos.inquilinoNombre} · ${direccion} · ${r.cuotas} período(s)`,
        });
      } catch (e) {
        errores.push({
          fila: i,
          motivo:
            e && typeof e === 'object' && (e as { code?: string }).code === 'P2002'
              ? 'Ese email o DNI ya lo usa otra persona en tu cartera'
              : 'No pudimos crear la deuda de esta fila',
        });
        // El error completo va al log del server, no a la respuesta: el motivo de
        // Prisma puede traer nombres de columnas y valores de otras filas.
        request.log.error({ err: e, fila: i }, 'importacion-morosos: fila fallida');
      }
    }

    return reply.code(200).send({ creadas, cuotasTotales, errores });
  });
}
