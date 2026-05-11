import type { Comprobante, Contrato, Liquidacion, MensajeChat, Reclamo } from './types';

// Mock fijo para que el frontend funcione sin backend. La forma matchea con
// el schema de packages/db; cuando exista la API se reemplaza por fetch real.

// Hitos históricos y futuros del contrato. Algunos vienen del schema
// (creación, fechaFin, ajustes pasados), otros se calculan en runtime.
export interface HitoContrato {
  fecha: string; // ISO
  tipo: 'INICIO' | 'AJUSTE_APLICADO' | 'AJUSTE_FUTURO' | 'FIN_CONTRATO';
  titulo: string;
  detalle?: string;
}

// Datos del garante del contrato. En backend real esto vive en
// Garante (CLAUDE.md §4) — acá lo simplificamos para mostrar en la pantalla.
export interface GaranteContrato {
  tipo: 'PROPIETARIA' | 'CAUCION' | 'SUELDO' | 'DIGITAL';
  nombreProveedor: string;
  numeroPoliza: string | null;
  montoCobertura: number;
  vigenciaHasta: string; // ISO
  contactoNombre: string;
  contactoTelefono: string;
  contactoEmail: string | null;
}

export const garanteMock: GaranteContrato = {
  tipo: 'DIGITAL',
  nombreProveedor: 'Cobertura SUMA',
  numeroPoliza: 'POL-2025-48721',
  montoCobertura: 14400000, // 30 meses de alquiler aprox
  vigenciaHasta: '2028-08-31',
  contactoNombre: 'Equipo de gestión SUMA',
  contactoTelefono: '+54 11 5288 9000',
  contactoEmail: 'soporte@cobsuma.com.ar',
};

export const hitosContratoMock: HitoContrato[] = [
  {
    fecha: '2025-09-01',
    tipo: 'INICIO',
    titulo: 'Empezó tu contrato',
    detalle: 'Alquiler inicial: $405.000 · 36 meses',
  },
  {
    fecha: '2025-11-01',
    tipo: 'AJUSTE_APLICADO',
    titulo: 'Ajuste ICL aplicado',
    detalle: '$405.000 → $432.000 · +6,7%',
  },
  {
    fecha: '2026-02-01',
    tipo: 'AJUSTE_APLICADO',
    titulo: 'Ajuste ICL aplicado',
    detalle: '$432.000 → $480.000 · +11,1%',
  },
  {
    fecha: '2026-06-01',
    tipo: 'AJUSTE_FUTURO',
    titulo: 'Próximo ajuste',
    detalle: 'Índice ICL · estimado +14% a +18%',
  },
  {
    fecha: '2028-08-31',
    tipo: 'FIN_CONTRATO',
    titulo: 'Vence el contrato',
    detalle: 'Avisanos 3 meses antes si querés renovar',
  },
];

export const contratoMock: Contrato = {
  id: 'cnt_001',
  direccion: 'Gorriti 4521, 3°B',
  ciudad: 'CABA',
  inmobiliaria: 'Inmobiliaria del Sol',
  fechaInicio: '2025-09-01',
  fechaFin: '2028-08-31',
  diaPago: 5,
  indiceAjuste: 'ICL',
  proximoAjuste: '2026-06-01',
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
  {
    id: 'cmp_004',
    periodo: '2026-01',
    monto: 480000,
    moneda: 'ARS',
    fechaPago: '2026-01-07',
    metodo: 'TRANSFERENCIA',
    pdfUrl: '#',
  },
  {
    id: 'cmp_005',
    periodo: '2025-12',
    monto: 480000,
    moneda: 'ARS',
    fechaPago: '2025-12-04',
    metodo: 'TRANSFERENCIA',
    pdfUrl: '#',
  },
  {
    id: 'cmp_006',
    periodo: '2025-11',
    monto: 480000,
    moneda: 'ARS',
    fechaPago: '2025-11-03',
    metodo: 'TRANSFERENCIA',
    pdfUrl: '#',
  },
  {
    id: 'cmp_007',
    periodo: '2025-10',
    monto: 405000,
    moneda: 'ARS',
    fechaPago: '2025-10-05',
    metodo: 'TRANSFERENCIA',
    pdfUrl: '#',
  },
  {
    id: 'cmp_008',
    periodo: '2025-09',
    monto: 405000,
    moneda: 'ARS',
    fechaPago: '2025-09-08',
    metodo: 'TRANSFERENCIA',
    pdfUrl: '#',
  },
];

// Reclamos del inquilino logueado (Mariela, contrato cnt_001). Estos son
// snapshot iniciales: el storage local hidrata desde acá si no hay nada
// guardado, y después persiste las nuevas altas + mensajes en localStorage.
export const misReclamosMock: Reclamo[] = [
  {
    id: 'rec_001',
    contratoId: 'cnt_001',
    inquilino: 'Mariela Sosa',
    direccion: 'Gorriti 4521, 3°B',
    categoria: 'PLOMERIA',
    descripcion: 'Pierde la canilla del baño desde anoche. Goteo constante.',
    urgencia: 'MEDIA',
    estado: 'ABIERTO',
    asignadoA: null,
    fotoUrl: null,
    resolucion: null,
    createdAt: '2026-05-09T14:32:00-03:00',
    resueltoAt: null,
    eventos: [
      {
        id: 'ev_001_1',
        tipo: 'CREADO',
        autor: 'Mariela Sosa',
        contenido: null,
        fecha: '2026-05-09T14:32:00-03:00',
      },
    ],
  },
  {
    id: 'rec_006',
    contratoId: 'cnt_001',
    inquilino: 'Mariela Sosa',
    direccion: 'Gorriti 4521, 3°B',
    categoria: 'PLOMERIA',
    descripcion: 'Inodoro con pérdida en la base.',
    urgencia: 'MEDIA',
    estado: 'RESUELTO',
    asignadoA: 'Sergio Almeida',
    fotoUrl: null,
    resolucion: 'Cambio de empaque y silicona perimetral. Sin filtraciones.',
    createdAt: '2026-04-28T13:00:00-03:00',
    resueltoAt: '2026-04-30T17:00:00-03:00',
    eventos: [
      {
        id: 'ev_006_1',
        tipo: 'CREADO',
        autor: 'Mariela Sosa',
        contenido: null,
        fecha: '2026-04-28T13:00:00-03:00',
      },
      {
        id: 'ev_006_2',
        tipo: 'ASIGNADO',
        autor: 'Roberto Tapia',
        contenido: 'Sergio Almeida',
        fecha: '2026-04-28T15:00:00-03:00',
      },
      {
        id: 'ev_006_3',
        tipo: 'EN_CURSO',
        autor: 'Sergio Almeida',
        contenido: 'Voy mañana 10am con plomero.',
        fecha: '2026-04-29T18:00:00-03:00',
      },
      {
        id: 'ev_006_4',
        tipo: 'RESUELTO',
        autor: 'Sergio Almeida',
        contenido: 'Cambio de empaque y silicona perimetral. Sin filtraciones.',
        fecha: '2026-04-30T17:00:00-03:00',
      },
    ],
  },
];

// Red de profesionales curada por la inmobiliaria. El inquilino los contacta
// directo por WhatsApp y la inmobiliaria valida que están al día. En backend
// real esto vive en una tabla compartida entre todas las inmobiliarias del
// network o por inmobiliaria.

export type CategoriaProfesional =
  | 'PLOMERO'
  | 'ELECTRICISTA'
  | 'GASISTA'
  | 'CERRAJERO'
  | 'PINTOR'
  | 'TECNICO_AC'
  | 'FLETE';

export interface ProfesionalRecomendado {
  id: string;
  nombre: string;
  categoria: CategoriaProfesional;
  zona: string;
  telefono: string;
  rating: number; // 1-5
  cantTrabajos: number;
  ultimoTrabajo: string | null; // ISO
  verificado: boolean;
  notas?: string;
}

export const profesionalesMock: ProfesionalRecomendado[] = [
  {
    id: 'prof_001',
    nombre: 'Sergio Almeida',
    categoria: 'PLOMERO',
    zona: 'Palermo, Villa Crespo',
    telefono: '+54 9 11 4421 8830',
    rating: 4.8,
    cantTrabajos: 24,
    ultimoTrabajo: '2026-04-30',
    verificado: true,
    notas: 'Llega en el día, factura A',
  },
  {
    id: 'prof_002',
    nombre: 'Diego Ferrari',
    categoria: 'ELECTRICISTA',
    zona: 'Palermo, Recoleta',
    telefono: '+54 9 11 6502 7714',
    rating: 4.9,
    cantTrabajos: 31,
    ultimoTrabajo: '2026-05-02',
    verificado: true,
    notas: 'Matriculado, presupuesto sin cargo',
  },
  {
    id: 'prof_003',
    nombre: 'Luciana Pérez',
    categoria: 'GASISTA',
    zona: 'CABA',
    telefono: '+54 9 11 5567 2118',
    rating: 4.7,
    cantTrabajos: 18,
    ultimoTrabajo: '2026-03-14',
    verificado: true,
    notas: 'Matriculada ENARGAS',
  },
  {
    id: 'prof_004',
    nombre: 'Pablo Cerrajería 24hs',
    categoria: 'CERRAJERO',
    zona: 'CABA, GBA Norte',
    telefono: '+54 9 11 3399 4422',
    rating: 4.6,
    cantTrabajos: 12,
    ultimoTrabajo: '2026-02-21',
    verificado: true,
  },
  {
    id: 'prof_005',
    nombre: 'Camila Torres',
    categoria: 'PINTOR',
    zona: 'Palermo, Belgrano',
    telefono: '+54 9 11 4488 1107',
    rating: 4.5,
    cantTrabajos: 9,
    ultimoTrabajo: '2026-01-18',
    verificado: false,
    notas: 'Especializada en interiores',
  },
  {
    id: 'prof_006',
    nombre: 'Frío Pro AA',
    categoria: 'TECNICO_AC',
    zona: 'CABA',
    telefono: '+54 9 11 6678 9921',
    rating: 4.7,
    cantTrabajos: 22,
    ultimoTrabajo: '2026-04-12',
    verificado: true,
    notas: 'Service split y central',
  },
  {
    id: 'prof_007',
    nombre: 'Mudanzas Soto',
    categoria: 'FLETE',
    zona: 'AMBA',
    telefono: '+54 9 11 5432 1198',
    rating: 4.4,
    cantTrabajos: 7,
    ultimoTrabajo: '2025-12-08',
    verificado: false,
    notas: 'Camión chico y mediano',
  },
];

export const profesionalCategoriaLabel: Record<CategoriaProfesional, string> = {
  PLOMERO: 'Plomería',
  ELECTRICISTA: 'Electricidad',
  GASISTA: 'Gas',
  CERRAJERO: 'Cerrajería',
  PINTOR: 'Pintura',
  TECNICO_AC: 'Aire / Calefacción',
  FLETE: 'Fletes y mudanzas',
};

export const inquilinoActual = {
  id: 'usr_mariela',
  nombre: 'Mariela Sosa',
  direccion: 'Gorriti 4521, 3°B',
  contratoId: 'cnt_001',
};

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
