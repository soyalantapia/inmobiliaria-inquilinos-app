// Tipos espejo de packages/db (los duplicamos en frontend para evitar acoplar
// la app al cliente Prisma hasta que exista el backend).

export type Moneda = 'ARS' | 'USD';
export type EstadoLiquidacion = 'PENDIENTE' | 'PAGADO' | 'PARCIAL' | 'VENCIDO';

// Reclamos
export type Categoria = 'PLOMERIA' | 'ELECTRICIDAD' | 'CERRADURA' | 'CALEFACCION' | 'OTRO';
export type Urgencia = 'BAJA' | 'MEDIA' | 'ALTA' | 'EMERGENCIA';
export type EstadoReclamo = 'ABIERTO' | 'EN_CURSO' | 'RESUELTO' | 'CERRADO' | 'RECHAZADO';

// Cada cambio de estado, asignación o mensaje queda como evento en la timeline.
// VISITA_* son hitos del profesional asignado (se computan al vuelo desde
// `visitas-profesional` storage al renderizar — no se persisten en eventos).
export type TipoEvento =
  | 'CREADO'
  | 'ASIGNADO'
  | 'EN_CURSO'
  | 'RESUELTO'
  | 'CERRADO'
  | 'RECHAZADO'
  | 'MENSAJE_INQUILINO'
  | 'MENSAJE_INMO'
  | 'VISITA_CONFIRMADA'
  | 'VISITA_EN_CAMINO'
  | 'VISITA_LISTO';

export interface EventoReclamo {
  id: string;
  tipo: TipoEvento;
  autor: string; // nombre visible
  contenido: string | null; // texto del mensaje o nota de cambio
  adjuntoUrl?: string | null; // adjunto opcional del mensaje (foto/archivo)
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
  /** Profesional externo que la inmobiliaria asignó para venir a resolverlo. */
  profesionalAsignadoNombre?: string | null;
  profesionalAsignadoTelefono?: string | null;
  profesionalAsignadoCategoria?: string | null;
  /** Decisión del inquilino sobre el cierre (solo prod/API). En demo la decisión
   *  vive en localStorage (confirmaciones-reclamo.ts). */
  confirmacionInquilino?: {
    estado: 'CONFORME' | 'PERSISTE';
    fecha: string;
    comentario: string | null;
  } | null;
  /** Calificación del inquilino del reclamo resuelto (solo prod/API). */
  ratingInquilino?: {
    estrellas: number;
    comentario: string | null;
    enviadoAt: string;
  } | null;
}

/**
 * Un pago informado por el inquilino, tal como lo expone el API dentro de
 * `Liquidacion.pagos` (GET /mis-liquidaciones). Espejo read-only de la tabla
 * `Pago`: INFORMADO = en revisión de la inmobiliaria, CONCILIADO = acreditado,
 * RECHAZADO = rechazado (la `observacion` trae el motivo; un pago anulado
 * después de conciliar también queda RECHAZADO, con observacion
 * "Anulado tras conciliar: ...").
 */
export interface PagoDeLiquidacion {
  id: string;
  tipo: 'TOTAL' | 'PARCIAL';
  estado: 'INFORMADO' | 'CONCILIADO' | 'RECHAZADO';
  monto: number;
  metodo: 'TRANSFERENCIA' | 'MERCADOPAGO' | 'EFECTIVO' | 'CHEQUE';
  nroOperacion: string | null;
  /** Fecha de la transferencia declarada por el inquilino (ISO). */
  fechaTransferencia: string;
  /** Cuándo lo informó en la app (ISO). El API ordena la lista ASC por esto. */
  informadoAt: string;
  /** Cuándo la inmo decidió (conciliar/rechazar); null si sigue en revisión. */
  decididoAt: string | null;
  /** Motivo del rechazo (solo tiene sentido en RECHAZADO). */
  observacion: string | null;
  /** Comprobante real en /uploads del backend. Un <a>/<img> no puede mandar
   *  Authorization: abrirlo requiere pasar por `urlDeArchivo` (?token=). */
  comprobanteUrl: string | null;
  comprobanteFileName: string | null;
  comprobanteMime: string | null;
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
  /** Fecha en que la inmobiliaria concilió el pago (solo cuando estado=PAGADO). */
  fechaPago?: string | null;
  estado: EstadoLiquidacion;
  moneda: Moneda;
  /** Suma de pagos CONCILIADOS de esta liquidación (lo que la inmo ya validó).
   *  Viene del API en prod; undefined en la demo offline (se usa el store local). */
  montoPagado?: number;
  /** Saldo pendiente real = montoTotal − montoPagado (del API, prod). */
  saldo?: number;
  /** Pagos informados por el inquilino (en revisión / conciliados / rechazados),
   *  ordenados por informadoAt ASC. Vienen del API en prod; undefined en la
   *  demo offline (ahí los pagos viven en el store local `pago-storage`). */
  pagos?: PagoDeLiquidacion[];
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
