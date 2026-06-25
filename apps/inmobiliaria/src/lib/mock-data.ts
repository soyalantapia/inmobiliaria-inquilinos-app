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
    proximoVencimiento: '2026-05-05',
    estadoPagoActual: 'VENCIDO',
    cbuAlias: 'eduardo.lopez.gorriti',
    titularCuenta: 'Eduardo López Vega',
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
    modoCobranza: 'PROPIETARIO_DIRECTO',
    cobraDirectoPropietarioId: 'own_004',
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
  // Consorcio "solo expensas": administra el edificio sin alquiler asociado.
  {
    id: 'cnt_007',
    inquilino: 'Consorcio Sucre 1450',
    direccion: 'Sucre 1450 — Belgrano',
    monto: 0,
    moneda: 'ARS',
    estado: 'ACTIVO',
    fechaInicio: '2024-01-01',
    fechaFin: '2027-12-31',
    proximoVencimiento: '2026-05-10',
    estadoPagoActual: 'PAGADO',
    tipoContrato: 'SOLO_EXPENSAS',
    montoExpensas: 285000,
    cargadoPor: 'Camila Acosta',
    cargadoRol: 'CARGA',
    cargadoAt: '2026-05-08T10:14:00-03:00',
    aprobadoPor: 'Roberto Tapia',
    aprobadoAt: '2026-05-08T12:40:00-03:00',
    pendienteAprobacion: false,
  },
  // Contrato pendiente de aprobación: cargado por Camila pero todavía sin
  // revisión del jefe. Aparece como BORRADOR y bloquea la activación.
  {
    id: 'cnt_008',
    inquilino: 'Lucía Fernández',
    direccion: 'Thames 1290, 5°A',
    monto: 540000,
    moneda: 'ARS',
    estado: 'BORRADOR',
    fechaInicio: '2026-06-01',
    fechaFin: '2029-05-31',
    proximoVencimiento: '2026-06-01',
    estadoPagoActual: 'PENDIENTE',
    tipoContrato: 'ALQUILER_Y_EXPENSAS',
    montoExpensas: 110000,
    cargadoPor: 'Camila Acosta',
    cargadoRol: 'CARGA',
    cargadoAt: '2026-05-12T17:20:00-03:00',
    pendienteAprobacion: true,
    aprobadoPor: null,
    aprobadoAt: null,
  },
];

// Etiqueta humana del tipo de contrato.
export const tipoContratoLabel: Record<'ALQUILER' | 'SOLO_EXPENSAS' | 'ALQUILER_Y_EXPENSAS', string> = {
  ALQUILER: 'Sólo alquiler',
  SOLO_EXPENSAS: 'Sólo expensas',
  ALQUILER_Y_EXPENSAS: 'Alquiler + expensas',
};

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
    categoriaArca: 'RELACION_DEPENDENCIA',
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
// Agenda de los próximos 14 días desde "hoy" (25-may-2026 en demo).
// Importante: las fechas deben ser FUTURAS para que el header
// "Próximos 14 días" no mienta. Si la fecha demo cambia, ajustar.
export const agendaMock = [
  {
    id: 'ag_1',
    fecha: '2026-05-28',
    titulo: 'Vencimiento alquiler Juan Pérez',
    detalle: 'Av. Cabildo 2890 · $620.000',
    tipo: 'pago' as const,
    urgencia: 'alta' as const,
  },
  {
    id: 'ag_2',
    fecha: '2026-06-01',
    titulo: 'Ajuste ICL · contrato Cabildo 2890',
    detalle: 'Juan Pérez · +18,4% estimado',
    tipo: 'ajuste' as const,
    urgencia: 'media' as const,
  },
  {
    id: 'ag_3',
    fecha: '2026-06-03',
    titulo: 'Vence póliza de garantía',
    detalle: 'Laura Giménez · Newbery 1820',
    tipo: 'garantia' as const,
    urgencia: 'media' as const,
  },
  {
    id: 'ag_4',
    fecha: '2026-06-05',
    titulo: 'Renovación de contrato',
    detalle: 'Honduras 4490 · Carlos Romero',
    tipo: 'renovacion' as const,
    urgencia: 'baja' as const,
  },
  {
    id: 'ag_5',
    fecha: '2026-06-08',
    titulo: 'Rendición mensual a propietarios',
    detalle: '5 propietarios · $2.1M total',
    tipo: 'rendicion' as const,
    urgencia: 'media' as const,
  },
];

// Top alertas — lo que requiere acción inmediata
// Alertas del card "Necesitan tu atención" del home.
// Importante: los datos deben coincidir con el resto del sistema. Si
// Mariela Sosa ya informó el pago y está en /pagos · pagos por validar,
// NO va en este feed como morosa — la que realmente está atrasada es
// Laura Giménez (lo confirma /pagos · Morosos · 1 contrato y el KPI
// "EN MORA $510.000 · 1 contrato atrasado").
export const alertasMock = [
  {
    id: 'al_1',
    titulo: 'Reclamo de emergencia sin asignar',
    detalle: 'Inquilino Carlos Romero · Electricidad · Honduras 4490',
    href: '/reclamos/rec_003',
    severidad: 'critica' as const,
  },
  {
    id: 'al_2',
    titulo: 'Inquilino atrasado 10 días',
    detalle: 'Laura Giménez · $510.000 + $4.590 punitorios · Jorge Newbery 1820',
    href: '/pagos',
    severidad: 'alta' as const,
  },
  {
    id: 'al_3',
    titulo: 'Propietario sin CBU cargado',
    detalle: 'Federico López Vega · sin CBU no podemos rendir el mes',
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
    // Su contrato (cnt_001) está VENCIDO → la inmo NO cobró, no hay nada "a rendir".
    // En 0 para no inflar el KPI de /propietarios ni habilitar Rendir sobre plata
    // no recibida (igual que own_004 PROPIETARIO_DIRECTO y own_005 BORRADOR).
    totalCobradoMes: 0,
    totalRecibirMes: 0,
    afip: {
      conectado: true,
      condicionFiscal: 'MONOTRIBUTO',
      puntoVenta: '0003',
      tipoComprobante: 'FACTURA_C',
      conectadoDesde: '2025-03-12',
    },
    cuentaCobranza: {
      banco: 'Banco Galicia',
      titular: 'Eduardo Castro',
      cbu: '0070123456789012345678',
      alias: 'castro.eduardo.cuenta',
      cuit: '20-12345678-2',
    },
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
    afip: {
      conectado: true,
      condicionFiscal: 'RESPONSABLE_INSCRIPTO',
      puntoVenta: '0001',
      tipoComprobante: 'FACTURA_B',
      conectadoDesde: '2024-09-08',
    },
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
    // Contrato cnt_003 VENCIDO → no cobrado → nada a rendir (mismo criterio que own_001).
    totalCobradoMes: 0,
    totalRecibirMes: 0,
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
    notas: 'Vive en Córdoba. Tiene 2 unidades funcionales en CABA. Cobra directo a su cuenta.',
    createdAt: '2022-05-10',
    propiedadesIds: ['prp_005'],
    // Su único contrato (cnt_005) es PROPIETARIO_DIRECTO → el alquiler va directo
    // del inquilino al dueño, la inmo NO lo cobra ni lo rinde. En 0 para que el
    // KPI "A rendir" y el botón Rendir no la incluyan (igual que el path API).
    totalCobradoMes: 0,
    totalRecibirMes: 0,
    afip: { conectado: false },
    cuentaCobranza: {
      banco: 'Banco Macro',
      titular: 'Patricia Iglesias',
      cbu: '2850001230094523456789',
      alias: 'iglesias.patricia',
      cuit: '27-45678901-5',
    },
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
    propietariosIds: ['own_001', 'own_002'],
    participaciones: [
      { propietarioId: 'own_001', porcentaje: 60 },
      { propietarioId: 'own_002', porcentaje: 40 },
    ],
    contratoActualId: 'cnt_001',
    sociedadId: 'soc_001',
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
    sociedadId: 'soc_001',
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
    sociedadId: 'soc_001',
    createdAt: '2025-02-20',
  },
  {
    // Local comercial: gestionado bajo la S.A. comercial.
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
    sociedadId: 'soc_002',
    createdAt: '2024-11-01',
  },
  {
    // Departamento en fideicomiso familiar Iglesias-Castro.
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
    sociedadId: 'soc_003',
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
    sociedadId: 'soc_001',
    createdAt: '2026-03-01',
  },
];

// Liquidaciones de un contrato: ese histórico mensual que el PM ve para
// conciliar pagos. En backend real es la tabla Liquidacion joineada con
// Pagos. Acá las generamos por contrato a partir del fechaInicio.

export interface LiquidacionAdmin {
  id: string;
  contratoId: string;
  periodo: string; // YYYY-MM
  montoAlquiler: number;
  montoExpensas: number;
  montoTotal: number;
  fechaVencimiento: string;
  fechaPago: string | null;
  estado: 'PAGADO' | 'PENDIENTE' | 'VENCIDO';
  metodoPago: 'TRANSFERENCIA' | 'MERCADOPAGO' | 'EFECTIVO' | null;
}

// Para no inflar el archivo, generamos al vuelo las últimas 12 liquidaciones
// de cada contrato a partir de hoy. Los 3 últimos meses son PENDIENTE/PAGADO,
// el resto PAGADO.
// Pseudo-aleatorio DETERMINÍSTICO por clave (FNV-1a → 0..1). Reemplaza a
// Math.random() en generarLiquidaciones: antes el mes pasado salía VENCIDO el
// ~30% de las veces AL AZAR en cada render, y como el scoring del inquilino
// deriva de estas liquidaciones, el puntaje fluctuaba ±6 pts entre navegaciones
// (contradiciendo el "cálculo determinístico desde mocks").
function rngDeterministico(clave: string): number {
  let h = 2166136261;
  for (let k = 0; k < clave.length; k++) {
    h ^= clave.charCodeAt(k);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

export function generarLiquidaciones(
  contratoId: string,
  montoBase: number,
  // Expensas reales del contrato. Si es 0 (contratos sin expensas explícitas)
  // caemos a la estimación histórica del 19% del alquiler. Para SOLO_EXPENSAS
  // (montoBase=0) el 19% daba $0 e ignoraba las expensas reales del contrato.
  montoExpensasBase = 0,
): LiquidacionAdmin[] {
  const hoy = new Date();
  const liquidaciones: LiquidacionAdmin[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 5);
    const periodo = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const expensas = montoExpensasBase > 0 ? montoExpensasBase : Math.round(montoBase * 0.19);
    let estado: LiquidacionAdmin['estado'] = 'PAGADO';
    let fechaPago: string | null = `${periodo}-${String(d.getDate() + Math.floor(rngDeterministico(`${contratoId}|${periodo}|dia`) * 4)).padStart(2, '0')}`;
    let metodoPago: LiquidacionAdmin['metodoPago'] = 'TRANSFERENCIA';
    if (i === 0) {
      // mes actual: pendiente
      estado = 'PENDIENTE';
      fechaPago = null;
      metodoPago = null;
    } else if (i === 1 && rngDeterministico(`${contratoId}|mes-pasado-vencido`) > 0.7) {
      // mes pasado: a veces vencido (determinístico por contrato)
      estado = 'VENCIDO';
      fechaPago = null;
      metodoPago = null;
    }
    liquidaciones.push({
      id: `liq_${contratoId}_${periodo}`,
      contratoId,
      periodo,
      montoAlquiler: montoBase,
      montoExpensas: expensas,
      montoTotal: montoBase + expensas,
      fechaVencimiento: `${periodo}-05`,
      fechaPago,
      estado,
      metodoPago,
    });
  }
  return liquidaciones.reverse();
}

// Eventos del ciclo de vida de un contrato (creación, ajustes, pagos
// importantes, reclamos creados, cambios de estado). Para el demo
// generamos un set fijo para Mariela y otro para los demás.

export type TipoEventoContrato =
  | 'CREADO'
  | 'AJUSTE_APLICADO'
  | 'PAGO_RECIBIDO'
  | 'PAGO_VENCIDO'
  | 'RECLAMO_CREADO'
  | 'COMUNICACION_ENVIADA'
  | 'GARANTE_RENOVADO'
  | 'INTENCION_RENOVACION';

export interface EventoContrato {
  id: string;
  contratoId: string;
  tipo: TipoEventoContrato;
  titulo: string;
  detalle: string | null;
  fecha: string; // ISO
  autor: string;
}

export const eventosContratoMock: EventoContrato[] = [
  {
    id: 'ev_c1_1',
    contratoId: 'cnt_001',
    tipo: 'CREADO',
    titulo: 'Contrato firmado',
    detalle: 'Inicio 01/09/2025 · 36 meses · ICL',
    fecha: '2025-08-28T10:30:00-03:00',
    autor: 'Roberto Tapia',
  },
  {
    id: 'ev_c1_2',
    contratoId: 'cnt_001',
    tipo: 'PAGO_RECIBIDO',
    titulo: 'Primer pago',
    detalle: '$405.000 · transferencia',
    fecha: '2025-09-08T09:15:00-03:00',
    autor: 'Sistema',
  },
  {
    id: 'ev_c1_3',
    contratoId: 'cnt_001',
    tipo: 'AJUSTE_APLICADO',
    titulo: 'Ajuste ICL aplicado',
    detalle: '$405.000 → $432.000 · +6,7%',
    fecha: '2025-11-01T08:00:00-03:00',
    autor: 'Sistema',
  },
  {
    id: 'ev_c1_4',
    contratoId: 'cnt_001',
    tipo: 'AJUSTE_APLICADO',
    titulo: 'Ajuste ICL aplicado',
    detalle: '$432.000 → $480.000 · +11,1%',
    fecha: '2026-02-01T08:00:00-03:00',
    autor: 'Sistema',
  },
  {
    id: 'ev_c1_5',
    contratoId: 'cnt_001',
    tipo: 'RECLAMO_CREADO',
    titulo: 'Reclamo de plomería',
    detalle: 'Mariela reportó pérdida de canilla',
    fecha: '2026-05-09T14:32:00-03:00',
    autor: 'Mariela Sosa',
  },
  {
    id: 'ev_c1_6',
    contratoId: 'cnt_001',
    tipo: 'PAGO_VENCIDO',
    titulo: 'Pago vencido',
    detalle: 'Período 2026-05 sin pagar al día 10',
    fecha: '2026-05-11T00:01:00-03:00',
    autor: 'Sistema',
  },
];

// Comunicaciones (WhatsApp / Email / Llamadas) con el inquilino. Log de
// gestión que el PM ve para saber qué se le dijo.

export type CanalComunicacion = 'WHATSAPP' | 'EMAIL' | 'LLAMADA';
export type DireccionComunicacion = 'SALIENTE' | 'ENTRANTE';

export interface Comunicacion {
  id: string;
  contratoId: string;
  canal: CanalComunicacion;
  direccion: DireccionComunicacion;
  asunto: string;
  preview: string;
  fecha: string;
  autor: string;
  leida: boolean;
}

export const comunicacionesMock: Comunicacion[] = [
  {
    id: 'com_1',
    contratoId: 'cnt_001',
    canal: 'WHATSAPP',
    direccion: 'SALIENTE',
    asunto: 'Bienvenida',
    preview: 'Hola Mariela! Te confirmo que el contrato quedó firmado. Cualquier duda, escribime.',
    fecha: '2025-08-28T11:00:00-03:00',
    autor: 'Roberto Tapia',
    leida: true,
  },
  {
    id: 'com_2',
    contratoId: 'cnt_001',
    canal: 'EMAIL',
    direccion: 'SALIENTE',
    asunto: 'Aviso de ajuste por ICL',
    preview: 'Te informamos que el ajuste por ICL aplicado al período 2025-11 fue del 6,7%...',
    fecha: '2025-10-25T15:00:00-03:00',
    autor: 'Sistema',
    leida: true,
  },
  {
    id: 'com_3',
    contratoId: 'cnt_001',
    canal: 'WHATSAPP',
    direccion: 'ENTRANTE',
    asunto: 'Consulta sobre el ajuste',
    preview: '¿Por qué subió ese %? ¿Puedo ver el cálculo?',
    fecha: '2025-10-26T09:30:00-03:00',
    autor: 'Mariela Sosa',
    leida: true,
  },
  {
    id: 'com_4',
    contratoId: 'cnt_001',
    canal: 'WHATSAPP',
    direccion: 'SALIENTE',
    asunto: 'Explicación ICL',
    preview: 'Te mando el cálculo: tomamos el índice del BCRA de los últimos 12 meses...',
    fecha: '2025-10-26T10:15:00-03:00',
    autor: 'Luciana Vidal',
    leida: true,
  },
  {
    id: 'com_5',
    contratoId: 'cnt_001',
    canal: 'WHATSAPP',
    direccion: 'ENTRANTE',
    asunto: 'Reclamo plomería',
    preview: 'Hola! Tengo una pérdida en la canilla del baño desde anoche.',
    fecha: '2026-05-09T14:33:00-03:00',
    autor: 'Mariela Sosa',
    leida: true,
  },
  {
    id: 'com_6',
    contratoId: 'cnt_001',
    canal: 'WHATSAPP',
    direccion: 'SALIENTE',
    asunto: 'Recordatorio vencimiento',
    preview: 'Hola Mariela! Te recuerdo que el pago de mayo vencía el 5/05. ¿Pudiste hacerlo?',
    fecha: '2026-05-08T10:00:00-03:00',
    autor: 'Roberto Tapia',
    leida: false,
  },
];

// Plantillas de mensaje que el PM puede enviar al inquilino. Acelera la
// gestión y mantiene consistencia de tono.

export interface PlantillaMensaje {
  id: string;
  titulo: string;
  asunto: string;
  cuerpo: string;
  canal: CanalComunicacion;
}

export const plantillasMensajeMock: PlantillaMensaje[] = [
  {
    id: 'tpl_recordatorio',
    titulo: 'Recordatorio de pago',
    asunto: 'Recordatorio: vencimiento próximo',
    cuerpo:
      'Hola {{nombre}}! Te recordamos que el pago del período actual vence el día 5. Si tenés alguna duda o necesitás ayuda, contestá este mensaje.',
    canal: 'WHATSAPP',
  },
  {
    id: 'tpl_ajuste',
    titulo: 'Aviso de ajuste',
    asunto: 'Tu próximo ajuste de alquiler',
    cuerpo:
      'Hola {{nombre}}! Te informamos que el próximo ajuste por ICL será del {{porcentaje}}%. El nuevo monto será de ${{nuevoMonto}} a partir del mes que viene.',
    canal: 'EMAIL',
  },
  {
    id: 'tpl_reclamo',
    titulo: 'Seguimiento de reclamo',
    asunto: 'Sobre tu reclamo',
    cuerpo:
      'Hola {{nombre}}! Sobre el reclamo que abriste, ya coordinamos con el proveedor. Te confirmo: {{detalle}}.',
    canal: 'WHATSAPP',
  },
  {
    id: 'tpl_renovacion',
    titulo: 'Renovación de contrato',
    asunto: 'Tu contrato está por vencer',
    cuerpo:
      'Hola {{nombre}}! Tu contrato vence el {{fechaFin}}. Queremos saber si tenés intención de renovar para coordinar con el propietario. ¿Hablamos?',
    canal: 'WHATSAPP',
  },
  {
    id: 'tpl_inspeccion',
    titulo: 'Coordinar inspección',
    asunto: 'Coordinemos una visita',
    cuerpo:
      'Hola {{nombre}}! Necesitamos coordinar una inspección rápida en {{direccion}}. ¿Qué día y horario te queda cómodo esta semana?',
    canal: 'WHATSAPP',
  },
];

// Co-inquilinos por contrato. Mariela invitó a su pareja.

export type PermisoCoInquilinoAdmin = 'VER' | 'PAGAR' | 'COMPLETO';

export interface CoInquilinoAdmin {
  id: string;
  contratoId: string;
  nombre: string;
  email: string;
  telefono: string | null;
  relacion: string;
  permiso: PermisoCoInquilinoAdmin;
  estado: 'PENDIENTE' | 'ACEPTADO';
  invitadoAt: string;
  aceptadoAt: string | null;
}

export const coInquilinosMock: CoInquilinoAdmin[] = [
  {
    id: 'co_1',
    contratoId: 'cnt_001',
    nombre: 'Federico Ramos',
    email: 'fede.ramos@gmail.com',
    telefono: '+54 9 11 6789 4421',
    relacion: 'Pareja',
    permiso: 'PAGAR',
    estado: 'ACEPTADO',
    invitadoAt: '2025-09-12T18:00:00-03:00',
    aceptadoAt: '2025-09-13T09:30:00-03:00',
  },
];

// Pagos informados por inquilinos que la inmobiliaria todavía no validó.
// El flow real: el inquilino transfiere → sube comprobante → su liquidación
// queda en estado INFORMADO → el admin valida acá y pasa a CONCILIADO.

export type MetodoPagoInformado = 'TRANSFERENCIA' | 'MERCADOPAGO' | 'EFECTIVO' | 'CHEQUE';

export type TipoPagoInformado = 'TOTAL' | 'PARCIAL';

export interface PagoInformado {
  id: string;
  contratoId: string;
  inquilino: string;
  direccion: string;
  periodo: string; // YYYY-MM
  /**
   * Monto del comprobante actual. Si es parcial, sólo cubre una parte
   * del total de la liquidación.
   */
  monto: number;
  /**
   * Default TOTAL (cubre el monto de la liquidación). Si es PARCIAL,
   * usamos `montoLiqTotal` y `saldoRestante` para mostrar el restante.
   */
  tipo?: TipoPagoInformado;
  /**
   * Sólo se setea cuando `tipo === 'PARCIAL'`. Es el monto TOTAL de la
   * liquidación (alquiler + expensas + punitorios) para que el admin
   * pueda ver cuánto falta.
   */
  montoLiqTotal?: number;
  metodo: MetodoPagoInformado;
  fechaTransferencia: string; // ISO
  informadoAt: string; // ISO
  comprobanteUrl: string; // dataURL o URL al pdf/img
  notaInquilino: string | null;
  liquidacionId: string;
}

export const pagosInformadosMock: PagoInformado[] = [
  {
    id: 'pag_inf_001',
    contratoId: 'cnt_001',
    inquilino: 'Mariela Sosa',
    direccion: 'Gorriti 4521, 3°B',
    periodo: '2026-05',
    monto: 572000,
    metodo: 'TRANSFERENCIA',
    fechaTransferencia: '2026-05-11',
    informadoAt: '2026-05-11T14:22:00-03:00',
    comprobanteUrl: '#',
    notaInquilino: 'Transferencia desde Galicia. Adjunto comprobante.',
    liquidacionId: 'liq_001',
  },
  {
    id: 'pag_inf_002',
    contratoId: 'cnt_002',
    inquilino: 'Juan Pérez',
    direccion: 'Av. Cabildo 2890, 7°A',
    periodo: '2026-05',
    monto: 620000,
    metodo: 'MERCADOPAGO',
    fechaTransferencia: '2026-05-07',
    informadoAt: '2026-05-07T18:45:00-03:00',
    comprobanteUrl: '#',
    notaInquilino: null,
    liquidacionId: 'liq_cnt_002_2026-05',
  },
  {
    id: 'pag_inf_003',
    contratoId: 'cnt_005',
    inquilino: 'Ana Pereyra',
    direccion: 'Salguero 2240, 12°D',
    periodo: '2026-05',
    monto: 850000,
    metodo: 'TRANSFERENCIA',
    fechaTransferencia: '2026-05-09',
    informadoAt: '2026-05-09T09:15:00-03:00',
    comprobanteUrl: '#',
    notaInquilino: 'Hice el pago el sábado, perdón por la demora en avisar.',
    liquidacionId: 'liq_cnt_005_2026-05',
  },
  // Ejemplo de pago parcial: Carlos informó 200k de un total de 480k.
  // Le queda un saldo de 280k que va a pagar en los próximos días.
  {
    id: 'pag_inf_004',
    contratoId: 'cnt_004',
    inquilino: 'Carlos Romero',
    direccion: 'Honduras 4490, PB',
    periodo: '2026-05',
    monto: 200000,
    tipo: 'PARCIAL',
    montoLiqTotal: 480000,
    metodo: 'TRANSFERENCIA',
    fechaTransferencia: '2026-05-12',
    informadoAt: '2026-05-12T11:08:00-03:00',
    comprobanteUrl: '#',
    notaInquilino:
      'Esta semana puedo cubrir solo 200k. El resto lo deposito el 18. Gracias!',
    liquidacionId: 'liq_cnt_004_2026-05',
  },
  // Segundo parcial del mismo contrato: completa el saldo.
  // (Lo dejamos también pendiente de validación para que el admin vea
  // los dos en la lista y entienda visualmente la lógica.)
  {
    id: 'pag_inf_005',
    contratoId: 'cnt_004',
    inquilino: 'Carlos Romero',
    direccion: 'Honduras 4490, PB',
    periodo: '2026-05',
    monto: 280000,
    tipo: 'PARCIAL',
    montoLiqTotal: 480000,
    metodo: 'MERCADOPAGO',
    fechaTransferencia: '2026-05-18',
    informadoAt: '2026-05-18T16:42:00-03:00',
    comprobanteUrl: '#',
    notaInquilino: 'Segundo parcial, completo lo que faltaba.',
    liquidacionId: 'liq_cnt_004_2026-05',
  },
];

// Datos de cobranza (titular + garante) por contrato. Esto sirve para que
// el admin imprima la lista de morosos con teléfonos a mano. En backend
// real esto vive en `Contrato.garante` y `Contrato.inquilino`.

export interface ContactoCobranza {
  contratoId: string;
  titular: { nombre: string; telefono: string; email: string };
  garante: { nombre: string; telefono: string; tipo: string } | null;
}

export const contactosCobranzaMock: ContactoCobranza[] = [
  {
    contratoId: 'cnt_001',
    titular: { nombre: 'Mariela Sosa', telefono: '+54 9 11 4567 8900', email: 'mariela.sosa@gmail.com' },
    garante: { nombre: 'Roberto Sosa (padre)', telefono: '+54 9 11 5678 9011', tipo: 'Propietaria' },
  },
  {
    contratoId: 'cnt_002',
    titular: { nombre: 'Juan Pérez', telefono: '+54 9 11 3344 5566', email: 'juan.perez@hotmail.com' },
    garante: { nombre: 'Cobertura SUMA', telefono: '+54 11 5288 9000', tipo: 'Digital · POL-2024-12345' },
  },
  {
    contratoId: 'cnt_003',
    titular: { nombre: 'Laura Giménez', telefono: '+54 9 11 2233 4455', email: 'laura.gim@yahoo.com.ar' },
    garante: { nombre: 'María Giménez (madre)', telefono: '+54 9 11 6677 8899', tipo: 'Propietaria' },
  },
  {
    contratoId: 'cnt_004',
    titular: { nombre: 'Carlos Romero', telefono: '+54 9 11 7788 9900', email: 'carlos.romero@gmail.com' },
    garante: { nombre: 'Recibo de sueldo - Banco Nación', telefono: '+54 11 4347 6000', tipo: 'Sueldo' },
  },
  {
    contratoId: 'cnt_005',
    titular: { nombre: 'Ana Pereyra', telefono: '+54 9 11 4455 6677', email: 'ana.pereyra@gmail.com' },
    garante: { nombre: 'Diego Pereyra (hermano)', telefono: '+54 9 11 8899 0011', tipo: 'Propietaria' },
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
