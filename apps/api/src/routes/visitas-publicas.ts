import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireProfesionalVisita } from '../auth/guards.js';
import { urlEsDelTenant } from './uploads.js';
import { imputarCostoReclamo, conceptoReclamo, ReclamoYaRendido, ReclamoNoReimputable } from '../lib/imputar-reclamo.js';
import { dinero } from '../lib/monto.js';

/**
 * Flujo del profesional asignado a un reclamo, vía link mágico (/p/:token en
 * la app inquilino). El profesional NO tiene cuenta ni password: el token
 * opaco de `VisitaProfesional.token` es el link que le manda la inmobiliaria
 * (WhatsApp/SMS). Al abrirlo (GET público), canjeamos el token por un JWT
 * corto (`kind: 'profesional'`) que habilita el resto de las acciones —
 * incluida la subida de fotos por POST /uploads, que ya acepta cualquier JWT
 * con `inmobiliariaId` (ver tenantDe() en uploads.ts).
 *
 * Máquina de estados (VisitaProfesional.estado): ASIGNADO → CONFIRMADA →
 * EN_CAMINO → LISTO. Cada transición registra un ReclamoEvento (VISITA_*)
 * para que la inmobiliaria vea el progreso en la timeline del reclamo.
 */

const ORDEN_ESTADO = { ASIGNADO: 0, CONFIRMADA: 1, EN_CAMINO: 2, LISTO: 3 } as const;
type EstadoVisita = keyof typeof ORDEN_ESTADO;

/** Gracia tras marcar LISTO: el profesional todavía ve la pantalla de confirmación. */
const GRACIA_POST_LISTO_MS = 48 * 60 * 60 * 1000;
/** Tope duro de vida del link, contado desde que se abrió el reclamo. */
const VIDA_MAX_LINK_MS = 60 * 24 * 60 * 60 * 1000;

export async function visitasPublicasRoutes(app: FastifyInstance): Promise<void> {
  // GET /visitas-publicas/:token — PÚBLICO (sin bearer): valida el token opaco
  // del link mágico y devuelve la info de la visita + un JWT de sesión corto
  // para las acciones siguientes.
  app.get('/visitas-publicas/:token', async (request, reply) => {
    const { token } = request.params as { token: string };
    const visita = await prisma.visitaProfesional.findUnique({
      where: { token },
      include: {
        profesional: { select: { nombre: true, categoria: true, telefono: true } },
        reclamo: {
          select: {
            id: true,
            // Para acotar la vida del link: la visita no tiene createdAt, pero es 1:1 con
            // el reclamo (reclamoId @unique), así que su antigüedad sirve de reloj.
            createdAt: true,
            estado: true,
            categoria: true,
            urgencia: true,
            descripcion: true,
            fotoUrl: true,
            propiedad: { select: { direccion: true, ciudad: true } },
            contrato: {
              select: { inquilinoTitular: { select: { nombre: true, apellido: true, telefono: true } } },
            },
          },
        },
      },
    });
    if (!visita) return reply.code(404).send({ message: 'Link inválido o vencido' });

    // VIGENCIA del link mágico. El token es permanente y `@unique`, y hasta acá NADA lo
    // vencía ni lo consumía: cualquiera que tuviera el link —reenviado por WhatsApp, en el
    // historial del teléfono de un profesional que ya no trabaja con la inmobiliaria—
    // seguía canjeándolo por sesiones de 14 días para siempre. Y la respuesta incluye la
    // dirección de la propiedad y el nombre y teléfono del inquilino.
    //
    // Sin migración: la visita no tiene createdAt, pero es 1:1 con el reclamo, así que
    // usamos ESE reloj + los hitos que ya se persisten.
    const vencido = (() => {
      const ahora = Date.now();
      // (a) Trabajo terminado: se deja una ventana de gracia para que el profesional vea
      //     la pantalla de confirmación y refresque, y después el link muere.
      if (visita.listoAt && ahora - new Date(visita.listoAt).getTime() > GRACIA_POST_LISTO_MS) return true;
      // (b) Reclamo cerrado o rechazado: no hay trabajo que hacer, no hay razón para entrar.
      if (visita.reclamo.estado === 'CERRADO' || visita.reclamo.estado === 'RECHAZADO') return true;
      // (c) Tope duro por antigüedad, para el link que quedó abierto y nunca se completó.
      if (ahora - new Date(visita.reclamo.createdAt).getTime() > VIDA_MAX_LINK_MS) return true;
      return false;
    })();
    if (vencido) return reply.code(410).send({ message: 'Este link ya venció. Pedile uno nuevo a la inmobiliaria.' });

    const sesion = app.jwt.sign(
      { kind: 'profesional', visitaId: visita.id, inmobiliariaId: visita.inmobiliariaId, profesionalId: visita.profesionalId },
      // 3 días, no 14: una visita normal se resuelve en ese plazo y, si tarda más, el
      // profesional vuelve a abrir el link y saca una sesión nueva (el token sigue vivo
      // mientras el reclamo lo esté). Acorta la ventana de una sesión filtrada.
      { expiresIn: '3d' },
    );

    const titular = visita.reclamo.contrato.inquilinoTitular;
    return {
      sesion,
      visita: {
        id: visita.id,
        estado: visita.estado,
        fechaVisita: visita.fechaVisita,
        confirmadaAt: visita.confirmadaAt,
        enCaminoAt: visita.enCaminoAt,
        listoAt: visita.listoAt,
        notaFinal: visita.notaFinal,
        montoCobrado: visita.montoCobrado,
        fotoAntes: visita.fotoAntes,
        fotoDespues: visita.fotoDespues,
        profesional: visita.profesional,
      },
      reclamo: {
        id: visita.reclamo.id,
        categoria: visita.reclamo.categoria,
        urgencia: visita.reclamo.urgencia,
        descripcion: visita.reclamo.descripcion,
        fotoUrl: visita.reclamo.fotoUrl,
        direccion: visita.reclamo.propiedad?.direccion ?? null,
        ciudad: visita.reclamo.propiedad?.ciudad ?? null,
        inquilino: titular ? `${titular.nombre} ${titular.apellido ?? ''}`.trim() : null,
        inquilinoTelefono: titular?.telefono ?? null,
      },
    };
  });

  /** Aplica una transición si la visita está en un estado previo válido; si ya
   * está en el estado destino (o más adelante), es idempotente (200 sin
   * volver a aplicar). Si falta un paso anterior, 409 con mensaje claro. */
  /** La visita tal como está hoy, para responder sin repetir los efectos del cierre. */
  async function visitaActualDe(visitaId: string) {
    return prisma.visitaProfesional.findUnique({ where: { id: visitaId } });
  }

  async function transicionar(
    visitaId: string,
    desde: EstadoVisita,
    hacia: EstadoVisita,
    data: Record<string, unknown>,
    reply: FastifyReply,
  ): Promise<{ ok: boolean; transiciono: boolean }> {
    const res = await prisma.visitaProfesional.updateMany({
      where: { id: visitaId, estado: desde },
      data,
    });
    if (res.count > 0) return { ok: true, transiciono: true };
    const actual = await prisma.visitaProfesional.findUnique({ where: { id: visitaId }, select: { estado: true } });
    if (actual && ORDEN_ESTADO[actual.estado] >= ORDEN_ESTADO[hacia]) {
      // Ya está en este estado o más adelante (doble-tap / reintento) → OK, pero el caller
      // tiene que saber que NO hubo transición: repetir los efectos de cerrar el trabajo
      // (contar el trabajo, imputar el costo, cerrar el reclamo) sería cobrarlo dos veces.
      return { ok: true, transiciono: false };
    }
    await reply.code(409).send({
      message:
        hacia === 'CONFIRMADA'
          ? 'Esta visita ya no está pendiente de confirmar.'
          : hacia === 'EN_CAMINO'
            ? 'Confirmá la visita antes de marcar que vas en camino.'
            : 'Marcá que vas en camino antes de dar la visita por terminada.',
    });
    return { ok: false, transiciono: false };
  }

  app.post('/visitas-publicas/confirmar', async (request, reply) => {
    const acc = await requireProfesionalVisita(request, reply);
    if (!acc) return;
    const body = z.object({ fechaVisita: z.coerce.date().optional() }).safeParse(request.body ?? {});
    if (!body.success) return reply.code(400).send({ message: 'Fecha de visita inválida' });
    const { ok } = await transicionar(
      acc.visitaId,
      'ASIGNADO',
      'CONFIRMADA',
      { estado: 'CONFIRMADA', confirmadaAt: new Date(), ...(body.data.fechaVisita ? { fechaVisita: body.data.fechaVisita } : {}) },
      reply,
    );
    if (!ok) return;
    const [visita, prof] = await Promise.all([
      prisma.visitaProfesional.findUnique({ where: { id: acc.visitaId } }),
      prisma.profesional.findUnique({ where: { id: acc.profesionalId }, select: { nombre: true } }),
    ]);
    await prisma.reclamoEvento.create({
      data: {
        inmobiliariaId: acc.inmobiliariaId,
        reclamoId: visita!.reclamoId,
        tipo: 'VISITA_CONFIRMADA',
        autor: prof?.nombre ?? 'Profesional',
        contenido: body.data.fechaVisita ? `Confirmó la visita para el ${body.data.fechaVisita.toLocaleDateString('es-AR')}` : 'Confirmó la visita',
      },
    });
    return visita;
  });

  app.post('/visitas-publicas/en-camino', async (request, reply) => {
    const acc = await requireProfesionalVisita(request, reply);
    if (!acc) return;
    const { ok } = await transicionar(acc.visitaId, 'CONFIRMADA', 'EN_CAMINO', { estado: 'EN_CAMINO', enCaminoAt: new Date() }, reply);
    if (!ok) return;
    const [visita, prof] = await Promise.all([
      prisma.visitaProfesional.findUnique({ where: { id: acc.visitaId } }),
      prisma.profesional.findUnique({ where: { id: acc.profesionalId }, select: { nombre: true } }),
    ]);
    await prisma.reclamoEvento.create({
      data: {
        inmobiliariaId: acc.inmobiliariaId,
        reclamoId: visita!.reclamoId,
        tipo: 'VISITA_EN_CAMINO',
        autor: prof?.nombre ?? 'Profesional',
        contenido: 'Va en camino',
      },
    });
    return visita;
  });

  const fotosSchema = z.object({
    fotoAntes: z.string().optional(),
    fotoDespues: z.string().optional(),
  });

  app.put('/visitas-publicas/fotos', async (request, reply) => {
    const acc = await requireProfesionalVisita(request, reply);
    if (!acc) return;
    // Una visita ya cerrada no acepta cambiar sus fotos: son el respaldo del trabajo que se
    // cobró y ya pudo haberse rendido al propietario. Antes se podían reemplazar siempre.
    const estadoActual = await prisma.visitaProfesional.findUnique({
      where: { id: acc.visitaId },
      select: { estado: true },
    });
    if (estadoActual?.estado === 'LISTO') {
      return reply.code(409).send({ message: 'La visita ya está cerrada: no se pueden cambiar las fotos.' });
    }
    const body = fotosSchema.safeParse(request.body ?? {});
    if (!body.success) return reply.code(400).send({ message: 'Datos de foto inválidos' });
    if (body.data.fotoAntes && !urlEsDelTenant(body.data.fotoAntes, acc.inmobiliariaId)) {
      return reply.code(400).send({ message: 'Foto (antes) inválida' });
    }
    if (body.data.fotoDespues && !urlEsDelTenant(body.data.fotoDespues, acc.inmobiliariaId)) {
      return reply.code(400).send({ message: 'Foto (después) inválida' });
    }
    const data: Record<string, string> = {};
    if (body.data.fotoAntes) data.fotoAntes = body.data.fotoAntes;
    if (body.data.fotoDespues) data.fotoDespues = body.data.fotoDespues;
    if (Object.keys(data).length === 0) return reply.code(400).send({ message: 'Mandá al menos una foto' });
    return prisma.visitaProfesional.update({ where: { id: acc.visitaId }, data });
  });

  const listoSchema = z.object({
    notaFinal: z.string().trim().min(1).max(1000),
    montoCobrado: dinero().optional(),
  });

  app.post('/visitas-publicas/listo', async (request, reply) => {
    const acc = await requireProfesionalVisita(request, reply);
    if (!acc) return;
    const body = listoSchema.safeParse(request.body ?? {});
    if (!body.success) return reply.code(400).send({ message: 'Contanos brevemente qué se hizo' });
    const { ok, transiciono } = await transicionar(
      acc.visitaId,
      'EN_CAMINO',
      'LISTO',
      { estado: 'LISTO', listoAt: new Date(), notaFinal: body.data.notaFinal, ...(body.data.montoCobrado != null ? { montoCobrado: body.data.montoCobrado } : {}) },
      reply,
    );
    if (!ok) return;
    // La visita YA estaba en LISTO: doble-tap, reintento, o —el caso caro— el link reabierto
    // después de que el inquilino marcó PERSISTE y el reclamo volvió a EN_CURSO. Sin este
    // corte se repetían TODOS los efectos del cierre: se re-cerraba el reclamo (el guard del
    // updateMany sólo mira estados terminales, y uno reabierto ya no lo está), se le sumaba
    // OTRO trabajo al profesional y se volvía a imputar el costo. Volver a cerrar pide una
    // visita nueva, no re-abrir el link viejo.
    if (!transiciono) return visitaActualDe(acc.visitaId);
    const [visita, prof] = await Promise.all([
      prisma.visitaProfesional.findUnique({ where: { id: acc.visitaId } }),
      prisma.profesional.findUnique({ where: { id: acc.profesionalId }, select: { nombre: true } }),
    ]);
    await prisma.reclamoEvento.create({
      data: {
        inmobiliariaId: acc.inmobiliariaId,
        reclamoId: visita!.reclamoId,
        tipo: 'VISITA_LISTO',
        autor: prof?.nombre ?? 'Profesional',
        contenido: body.data.notaFinal,
      },
    });
    // Reputación REAL: al terminar el trabajo cerramos el reclamo (RESUELTO), imputamos
    // el costo que declaró el profesional y sumamos el trabajo a su track record. Antes
    // el /listo dejaba la visita en LISTO pero NO cerraba el reclamo ni tocaba cantTrabajos
    // /ultimoTrabajo (quedaban congelados) → la reputación del panel era ficticia.
    // IDEMPOTENTE: el updateMany condicionado por estado no-terminal solo pega la primera
    // vez; un doble-tap del /listo (o un reintento) no re-cierra ni re-cuenta.
    // Cerrar el reclamo, acreditarle el trabajo al profesional e IMPUTAR el costo, todo en
    // una transacción. La imputación faltaba: el costo quedaba escrito en el reclamo pero
    // no se le cobraba a nadie si el pagador era INQUILINO o DEPOSITO (no aparecía en
    // /mis-cargos, no deducía el depósito, y la rendición lo ignoraba por no ser
    // PROPIETARIO) — y quedaba irrecuperable, porque con el reclamo ya RESUELTO el
    // /reclamos/:id/resolver del panel responde 409.
    const ahora = new Date();
    try {
      await prisma.$transaction(async (tx) => {
      const cerrado = await tx.reclamo.updateMany({
        where: {
          id: visita!.reclamoId,
          inmobiliariaId: acc.inmobiliariaId,
          estado: { notIn: ['RESUELTO', 'CERRADO', 'RECHAZADO'] },
        },
        data: {
          estado: 'RESUELTO',
          resueltoAt: ahora,
          ...(visita!.montoCobrado != null ? { costoTrabajo: visita!.montoCobrado } : {}),
        },
      });
      // El updateMany condicionado por estado es el lock: si no pegó, otro cerró primero →
      // no re-contamos el trabajo ni re-imputamos.
      if (cerrado.count === 0) return;

      await tx.profesional.update({
        where: { id: acc.profesionalId },
        data: { cantTrabajos: { increment: 1 }, ultimoTrabajo: ahora },
      });

      const rec = await tx.reclamo.findUnique({
        where: { id: visita!.reclamoId },
        select: {
          contratoId: true,
          pagador: true,
          costoTrabajo: true,
          categoria: true,
          descripcion: true,
          contrato: { select: { moneda: true } },
        },
      });
      if (!rec) return;
      await imputarCostoReclamo(tx, {
        inmobiliariaId: acc.inmobiliariaId,
        reclamoId: visita!.reclamoId,
        contratoId: rec.contratoId,
        pagador: rec.pagador,
        costo: rec.costoTrabajo != null ? Number(rec.costoTrabajo) : 0,
        moneda: rec.contrato.moneda,
        concepto: conceptoReclamo(rec.categoria, rec.descripcion),
        // Lo cerró el profesional por link mágico: no hay usuario del panel detrás.
        creadoPorId: null,
      });
      });
    } catch (e) {
      // El costo ya se le rindió al propietario y este /listo lo reimputaría al inquilino
      // o al depósito → 409. Sin este catch sería 500: la tx no tenía manejo de error.
      if (e instanceof ReclamoNoReimputable) return reply.code(409).send({ message: e.message });
      throw e;
    }
    return visita;
  });
}
