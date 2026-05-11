export type Moneda = 'ARS' | 'USD';
export type EstadoContrato = 'BORRADOR' | 'ACTIVO' | 'FINALIZADO' | 'RESCINDIDO';
export type EstadoLiquidacion = 'PENDIENTE' | 'PAGADO' | 'PARCIAL' | 'VENCIDO';
export type IndiceAjuste = 'ICL' | 'IPC' | 'CASA_PROPIA' | 'UVA' | 'CAC' | 'RIPTE' | 'FIJO';
export type Recomendacion = 'APTO' | 'APTO_CON_GARANTIA' | 'NO_APTO';
export type Confianza = 'alto' | 'medio' | 'bajo';

export type CategoriaReclamo = 'PLOMERIA' | 'ELECTRICIDAD' | 'CERRADURA' | 'CALEFACCION' | 'OTRO';
export type UrgenciaReclamo = 'BAJA' | 'MEDIA' | 'ALTA' | 'EMERGENCIA';
export type EstadoReclamo = 'ABIERTO' | 'EN_CURSO' | 'RESUELTO' | 'CERRADO';

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
  createdAt: string;
  resueltoAt: string | null;
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
  propiedadesIds: string[];
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

export interface ScreeningResultado {
  cuit: string;
  nombre: string;
  scoreNosis: number;
  resultadoBcra: number;
  deudasCount: number;
  deudasMonto: number;
  chequesRechazados: number;
  juiciosCount: number;
  recomendacion: Recomendacion;
  recomendacionRazon: string;
}
