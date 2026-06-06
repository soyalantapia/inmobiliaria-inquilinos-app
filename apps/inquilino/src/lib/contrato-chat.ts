/**
 * Chat con el contrato — responde preguntas del inquilino sobre su
 * contrato de alquiler.
 *
 * Idea de Juanpi en el meeting: "tener la función de poder como
 * inquilino conversar con el contrato y que el contrato me responda
 * cosas... te da transparencia, te da seguridad".
 *
 * En backend real esto va a ser RAG (Retrieval Augmented Generation):
 *  - Indexamos el PDF del contrato en una vector store.
 *  - Cuando el inquilino pregunta, recuperamos los chunks relevantes.
 *  - Claude responde citando textualmente la cláusula.
 *
 * En la demo simulamos con un patrón de matching por palabras clave
 * sobre un conjunto de respuestas pre-armadas que cubren las preguntas
 * más comunes. Cada respuesta cita la sección/cláusula del contrato.
 */

import { contratoMock } from './mock-data';

export interface CitaContrato {
  /** Identificador de la cláusula (ej: "Art. 5", "Cláusula 12"). */
  referencia: string;
  /** Texto literal copiado del contrato. */
  texto: string;
}

export interface MensajeContratoChat {
  id: string;
  rol: 'usuario' | 'asistente';
  texto: string;
  citas?: CitaContrato[];
  /** Sugerencias de follow-up para que el inquilino haga click. */
  followUps?: string[];
  enviadoAt: string;
}

/* ============================================================
 * Catálogo de respuestas — matched por keywords.
 *
 * Cada entrada tiene:
 *  - keywords: lista de palabras que disparan la respuesta.
 *  - respuesta: el cuerpo del mensaje (con placeholders {{...}}).
 *  - citas: cláusulas que respaldan la respuesta.
 *  - followUps: preguntas sugeridas para profundizar.
 * ============================================================ */

interface RespuestaTemplate {
  keywords: string[];
  /** Función que arma la respuesta con los datos del contrato. */
  build: () => { texto: string; citas: CitaContrato[]; followUps?: string[] };
}

const RESPUESTAS: RespuestaTemplate[] = [
  /* ----- Ajustes / actualización ----- */
  {
    keywords: ['ajuste', 'actualiza', 'actualizar', 'aumento', 'sube', 'cuándo me toca'],
    build: () => {
      const proximo = new Date(contratoMock.proximoAjuste);
      const meses = Math.max(
        0,
        Math.ceil((proximo.getTime() - Date.now()) / (30 * 86400000)),
      );
      return {
        texto:
          `Tu próximo ajuste es el ${proximo.toLocaleDateString('es-AR')} ` +
          `(faltan ~${meses} meses). El contrato dice que se actualiza con el ` +
          `índice ${contratoMock.indiceAjuste} (Índice para Contratos de Locación) ` +
          `cada 3 meses sobre el último monto pagado.`,
        citas: [
          {
            referencia: 'Cláusula 7 · Actualización del canon locativo',
            texto:
              'El canon locativo será actualizado en forma trimestral según el ' +
              'Índice para Contratos de Locación (ICL) que publica el Banco ' +
              'Central de la República Argentina, conforme lo establece el ' +
              'art. 14 de la Ley 27.737.',
          },
        ],
        followUps: ['¿Cuánto va a aumentar?'],
      };
    },
  },
  {
    keywords: ['cuánto va a aumentar', 'porcentaje', 'cuanto sube'],
    build: () => ({
      texto:
        `Hoy no podemos decirte el número exacto porque el ICL se calcula al ` +
        `mes de aplicar el ajuste. Las estimaciones de mercado para el próximo ` +
        `ajuste van entre +14% y +18% trimestral. Cuando el BCRA publique el ` +
        `índice oficial, te llega un aviso por WhatsApp con el monto nuevo.`,
      citas: [
        {
          referencia: 'Cláusula 7 · Actualización del canon locativo',
          texto:
            'El porcentaje aplicado será el surgido del cociente entre el ICL ' +
            'del último mes vigente del trimestre anterior y el ICL del último ' +
            'mes anterior al inicio del trimestre.',
        },
      ],
      followUps: ['¿Y si discrepo con el cálculo?'],
    }),
  },
  /* ----- Roturas / desperfectos ----- */
  {
    keywords: ['rompo', 'rotura', 'roturas', 'arreglar', 'rompí', 'rompió', 'arreglo'],
    build: () => ({
      texto:
        `Las roturas se dividen en dos: las que pasan por uso normal (caños, ` +
        `electrodomésticos del inmueble, instalaciones) son del propietario ` +
        `("desperfectos"). Las que pasan por mal uso o accidente del inquilino ` +
        `son tuyas ("uso y goce"). En cualquiera de los dos casos, abrí un ` +
        `reclamo desde la app y la inmobiliaria define quién paga al cerrarlo.`,
      citas: [
        {
          referencia: 'Cláusula 11 · Reparaciones',
          texto:
            'Las reparaciones extraordinarias y las que provengan del uso ' +
            'natural y razonable del inmueble serán por cuenta del LOCADOR. ' +
            'Las que resulten de un mal uso o destrucción imputable al ' +
            'LOCATARIO correrán a su exclusivo cargo.',
        },
      ],
      followUps: ['¿Cómo cargo un reclamo?', '¿Me cobran a mí si lo arregla un profesional?'],
    }),
  },
  /* ----- Salida anticipada ----- */
  {
    keywords: ['salir', 'salida', 'irme antes', 'rescindir', 'rescisión', 'terminar antes', 'mudarme'],
    build: () => ({
      texto:
        `Sí, podés rescindir anticipadamente avisando con al menos 1 mes de ` +
        `antelación. Si lo hacés ANTES del primer año, la indemnización es 1 ` +
        `mes y medio de alquiler. Si lo hacés DESPUÉS del primer año, es 1 mes. ` +
        `Si avisás con 3 meses de anticipación y devolvés el inmueble pasado ` +
        `el 6º mes, NO hay indemnización.`,
      citas: [
        {
          referencia: 'Cláusula 14 · Resolución anticipada',
          texto:
            'El LOCATARIO podrá rescindir la presente locación previa ' +
            'notificación fehaciente al LOCADOR con sesenta (60) días de ' +
            'anticipación. La indemnización se calculará conforme al artículo ' +
            '1221 del Código Civil y Comercial.',
        },
      ],
      followUps: ['¿Tengo que devolver el depósito?', '¿Pierdo el mes de adelanto?'],
    }),
  },
  /* ----- Depósito / garantía ----- */
  {
    keywords: ['depósito', 'deposito', 'garantía', 'garantia', 'devuelven', 'devolver el dep', 'reintegro'],
    build: () => ({
      texto:
        `El depósito (equivalente a 1 mes de alquiler al INICIO del contrato) ` +
        `se devuelve actualizado por el último ajuste vigente, dentro de los 10 ` +
        `días de finalizado el contrato, descontando deudas y gastos por daños ` +
        `comprobables. Si la entrega de las llaves está limpia y sin pendientes, ` +
        `el reintegro es íntegro.`,
      citas: [
        {
          referencia: 'Cláusula 9 · Depósito en garantía',
          texto:
            'El LOCADOR percibe del LOCATARIO en concepto de depósito en ' +
            'garantía la suma equivalente a un (1) canon locativo inicial. ' +
            'Será restituido al final del contrato actualizado por el ICL del ' +
            'último período vigente.',
        },
      ],
      followUps: ['¿Cuándo me lo devuelven?', '¿Y si hay daños?'],
    }),
  },
  /* ----- Pago / mes / monto / vencimiento ----- */
  {
    keywords: ['cuánto pago', 'cuanto pago', 'monto', 'alquiler vale', 'el alquiler es', 'cuanto es el alquiler'],
    build: () => ({
      texto:
        `Tu canon mensual actual es de ${formatMontoCorto(contratoMock.montoActual)} ` +
        `(${contratoMock.moneda}). Más expensas si las hay. Vence cada día ` +
        `${contratoMock.diaPago} del mes. Si no pagás en fecha, sumás ` +
        `punitorios automáticos por día de atraso.`,
      citas: [
        {
          referencia: 'Cláusula 3 · Plazo, precio y forma de pago',
          texto:
            'El LOCATARIO abonará el canon locativo en forma mensual y ' +
            'consecutiva, por mes adelantado, dentro de los primeros cinco ' +
            '(5) días corridos de cada mes.',
        },
      ],
      followUps: ['¿Cuánto son los punitorios?', '¿Cuándo es el próximo ajuste?'],
    }),
  },
  /* ----- Punitorios / mora / atraso ----- */
  {
    keywords: ['punitorio', 'punitorios', 'mora', 'atraso', 'intere', 'pago tarde'],
    build: () => ({
      texto:
        `Si pagás después del día ${contratoMock.diaPago}, se aplica un punitorio ` +
        `diario sobre el monto total. La tasa actual es del 0.1% por día de ` +
        `atraso. Te recomendamos avisar a la inmobiliaria APENAS sepas que vas ` +
        `a demorar — muchas veces conceden días extra sin punitorios.`,
      citas: [
        {
          referencia: 'Cláusula 5 · Punitorios por mora',
          texto:
            'La mora se producirá de pleno derecho al vencimiento del plazo ' +
            'previsto. El LOCATARIO incurrirá en intereses moratorios ' +
            'calculados en la tasa nominal diaria fijada por el LOCADOR.',
        },
      ],
      followUps: ['¿Puedo pagar parcial?', '¿Pueden pausar los punitorios?'],
    }),
  },
  /* ----- Subalquiler / huéspedes ----- */
  {
    keywords: ['subalquilar', 'subalquiler', 'subalquil', 'huésped', 'huesped', 'compartir', 'vive conmigo'],
    build: () => ({
      texto:
        `No podés subalquilar la propiedad. Pero SÍ podés convivir con tu ` +
        `pareja, familiares directos o un convivente (registrado). Los ` +
        `huéspedes ocasionales (visitas que se quedan a dormir) no requieren ` +
        `permiso. Para que alguien se sume al contrato como co-inquilino, ` +
        `tenés que avisar a la inmobiliaria.`,
      citas: [
        {
          referencia: 'Cláusula 13 · Destino y uso del inmueble',
          texto:
            'El inmueble locado se destinará exclusivamente a vivienda ' +
            'familiar del LOCATARIO. Queda prohibido sublocarlo, cederlo, ' +
            'transferirlo en uso o en posesión a terceros sin autorización ' +
            'expresa y por escrito del LOCADOR.',
        },
      ],
      followUps: ['¿Cómo sumo un co-inquilino?'],
    }),
  },
  /* ----- Mascotas ----- */
  {
    keywords: ['mascota', 'mascotas', 'perro', 'gato', 'animal', 'animales'],
    build: () => ({
      texto:
        `Tu contrato no prohíbe expresamente tener mascotas. La ley argentina ` +
        `(art. 1958 del CCyC) dice que el propietario NO puede prohibirlo ` +
        `arbitrariamente. Tenés que cuidar que no causen ruidos molestos ni ` +
        `daños al inmueble — si los causan, son a tu cargo. Si el consorcio ` +
        `del edificio tiene reglamento contra mascotas, ese sí aplica.`,
      citas: [
        {
          referencia: 'Cláusula 17 · Convivencia y reglamento',
          texto:
            'El LOCATARIO deberá respetar el reglamento de copropiedad y ' +
            'administración del consorcio en el caso de inmuebles en propiedad ' +
            'horizontal, así como las normas de convivencia.',
        },
      ],
      followUps: ['¿Dónde veo el reglamento del consorcio?'],
    }),
  },
  /* ----- Fin de contrato / vencimiento general ----- */
  {
    keywords: ['cuándo vence', 'cuando vence', 'fin', 'termina', 'vencimiento del contrato', 'cuándo se vence'],
    build: () => {
      const fin = new Date(contratoMock.fechaFin);
      const meses = Math.max(
        0,
        Math.ceil((fin.getTime() - Date.now()) / (30 * 86400000)),
      );
      return {
        texto:
          `Tu contrato vence el ${fin.toLocaleDateString('es-AR')} ` +
          `(faltan ~${meses} meses). Si querés renovar, avisanos al menos 3 ` +
          `meses antes para empezar la negociación. Si no, tenés que avisar ` +
          `con la misma antelación para coordinar la entrega del inmueble.`,
        citas: [
          {
            referencia: 'Cláusula 2 · Plazo de la locación',
            texto:
              'La presente locación tendrá un plazo de tres (3) años, contado ' +
              'a partir del 1 de septiembre de 2025 y hasta el 31 de agosto ' +
              'de 2028.',
          },
        ],
        followUps: ['¿Quiero renovar, qué hago?', '¿Y si no renuevo?'],
      };
    },
  },
];

const RESPUESTA_DEFAULT = (pregunta: string) => ({
  texto:
    `No encuentro algo específico en tu contrato sobre "${pregunta}". Si la ` +
    `consulta es importante, escribile a la inmobiliaria por WhatsApp — ellos ` +
    `tienen la copia completa y pueden interpretar mejor. También podés ` +
    `descargar el PDF del contrato desde esta página y revisarlo vos mismo.`,
  citas: [] as CitaContrato[],
  followUps: [
    '¿Cuándo me toca actualizar?',
    '¿Qué pasa si rompo algo?',
    '¿Puedo salir antes?',
  ],
});

function formatMontoCorto(n: number): string {
  return `$${Math.round(n).toLocaleString('es-AR')}`;
}

function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[¿?¡!.,;:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Responde una pregunta del inquilino. Matchea contra el catálogo de
 * keywords y devuelve la respuesta del template ganador. Si nada
 * matchea, devuelve la respuesta default con sugerencias.
 */
export function responderPregunta(pregunta: string): {
  texto: string;
  citas: CitaContrato[];
  followUps?: string[];
} {
  const p = normalizar(pregunta);
  if (!p) return RESPUESTA_DEFAULT(pregunta);

  // Scoreamos cada template por cantidad de keywords matched.
  let mejorScore = 0;
  let ganador: RespuestaTemplate | null = null;
  for (const t of RESPUESTAS) {
    let score = 0;
    for (const k of t.keywords) {
      if (p.includes(normalizar(k))) score++;
    }
    if (score > mejorScore) {
      mejorScore = score;
      ganador = t;
    }
  }
  if (ganador) return ganador.build();
  return RESPUESTA_DEFAULT(pregunta);
}

/** Preguntas sugeridas que el inquilino ve antes de escribir la primera. */
export const PREGUNTAS_SUGERIDAS = [
  '¿Cuándo me toca actualizar?',
  '¿Qué pasa si rompo algo?',
  '¿Puedo salir antes?',
  '¿Cuándo me devuelven el depósito?',
  '¿Cuánto pago por mes?',
  '¿Puedo tener mascotas?',
] as const;
