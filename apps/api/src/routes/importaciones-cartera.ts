import type { Prisma } from '@prisma/client';
import * as XLSX from 'xlsx';
import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';
import { requireUsuario } from '../auth/guards.js';
import { generarLiquidacionesContrato } from '../lib/liquidaciones.js';
import { buscarOCrearPersona } from '../lib/persona.js';
import {
  CAMPOS_IMPORTACION,
  fechaFinPorDefecto,
  parsearFilaMapeada,
  sugerirMapeo,
  validarFila,
  normalizarDireccion,
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

    // Truncado EXPLÍCITO: `slice(1, 1 + MAX_FILAS)` cortaba el archivo en silencio y el
    // admin veía "2000 filas" creyendo que era la cartera completa — las de más nunca se
    // importaban y nadie se enteraba hasta que faltaba un contrato.
    const filasDelArchivo = filas.length - 1;
    const filasDescartadas = Math.max(0, filasDelArchivo - cuerpo.length);
    return reply.code(201).send({
      id: imp.id,
      columnas: headers,
      filasPreview: cuerpo.slice(0, 20),
      totalFilas: cuerpo.length,
      filasDelArchivo,
      filasDescartadas,
      maxFilas: MAX_FILAS,
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

    // RECLAMO ATÓMICO contra dos requests simultáneas (el doble click del operador, o el
    // panel reintentando después de un timeout del proxy mientras la corrida original sigue
    // viva del lado del server: Node no aborta el handler cuando el cliente se desconecta).
    // Sin esto las dos corridas arrancan con `procesadas` vacío y crean la cartera ENTERA
    // dos veces — ni el email ni la dirección tienen unique, así que nada las frena.
    //
    // Es un reclamo con vencimiento, NO un cambio de estado: marcar CONFIRMADO al arrancar
    // rompería la reanudación (una importación cortada quedaría cerrada y sin forma de
    // retomarla). Si el proceso muere, el reclamo caduca solo y el reintento sigue donde
    // quedó. Va en `resultado`, que ya es Json → sin migración.
    const RECLAMO_VENCE_MS = 15 * 60 * 1000;
    const ahoraISO = new Date().toISOString();
    const limiteISO = new Date(Date.now() - RECLAMO_VENCE_MS).toISOString();
    // UPDATE condicional en una sola sentencia: si dos requests llegan juntas, sólo una
    // ve rowsAffected=1. Prisma no puede expresar el WHERE sobre el Json, va en SQL.
    const reclamado = await prisma.$executeRaw`
      UPDATE importaciones_cartera
      SET resultado = jsonb_set(COALESCE(resultado, '{}'::jsonb), '{enCursoDesde}', to_jsonb(${ahoraISO}::text))
      WHERE id = ${id}
        AND estado = 'MAPEADO'
        AND (resultado->>'enCursoDesde' IS NULL OR resultado->>'enCursoDesde' < ${limiteISO})`;
    if (reclamado === 0) {
      return reply.code(409).send({
        message: 'Esta importación ya se está procesando. Esperá a que termine antes de reintentar.',
      });
    }

    const mapeo = imp.mapeoColumnas as Record<string, number>;
    const filas = imp.filas as unknown[][];
    const seleccion = body.data.filas ? new Set(body.data.filas) : null;

    const emailsExistentes = await emailsInquilinos(u.inmobiliariaId);
    const direccionesExistentes = await direccionesPropiedades(u.inmobiliariaId);
    const propietarioCache = new Map<string, string>();

    // REANUDABLE. Cada contrato se crea en su propia transacción dentro de UNA request
    // HTTP: si el proceso muere a mitad (redeploy, timeout del proxy, el navegador), quedan
    // K contratos creados y la importación sigue en MAPEADO. Al reintentar, la única
    // deduplicación era `emailsExistentes` — así que las filas SIN email se volvían a crear
    // ENTERAS: propiedad + inquilino + contrato + liquidaciones duplicados en la cartera
    // real del cliente. Ahora vamos anotando qué filas ya se procesaron (en `resultado`,
    // que ya es Json y no necesita migración) y el reintento las saltea.
    const previo = (imp.resultado ?? {}) as { creadas?: number; errores?: typeof errores; procesadas?: number[] };
    const procesadas = new Set<number>(previo.procesadas ?? []);
    const errores: Array<{ fila: number; motivo: string }> = [...(previo.errores ?? [])];
    let creadas = previo.creadas ?? 0;
    let sinGuardar = 0;

    // El progreso de las filas que CREAN algo se persiste DENTRO de la misma transacción
    // que las crea (ver `alTerminar` abajo): antes se anotaba después, y un checkpoint cada
    // 10 dejaba hasta 9 contratos creados y sin anotar. Si el proceso moría en esa ventana
    // —un redeploy la abre: el apagado ordenado corta a los 12s y 2000 filas no entran en
    // 12s— el reintento los volvía a crear enteros, duplicados en la cartera real del
    // cliente, y el contador que veía el operador subestimaba lo realmente creado.
    // Para las filas que sólo registran un ERROR no hace falta: no crean nada, así que
    // repetirlas en un reintento es inocuo y ahí sí conviene el checkpoint agrupado.
    const CHECKPOINT = 10;
    // El reclamo se REFRESCA en cada anotación (latido), no se deja clavado en el instante
    // de arranque: una cartera grande tarda más que el vencimiento, y con la marca vieja el
    // reclamo caducaba con la importación todavía corriendo — justo lo que evita.
    const estadoActual = () => ({ creadas, errores, procesadas: [...procesadas], enCursoDesde: new Date().toISOString() });
    const guardarProgreso = async () => {
      await prisma.importacionCartera.update({ where: { id }, data: { resultado: estadoActual() } });
      sinGuardar = 0;
    };

    for (let i = 0; i < filas.length; i++) {
      if (seleccion && !seleccion.has(i)) continue;
      if (procesadas.has(i)) continue; // ya se resolvió en un intento anterior
      const d = parsearFilaMapeada(filas[i] ?? [], mapeo);
      const v = validarFila(d, emailsExistentes, direccionesExistentes);
      if (v.estado === 'ERROR' || v.estado === 'DUPLICADO') {
        errores.push({ fila: i, motivo: v.motivo ?? 'Fila inválida' });
        procesadas.add(i);
        if (++sinGuardar >= CHECKPOINT) await guardarProgreso();
        continue;
      }
      try {
        // El estado que va a quedar SI la fila se crea. Se escribe dentro de la misma tx:
        // o quedan las dos cosas (contrato + "fila i procesada") o no queda ninguna.
        const siguiente = {
          creadas: creadas + 1, errores, procesadas: [...procesadas, i],
          enCursoDesde: new Date().toISOString(), // latido: ver estadoActual()
        };
        await crearContratoDesdeFila(u.inmobiliariaId, u.userId, d, propietarioCache, async (tx) => {
          await tx.importacionCartera.update({ where: { id }, data: { resultado: siguiente } });
        });
        // El email ya NO bloquea nada (ver validarFila): esto es para que las filas
        // siguientes del mismo archivo con este email salgan como ADVERTENCIA "ya hay un
        // inquilino con este email en tu cartera" en vez de pasar calladas como OK.
        if (d.inquilinoEmail) emailsExistentes.add(d.inquilinoEmail);
        direccionesExistentes.add(normalizarDireccion(d.direccion)); // idem: dos filas con la misma dirección
        creadas++;
        procesadas.add(i);
        sinGuardar = 0;
        continue; // ya quedó anotada de forma atómica
      } catch (e) {
        const msg = e && typeof e === 'object' && (e as { code?: string }).code === 'P2002'
          ? 'Email o dato único ya existente'
          : e instanceof Error ? e.message : 'Error al crear el contrato';
        errores.push({ fila: i, motivo: msg });
      }
      // Se marca procesada TAMBIÉN si falló: el error ya quedó registrado y reintentarla a
      // ciegas es lo que duplicaba filas. El operador la corrige y la vuelve a subir.
      procesadas.add(i);
      if (++sinGuardar >= CHECKPOINT) await guardarProgreso();
    }

    const resultado = { creadas, errores, procesadas: [...procesadas] };
    await prisma.importacionCartera.update({ where: { id }, data: { estado: 'CONFIRMADO', resultado } });
    return { creadas, errores };
  });
}

/* ============================================================ helpers ============================================================ */

/** Direcciones (normalizadas) de las propiedades ya cargadas: dedup de re-importación. */
async function direccionesPropiedades(inmobiliariaId: string): Promise<Set<string>> {
  const rows = await prisma.propiedad.findMany({ where: { inmobiliariaId }, select: { direccion: true } });
  return new Set(rows.map((r) => normalizarDireccion(r.direccion)).filter(Boolean));
}

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
  const direccionesExistentes = await direccionesPropiedades(inmobiliariaId);
  // email → filas (índice + DNI) donde ya apareció, en orden. Para avisar "es el mismo
  // inquilino que la fila N" en vez de rechazar: el mismo inquilino puede tener varias filas
  // propias dentro del MISMO archivo (multi-alquiler cargado de una — 3 locales, 10 deptos de
  // un consorcio). Separado de `emailsExistentes` (cartera YA guardada en la DB) a propósito.
  const emailsEnArchivo = new Map<string, Array<{ fila: number; dni: string | null }>>();
  // Direcciones ya vistas EN ESTE archivo (aunque todavía no existan en la DB). Espeja lo que
  // hace el confirm: ahí `direccionesExistentes.add(...)` corre apenas se crea una fila, así
  // que la 2da fila del archivo con la MISMA dirección choca contra ese Set y se rechaza como
  // DUPLICADO — aunque esa dirección no estuviera en la DB al arrancar. Sin este Set acá, el
  // preview mostraba esa 2da fila como ADVERTENCIA/seleccionada por defecto y recién el
  // confirm la frenaba: el operador decidía con una vista que no reflejaba lo que iba a pasar.
  const direccionesEnArchivo = new Set<string>();
  const out: FilaValidada[] = [];
  const resumen: Record<string, number> = { OK: 0, ADVERTENCIA: 0, ERROR: 0, DUPLICADO: 0 };
  for (let i = 0; i < filas.length; i++) {
    const d = parsearFilaMapeada(filas[i] ?? [], mapeo);
    let v = validarFila(d, emailsExistentes, direccionesExistentes);
    const direccionNorm = normalizarDireccion(d.direccion);
    if (v.estado !== 'ERROR' && v.estado !== 'DUPLICADO' && direccionesEnArchivo.has(direccionNorm)) {
      v = { estado: 'DUPLICADO', motivo: 'Ya existe una propiedad con esa dirección en tu cartera' };
    }
    // Repetido DENTRO del mismo archivo (dos filas con el mismo email): ya NO es DUPLICADO,
    // es el mismo inquilino con otro alquiler — advertencia informativa con la fila donde
    // apareció por primera vez y qué número de alquiler es este.
    if (v.estado !== 'ERROR' && v.estado !== 'DUPLICADO' && d.inquilinoEmail) {
      const previas = emailsEnArchivo.get(d.inquilinoEmail);
      const dniActual = (d.inquilinoDni ?? '').trim() || null;
      if (previas) {
        const primera = previas[0]!;
        const primeraFila = primera.fila + 2; // igual que el front (encabezado + 1-indexado): ver migracion-masiva-api-dialog.tsx
        const numeroAlquiler = previas.length + 1;
        // El email repetido no prueba que sea la MISMA persona si el DNI —el dato más
        // confiable, a mano acá— difiere: pudo ser un error de tipeo o un email compartido
        // (pareja, oficina administrativa). No lo bloqueamos (sigue siendo multi-alquiler
        // legítimo la mayoría de las veces), pero el aviso no puede afirmar algo que el
        // propio DNI contradice.
        v = primera.dni && dniActual && primera.dni !== dniActual
          ? { estado: 'ADVERTENCIA', motivo: `Mismo email que la fila ${primeraFila} pero con DNI distinto: revisá si son la misma persona` }
          : { estado: 'ADVERTENCIA', motivo: `Es el mismo inquilino que la fila ${primeraFila}: se carga como su alquiler N°${numeroAlquiler}` };
        previas.push({ fila: i, dni: dniActual });
      } else {
        emailsEnArchivo.set(d.inquilinoEmail, [{ fila: i, dni: dniActual }]);
      }
    }
    if (v.estado !== 'ERROR' && v.estado !== 'DUPLICADO') {
      direccionesEnArchivo.add(direccionNorm);
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
  /** Corre DENTRO de la transacción de la fila: sirve para anotar el progreso de forma
   *  atómica con la creación (o quedan las dos cosas, o no queda ninguna). */
  alTerminar?: (tx: Prisma.TransactionClient) => Promise<void>,
): Promise<void> {
  const fechaInicio = d.fechaInicio!;
  const fechaFin = d.fechaFin && d.fechaFin > fechaInicio ? d.fechaFin : fechaFinPorDefecto(fechaInicio);

  await prisma.$transaction(
    async (tx) => {
      const propietarioId = await propietarioParaFila(tx, inmobiliariaId, d.propietarioNombre, propietarioCache);
      // Find-or-create COMPARTIDO con el alta manual (lib/persona.ts): agrupa esta fila bajo
      // la misma Persona que el resto de los alquileres del inquilino (por DNI o, si falta,
      // por email). Va JUNTO con haber sacado el rechazo por email repetido en validarFila:
      // sin esto, la 2da fila del mismo inquilino se creaba igual pero como Inquilino
      // huérfano (sin personaId) — o, peor, con un create() ciego de Persona, reventaba con
      // P2002 contra el unique de Persona a mitad de la cartera real del cliente.
      const persona = await buscarOCrearPersona(tx, {
        inmobiliariaId,
        dni: d.inquilinoDni,
        email: d.inquilinoEmail,
        nombre: d.inquilinoNombre,
        apellido: d.inquilinoApellido,
        telefono: d.inquilinoTelefono,
      });

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
          personaId: persona.id,
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
      // PERSISTIR la decisión, no sólo aplicarla acá: el cron de devengo (y el botón
      // "Devengar" del panel) releen el contrato de la DB, así que con la fechaInicio real
      // volvían a generar TODOS los meses históricos como VENCIDO —deuda falsa, encima con
      // el monto actual post-ajustes— entre 30s y 6h después de importar la cartera.
      await tx.contrato.update({ where: { id: contrato.id }, data: { devengarDesde } });
      await generarLiquidacionesContrato(tx, { ...contrato, devengarDesde });
      // Último dentro de la tx: el progreso se commitea junto con la fila creada.
      await alTerminar?.(tx);
    },
    { timeout: 30_000, maxWait: 10_000 },
  );
}
