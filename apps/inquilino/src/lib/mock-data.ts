import type { Comprobante, Contrato, Liquidacion, MensajeChat } from './types';

// Mock fijo para que el frontend funcione sin backend. La forma matchea con
// el schema de packages/db; cuando exista la API se reemplaza por fetch real.

export const contratoMock: Contrato = {
  id: 'cnt_001',
  direccion: 'Gorriti 4521, 3°B',
  ciudad: 'CABA',
  inmobiliaria: 'Inmobiliaria del Sol',
  fechaInicio: '2025-09-01',
  fechaFin: '2028-08-31',
  diaPago: 5,
  indiceAjuste: 'ICL',
  proximoAjuste: '2026-09-01',
  montoActual: 480000,
  moneda: 'ARS',
};

export const liquidacionesMock: Liquidacion[] = [
  {
    id: 'liq_001',
    contratoId: 'cnt_001',
    periodo: '2026-05',
    montoAlquiler: 480000,
    montoExpensas: 92000,
    montoPunitorio: 0, // se recalcula en runtime con punitorios.ts
    montoTotal: 572000,
    fechaVencimiento: '2026-05-05', // venció hace ~6 días, queda atrasada para ver el flow
    estado: 'VENCIDO',
    moneda: 'ARS',
  },
  {
    id: 'liq_002',
    contratoId: 'cnt_001',
    periodo: '2026-04',
    montoAlquiler: 480000,
    montoExpensas: 88500,
    montoPunitorio: 0,
    montoTotal: 568500,
    fechaVencimiento: '2026-04-10',
    estado: 'PAGADO',
    moneda: 'ARS',
  },
];

export const comprobantesMock: Comprobante[] = [
  {
    id: 'cmp_001',
    periodo: '2026-04',
    monto: 568500,
    moneda: 'ARS',
    fechaPago: '2026-04-08',
    metodo: 'TRANSFERENCIA',
    pdfUrl: '#',
  },
  {
    id: 'cmp_002',
    periodo: '2026-03',
    monto: 568500,
    moneda: 'ARS',
    fechaPago: '2026-03-04',
    metodo: 'TRANSFERENCIA',
    pdfUrl: '#',
  },
  {
    id: 'cmp_003',
    periodo: '2026-02',
    monto: 568500,
    moneda: 'ARS',
    fechaPago: '2026-02-09',
    metodo: 'TRANSFERENCIA',
    pdfUrl: '#',
  },
];

export const chatInicialMock: MensajeChat[] = [
  {
    id: 'msg_seed',
    rol: 'ASSISTANT',
    contenido:
      'Hola, soy el asistente de tu contrato. Puedo responderte cualquier duda sobre tu alquiler: aumentos, mascotas, depósito, vencimiento. Probá preguntarme algo.',
    createdAt: new Date().toISOString(),
  },
];

export const respuestasMock: Array<{ patron: RegExp; respuesta: string; citas?: Array<{ clausula: string; texto: string }> }> = [
  {
    patron: /aumento|ajust|icl/i,
    respuesta:
      'Tu contrato se ajusta cada 12 meses según el índice ICL del BCRA. El próximo ajuste es el 1° de septiembre de 2026.',
    citas: [
      {
        clausula: 'Cláusula 4ª — Ajuste',
        texto: 'El precio del alquiler se ajustará anualmente según el Índice de Contratos de Locación (ICL) publicado por el BCRA.',
      },
    ],
  },
  {
    patron: /mascot|perro|gato/i,
    respuesta: 'Sí, podés tener mascotas. La cláusula 9 lo permite siempre que sean perros o gatos hasta 25 kg.',
    citas: [
      {
        clausula: 'Cláusula 9ª — Mascotas',
        texto: 'Se autoriza la tenencia de mascotas (perros o gatos) hasta 25 kg de peso, debiendo el inquilino responder por daños.',
      },
    ],
  },
  {
    patron: /depós|deposit/i,
    respuesta:
      'Pagaste un depósito de $480.000 (un mes de alquiler). Te lo devuelven al finalizar el contrato si no hay daños ni deudas.',
    citas: [
      {
        clausula: 'Cláusula 6ª — Garantía',
        texto: 'En concepto de depósito el inquilino abona la suma equivalente a un mes de alquiler.',
      },
    ],
  },
  {
    patron: /vencimiento|finaliza|termina/i,
    respuesta: 'Tu contrato vence el 31 de agosto de 2028. Faltan poco más de dos años.',
  },
];
