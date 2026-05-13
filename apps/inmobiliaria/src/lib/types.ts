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
  fecha: string; // ISO
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
  /** Clasificación que decide quién paga el arreglo. */
  clasificacion?: ClasificacionReclamo | null;
  /** Profesional externo que el admin asignó al reclamo (de la red curada). */
  profesionalAsignadoId?: string | null;
  profesionalAsignadoNombre?: string | null;
  profesionalAsignadoTelefono?: string | null;
  profesionalAsignadoCategoria?: string | null;
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
}

export interface ContratoListado {
  id: string;
  inquilino: string;
  direccion: string;
  monto: number;
  moneda: Moneda;
  estado: EstadoContrato;
  fechaInicio: string;
  fechaFin: string;
  proximoVencimiento: string;
  estadoPagoActual: EstadoLiquidacion;
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

export interface IngresosAfip {
  categoriaAfip: 'AUTONOMO' | 'MONOTRIBUTO' | 'RELACION_DEPENDENCIA' | 'NO_INSCRIPTO';
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
  ingresos: IngresosAfip;

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
