export type Moneda = 'ARS' | 'USD';
export type EstadoContrato = 'BORRADOR' | 'ACTIVO' | 'FINALIZADO' | 'RESCINDIDO';
export type EstadoLiquidacion = 'PENDIENTE' | 'PAGADO' | 'PARCIAL' | 'VENCIDO';

/**
 * Qué administra este contrato:
 *  - ALQUILER: sólo el canon locativo
 *  - SOLO_EXPENSAS: gestión de consorcio / complejo sin alquiler (ej. unidades
 *    propias del dueño, edificios donde sólo administramos expensas)
 *  - ALQUILER_Y_EXPENSAS: el contrato típico que cobra ambos en un solo recibo
 */
export type TipoContrato = 'ALQUILER' | 'SOLO_EXPENSAS' | 'ALQUILER_Y_EXPENSAS';
export type IndiceAjuste = 'ICL' | 'IPC' | 'CASA_PROPIA' | 'UVA' | 'CAC' | 'RIPTE' | 'FIJO';

/**
 * Esquema de interés por mora (punitorio por pago tardío):
 *  - SIN_MORA: no se cobra punitorio
 *  - PORCENTAJE_DIARIO: % por día de atraso sobre el monto
 *  - MONTO_FIJO: monto fijo por cada mes de atraso iniciado (acumula; en la
 *    moneda del contrato)
 *  - PORCENTAJE_MENSUAL: % mensual prorrateado por día (días/30)
 */
export type TipoMora = 'SIN_MORA' | 'PORCENTAJE_DIARIO' | 'MONTO_FIJO' | 'PORCENTAJE_MENSUAL';

/**
 * Esquema de mora YA RESUELTO por la cascada default inmobiliaria → override
 * por contrato. `origen` dice de dónde salió: CONTRATO (override propio),
 * INMOBILIARIA (heredado del default), LEGACY (tasa vieja migrada) o SIN_MORA.
 */
export interface MoraEfectiva {
  tipo: TipoMora;
  valor: number | null;
  origen: 'CONTRATO' | 'LEGACY' | 'INMOBILIARIA' | 'SIN_MORA';
}
export type Recomendacion = 'APTO' | 'APTO_CON_GARANTIA' | 'NO_APTO';
export type Confianza = 'alto' | 'medio' | 'bajo';

export type TipoPropiedad = 'DEPARTAMENTO' | 'CASA' | 'LOCAL' | 'GALPON';
export type EstadoPropiedad = 'ALQUILADA' | 'DISPONIBLE' | 'EN_EDICION';

/** Cuánto le toca a cada propietario de los frutos del alquiler. La suma
 * de porcentajes de una propiedad debe dar 100. Si no hay participaciones
 * explícitas, asumimos repartición igualitaria entre `propietariosIds`. */
export interface ParticipacionPropietario {
  propietarioId: string;
  porcentaje: number;
}

export interface Propiedad {
  id: string;
  direccion: string;
  ciudad: string;
  provincia: string;
  tipo: TipoPropiedad;
  ambientes: number | null;
  m2: number | null;
  fotoUrl: string | null;
  estado: EstadoPropiedad;
  propietariosIds: string[]; // FK a Propietario.id (puede haber cotitularidad)
  /** Reparto explícito; opcional — si falta, se reparte parejo. */
  participaciones?: ParticipacionPropietario[];
  contratoActualId: string | null; // FK a Contrato.id, null si DISPONIBLE
  /**
   * Sociedad de la inmobiliaria que gestiona esta propiedad. Determina
   * qué CUIT figura en las facturas, qué CBU se publica al inquilino y
   * en qué sociedad agrupa los reportes. Si falta, asume la principal.
   */
  sociedadId?: string;
  /** Nombre de complejo/edificio para agrupar (feedback 14/07). Es el efectivo:
   *  consorcio real si está ligado, si no el texto libre. null = sin complejo. */
  complejo?: string | null;
  createdAt: string;
}

export type CategoriaReclamo = 'PLOMERIA' | 'ELECTRICIDAD' | 'CERRADURA' | 'CALEFACCION' | 'OTRO';
export type UrgenciaReclamo = 'BAJA' | 'MEDIA' | 'ALTA' | 'EMERGENCIA';
export type EstadoReclamo = 'ABIERTO' | 'EN_CURSO' | 'RESUELTO' | 'CERRADO' | 'RECHAZADO';

// Quién paga el arreglo: USO_Y_GOCE = lo paga el inquilino (rotura por uso),
// DESPERFECTO = lo paga el propietario (problema estructural / del inmueble).
// Lo decide la inmobiliaria al evaluar el reclamo.
export type ClasificacionReclamo = 'USO_Y_GOCE' | 'DESPERFECTO';

export type TipoEventoReclamo =
  | 'CREADO'
  | 'ASIGNADO'
  | 'EN_CURSO'
  | 'RESUELTO'
  | 'CERRADO'
  | 'RECHAZADO'
  | 'MENSAJE_INQUILINO'
  | 'MENSAJE_INMO'
  | 'CLASIFICADO'
  | 'PROFESIONAL_ASIGNADO';

export interface EventoReclamo {
  id: string;
  tipo: TipoEventoReclamo;
  autor: string;
  contenido: string | null;
  /** Adjunto opcional del mensaje (foto/archivo servido por /uploads). */
  adjuntoUrl?: string | null;
  fecha: string; // ISO
}

/** Quién se hace cargo del costo del trabajo de un reclamo. */
export type PagadorReclamo = 'PROPIETARIO' | 'INQUILINO' | 'DEPOSITO';

/** Cargo generado al resolver un reclamo (reparación a cargo del inquilino o del depósito). */
export interface CargoReclamo {
  id: string;
  tipo: string;
  concepto: string;
  monto: number;
  moneda: Moneda;
  contraDeposito: boolean;
  createdAt: string;
}

export interface Reclamo {
  id: string;
  contratoId: string;
  inquilino: string;
  direccion: string;
  categoria: CategoriaReclamo;
  descripcion: string;
  urgencia: UrgenciaReclamo;
  estado: EstadoReclamo;
  asignadoA: string | null;
  fotoUrl: string | null;
  resolucion: string | null;
  createdAt: string;
  resueltoAt: string | null;
  eventos: EventoReclamo[];
  /** Fecha de inicio del contrato del inquilino — para mostrar hace cuánto vive
   *  en la propiedad (antigüedad). Puede faltar en datos viejos/demo. */
  contratoDesde?: string | null;
  /** Clasificación legada (2 valores). Reemplazada por `pagador`. */
  clasificacion?: ClasificacionReclamo | null;
  /** Quién paga el costo del trabajo: propietario / inquilino / depósito. */
  pagador?: PagadorReclamo | null;
  /** Moneda del contrato — para formatear costoTrabajo/cargos en la moneda correcta. */
  moneda?: Moneda;
  /** Cargos de reparación emitidos al resolver (inquilino paga o contra depósito). */
  cargos?: CargoReclamo[];
  /** Profesional externo que el admin asignó al reclamo (de la red curada). */
  profesionalAsignadoId?: string | null;
  profesionalAsignadoNombre?: string | null;
  profesionalAsignadoTelefono?: string | null;
  profesionalAsignadoCategoria?: string | null;
  /** Costo total del trabajo cargado al cerrar el reclamo.
   *  Se descuenta del propietario en la rendición (si clasificacion = DESPERFECTO)
   *  o se cobra al inquilino (si clasificacion = USO_Y_GOCE). */
  costoTrabajo?: number | null;
  /** Notas sobre el costo (ítems, descripción, etc.) opcional. */
  costoTrabajoNotas?: string | null;
  /** ID de la propiedad del reclamo — para atribuir gastos en rendiciones. */
  propiedadId?: string | null;
  /** Calificación que dejó el inquilino al resolverse el reclamo (1-5 + comentario). */
  ratingInquilino?: { estrellas: number; comentario: string | null; enviadoAt: string } | null;
}

/** Datos AFIP del propietario para emitir factura/recibo automático al conciliar el alquiler. */
export interface ArcaConfig {
  conectado: boolean;
  condicionFiscal?: 'MONOTRIBUTO' | 'RESPONSABLE_INSCRIPTO' | 'EXENTO';
  puntoVenta?: string; // ej. "0003"
  tipoComprobante?: 'FACTURA_C' | 'FACTURA_A' | 'FACTURA_B' | 'RECIBO_C';
  conectadoDesde?: string; // fecha ISO
}

/**
 * Cuenta bancaria directa del propietario para que el inquilino le deposite SIN
 * pasar por la cuenta recaudadora de la inmobiliaria (modo PROPIETARIO_DIRECTO).
 */
export interface CuentaCobranzaDirecta {
  banco: string;
  titular: string;
  cbu: string;
  alias: string;
  cuit: string;
}

export interface Propietario {
  id: string;
  nombre: string;
  apellido: string;
  cuit: string;
  email: string;
  telefono: string;
  cbuAlias: string | null;
  comisionPct: number;
  notas: string | null;
  createdAt: string;
  // métricas derivadas para el listado/detalle (en backend real se calculan)
  propiedadesIds: string[]; // FK a Propiedad.id (no a Contrato)
  totalCobradoMes: number;
  totalRecibirMes: number;
  /** Moneda de los montos mensuales (null si el dueño mezcla ARS+USD → no se agregan en un total). */
  monedaMensual?: Moneda | null;
  /** Configuración AFIP — si está conectada, al conciliar un pago se emite factura/recibo automático. */
  afip?: ArcaConfig;
  /** Cuenta directa del propietario (modo PROPIETARIO_DIRECTO). */
  cuentaCobranza?: CuentaCobranzaDirecta;
}

export interface ContratoListado {
  id: string;
  inquilino: string;
  /** Teléfono del inquilino titular (para WhatsApp/PDF de cobranza). */
  inquilinoTelefono?: string | null;
  direccion: string;
  /** FK a Propiedad.id — para cruzar la deuda de ex-inquilinos contra el listado de propiedades. */
  propiedadId?: string;
  monto: number;
  moneda: Moneda;
  estado: EstadoContrato;
  fechaInicio: string;
  fechaFin: string;
  proximoVencimiento: string;
  estadoPagoActual: EstadoLiquidacion;
  /**
   * Cobrado y saldo de la liquidación ACTUAL (la que determina estadoPagoActual).
   * Del API en prod (suma de pagos CONCILIADO, vía montoPagadoPorLiquidacion); en
   * el demo/mock quedan sin setear. Sirven para NO contar el alquiler entero como
   * pendiente cuando el mes está PARCIAL: el KPI "Pendiente" resta lo ya conciliado.
   */
  montoPagado?: number;
  saldo?: number | null;
  /**
   * Deuda TOTAL acumulada del contrato: suma del saldo (con mora) de TODAS las
   * liquidaciones impagas y vencidas, no solo la del mes actual. Del API en prod;
   * en demo/mock sin setear. Es lo que usa el resumen de morosidad/cobranza.
   */
  deudaTotal?: number | null;
  /**
   * CBU/alias específico de este contrato. Si está presente, sobreescribe
   * al CBU del propietario para esta unidad. Útil cuando el propietario
   * tiene varias propiedades y quiere recibir cada alquiler en una cuenta
   * distinta.
   */
  cbuAlias?: string | null;
  titularCuenta?: string | null;
  /** Por defecto ALQUILER_Y_EXPENSAS para retrocompatibilidad. */
  tipoContrato?: TipoContrato;
  /** Monto de expensas mensuales (si el contrato lo incluye). */
  montoExpensas?: number | null;
  /** Depósito de garantía que dejó el inquilino (plata en custodia de la inmo). */
  depositoGarantia?: number | null;
  /** Estado del depósito: RETENIDO / DEVUELTO / NETEADO / EJECUTADO. */
  estadoDeposito?: string;
  /** Índice de actualización del alquiler (ICL, IPC, etc.). Null si no aplica. */
  indiceAjuste?: string | null;
  /** Cada cuántos meses se ajusta el alquiler. Null si no aplica. */
  frecuenciaAjusteMeses?: number | null;
  /**
   * Fecha (ISO) del próximo ajuste programado del alquiler. Del API en prod (el
   * backend lo setea al alta); null/undefined si no hay ajuste programado. En el
   * demo/mock no se setea.
   */
  proximoAjuste?: string | null;
  /**
   * Trazabilidad: quién cargó el contrato y cuándo. Si lo cargó alguien con
   * rol CARGA, queda PENDIENTE_APROBACION (estado BORRADOR + pendienteAprobacion=true)
   * hasta que un ADMIN lo apruebe.
   */
  cargadoPor?: string;
  cargadoAt?: string;
  cargadoRol?: 'ADMIN' | 'OPERADOR' | 'CARGA' | 'LECTURA';
  pendienteAprobacion?: boolean;
  aprobadoPor?: string | null;
  aprobadoAt?: string | null;
  /**
   * Modo de cobranza:
   * - INMOBILIARIA: el inquilino paga a la cuenta recaudadora de la inmo, y la
   *   inmo después rinde al propietario.
   * - PROPIETARIO_DIRECTO: el inquilino transfiere directo a la cuenta del
   *   propietario, sube comprobante, y el propietario confirma recepción.
   *   El sistema sólo se entera del estado, no toca la plata.
   */
  modoCobranza?: 'INMOBILIARIA' | 'PROPIETARIO_DIRECTO';
  /** Cuando modoCobranza === 'PROPIETARIO_DIRECTO', a quién va dirigido el pago (FK a Propietario.id). */
  cobraDirectoPropietarioId?: string | null;
  /**
   * Interés por mora. moraTipo/moraValor son el override PROPIO del contrato
   * (null = hereda el default de la inmobiliaria); moraEfectiva es el esquema
   * ya resuelto por el backend con la cascada. Del API en prod.
   */
  moraTipo?: TipoMora | null;
  moraValor?: number | null;
  moraEfectiva?: MoraEfectiva;
}

export interface CampoExtraido {
  valor: string | number | null;
  confianza: Confianza;
}

export interface ContratoExtraido {
  inquilino: CampoExtraido;
  cuit: CampoExtraido;
  direccion: CampoExtraido;
  montoInicial: CampoExtraido;
  moneda: CampoExtraido;
  fechaInicio: CampoExtraido;
  fechaFin: CampoExtraido;
  diaPago: CampoExtraido;
  indiceAjuste: CampoExtraido;
  frecuenciaAjusteMeses: CampoExtraido;
  comisionInmobiliaria: CampoExtraido;
  depositoGarantia: CampoExtraido;
  tasaPunitorioDiaria: CampoExtraido;
}

// Informe SkipTrace completo. Refleja lo que devuelve un proveedor tipo
// MKT Insiders / Nosis: identificación, contacto, BCRA del titular y del
// grupo familiar + del empleador, bienes, ingresos, laboral, referencias.

export type RiesgoBcra = 'bajo' | 'medio' | 'alto' | 'irrecuperable';
export type SituacionBcra = 1 | 2 | 3 | 4 | 5;
export type VinculoFamiliar = 'CONYUGE' | 'PADRE_MADRE' | 'CONVIVIENTE' | 'HIJO' | 'HERMANO';
export type RangoIngreso = 'A1' | 'A2' | 'A3' | 'A4' | 'A5' | 'A6' | 'A7';

export interface TelefonoValidado {
  numero: string;
  tipo: 'CELULAR' | 'FIJO';
  whatsappActivo: boolean;
}

export interface ResumenBcra {
  entidadesCount: number;
  deudaTomada: number;
  deudaEnMora: number;
  riesgo: RiesgoBcra;
  situaciones: Partial<Record<SituacionBcra, number>>; // ej {1: 2, 2: 1, 3: 1}
  entidades: Array<{ codigo: string; nombre: string; deuda: number }>;
  deudaUltimos24m: boolean;
}

export interface Cheques {
  rechazadosCount: number;
  rechazadosMonto: number;
  levantadosCount: number;
  levantadosMonto: number;
}

export interface FamiliarReferencia {
  vinculo: VinculoFamiliar;
  nombreCompleto: string;
  telefonos: TelefonoValidado[];
  email: string | null;
}

export interface VecinoReferencia {
  nombreCompleto: string;
  telefono: string;
  direccion: string;
}

export type PlataformaDigital =
  | 'INSTAGRAM'
  | 'LINKEDIN'
  | 'FACEBOOK'
  | 'X'
  | 'TIKTOK'
  | 'THREADS'
  | 'YOUTUBE'
  | 'GOOGLE';

export type EstadoPerfilDigital = 'ACTIVO' | 'INACTIVO' | 'PRIVADO' | 'NO_ENCONTRADO';

export interface PerfilDigital {
  plataforma: PlataformaDigital;
  handle: string | null; // @usuario o nombre público
  url: string | null;
  verificado: boolean;
  estado: EstadoPerfilDigital;
  seguidores: number | null;
  ultimaActividad: string | null; // ISO
  notas: string | null; // ej. "menciones a alquileres anteriores", "presentación coherente"
}

export type CoherenciaHuella = 'alta' | 'media' | 'baja';

export interface HuellaDigital {
  // Score general 0-100 de cuán completa y coherente es la huella
  scoreCoherencia: CoherenciaHuella;
  // Antigüedad de la presencia digital más vieja (años)
  antiguedadAnios: number;
  // Plataformas encontradas
  perfiles: PerfilDigital[];
  // Menciones en Google / medios
  mencionesGoogle: number;
  // Email aparece en N filtraciones/sitios públicos
  emailEnSitios: number;
  // Hallazgos relevantes (positivos o negativos) que la IA destaca
  hallazgos: Array<{ tipo: 'positivo' | 'neutro' | 'alerta'; texto: string }>;
}

export interface Inmueble {
  partidoCatastral: string;
  ubicacion: string;
  tipo: 'DEPARTAMENTO' | 'CASA' | 'TERRENO';
  fechaAdquisicion: string;
}

export interface Vehiculo {
  marca: string;
  modelo: string;
  anio: number;
  fechaCompra: string;
  patente: string | null;
}

export interface Empleador {
  cuit: string;
  razonSocial: string;
  ciiu: string;
  actividad: string;
  telefonos: string[];
  email: string | null;
  paginaWeb: string | null;
  tipoEmpresa: string;
  artVigente: boolean;
  bcra: ResumenBcra;
}

export interface IngresosArca {
  categoriaArca: 'AUTONOMO' | 'MONOTRIBUTO' | 'RELACION_DEPENDENCIA' | 'NO_INSCRIPTO';
  impuestoGanancias: 'AC' | 'EX' | 'NA' | 'NI';
  impuestoIva: 'AC' | 'EX' | 'NA' | 'NI';
  integranteSocietario: boolean;
  empleador: boolean;
  ciiu: string;
  actividadDescripcion: string;
  obraSocialCodigo: string | null;
  obraSocialNombre: string | null;
  // últimos 6 meses si está en relación de dependencia
  nominaUltimos6m: Array<{ periodo: string; rangoIngreso: RangoIngreso; fechaPago: string }>;
}

export interface ScreeningResultado {
  // Identificación
  cuit: string;
  dni: string;
  nombre: string;
  apellido: string;
  fechaNacimiento: string;
  sexo: 'F' | 'M';

  // Localización
  domicilio: {
    calle: string;
    altura: string;
    pisoDpto: string | null;
    codigoPostal: string;
    localidad: string;
    partido: string;
    provincia: string;
  };

  // Contacto
  telefonos: TelefonoValidado[];
  email: string | null;

  // BCRA titular
  bcra: ResumenBcra;
  cheques: Cheques;

  // Grupo familiar
  familia: FamiliarReferencia[];
  rangoIngresoFamiliar: RangoIngreso;
  bcraFamiliar: ResumenBcra;

  // Bienes
  inmuebles: Inmueble[];
  vehiculos: Vehiculo[];

  // Ingresos
  ingresos: IngresosArca;

  // Laboral
  empleador: Empleador | null;

  // Referencias / contactación opcional
  vecinos: VecinoReferencia[];

  // Huella digital — redes sociales y presencia online
  huellaDigital: HuellaDigital;

  // Recomendación IA
  scoreNosis: number; // 0-1000
  recomendacion: Recomendacion;
  recomendacionRazon: string;
}
