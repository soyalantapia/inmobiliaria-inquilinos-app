import * as XLSX from 'xlsx';
import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';
import { requireUsuario } from '../auth/guards.js';
import { generarLiquidacionesContrato } from '../lib/liquidaciones.js';
import {
  CAMPOS_IMPORTACION,
  fechaFinPorDefecto,
  parsearFilaMapeada,
  sugerirMapeo,
  validarFila,
  type FilaMapeada,
} from '../lib/importacion-cartera.js';

/**
 * Migración de cartera REAL: el admin sube su planilla (Excel/CSV con SUS
 * columnas/orden), el sistema detecta los headers y sugiere un mapeo; el admin
 * lo confirma/corrige (mapeo flexible) y luego importamos las filas válidas
 * creando propiedad + propietario + inquilino + contrato ACTIVO (con sus
 * liquidaciones devengadas — mismo motor que el alta manual). Antes era 100%
 * mock: ni leía el archivo, generaba filas de prueba.
 *
 * Flujo: POST (subir+parsear) → PUT mapeo (elegir columnas) → POST confirmar.
 */

const MAX_FILAS = 2000;

export async function importacionesCarteraRoutes(app: FastifyInstance): Promise<void> {
  // Campos destino disponibles (para que el front arme el UI de mapeo).
  app.get('/importaciones-cartera/campos', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'contratos.crear');
    if (!u) return;
    return CAMPOS_IMPORTACION.map((c) => ({ key: c.key, label: c.label, requerido: c.requerido }));
  });

  app.get('/importaciones-cartera', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'contratos.crear');
    if (!u) return;
    const imps = await prisma.importacionCartera.findMany({
      where: { inmobiliariaId: u.inmobiliariaId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, nombreArchivo: true, totalFilas: true, estado: true, resultado: true, createdAt: true },
    });
    return imps.map((i) => ({ ...i, createdAt: i.createdAt.toISOString() }));
  });

  // Subir + parsear. Guarda las filas crudas + sugiere el mapeo por header.
  app.post('/importaciones-cartera', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'contratos.crear');
    if (!u) return;
    const data = await request.file();
    if (!data) return reply.code(400).send({ message: 'Falta el archivo' });
    if (!/\.(xlsx|xls|csv)$/i.test(data.filename ?? '')) {
      return reply.code(415).send({ message: 'Subí la cartera en Excel (.xlsx/.xls) o CSV.' });
    }
    const buffer = await data.toBuffer();
    if (buffer.length > 15 * 1024 * 1024) return reply.code(413).send({ message: 'El archivo supera los 15 MB.' });

    const esCsv = /\.csv$/i.test(data.filename ?? '');
    let filas: unknown[][];
    try {
      // CSV: raw (sin coerción) → las fechas quedan como texto "dd/mm/yyyy" y las
      // parsea parsearFecha (AR). Excel: cellDates → Date reales (locale correcto).
      // Sin esto, xlsx interpreta "01/06" como US mm/dd en CSV → mes equivocado.
      const wb = esCsv ? XLSX.read(buffer, { type: 'buffer', raw: true }) : XLSX.read(buffer, { type: 'buffer', cellDates: true });
      const nombreHoja = wb.SheetNames[0];
      if (!nombreHoja) return reply.code(400).send({ message: 'El archivo no tiene hojas para leer' });
      filas = XLSX.utils.sheet_to_json(wb.Sheets[nombreHoja]!, { header: 1, raw: true, blankrows: false }) as unknown[][];
    } catch {
      return reply.code(400).send({ message: 'No pudimos leer el archivo. ¿Es un Excel o CSV válido?' });
    }
    if (filas.length < 2) return reply.code(400).send({ message: 'El archivo no tiene filas de datos (solo el encabezado o vacío).' });

    const headers = (filas[0] ?? []).map((h) => String(h ?? ''));
    // sheet_to_json devuelve arrays ESPARCIDOS (celdas vacías = huecos); Array.from
    // los rellena (map los saltea → Prisma rechaza undefined). Preservamos el tipo:
    // Date→ISO, número (serial Excel/monto) tal cual, string tal cual, hueco→null.
    const cuerpo = filas.slice(1, 1 + MAX_FILAS).map((f) => {
      const fila = f ?? [];
      return Array.from({ length: fila.length }, (_, i) => {
        const c = fila[i];
        if (c === undefined || c === null) return null;
        if (c instanceof Date) return c.toISOString();
        return c as string | number;
      });
    });
    const mapeoSugerido = sugerirMapeo(headers);

    const imp = await prisma.importacionCartera.create({
      data: {
        inmobiliariaId: u.inmobiliariaId,
        archivoUrl: '', // no archivamos el archivo original (dato PII de cartera); guardamos las filas parseadas.
        nombreArchivo: data.filename ?? 'cartera',
        columnas: headers,
        filas: cuerpo,
        mapeoColumnas: mapeoSugerido,
        totalFilas: cuerpo.length,
        estado: 'SUBIDO',
        creadoPor: u.userId,
      },
    });

    return reply.code(201).send({
      id: imp.id,
      columnas: headers,
      filasPreview: cuerpo.slice(0, 20),
      totalFilas: cuerpo.length,
      mapeoSugerido,
    });
  });

  // Guardar el mapeo elegido + devolver la validación fila por fila.
  const mapeoSchema = z.object({ mapeo: z.record(z.string(), z.number().int().min(0)) });

  app.put('/importaciones-cartera/:id/mapeo', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'contratos.crear');
    if (!u) return;
    const { id } = request.params as { id: string };
    const body = mapeoSchema.safeParse(request.body ?? {});
    if (!body.success) return reply.code(400).send({ message: 'Mapeo inválido' });
    const imp = await prisma.importacionCartera.findFirst({ where: { id, inmobiliariaId: u.inmobiliariaId } });
    if (!imp) return reply.code(404).send({ message: 'Importación inexistente' });
    if (imp.estado === 'CONFIRMADO') return reply.code(409).send({ message: 'Esta importación ya se confirmó' });

    const mapeo = body.data.mapeo;
    const faltantes = CAMPOS_IMPORTACION.filter((c) => c.requerido && mapeo[c.key] === undefined);
    if (faltantes.length > 0) {
      return reply.code(400).send({ message: `Asigná una columna para: ${faltantes.map((c) => c.label).join(', ')}` });
    }

    await prisma.importacionCartera.update({ where: { id }, data: { mapeoColumnas: mapeo, estado: 'MAPEADO' } });
    const validacion = await validarFilas(imp.filas as unknown[][], mapeo, u.inmobiliariaId);
    return validacion;
  });

  // Confirmar: crea las entidades para las filas OK/ADVERTENCIA seleccionadas.
  const confirmarSchema = z.object({ filas: z.array(z.number().int().min(0)).optional() });

  app.post('/importaciones-cartera/:id/confirmar', async (request, reply) => {
    const u = await requireUsuario(request, reply, 'contratos.crear');
    if (!u) return;
    if (u.rol === 'CARGA' || u.rol === 'LECTURA') {
      return reply.code(403).send({ message: 'Solo un Admin u Operador puede confirmar una importación masiva' });
    }
    const { id } = request.params as { id: string };
    const body = confirmarSchema.safeParse(request.body ?? {});
    if (!body.success) return reply.code(400).send({ message: 'Datos inválidos' });
    const imp = await prisma.importacionCartera.findFirst({ where: { id, inmobiliariaId: u.inmobiliariaId } });
    if (!imp) return reply.code(404).send({ message: 'Importación inexistente' });
    if (imp.estado === 'CONFIRMADO') return reply.code(409).send({ message: 'Esta importación ya se confirmó' });
    if (imp.estado !== 'MAPEADO') return reply.code(400).send({ message: 'Primero confirmá el mapeo de columnas' });

    const mapeo = imp.mapeoColumnas as Record<string, number>;
    const filas = imp.filas as unknown[][];
    const seleccion = body.data.filas ? new Set(body.data.filas) : null;

    const emailsExistentes = await emailsInquilinos(u.inmobiliariaId);
    const propietarioCache = new Map<string, string>();
    let creadas = 0;
    const errores: Array<{ fila: number; motivo: string }> = [];

    for (let i = 0; i < filas.length; i++) {
      if (seleccion && !seleccion.has(i)) continue;
      const d = parsearFilaMapeada(filas[i] ?? [], mapeo);
      const v = validarFila(d, emailsExistentes);
      if (v.estado === 'ERROR' || v.estado === 'DUPLICADO') {
        errores.push({ fila: i, motivo: v.motivo ?? 'Fila inválida' });
        continue;
      }
      try {
        await crearContratoDesdeFila(u.inmobiliariaId, u.userId, d, propietarioCache);
        if (d.inquilinoEmail) emailsExistentes.add(d.inquilinoEmail); // evita duplicar en filas siguientes
        creadas++;
      } catch (e) {
        const msg = e && typeof e === 'object' && (e as { code?: string }).code === 'P2002'
          ? 'Email o dato único ya existente'
          : e instanceof Error ? e.message : 'Error al crear el contrato';
        errores.push({ fila: i, motivo: msg });
      }
    }

    const resultado = { creadas, errores };
    await prisma.importacionCartera.update({ where: { id }, data: { estado: 'CONFIRMADO', resultado } });
    return resultado;
  });
}

/* ============================================================ helpers ============================================================ */

async function emailsInquilinos(inmobiliariaId: string): Promise<Set<string>> {
  const rows = await prisma.inquilino.findMany({ where: { inmobiliariaId, email: { not: null } }, select: { email: true } });
  return new Set(rows.map((r) => (r.email ?? '').toLowerCase()).filter(Boolean));
}

interface FilaValidada {
  fila: number;
  datos: {
    direccion: string;
    inquilino: string;
    dni: string | null;
    email: string | null;
    telefono: string | null;
    propietario: string | null;
    monto: number;
    moneda: string;
    fechaInicio: string | null;
    fechaFin: string | null;
  };
  estado: string;
  motivo: string | null;
}

async function validarFilas(filas: unknown[][], mapeo: Record<string, number>, inmobiliariaId: string): Promise<{ filas: FilaValidada[]; resumen: Record<string, number> }> {
  const emailsExistentes = await emailsInquilinos(inmobiliariaId);
  const emailsEnArchivo = new Set<string>();
  const out: FilaValidada[] = [];
  const resumen: Record<string, number> = { OK: 0, ADVERTENCIA: 0, ERROR: 0, DUPLICADO: 0 };
  for (let i = 0; i < filas.length; i++) {
    const d = parsearFilaMapeada(filas[i] ?? [], mapeo);
    let v = validarFila(d, emailsExistentes);
    // Duplicado DENTRO del mismo archivo (dos filas con el mismo email).
    if (v.estado !== 'ERROR' && d.inquilinoEmail) {
      if (emailsEnArchivo.has(d.inquilinoEmail)) v = { estado: 'DUPLICADO', motivo: 'Email repetido dentro del archivo' };
      else emailsEnArchivo.add(d.inquilinoEmail);
    }
    resumen[v.estado] = (resumen[v.estado] ?? 0) + 1;
    out.push({
      fila: i,
      datos: {
        direccion: d.direccion,
        inquilino: `${d.inquilinoNombre} ${d.inquilinoApellido ?? ''}`.trim(),
        dni: d.inquilinoDni,
        email: d.inquilinoEmail,
        telefono: d.inquilinoTelefono,
        propietario: d.propietarioNombre,
        monto: d.monto,
        moneda: d.moneda,
        fechaInicio: d.fechaInicio ? d.fechaInicio.toISOString().slice(0, 10) : null,
        fechaFin: d.fechaFin ? d.fechaFin.toISOString().slice(0, 10) : null,
      },
      estado: v.estado,
      motivo: v.motivo,
    });
  }
  return { filas: out, resumen };
}

/** Find-or-create de propietario por nombre (cacheado dentro de la importación). */
async function propietarioParaFila(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  inmobiliariaId: string,
  nombreCompleto: string | null,
  cache: Map<string, string>,
): Promise<string> {
  const raw = (nombreCompleto ?? 'Propietario a definir').trim() || 'Propietario a definir';
  const key = raw.toLowerCase();
  const cached = cache.get(key);
  if (cached) return cached;
  const partes = raw.split(/\s+/);
  const nombre = partes[0]!;
  const apellido = partes.slice(1).join(' ') || '—';
  const existente = await tx.propietario.findFirst({ where: { inmobiliariaId, nombre, apellido } });
  const prop = existente ?? (await tx.propietario.create({ data: { inmobiliariaId, nombre, apellido, cuit: '', email: '', telefono: '' } }));
  cache.set(key, prop.id);
  return prop.id;
}

async function crearContratoDesdeFila(
  inmobiliariaId: string,
  userId: string,
  d: FilaMapeada,
  propietarioCache: Map<string, string>,
): Promise<void> {
  const fechaInicio = d.fechaInicio!;
  const fechaFin = d.fechaFin && d.fechaFin > fechaInicio ? d.fechaFin : fechaFinPorDefecto(fechaInicio);

  await prisma.$transaction(
    async (tx) => {
      const propietarioId = await propietarioParaFila(tx, inmobiliariaId, d.propietarioNombre, propietarioCache);

      const propiedad = await tx.propiedad.create({
        data: {
          inmobiliariaId,
          direccion: d.direccion,
          ciudad: d.ciudad || '',
          provincia: d.provincia || '',
          tipo: d.tipo,
          estado: 'ALQUILADA',
        },
      });
      await tx.participacionPropietario.create({
        data: { inmobiliariaId, propiedadId: propiedad.id, propietarioId, porcentaje: 100 },
      });

      const inq = await tx.inquilino.create({
        data: {
          inmobiliariaId,
          nombre: d.inquilinoNombre,
          apellido: d.inquilinoApellido,
          email: d.inquilinoEmail,
          telefono: d.inquilinoTelefono,
          dni: d.inquilinoDni,
          esInvitado: false,
        },
      });

      const contrato = await tx.contrato.create({
        data: {
          inmobiliariaId,
          propiedadId: propiedad.id,
          estado: 'ACTIVO',
          monto: d.monto,
          moneda: d.moneda,
          fechaInicio,
          fechaFin,
          diaPago: d.diaPago,
          indiceAjuste: 'ICL',
          frecuenciaAjusteMeses: 12,
          tipoContrato: 'ALQUILER',
          modoCobranza: 'INMOBILIARIA',
          cargadoPor: userId,
          cargadoAt: new Date(),
        },
      });
      await tx.inquilino.update({ where: { id: inq.id }, data: { contratoId: contrato.id } });
      await tx.propiedad.update({ where: { id: propiedad.id }, data: { contratoActualId: contrato.id } });
      // Migración de cartera: la app EMPIEZA A DEVENGAR desde el mes actual, NO
      // desde la fecha de inicio histórica. Si devengáramos desde el inicio (p.ej.
      // hace 6 meses), esos meses nacerían como VENCIDO = DEUDA FALSA (el inquilino
      // los venía pagando por afuera). El contrato conserva su fechaInicio real
      // (antigüedad/ajuste); solo se acota el punto de arranque del devengo. El
      // alta MANUAL con historial usa el wizard (periodosAnteriores), no esto.
      const hoy = new Date();
      const mesActual = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), 1));
      const devengarDesde = fechaInicio > mesActual ? fechaInicio : mesActual;
      await generarLiquidacionesContrato(tx, { ...contrato, fechaInicio: devengarDesde });
    },
    { timeout: 30_000, maxWait: 10_000 },
  );
}
