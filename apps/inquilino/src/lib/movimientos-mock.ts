// Mock de movimientos para el feed estilo banco en /pagos.
// En backend real esto se compone de pagos + ajustes + cargos + reembolsos
// + notificaciones del contrato.

export type MovimientoTipo = 'pago' | 'pago_expensa' | 'ajuste' | 'punitorio' | 'reembolso' | 'aviso';

export interface Movimiento {
  id: string;
  tipo: MovimientoTipo;
  titulo: string;
  detalle: string;
  fecha: string; // ISO
  monto: number | null; // null para avisos / informativos
  signo: 'salida' | 'entrada' | 'info';
}

export const movimientosMock: Movimiento[] = [
  {
    id: 'mv_001',
    tipo: 'pago',
    titulo: 'Alquiler Abril 2026',
    detalle: 'Mercado Pago · liquidación cn-04',
    fecha: '2026-04-08T11:20:00-03:00',
    monto: 568500,
    signo: 'salida',
  },
  {
    id: 'mv_002',
    tipo: 'pago_expensa',
    titulo: 'Expensas Marzo 2026',
    detalle: 'Consorcio Gorriti 4521',
    fecha: '2026-03-04T09:42:00-03:00',
    monto: 88500,
    signo: 'salida',
  },
  {
    id: 'mv_003',
    tipo: 'ajuste',
    titulo: 'Aumento aplicado',
    detalle: 'ICL +18,4% · contrato cn-001',
    fecha: '2026-03-01T00:00:00-03:00',
    monto: null,
    signo: 'info',
  },
  {
    id: 'mv_004',
    tipo: 'pago',
    titulo: 'Alquiler Febrero 2026',
    detalle: 'Transferencia bancaria',
    fecha: '2026-02-09T15:30:00-03:00',
    monto: 480000,
    signo: 'salida',
  },
  {
    id: 'mv_005',
    tipo: 'aviso',
    titulo: 'Nuevo contrato firmado',
    detalle: 'Gorriti 4521 · vigencia 36 meses',
    fecha: '2025-09-01T10:00:00-03:00',
    monto: null,
    signo: 'info',
  },
];
