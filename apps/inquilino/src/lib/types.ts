// Tipos espejo de packages/db (los duplicamos en frontend para evitar acoplar
// la app al cliente Prisma hasta que exista el backend).

export type Moneda = 'ARS' | 'USD';
export type EstadoLiquidacion = 'PENDIENTE' | 'PAGADO' | 'PARCIAL' | 'VENCIDO';
export type Categoria = 'PLOMERIA' | 'ELECTRICIDAD' | 'CERRADURA' | 'CALEFACCION' | 'OTRO';
export type Urgencia = 'BAJA' | 'MEDIA' | 'ALTA' | 'EMERGENCIA';

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
