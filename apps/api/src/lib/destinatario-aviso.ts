import type { TipoAvisoInmo } from '@prisma/client';
import { prisma } from '../db.js';

/**
 * A qué casilla mandarle a la INMOBILIARIA un aviso de un tipo dado.
 *
 * POR QUÉ: todos los avisos iban a `Inmobiliaria.email`. Camila, con 220 propiedades: *"me va a
 * llegar un mail por cada reclamo… y todos van a mi misma casilla, no a la de la chica que los
 * maneja."* Su bandeja se llena de cosas que no va a accionar y quien tiene que accionarlas no
 * se entera.
 *
 * LA REGLA: si hay una casilla configurada para ese tipo, va ahí. Si no, a la de la
 * inmobiliaria — que es el comportamiento de siempre. **No configurar nada no cambia nada.**
 */

/**
 * El catálogo de tipos, con su copy. Vive acá y no en el front para que la pantalla de
 * configuración no tenga que mantener una lista paralela: agregar un aviso nuevo es agregar el
 * valor al enum de Prisma y una entrada acá, y el panel lo muestra solo.
 */
export const TIPOS_AVISO_INMO: { tipo: TipoAvisoInmo; label: string; descripcion: string }[] = [
  {
    tipo: 'RECLAMO_NUEVO',
    label: 'Reclamos nuevos',
    descripcion: 'Cuando un inquilino abre un reclamo desde su app.',
  },
];

/** Resultado ya normalizado y listo para usar como `to:`. `null` = no hay a quién mandarle. */
export function elegirDestinatario(
  configurado: string | null | undefined,
  fallbackInmobiliaria: string | null | undefined,
): string | null {
  // `.trim()` en las dos: un email guardado con espacios —o el string vacío que el alta permite
  // en `Inmobiliaria.email`— no es un destinatario, es un campo sin completar. Sin esto,
  // nodemailer recibía " " y fallaba con un error de dirección inválida en vez de saltearse.
  const elegido = (configurado ?? '').trim() || (fallbackInmobiliaria ?? '').trim();
  return elegido || null;
}

/**
 * Versión con DB. Scopeada por `inmobiliariaId` en las dos consultas: el destinatario de una
 * inmobiliaria no puede salir nunca de la fila de otra.
 */
export async function destinatarioDeAviso(
  inmobiliariaId: string,
  tipo: TipoAvisoInmo,
): Promise<string | null> {
  const [config, inmo] = await Promise.all([
    prisma.destinatarioAviso.findUnique({
      where: { inmobiliariaId_tipo: { inmobiliariaId, tipo } },
      select: { email: true },
    }),
    prisma.inmobiliaria.findUnique({
      where: { id: inmobiliariaId },
      select: { email: true },
    }),
  ]);
  return elegirDestinatario(config?.email, inmo?.email);
}
