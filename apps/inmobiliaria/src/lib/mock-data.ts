import type {
  ContratoExtraido,
  ContratoListado,
  Propiedad,
  Propietario,
  Reclamo,
  ScreeningResultado,
} from './types';

export const contratosMock: ContratoListado[] = [
  {
    id: 'cnt_001',
    inquilino: 'Mariela Sosa',
    direccion: 'Gorriti 4521, 3°B',
    monto: 480000,
    moneda: 'ARS',
    estado: 'ACTIVO',
    fechaInicio: '2025-09-01',
    fechaFin: '2028-08-31',
    proximoVencimiento: '2026-05-10',
    estadoPagoActual: 'PENDIENTE',
  },
  {
    id: 'cnt_002',
    inquilino: 'Juan Pérez',
    direccion: 'Av. Cabildo 2890, 7°A',
    monto: 620000,
    moneda: 'ARS',
    estado: 'ACTIVO',
    fechaInicio: '2023-09-01',
    fechaFin: '2026-08-31',
    proximoVencimiento: '2026-05-08',
    estadoPagoActual: 'PAGADO',
  },
  {
    id: 'cnt_003',
    inquilino: 'Laura Giménez',
    direccion: 'Jorge Newbery 1820',
    monto: 510000,
    moneda: 'ARS',
    estado: 'ACTIVO',
    fechaInicio: '2023-12-15',
    fechaFin: '2026-12-14',
    proximoVencimiento: '2026-05-15',
    estadoPagoActual: 'VENCIDO',
  },
  {
    id: 'cnt_004',
    inquilino: 'Carlos Romero',
    direccion: 'Honduras 4490, PB',
    monto: 720000,
    moneda: 'ARS',
    estado: 'ACTIVO',
    fechaInicio: '2024-11-01',
    fechaFin: '2027-10-31',
    proximoVencimiento: '2026-05-05',
    estadoPagoActual: 'PAGADO',
  },
  {
    id: 'cnt_005',
    inquilino: 'Ana Pereyra',
    direccion: 'Salguero 2240, 12°D',
    monto: 850000,
    moneda: 'ARS',
    estado: 'ACTIVO',
    fechaInicio: '2025-04-01',
    fechaFin: '2028-03-31',
    proximoVencimiento: '2026-05-10',
    estadoPagoActual: 'PENDIENTE',
  },
  {
    id: 'cnt_006',
    inquilino: 'Tomás Bravo',
    direccion: 'Olleros 3920',
    monto: 1200,
    moneda: 'USD',
    estado: 'BORRADOR',
    fechaInicio: '2026-06-01',
    fechaFin: '2029-05-31',
    proximoVencimiento: '2026-06-01',
    estadoPagoActual: 'PENDIENTE',
  },
];

export const contratoExtraidoMock: ContratoExtraido = {
  inquilino: { valor: 'Mariela Sosa', confianza: 'alto' },
  cuit: { valor: '27-32567890-4', confianza: 'alto' },
  direccion: { valor: 'Gorriti 4521, 3°B', confianza: 'alto' },
  montoInicial: { valor: 480000, confianza: 'alto' },
  moneda: { valor: 'ARS', confianza: 'alto' },
  fechaInicio: { valor: '2025-09-01', confianza: 'alto' },
  fechaFin: { valor: '2028-08-31', confianza: 'alto' },
  diaPago: { valor: 5, confianza: 'medio' },
  indiceAjuste: { valor: 'ICL', confianza: 'alto' },
  frecuenciaAjusteMeses: { valor: 12, confianza: 'alto' },
  comisionInmobiliaria: { valor: 4.17, confianza: 'medio' },
  depositoGarantia: { valor: 480000, confianza: 'alto' },
  tasaPunitorioDiaria: { valor: 0.001, confianza: 'bajo' },
};

// Perfil completo tipo SkipTrace (MKT Insiders / Nosis). Persona ficticia
// con datos coherentes para mostrar todas las secciones del informe.
export const screeningMock: ScreeningResultado = {
  cuit: '20-31256789-0',
  dni: '31.256.789',
  nombre: 'Carlos Eduardo',
  apellido: 'Méndez',
  fechaNacimiento: '1985-04-22',
  sexo: 'M',

  domicilio: {
    calle: 'Av. Rivadavia',
    altura: '6420',
    pisoDpto: '8°C',
    codigoPostal: '1406',
    localidad: 'Caballito',
    partido: 'CABA',
    provincia: 'Buenos Aires',
  },

  telefonos: [
    { numero: '+54 11 4631 5870', tipo: 'FIJO', whatsappActivo: false },
    { numero: '+54 9 11 5234 7891', tipo: 'CELULAR', whatsappActivo: true },
    { numero: '+54 9 11 6789 1234', tipo: 'CELULAR', whatsappActivo: true },
    { numero: '+54 9 11 3456 7890', tipo: 'CELULAR', whatsappActivo: false },
  ],
  email: 'carlos.mendez@gmail.com',

  bcra: {
    entidadesCount: 4,
    deudaTomada: 1850000,
    deudaEnMora: 0,
    riesgo: 'bajo',
    situaciones: { 1: 4 },
    entidades: [
      { codigo: '0007', nombre: 'Banco Galicia', deuda: 980000 },
      { codigo: '0011', nombre: 'Banco Nación', deuda: 520000 },
      { codigo: '0017', nombre: 'BBVA Argentina', deuda: 240000 },
      { codigo: '0072', nombre: 'Banco Patagonia', deuda: 110000 },
    ],
    deudaUltimos24m: true,
  },

  cheques: {
    rechazadosCount: 0,
    rechazadosMonto: 0,
    levantadosCount: 2,
    levantadosMonto: 350000,
  },

  familia: [
    {
      vinculo: 'CONYUGE',
      nombreCompleto: 'María Laura Fernández',
      telefonos: [{ numero: '+54 9 11 5678 1234', tipo: 'CELULAR', whatsappActivo: true }],
      email: 'mlaura.fernandez@gmail.com',
    },
    {
      vinculo: 'HIJO',
      nombreCompleto: 'Tomás Méndez',
      telefonos: [],
      email: null,
    },
    {
      vinculo: 'HIJO',
      nombreCompleto: 'Sofía Méndez',
      telefonos: [],
      email: null,
    },
    {
      vinculo: 'PADRE_MADRE',
      nombreCompleto: 'Roberto Méndez',
      telefonos: [
        { numero: '+54 11 4234 5678', tipo: 'FIJO', whatsappActivo: false },
        { numero: '+54 9 11 4111 2222', tipo: 'CELULAR', whatsappActivo: true },
      ],
      email: 'roberto.mendez@yahoo.com.ar',
    },
    {
      vinculo: 'HERMANO',
      nombreCompleto: 'Mariana Méndez',
      telefonos: [{ numero: '+54 9 11 3322 1144', tipo: 'CELULAR', whatsappActivo: true }],
      email: 'mariana.mendez@hotmail.com',
    },
  ],
  rangoIngresoFamiliar: 'A5',
  bcraFamiliar: {
    entidadesCount: 7,
    deudaTomada: 2840000,
    deudaEnMora: 180000,
    riesgo: 'medio',
    situaciones: { 1: 5, 2: 2 },
    entidades: [
      { codigo: '0007', nombre: 'Banco Galicia', deuda: 1450000 },
      { codigo: '0072', nombre: 'Banco Patagonia', deuda: 620000 },
      { codigo: '0011', nombre: 'Banco Nación', deuda: 580000 },
      { codigo: '0044', nombre: 'Banco Hipotecario', deuda: 190000 },
    ],
    deudaUltimos24m: true,
  },

  inmuebles: [
    {
      partidoCatastral: 'CABA 12-23-4',
      ubicacion: 'Av. Rivadavia 6420 8°C — Caballito, CABA',
      tipo: 'DEPARTAMENTO',
      fechaAdquisicion: '2018-03-15',
    },
    {
      partidoCatastral: 'BA 053-12-89',
      ubicacion: 'Lote 12 — Country Las Praderas, Pilar',
      tipo: 'TERRENO',
      fechaAdquisicion: '2021-11-08',
    },
  ],
  vehiculos: [
    {
      marca: 'Toyota',
      modelo: 'Corolla Cross XEI',
      anio: 2023,
      fechaCompra: '2023-06-10',
      patente: 'AC842PQ',
    },
    {
      marca: 'Renault',
      modelo: 'Sandero 1.6',
      anio: 2017,
      fechaCompra: '2017-09-22',
      patente: 'AB129XR',
    },
  ],

  ingresos: {
    categoriaAfip: 'RELACION_DEPENDENCIA',
    impuestoGanancias: 'AC',
    impuestoIva: 'NA',
    integranteSocietario: false,
    empleador: false,
    ciiu: '620100',
    actividadDescripcion: 'Servicios de consultores en informática y suministros de programas',
    obraSocialCodigo: '203500',
    obraSocialNombre: 'OSDE — Organización de Servicios Directos Empresarios',
    nominaUltimos6m: [
      { periodo: '2026-04', rangoIngreso: 'A6', fechaPago: '2026-05-05' },
      { periodo: '2026-03', rangoIngreso: 'A6', fechaPago: '2026-04-05' },
      { periodo: '2026-02', rangoIngreso: 'A6', fechaPago: '2026-03-05' },
      { periodo: '2026-01', rangoIngreso: 'A5', fechaPago: '2026-02-05' },
      { periodo: '2025-12', rangoIngreso: 'A6', fechaPago: '2026-01-05' },
      { periodo: '2025-11', rangoIngreso: 'A5', fechaPago: '2025-12-05' },
    ],
  },

  empleador: {
    cuit: '30-71234567-9',
    razonSocial: 'Globant Argentina S.A.',
    ciiu: '620100',
    actividad: 'Servicios de consultores en informática',
    telefonos: ['+54 11 4014 4040', '+54 11 4014 4041'],
    email: 'rrhh@globant.com',
    paginaWeb: 'https://www.globant.com',
    tipoEmpresa: 'Sociedad Anónima',
    artVigente: true,
    bcra: {
      entidadesCount: 6,
      deudaTomada: 145000000,
      deudaEnMora: 0,
      riesgo: 'bajo',
      situaciones: { 1: 6 },
      entidades: [
        { codigo: '0007', nombre: 'Banco Galicia', deuda: 65000000 },
        { codigo: '0017', nombre: 'BBVA Argentina', deuda: 42000000 },
        { codigo: '0027', nombre: 'Banco Supervielle', deuda: 28000000 },
      ],
      deudaUltimos24m: true,
    },
  },

  vecinos: [
    {
      nombreCompleto: 'Andrea Pérez',
      telefono: '+54 9 11 5555 7890',
      direccion: 'Av. Rivadavia 6420 8°B',
    },
    {
      nombreCompleto: 'Diego Romano',
      telefono: '+54 9 11 4422 3311',
      direccion: 'Av. Rivadavia 6420 8°D',
    },
    {
      nombreCompleto: 'Encargado del edificio',
      telefono: '+54 9 11 3344 5566',
      direccion: 'Portería · Av. Rivadavia 6420',
    },
  ],

  huellaDigital: {
    scoreCoherencia: 'alta',
    antiguedadAnios: 14,
    mencionesGoogle: 12,
    emailEnSitios: 23,
    perfiles: [
      {
        plataforma: 'LINKEDIN',
        handle: 'carlos-mendez-globant',
        url: 'https://linkedin.com/in/carlos-mendez-globant',
        verificado: true,
        estado: 'ACTIVO',
        seguidores: 1840,
        ultimaActividad: '2026-05-08T14:32:00-03:00',
        notas:
          'Senior Software Engineer en Globant desde 2019. Historial laboral coherente con la declaración. 6 recomendaciones.',
      },
      {
        plataforma: 'INSTAGRAM',
        handle: '@carlos.mendez85',
        url: 'https://instagram.com/carlos.mendez85',
        verificado: false,
        estado: 'ACTIVO',
        seguidores: 1247,
        ultimaActividad: '2026-05-09T20:14:00-03:00',
        notas: 'Cuenta personal. Fotos de viajes, familia y deporte. Sin contenido marcado.',
      },
      {
        plataforma: 'FACEBOOK',
        handle: 'carlos.mendez.eduardo',
        url: 'https://facebook.com/carlos.mendez.eduardo',
        verificado: false,
        estado: 'INACTIVO',
        seguidores: 432,
        ultimaActividad: '2024-08-12T10:00:00-03:00',
        notas: 'Cuenta vieja, sin actividad reciente. Foto de perfil pública.',
      },
      {
        plataforma: 'X',
        handle: '@cmendez_dev',
        url: 'https://x.com/cmendez_dev',
        verificado: false,
        estado: 'ACTIVO',
        seguidores: 320,
        ultimaActividad: '2026-04-22T11:05:00-03:00',
        notas: 'Comparte contenido técnico. Tono profesional.',
      },
      {
        plataforma: 'THREADS',
        handle: '@carlos.mendez85',
        url: 'https://threads.net/@carlos.mendez85',
        verificado: false,
        estado: 'INACTIVO',
        seguidores: 89,
        ultimaActividad: '2024-12-10T19:00:00-03:00',
        notas: null,
      },
      {
        plataforma: 'TIKTOK',
        handle: null,
        url: null,
        verificado: false,
        estado: 'NO_ENCONTRADO',
        seguidores: null,
        ultimaActividad: null,
        notas: null,
      },
      {
        plataforma: 'YOUTUBE',
        handle: null,
        url: null,
        verificado: false,
        estado: 'NO_ENCONTRADO',
        seguidores: null,
        ultimaActividad: null,
        notas: null,
      },
      {
        plataforma: 'GOOGLE',
        handle: null,
        url: 'https://www.google.com/search?q=Carlos+Mendez+Globant',
        verificado: false,
        estado: 'ACTIVO',
        seguidores: null,
        ultimaActividad: null,
        notas: '12 menciones: 8 técnicas (charlas, blogs, repos GitHub), 4 de eventos comunitarios.',
      },
    ],
    hallazgos: [
      {
        tipo: 'positivo',
        texto: 'Identidad coherente cross-plataforma. LinkedIn confirma empleador y antigüedad declarados.',
      },
      {
        tipo: 'positivo',
        texto: 'Sin menciones a deshaucios, juicios o conflictos contractuales previos.',
      },
      {
        tipo: 'positivo',
        texto:
          'Email aparece en 23 sitios públicos (GitHub, Meetup, Eventbrite) — patrón típico de perfil técnico profesional.',
      },
      {
        tipo: 'neutro',
        texto: 'Sin cuentas en TikTok o YouTube. Coherente con perfil profesional 40+.',
      },
    ],
  },

  scoreNosis: 742,
  recomendacion: 'APTO',
  recomendacionRazon:
    'Score Nosis 742 (alto). BCRA categoría 1 con 4 entidades, sin mora ni deuda en riesgo. Patrimonio sólido (2 inmuebles + 2 vehículos), antigüedad laboral en empresa grande con ART vigente. Ingresos formales estables últimos 6 meses (rango A5-A6). Grupo familiar con leve atraso (Sit 2) pero sin impacto material. Apto sin garantía adicional.',
};

// Las métricas core (ingresos, morosos, ocupación) se calculan en runtime
// con dashboardHelpers a partir de contratosMock + propiedadesMock +
// reclamosMock. Acá quedan solo métricas estratégicas y comparativos que
// el backend tendría que calcular cross-tabla (vencimientos próximos,
// variaciones vs mes anterior, etc.).
export const dashboardMetricsMock = {
  // operacionales (estimadas, en backend real se calculan)
  proximosAjustes30d: 5, // contratos con ajuste en los próximos 30 días
  contratosVencen90d: 4, // contratos que terminan en los próximos 90 días
  garantiasVencen30d: 2, // pólizas de garantía que vencen en 30 días
  screeningsPendientes: 2, // screenings en curso (no convertidos a contrato)
  reclamosResueltosMes: 8, // resueltos este mes
  tiempoPromedioResolucionDias: 3.2,

  // comparativos vs mes anterior (en %)
  variacionIngresos: 8.4, // +8.4% vs abril
  variacionCobrabilidad: 2.1, // +2.1 puntos vs abril
  variacionMorosos: -25, // -25% vs abril (mejor)
};

// Agenda próximos 14 días — eventos importantes
export const agendaMock = [
  {
    id: 'ag_1',
    fecha: '2026-05-12',
    titulo: 'Vencimiento alquiler Mariela Sosa',
    detalle: 'Gorriti 4521 · $572.000',
    tipo: 'pago' as const,
    urgencia: 'alta' as const,
  },
  {
    id: 'ag_2',
    fecha: '2026-05-15',
    titulo: 'Ajuste ICL · contrato Cabildo 2890',
    detalle: 'Juan Pérez · +18,4% estimado',
    tipo: 'ajuste' as const,
    urgencia: 'media' as const,
  },
  {
    id: 'ag_3',
    fecha: '2026-05-18',
    titulo: 'Vence póliza de garantía',
    detalle: 'Laura Giménez · Newbery 1820',
    tipo: 'garantia' as const,
    urgencia: 'media' as const,
  },
  {
    id: 'ag_4',
    fecha: '2026-05-22',
    titulo: 'Renovación de contrato',
    detalle: 'Honduras 4490 · Carlos Romero',
    tipo: 'renovacion' as const,
    urgencia: 'baja' as const,
  },
  {
    id: 'ag_5',
    fecha: '2026-05-25',
    titulo: 'Rendición a propietarios',
    detalle: '5 propietarios · $2.1M total',
    tipo: 'rendicion' as const,
    urgencia: 'media' as const,
  },
];

// Top alertas — lo que requiere acción inmediata
export const alertasMock = [
  {
    id: 'al_1',
    titulo: 'Reclamo de emergencia sin asignar',
    detalle: 'Carlos Romero · Electricidad · Honduras 4490',
    href: '/reclamos/rec_003',
    severidad: 'critica' as const,
  },
  {
    id: 'al_2',
    titulo: 'Pago atrasado 6 días',
    detalle: 'Mariela Sosa · $572.000 + $5.148 punitorios',
    href: '/pagos',
    severidad: 'alta' as const,
  },
  {
    id: 'al_3',
    titulo: 'Propietario sin CBU cargado',
    detalle: 'Federico López Vega · no podrás rendir',
    href: '/propietarios',
    severidad: 'media' as const,
  },
];

export const operadoresMock = ['Roberto Tapia', 'Luciana Vidal', 'Sergio Almeida'] as const;

export const reclamosMock: Reclamo[] = [
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
    id: 'rec_002',
    contratoId: 'cnt_003',
    inquilino: 'Laura Giménez',
    direccion: 'Jorge Newbery 1820',
    categoria: 'CALEFACCION',
    descripcion: 'No prende la caldera. Hace 2 días sin agua caliente.',
    urgencia: 'ALTA',
    estado: 'EN_CURSO',
    asignadoA: 'Sergio Almeida',
    fotoUrl: null,
    resolucion: null,
    createdAt: '2026-05-08T09:15:00-03:00',
    resueltoAt: null,
    eventos: [
      {
        id: 'ev_002_1',
        tipo: 'CREADO',
        autor: 'Laura Giménez',
        contenido: null,
        fecha: '2026-05-08T09:15:00-03:00',
      },
      {
        id: 'ev_002_2',
        tipo: 'ASIGNADO',
        autor: 'Roberto Tapia',
        contenido: 'Sergio Almeida',
        fecha: '2026-05-08T11:20:00-03:00',
      },
      {
        id: 'ev_002_3',
        tipo: 'MENSAJE_INMO',
        autor: 'Sergio Almeida',
        contenido: 'Hola Laura, te paso a visitar mañana entre 10 y 12 con el gasista. ¿Estás?',
        fecha: '2026-05-08T11:35:00-03:00',
      },
      {
        id: 'ev_002_4',
        tipo: 'MENSAJE_INQUILINO',
        autor: 'Laura Giménez',
        contenido: 'Sí, te espero. Gracias!',
        fecha: '2026-05-08T12:10:00-03:00',
      },
      {
        id: 'ev_002_5',
        tipo: 'EN_CURSO',
        autor: 'Sergio Almeida',
        contenido: 'Pasó el gasista, hay que cambiar termocupla. Volvemos mañana.',
        fecha: '2026-05-09T13:00:00-03:00',
      },
    ],
  },
  {
    id: 'rec_003',
    contratoId: 'cnt_004',
    inquilino: 'Carlos Romero',
    direccion: 'Honduras 4490, PB',
    categoria: 'ELECTRICIDAD',
    descripcion: 'Saltó el térmico de la cocina. Probé reset y no anda.',
    urgencia: 'EMERGENCIA',
    estado: 'ABIERTO',
    asignadoA: null,
    fotoUrl: null,
    resolucion: null,
    createdAt: '2026-05-09T18:42:00-03:00',
    resueltoAt: null,
    eventos: [
      {
        id: 'ev_003_1',
        tipo: 'CREADO',
        autor: 'Carlos Romero',
        contenido: null,
        fecha: '2026-05-09T18:42:00-03:00',
      },
    ],
  },
  {
    id: 'rec_004',
    contratoId: 'cnt_005',
    inquilino: 'Ana Pereyra',
    direccion: 'Salguero 2240, 12°D',
    categoria: 'CERRADURA',
    descripcion: 'La cerradura del balcón está dura. Dificultad para abrir.',
    urgencia: 'BAJA',
    estado: 'EN_CURSO',
    asignadoA: 'Luciana Vidal',
    fotoUrl: null,
    resolucion: null,
    createdAt: '2026-05-06T11:00:00-03:00',
    resueltoAt: null,
    eventos: [
      {
        id: 'ev_004_1',
        tipo: 'CREADO',
        autor: 'Ana Pereyra',
        contenido: null,
        fecha: '2026-05-06T11:00:00-03:00',
      },
      {
        id: 'ev_004_2',
        tipo: 'ASIGNADO',
        autor: 'Roberto Tapia',
        contenido: 'Luciana Vidal',
        fecha: '2026-05-07T09:00:00-03:00',
      },
    ],
  },
  {
    id: 'rec_005',
    contratoId: 'cnt_002',
    inquilino: 'Juan Pérez',
    direccion: 'Av. Cabildo 2890, 7°A',
    categoria: 'OTRO',
    descripcion: 'El portero eléctrico tiene interferencia.',
    urgencia: 'BAJA',
    estado: 'RESUELTO',
    asignadoA: 'Sergio Almeida',
    fotoUrl: null,
    resolucion: 'Se cambió el módulo del portero. Funciona OK.',
    createdAt: '2026-05-03T16:20:00-03:00',
    resueltoAt: '2026-05-05T10:30:00-03:00',
    eventos: [
      {
        id: 'ev_005_1',
        tipo: 'CREADO',
        autor: 'Juan Pérez',
        contenido: null,
        fecha: '2026-05-03T16:20:00-03:00',
      },
      {
        id: 'ev_005_2',
        tipo: 'ASIGNADO',
        autor: 'Roberto Tapia',
        contenido: 'Sergio Almeida',
        fecha: '2026-05-04T08:30:00-03:00',
      },
      {
        id: 'ev_005_3',
        tipo: 'RESUELTO',
        autor: 'Sergio Almeida',
        contenido: 'Se cambió el módulo del portero. Funciona OK.',
        fecha: '2026-05-05T10:30:00-03:00',
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

// Propietarios usan prefijo `own_` (de "owner") para no chocar con IDs de
// propiedades (prefijo `prp_`).
export const propietariosMock: Propietario[] = [
  {
    id: 'own_001',
    nombre: 'Eduardo',
    apellido: 'Castro',
    cuit: '20-12345678-2',
    email: 'eduardo.castro@gmail.com',
    telefono: '+54 11 4789 1234',
    cbuAlias: 'castro.eduardo.cuenta',
    comisionPct: 8,
    notas: 'Pide rendición los días 10 de cada mes. Prefiere WhatsApp.',
    createdAt: '2024-08-15',
    propiedadesIds: ['prp_001'],
    totalCobradoMes: 572000,
    totalRecibirMes: 526240,
  },
  {
    id: 'own_002',
    nombre: 'Silvana',
    apellido: 'Morales',
    cuit: '27-23456789-3',
    email: 'silvanamorales@gmail.com',
    telefono: '+54 9 11 5432 6789',
    cbuAlias: 'morales.silvana',
    comisionPct: 7,
    notas: null,
    createdAt: '2023-11-02',
    propiedadesIds: ['prp_002', 'prp_004'],
    totalCobradoMes: 1340000,
    totalRecibirMes: 1246200,
  },
  {
    id: 'own_003',
    nombre: 'Federico',
    apellido: 'López Vega',
    cuit: '20-34567890-4',
    email: 'federico.lv@outlook.com',
    telefono: '+54 11 5678 9012',
    cbuAlias: null,
    comisionPct: 8,
    notas: 'Cuenta nueva — falta CBU. Reclamar en la próxima rendición.',
    createdAt: '2025-02-20',
    propiedadesIds: ['prp_003'],
    totalCobradoMes: 510000,
    totalRecibirMes: 469200,
  },
  {
    id: 'own_004',
    nombre: 'Patricia',
    apellido: 'Iglesias',
    cuit: '27-45678901-5',
    email: 'patriciaiglesias@yahoo.com.ar',
    telefono: '+54 9 351 4321 9876',
    cbuAlias: 'iglesias.patricia',
    comisionPct: 6.5,
    notas: 'Vive en Córdoba. Tiene 2 unidades funcionales en CABA.',
    createdAt: '2022-05-10',
    propiedadesIds: ['prp_005'],
    totalCobradoMes: 850000,
    totalRecibirMes: 794750,
  },
  {
    id: 'own_005',
    nombre: 'Martín',
    apellido: 'Bravo',
    cuit: '20-56789012-6',
    email: 'martinbravo@gmail.com',
    telefono: '+54 11 2345 1357',
    cbuAlias: 'bravo.martin.cap',
    comisionPct: 8,
    notas: 'Inmueble en USD — el inquilino paga en pesos al MEP.',
    createdAt: '2026-03-01',
    propiedadesIds: ['prp_006'],
    totalCobradoMes: 0,
    totalRecibirMes: 0,
  },
];

// Propiedades: una por cada contrato actual (cnt_001..cnt_006). El detalle
// de la propiedad es la vista principal del panel — desde acá se accede a
// inquilino, propietarios, contrato y reclamos relacionados.
export const propiedadesMock: Propiedad[] = [
  {
    id: 'prp_001',
    direccion: 'Gorriti 4521, 3°B',
    ciudad: 'CABA',
    provincia: 'Buenos Aires',
    tipo: 'DEPARTAMENTO',
    ambientes: 2,
    m2: 48,
    fotoUrl: null,
    estado: 'ALQUILADA',
    propietariosIds: ['own_001'],
    contratoActualId: 'cnt_001',
    createdAt: '2024-08-15',
  },
  {
    id: 'prp_002',
    direccion: 'Av. Cabildo 2890, 7°A',
    ciudad: 'CABA',
    provincia: 'Buenos Aires',
    tipo: 'DEPARTAMENTO',
    ambientes: 3,
    m2: 72,
    fotoUrl: null,
    estado: 'ALQUILADA',
    propietariosIds: ['own_002'],
    contratoActualId: 'cnt_002',
    createdAt: '2023-11-02',
  },
  {
    id: 'prp_003',
    direccion: 'Jorge Newbery 1820',
    ciudad: 'CABA',
    provincia: 'Buenos Aires',
    tipo: 'CASA',
    ambientes: 4,
    m2: 110,
    fotoUrl: null,
    estado: 'ALQUILADA',
    propietariosIds: ['own_003'],
    contratoActualId: 'cnt_003',
    createdAt: '2025-02-20',
  },
  {
    id: 'prp_004',
    direccion: 'Honduras 4490, PB',
    ciudad: 'CABA',
    provincia: 'Buenos Aires',
    tipo: 'LOCAL',
    ambientes: null,
    m2: 95,
    fotoUrl: null,
    estado: 'ALQUILADA',
    propietariosIds: ['own_002'],
    contratoActualId: 'cnt_004',
    createdAt: '2024-11-01',
  },
  {
    id: 'prp_005',
    direccion: 'Salguero 2240, 12°D',
    ciudad: 'CABA',
    provincia: 'Buenos Aires',
    tipo: 'DEPARTAMENTO',
    ambientes: 4,
    m2: 95,
    fotoUrl: null,
    estado: 'ALQUILADA',
    propietariosIds: ['own_004'],
    contratoActualId: 'cnt_005',
    createdAt: '2022-05-10',
  },
  {
    id: 'prp_006',
    direccion: 'Olleros 3920',
    ciudad: 'CABA',
    provincia: 'Buenos Aires',
    tipo: 'DEPARTAMENTO',
    ambientes: 3,
    m2: 80,
    fotoUrl: null,
    estado: 'EN_EDICION',
    propietariosIds: ['own_005'],
    contratoActualId: 'cnt_006', // borrador
    createdAt: '2026-03-01',
  },
];

// Intenciones de renovación reportadas por inquilinos. En el inquilino real
// estas las dispara el flow /contrato/renovacion. En el lado inmobiliaria
// las usamos para ordenar el dashboard de renovaciones por urgencia.
// Red de profesionales que la inmobiliaria mantiene curada. Sus inquilinos
// los ven en /profesionales del lado inquilino. En backend real esto vive
// en una tabla Profesional con relación a la inmobiliaria.

export type CategoriaProfesional =
  | 'PLOMERO'
  | 'ELECTRICISTA'
  | 'GASISTA'
  | 'CERRAJERO'
  | 'PINTOR'
  | 'TECNICO_AC'
  | 'FLETE';

export interface ProfesionalAdmin {
  id: string;
  nombre: string;
  categoria: CategoriaProfesional;
  zona: string;
  telefono: string;
  email: string | null;
  rating: number;
  cantTrabajos: number;
  ultimoTrabajo: string | null;
  verificado: boolean;
  notas: string | null;
  activo: boolean;
}

export const profesionalCategoriaLabelAdmin: Record<CategoriaProfesional, string> = {
  PLOMERO: 'Plomería',
  ELECTRICISTA: 'Electricidad',
  GASISTA: 'Gas',
  CERRAJERO: 'Cerrajería',
  PINTOR: 'Pintura',
  TECNICO_AC: 'Aire / Calefacción',
  FLETE: 'Fletes y mudanzas',
};

export const profesionalesAdminMock: ProfesionalAdmin[] = [
  {
    id: 'prof_001',
    nombre: 'Sergio Almeida',
    categoria: 'PLOMERO',
    zona: 'Palermo, Villa Crespo',
    telefono: '+54 9 11 4421 8830',
    email: 'sergio.almeida@plomeria.ar',
    rating: 4.8,
    cantTrabajos: 24,
    ultimoTrabajo: '2026-04-30',
    verificado: true,
    notas: 'Llega en el día, factura A',
    activo: true,
  },
  {
    id: 'prof_002',
    nombre: 'Diego Ferrari',
    categoria: 'ELECTRICISTA',
    zona: 'Palermo, Recoleta',
    telefono: '+54 9 11 6502 7714',
    email: 'diego@ferrari-elec.com.ar',
    rating: 4.9,
    cantTrabajos: 31,
    ultimoTrabajo: '2026-05-02',
    verificado: true,
    notas: 'Matriculado, presupuesto sin cargo',
    activo: true,
  },
  {
    id: 'prof_003',
    nombre: 'Luciana Pérez',
    categoria: 'GASISTA',
    zona: 'CABA',
    telefono: '+54 9 11 5567 2118',
    email: null,
    rating: 4.7,
    cantTrabajos: 18,
    ultimoTrabajo: '2026-03-14',
    verificado: true,
    notas: 'Matriculada ENARGAS',
    activo: true,
  },
  {
    id: 'prof_004',
    nombre: 'Pablo Cerrajería 24hs',
    categoria: 'CERRAJERO',
    zona: 'CABA, GBA Norte',
    telefono: '+54 9 11 3399 4422',
    email: null,
    rating: 4.6,
    cantTrabajos: 12,
    ultimoTrabajo: '2026-02-21',
    verificado: true,
    notas: null,
    activo: true,
  },
  {
    id: 'prof_005',
    nombre: 'Camila Torres',
    categoria: 'PINTOR',
    zona: 'Palermo, Belgrano',
    telefono: '+54 9 11 4488 1107',
    email: 'camila.t@gmail.com',
    rating: 4.5,
    cantTrabajos: 9,
    ultimoTrabajo: '2026-01-18',
    verificado: false,
    notas: 'Especializada en interiores',
    activo: true,
  },
  {
    id: 'prof_006',
    nombre: 'Frío Pro AA',
    categoria: 'TECNICO_AC',
    zona: 'CABA',
    telefono: '+54 9 11 6678 9921',
    email: 'contacto@friopro.com.ar',
    rating: 4.7,
    cantTrabajos: 22,
    ultimoTrabajo: '2026-04-12',
    verificado: true,
    notas: 'Service split y central',
    activo: true,
  },
  {
    id: 'prof_007',
    nombre: 'Mudanzas Soto',
    categoria: 'FLETE',
    zona: 'AMBA',
    telefono: '+54 9 11 5432 1198',
    email: null,
    rating: 4.4,
    cantTrabajos: 7,
    ultimoTrabajo: '2025-12-08',
    verificado: false,
    notas: 'Camión chico y mediano',
    activo: true,
  },
];

export type DecisionRenovacionMock = 'RENOVAR' | 'NO_RENOVAR' | 'PENSANDO' | 'SIN_RESPUESTA';

export interface IntencionRenovacionMock {
  contratoId: string;
  decision: DecisionRenovacionMock;
  comentario: string | null;
  fechaIntencion: string | null; // ISO
}

export const intencionesRenovacionMock: IntencionRenovacionMock[] = [
  // Mariela todavía no decidió (su contrato vence en 2028, lejos)
  {
    contratoId: 'cnt_001',
    decision: 'SIN_RESPUESTA',
    comentario: null,
    fechaIntencion: null,
  },
  // Juan dijo que renueva (vence 2027-02, ya está en zona)
  {
    contratoId: 'cnt_002',
    decision: 'RENOVAR',
    comentario: 'Quiero el mismo plazo y discutir el monto con la inmobiliaria.',
    fechaIntencion: '2026-04-22T10:00:00-03:00',
  },
  // Laura está pensándolo
  {
    contratoId: 'cnt_003',
    decision: 'PENSANDO',
    comentario: 'Tengo que ver con mi pareja si nos mudamos a un depto más grande.',
    fechaIntencion: '2026-05-02T18:30:00-03:00',
  },
  // Carlos avisó que no renueva
  {
    contratoId: 'cnt_004',
    decision: 'NO_RENOVAR',
    comentario: 'Nos compramos casa, gracias por estos años.',
    fechaIntencion: '2026-03-15T09:15:00-03:00',
  },
  // Ana y Tomás sin respuesta
  {
    contratoId: 'cnt_005',
    decision: 'SIN_RESPUESTA',
    comentario: null,
    fechaIntencion: null,
  },
];

export const eventosMock = [
  { id: 'e1', tipo: 'pago', titulo: 'Cobraste a Juan Pérez', subtitulo: 'Hace 12 minutos · $620.000', icono: 'dollar' },
  { id: 'e2', tipo: 'reclamo', titulo: 'Nuevo reclamo de Mariela Sosa', subtitulo: 'Hace 2 hs · Plomería · Media', icono: 'wrench' },
  { id: 'e3', tipo: 'aumento', titulo: 'Ajuste aplicado a 5 contratos', subtitulo: 'Hace 1 día · ICL +18,4%', icono: 'trending-up' },
  { id: 'e4', tipo: 'screening', titulo: 'Screening de Tomás Bravo', subtitulo: 'Hace 1 día · APTO', icono: 'shield-check' },
] as const;
