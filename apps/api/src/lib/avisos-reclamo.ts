import { prisma } from '../db.js';
import { destinatarioDeAviso } from './destinatario-aviso.js';
import {
  enviarReclamoAsignadoInquilino,
  enviarReclamoNuevoInmo,
  enviarReclamoResueltoInquilino,
} from '../mailer.js';

/**
 * Avisos por MAIL del ciclo del reclamo.
 *
 * Pedido de la reunión del 03/08: *"tiene que notificarle también los reclamos, tiene todo por
 * email y por la plataforma, por si no no está enterada"*. La parte "en la plataforma" ya
 * existía en los dos lados —la campana del panel cuenta los sin resolver, y
 * `GET /mis-notificaciones` ya le avisa al inquilino cuando le responden, le asignan
 * profesional o hay que calificar—; lo que faltaba era el mail.
 *
 * TRES REGLAS QUE VALEN PARA LAS TRES FUNCIONES:
 *
 * 1. **Best-effort.** Devuelven `void` y nunca tiran. El caller las dispara con `void … .catch()`
 *    DESPUÉS de que la transacción commiteó. Abrir un reclamo, asignarlo o resolverlo tiene que
 *    funcionar igual con el SMTP caído: la notificación es un extra, no parte de la operación.
 *
 * 2. **El destinatario se resuelve SIEMPRE scopeado por `inmobiliariaId`.** Nunca se confía en un
 *    id que venga del request. Mandarle a una inmobiliaria el reclamo de otra sería una fuga de
 *    datos entre tenants, que es el peor error posible en este sistema.
 *
 * 3. **Si no hay email, no se intenta.** Un inquilino sin email cargado es un caso normal (la
 *    cartera se migra con datos incompletos), no un error.
 */

/** Rótulo de la propiedad: el nombre por el que la inmobiliaria la reconoce. */
function rotulo(p: { direccion: string; complejo: string | null; consorcio: { nombre: string } | null }): string {
  const ref = p.consorcio?.nombre?.trim() || p.complejo?.trim() || '';
  return ref ? `${ref} · ${p.direccion}` : p.direccion;
}

/** A la inmobiliaria: un inquilino abrió un reclamo. */
export async function avisarReclamoNuevoAInmo(opts: {
  inmobiliariaId: string;
  reclamoId: string;
  autor: string;
  categoria: string;
  urgencia: string;
  descripcion: string;
}): Promise<void> {
  const reclamo = await prisma.reclamo.findFirst({
    where: { id: opts.reclamoId, inmobiliariaId: opts.inmobiliariaId },
    select: {
      propiedad: { select: { direccion: true, complejo: true, consorcio: { select: { nombre: true } } } },
    },
  });
  if (!reclamo) return;
  // El destinatario ya no es fijo: si la inmobiliaria configuró una casilla para los reclamos,
  // va ahí; si no, a la de siempre. Camila (03/08): *"todos van a mi misma casilla, no a la de
  // la chica que los maneja"*. Ver lib/destinatario-aviso.ts.
  const email = await destinatarioDeAviso(opts.inmobiliariaId, 'RECLAMO_NUEVO');
  if (!email) return;

  await enviarReclamoNuevoInmo({
    email,
    autor: opts.autor,
    propiedad: reclamo.propiedad ? rotulo(reclamo.propiedad) : 'Propiedad sin dirección',
    categoria: opts.categoria,
    urgencia: opts.urgencia,
    descripcion: opts.descripcion,
    reclamoId: opts.reclamoId,
  });
}

/**
 * Al inquilino titular: le asignaron un profesional, o su reclamo se resolvió.
 *
 * Un solo helper para los dos casos porque comparten TODA la resolución de destinatario, que es
 * la parte con riesgo (scope por tenant + contrato + titular). Lo único que cambia es el mail.
 */
export async function avisarAlInquilinoDelReclamo(opts: {
  inmobiliariaId: string;
  reclamoId: string;
  evento: { tipo: 'ASIGNADO'; profesional: string; oficio: string | null } | { tipo: 'RESUELTO'; notas: string | null };
}): Promise<void> {
  const reclamo = await prisma.reclamo.findFirst({
    where: { id: opts.reclamoId, inmobiliariaId: opts.inmobiliariaId },
    select: {
      inmobiliaria: { select: { nombre: true } },
      contrato: { select: { inquilinoTitular: { select: { email: true } } } },
    },
  });
  const email = reclamo?.contrato?.inquilinoTitular?.email?.trim();
  if (!reclamo || !email) return;
  const inmobiliariaNombre = reclamo.inmobiliaria?.nombre ?? 'Tu inmobiliaria';

  if (opts.evento.tipo === 'ASIGNADO') {
    await enviarReclamoAsignadoInquilino({
      email,
      profesional: opts.evento.profesional,
      oficio: opts.evento.oficio,
      inmobiliariaNombre,
      reclamoId: opts.reclamoId,
    });
    return;
  }

  await enviarReclamoResueltoInquilino({
    email,
    inmobiliariaNombre,
    notas: opts.evento.notas,
    reclamoId: opts.reclamoId,
  });
}
