// Tipos espejo de packages/db (los duplicamos en frontend para evitar acoplar
// la app al cliente Prisma hasta que exista el backend).

export type Moneda = 'ARS' | 'USD';
export type EstadoLiquidacion = 'PENDIENTE' | 'PAGADO' | 'PARCIAL' | 'VENCIDO';

// Reclamos
export type Categoria = 'PLOMERIA' | 'ELECTRICIDAD' | 'CERRADURA' | 'CALEFACCION' | 'OTRO';
export type Urgencia = 'BAJA' | 'MEDIA' | 'ALTA' | 'EMERGENCIA';
export type EstadoReclamo = 'ABIERTO' | 'EN_CURSO' | 'RESUELTO' | 'CERRADO' | 'RECHAZADO';

// Cada cambio de estado, asignación o mensaje queda como evento en la timeline.
export type TipoEvento =
  | 'CREADO'
  | 'ASIGNADO'
  | 'EN_CURSO'
  | 'RESUELTO'
  | 'CERRADO'
  | 'RECHAZADO'
  | 'MENSAJE_INQUILINO'
  | 'MENSAJE_INMO';

export interface EventoReclamo {
  id: string;
  tipo: TipoEvento;
  autor: string; // nombre visible
  contenido: string | null; // texto del mensaje o nota de cambio
  fecha: string; // ISO
}

export interface Reclamo {
  id: string;
  contratoId: string;
  inquilino: string;
  direccion: string;
  categoria: Categoria;
  descripcion: string;
  urgencia: Urgencia;
  estado: EstadoReclamo;
  asignadoA: string | null;
  fotoUrl: string | null;
  resolucion: string | null; // descripción de cómo se resolvió
  createdAt: string;
  resueltoAt: string | null;
  eventos: EventoReclamo[];
}

export interface Liquidacion {
  id: string;
  contratoId: string;
  periodo: string;
  montoAlquiler: number;
  montoExpensas: number | null;
  montoPunitorio: number;
  montoTotal: number;
  fechaVencimiento: string;
  estado: EstadoLiquidacion;
  moneda: Moneda;
}

export interface Contrato {
  id: string;
  direccion: string;
  ciudad: string;
  inmobiliaria: string;
  fechaInicio: string;
  fechaFin: string;
  diaPago: number;
  indiceAjuste: 'ICL' | 'IPC' | 'CASA_PROPIA' | 'UVA' | 'CAC' | 'RIPTE' | 'FIJO';
  proximoAjuste: string;
  montoActual: number;
  moneda: Moneda;
}

export interface MensajeChat {
  id: string;
  rol: 'USER' | 'ASSISTANT';
  contenido: string;
  citas?: Array<{ clausula: string; texto: string }>;
  createdAt: string;
}

export interface Comprobante {
  id: string;
  periodo: string;
  monto: number;
  moneda: Moneda;
  fechaPago: string;
  metodo: 'MERCADOPAGO' | 'TRANSFERENCIA' | 'QR' | 'CRIPTO';
  pdfUrl: string;
}
