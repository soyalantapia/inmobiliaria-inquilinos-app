// Caja de gastos: registro de plata que la inmobiliaria adelantó por una
// propiedad (plomero, electricista, materiales, expensas extraordinarias)
// y que se resta de la rendición al propietario.
//
// En backend real es una tabla `MovimientoCaja` con FK a Propiedad. Por
// ahora vive en localStorage. Cargamos algunos movimientos de ejemplo si
// el storage está vacío para que la demo tenga sustancia.

const STORAGE_KEY = 'llave-inmo:caja:v1';

export type CategoriaGasto =
  | 'PLOMERIA'
  | 'ELECTRICIDAD'
  | 'GAS'
  | 'CERRAJERIA'
  | 'PINTURA'
  | 'EXPENSAS'
  | 'MATERIALES'
  | 'OTRO';

export type TipoMovimiento = 'GASTO' | 'INGRESO_EXTRA';

export interface MovimientoCaja {
  id: string;
  propiedadId: string;
  contratoId: string | null;
  tipo: TipoMovimiento;
  categoria: CategoriaGasto;
  descripcion: string;
  monto: number; // siempre positivo, el tipo define si suma o resta
  fecha: string; // ISO date YYYY-MM-DD
  proveedor: string | null; // ej. "Sergio Almeida (plomero)"
  comprobante: string | null; // dataURL o ref
  cuentaId?: string | null; // cuenta de caja (de dónde sale / a dónde entra)
  cuentaNombre?: string | null; // nombre de esa cuenta (para mostrar en la lista)
  cargadoPor: string;
  createdAt: string;
  // Ya descontado en una rendición? Si no, queda pendiente de descuento.
  descontadoEnRendicion: boolean;
}

const SEED: MovimientoCaja[] = [
  {
    id: 'mov_seed_1',
    propiedadId: 'prp_001',
    contratoId: 'cnt_001',
    tipo: 'GASTO',
    categoria: 'PLOMERIA',
    descripcion: 'Reparación pérdida cocina',
    monto: 45000,
    fecha: '2026-04-30',
    proveedor: 'Sergio Almeida (plomero)',
    comprobante: null,
    cargadoPor: 'Roberto Tapia',
    createdAt: '2026-04-30T17:00:00-03:00',
    descontadoEnRendicion: true,
  },
  {
    id: 'mov_seed_2',
    propiedadId: 'prp_002',
    contratoId: 'cnt_002',
    tipo: 'GASTO',
    categoria: 'ELECTRICIDAD',
    descripcion: 'Cambio de térmica del tablero',
    monto: 28500,
    fecha: '2026-05-04',
    proveedor: 'Diego Ferrari (electricista)',
    comprobante: null,
    cargadoPor: 'Luciana Vidal',
    createdAt: '2026-05-04T11:30:00-03:00',
    descontadoEnRendicion: false,
  },
  {
    id: 'mov_seed_3',
    propiedadId: 'prp_004',
    contratoId: 'cnt_004',
    tipo: 'GASTO',
    categoria: 'EXPENSAS',
    descripcion: 'Expensa extraordinaria — fachada',
    monto: 62000,
    fecha: '2026-05-02',
    proveedor: 'Consorcio',
    comprobante: null,
    cargadoPor: 'Roberto Tapia',
    createdAt: '2026-05-02T09:00:00-03:00',
    descontadoEnRendicion: false,
  },
];

function leer(): MovimientoCaja[] {
  if (typeof window === 'undefined') return SEED;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return SEED;
    return JSON.parse(raw) as MovimientoCaja[];
  } catch {
    return SEED;
  }
}

function guardar(lista: MovimientoCaja[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lista));
  } catch {
    // ignore
  }
}

export function listarMovimientosCaja(): MovimientoCaja[] {
  return [...leer()].sort((a, b) => b.fecha.localeCompare(a.fecha));
}

export function movimientosDePropiedad(propiedadId: string): MovimientoCaja[] {
  return listarMovimientosCaja().filter((m) => m.propiedadId === propiedadId);
}

export function totalPendienteDescuento(propiedadId: string): number {
  return movimientosDePropiedad(propiedadId)
    .filter((m) => m.tipo === 'GASTO' && !m.descontadoEnRendicion)
    .reduce((acc, m) => acc + m.monto, 0);
}

// Suma global de TODOS los gastos pendientes de descontar (sin propiedad). Se
// usa en el KPI "A rendir a propietarios" del dashboard, que debe descontar los
// gastos de caja del neto a transferir.
export function totalGastosPendientesGlobal(): number {
  return listarMovimientosCaja()
    .filter((m) => m.tipo === 'GASTO' && !m.descontadoEnRendicion)
    .reduce((acc, m) => acc + m.monto, 0);
}

export function cargarMovimiento(
  data: Omit<MovimientoCaja, 'id' | 'createdAt' | 'descontadoEnRendicion'>,
): MovimientoCaja {
  const nuevo: MovimientoCaja = {
    ...data,
    id: `mov_${Date.now()}`,
    createdAt: new Date().toISOString(),
    descontadoEnRendicion: false,
  };
  guardar([nuevo, ...leer()]);
  return nuevo;
}

export function eliminarMovimiento(id: string): void {
  guardar(leer().filter((m) => m.id !== id));
}

export function marcarDescontado(id: string): void {
  guardar(
    leer().map((m) => (m.id === id ? { ...m, descontadoEnRendicion: true } : m)),
  );
}

export const categoriaGastoLabel: Record<CategoriaGasto, string> = {
  PLOMERIA: 'Plomería',
  ELECTRICIDAD: 'Electricidad',
  GAS: 'Gas',
  CERRAJERIA: 'Cerrajería',
  PINTURA: 'Pintura',
  EXPENSAS: 'Expensas',
  MATERIALES: 'Materiales',
  OTRO: 'Otro',
};
