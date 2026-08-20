import type { Prisma } from '@prisma/client';
import { buscarOCrearPersona } from './persona.js';
import { normalizarDni } from './normalizar-dni.js';
import { generarLiquidacionesContrato } from './liquidaciones.js';

/**
 * Crear la deuda de un inquilino que YA SE FUE.
 *
 * Vive acá y no adentro de la ruta porque tiene DOS callers que no se pueden
 * permitir divergir: `POST /contratos/historico` (de a uno, desde la ficha de la
 * propiedad) y la importación masiva de morosos. Si la aritmética de la deuda
 * viviera duplicada, tarde o temprano una de las dos crearía cuotas distintas
 * que la otra — y son plata que alguien va a reclamar.
 *
 * LAS DOS INVARIANTES, que son todo el diseño:
 *
 *   1. El contrato nace **FINALIZADO**. El devengo barre `estado: 'ACTIVO'` y
 *      `devengarSiSigueActivo` lo re-verifica bajo lock, así que las cuotas que
 *      se crean acá son las únicas que va a tener: nunca le crece deuda sola.
 *   2. **NO reclama la propiedad**: no toca `contratoActualId` ni `estado`. Por
 *      eso puede convivir con el contrato vigente de otro inquilino, que es el
 *      caso normal (el moroso de hace tres años vivió donde hoy vive otro).
 *
 * `fechaInicio`/`fechaFin` delimitan la VENTANA DE DEUDA, no el alquiler real.
 *
 * NO valida: el caller decide los 400 (fechas invertidas, ventana abierta) y los
 * 404 (propiedad/persona de otro tenant). Acá sólo se escribe.
 */

export interface DatosContratoHistorico {
  inmobiliariaId: string;
  propiedadId: string;
  /** Reuso explícito de identidad. Si viene, tiene que ser del mismo tenant (validado por el caller). */
  personaId?: string | null;
  inquilino: {
    nombre: string;
    apellido?: string | null;
    /** Sólo para identificar a la Persona. NUNCA se escribe en el Inquilino — ver abajo. */
    email?: string | null;
    telefono?: string | null;
    dni?: string | null;
  };
  monto: number;
  moneda: 'ARS' | 'USD';
  montoExpensas?: number | null;
  fechaInicio: Date;
  fechaFin: Date;
  diaPago: number;
}

export interface AutorCarga {
  userId: string;
  rol: 'ADMIN' | 'OPERADOR';
}

export interface ContratoHistoricoCreado {
  contratoId: string;
  personaId: string;
  /** Cuántas cuotas de deuda quedaron creadas. */
  cuotas: number;
}

export async function crearContratoHistorico(
  tx: Prisma.TransactionClient,
  d: DatosContratoHistorico,
  autor: AutorCarga,
  /** Sólo para el texto del evento del timeline. */
  direccionPropiedad: string,
): Promise<ContratoHistoricoCreado> {
  const emailPersona = d.inquilino.email ? d.inquilino.email.trim().toLowerCase() || null : null;

  const inq = await tx.inquilino.create({
    data: {
      inmobiliariaId: d.inmobiliariaId,
      nombre: d.inquilino.nombre,
      apellido: d.inquilino.apellido || null,
      // A PROPÓSITO sin email, aunque haya venido uno.
      //
      // `Inquilino.email` es la LLAVE DE LOGIN de la PWA: `alquileresDeEmail`
      // (auth.ts) busca por email sin filtrar estado, y un contrato FINALIZADO le
      // da al ex-inquilino acceso de sólo lectura. Eso está bien para un alquiler
      // que existió de verdad y terminó — pero acá la fila la tipea el operador de
      // memoria, o peor, viene de una celda de Excel. Un email mal tipeado le
      // abriría a un TERCERO la deuda de otra persona.
      //
      // El email igual se aprovecha: va a la Persona (abajo), que es donde sirve
      // —dedup e identidad de la ficha— y NO habilita login por sí sola.
      email: null,
      telefono: d.inquilino.telefono || null,
      // Normalizado también acá: `Inquilino.dni` es de donde sale la clave de dedup
      // de deuda histórica, y tiene que quedar igual entre la carga de a uno y la masiva.
      dni: normalizarDni(d.inquilino.dni),
      esInvitado: false,
    },
  });

  const contrato = await tx.contrato.create({
    data: {
      inmobiliariaId: d.inmobiliariaId,
      propiedadId: d.propiedadId,
      estado: 'FINALIZADO',
      pendienteAprobacion: false,
      monto: d.monto,
      moneda: d.moneda,
      fechaInicio: d.fechaInicio,
      fechaFin: d.fechaFin,
      diaPago: d.diaPago,
      // FIJO + proximoAjuste null: un contrato terminado no se ajusta. La
      // frecuencia es obligatoria en el schema y acá es inerte (nada la lee para
      // un FINALIZADO), pero se deja explícita en vez de un 0 raro.
      indiceAjuste: 'FIJO',
      frecuenciaAjusteMeses: 12,
      proximoAjuste: null,
      montoExpensas: d.montoExpensas ?? null,
      tipoContrato: d.montoExpensas ? 'ALQUILER_Y_EXPENSAS' : 'ALQUILER',
      modoCobranza: 'INMOBILIARIA',
      cargadoPor: autor.userId,
      cargadoRol: autor.rol,
      cargadoAt: new Date(),
    },
  });

  // Identidad reutilizable del tenant: si el DNI ya existe se REUSA la Persona y
  // la deuda vieja aparece en la misma ficha que su alquiler actual. Es
  // literalmente lo que pidió Camila: que al cargar un DNI el sistema avise que
  // ya lo tiene. Compartido con el alta normal y con la importación de cartera,
  // para que los tres caminos agrupen igual.
  const persona = d.personaId
    ? await tx.persona.findFirstOrThrow({ where: { id: d.personaId, inmobiliariaId: d.inmobiliariaId } })
    : await buscarOCrearPersona(tx, {
        inmobiliariaId: d.inmobiliariaId,
        // Normalizado también acá: `Inquilino.dni` es de donde sale la clave de dedup
      // de deuda histórica, y tiene que quedar igual entre la carga de a uno y la masiva.
      dni: normalizarDni(d.inquilino.dni),
        email: emailPersona,
        nombre: d.inquilino.nombre,
        apellido: d.inquilino.apellido || null,
        telefono: d.inquilino.telefono || null,
      });

  await tx.inquilino.update({ where: { id: inq.id }, data: { contratoId: contrato.id, personaId: persona.id } });

  // Las cuotas de la ventana. Ambas fechas son pasadas ⇒ todas nacen VENCIDO.
  // NO se toca la propiedad: ese es el punto.
  const cuotas = await generarLiquidacionesContrato(tx, contrato);

  // Queda asentado quién cargó la deuda y cuánta: es plata que aparece de la nada
  // en la cartera, tiene que ser rastreable.
  await tx.eventoContrato.create({
    data: {
      inmobiliariaId: d.inmobiliariaId,
      contratoId: contrato.id,
      tipo: 'CREADO',
      titulo: `Deuda histórica: ${cuotas} período(s) de ${d.inquilino.nombre} en ${direccionPropiedad}`,
      detalle: 'Contrato terminado cargado para registrar deuda de un inquilino anterior. No ocupa la propiedad.',
      fecha: new Date(),
      autor: autor.userId,
    },
  });

  return { contratoId: contrato.id, personaId: persona.id, cuotas };
}
