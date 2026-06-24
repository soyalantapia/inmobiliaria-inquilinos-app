'use client';

/**
 * Inventario de materiales y repuestos por consorcio.
 *
 * Pedido recurrente del feedback: "tengo focos, fluorescentes, cerraduras,
 * llaves de paso, repuestos del portero — necesito saber cuántos tengo y
 * descontar cada vez que usamos algo, así al fin de mes le pasamos al
 * consorcio el detalle real de lo que se consumió".
 *
 * Storage por consorcioId con N items. Cada item tiene cantidad actual,
 * mínimo deseado (para alertas) y log de movimientos. En backend real
 * vive en tablas ItemInventario + MovimientoInventario.
 */

const STORAGE_KEY = 'llave-inmo:consorcio-inventario:v1';

export type CategoriaInventario =
  | 'ILUMINACION'
  | 'PLOMERIA'
  | 'CERRAJERIA'
  | 'LIMPIEZA'
  | 'ELECTRICIDAD'
  | 'OFICINA'
  | 'OTRO';

export interface ItemInventario {
  id: string;
  consorcioId: string;
  categoria: CategoriaInventario;
  nombre: string;
  /** Unidad de medida ("unidades", "litros", "metros"). */
  unidad: string;
  cantidadActual: number;
  /** Stock mínimo deseado — alerta si baja de acá. */
  minimoStock: number;
  /** Costo unitario promedio para estimar valor del stock. */
  costoUnitario?: number;
  notas?: string;
  actualizadoAt: string;
}

export interface MovimientoInventario {
  id: string;
  itemId: string;
  consorcioId: string;
  tipo: 'ENTRADA' | 'SALIDA' | 'AJUSTE';
  cantidad: number;
  motivo: string;
  /** Unidad funcional / lugar donde se usó. */
  ufDestino?: string;
  fecha: string;
  cargadoPor: string;
}

interface Payload {
  items: Record<string, ItemInventario[]>;
  movimientos: Record<string, MovimientoInventario[]>;
}

function read(): Payload {
  if (typeof window === 'undefined') return { items: SEEDS_ITEMS, movimientos: SEEDS_MOVS };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      // Validar la FORMA, no solo que sea JSON: un valor válido pero de shape
      // incorrecto (ej. `[]`) pasaba el catch y crasheaba luego en read().items[id].
      const p = JSON.parse(raw);
      if (p && typeof p === 'object' && !Array.isArray(p) && p.items && p.movimientos) {
        return p as Payload;
      }
    }
  } catch {
    // ignore
  }
  return { items: SEEDS_ITEMS, movimientos: SEEDS_MOVS };
}

function write(p: Payload): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    // ignore
  }
}

export function listarInventarioDe(consorcioId: string): ItemInventario[] {
  return (read().items[consorcioId] ?? []).sort((a, b) =>
    a.nombre.localeCompare(b.nombre),
  );
}

export function listarMovimientosDe(
  consorcioId: string,
  itemId?: string,
): MovimientoInventario[] {
  let lista = read().movimientos[consorcioId] ?? [];
  if (itemId) lista = lista.filter((m) => m.itemId === itemId);
  return [...lista].sort((a, b) => b.fecha.localeCompare(a.fecha));
}

export function cargarItem(
  input: Omit<ItemInventario, 'id' | 'actualizadoAt'>,
): ItemInventario {
  const nuevo: ItemInventario = {
    ...input,
    id: `inv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    actualizadoAt: new Date().toISOString(),
  };
  const data = read();
  const lista = data.items[input.consorcioId] ?? [];
  lista.push(nuevo);
  data.items[input.consorcioId] = lista;
  write(data);
  return nuevo;
}

export function moverStock(
  input: Omit<MovimientoInventario, 'id' | 'fecha'>,
): MovimientoInventario {
  const data = read();
  const mov: MovimientoInventario = {
    ...input,
    id: `movinv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    fecha: new Date().toISOString(),
  };
  // Aplicar al stock
  const items = data.items[input.consorcioId] ?? [];
  const idx = items.findIndex((i) => i.id === input.itemId);
  if (idx >= 0) {
    const item = items[idx]!;
    const delta =
      input.tipo === 'ENTRADA'
        ? input.cantidad
        : input.tipo === 'SALIDA'
          ? -input.cantidad
          : input.cantidad - item.cantidadActual;
    items[idx] = {
      ...item,
      cantidadActual: Math.max(0, item.cantidadActual + delta),
      actualizadoAt: new Date().toISOString(),
    };
  }
  data.items[input.consorcioId] = items;

  // Registrar movimiento
  const movsLista = data.movimientos[input.consorcioId] ?? [];
  movsLista.unshift(mov);
  data.movimientos[input.consorcioId] = movsLista;

  write(data);
  return mov;
}

export function eliminarItem(consorcioId: string, itemId: string): void {
  const data = read();
  const items = (data.items[consorcioId] ?? []).filter((i) => i.id !== itemId);
  data.items[consorcioId] = items;
  write(data);
}

export const CATEGORIA_INVENTARIO_LABEL: Record<CategoriaInventario, string> = {
  ILUMINACION: 'Iluminación',
  PLOMERIA: 'Plomería',
  CERRAJERIA: 'Cerrajería',
  LIMPIEZA: 'Limpieza',
  ELECTRICIDAD: 'Electricidad',
  OFICINA: 'Oficina',
  OTRO: 'Otros',
};

/* ============================================================
 * Seeds para que el demo arranque con inventario visible y un
 * caso de "stock bajo" que active alerta.
 * ============================================================ */
const SEEDS_ITEMS: Record<string, ItemInventario[]> = {
  cnsr_001: [
    {
      id: 'inv_seed_1',
      consorcioId: 'cnsr_001',
      categoria: 'ILUMINACION',
      nombre: 'Foco LED 9W cálido',
      unidad: 'unidades',
      cantidadActual: 12,
      minimoStock: 6,
      costoUnitario: 4200,
      notas: 'Pasillos y hall de PB.',
      actualizadoAt: '2026-04-22T11:00:00.000Z',
    },
    {
      id: 'inv_seed_2',
      consorcioId: 'cnsr_001',
      categoria: 'ILUMINACION',
      nombre: 'Tubo LED T8 18W',
      unidad: 'unidades',
      cantidadActual: 3,
      minimoStock: 8,
      costoUnitario: 9800,
      notas: 'Cochera y sala de máquinas.',
      actualizadoAt: '2026-05-12T15:42:00.000Z',
    },
    {
      id: 'inv_seed_3',
      consorcioId: 'cnsr_001',
      categoria: 'LIMPIEZA',
      nombre: 'Detergente piso 5L',
      unidad: 'bidones',
      cantidadActual: 5,
      minimoStock: 2,
      costoUnitario: 12500,
      actualizadoAt: '2026-05-02T09:15:00.000Z',
    },
    {
      id: 'inv_seed_4',
      consorcioId: 'cnsr_001',
      categoria: 'CERRAJERIA',
      nombre: 'Juego de llaves del portón principal',
      unidad: 'unidades',
      cantidadActual: 2,
      minimoStock: 3,
      costoUnitario: 8500,
      notas: 'Las da Carlos cuando un titular pide copia. Cobrar aparte.',
      actualizadoAt: '2026-03-28T13:00:00.000Z',
    },
    {
      id: 'inv_seed_5',
      consorcioId: 'cnsr_001',
      categoria: 'PLOMERIA',
      nombre: 'Cinta teflón 12mm',
      unidad: 'rollos',
      cantidadActual: 14,
      minimoStock: 5,
      costoUnitario: 1200,
      actualizadoAt: '2026-02-14T10:00:00.000Z',
    },
    {
      id: 'inv_seed_6',
      consorcioId: 'cnsr_001',
      categoria: 'ELECTRICIDAD',
      nombre: 'Térmica 16A bipolar',
      unidad: 'unidades',
      cantidadActual: 4,
      minimoStock: 2,
      costoUnitario: 18900,
      actualizadoAt: '2026-04-08T16:20:00.000Z',
    },
  ],
};

const SEEDS_MOVS: Record<string, MovimientoInventario[]> = {
  cnsr_001: [
    {
      id: 'movinv_seed_1',
      itemId: 'inv_seed_2',
      consorcioId: 'cnsr_001',
      tipo: 'SALIDA',
      cantidad: 2,
      motivo: 'Reemplazo tubos quemados de cochera',
      ufDestino: 'Cochera nivel -1',
      fecha: '2026-05-12T15:42:00.000Z',
      cargadoPor: 'Carlos Domínguez',
    },
    {
      id: 'movinv_seed_2',
      itemId: 'inv_seed_1',
      consorcioId: 'cnsr_001',
      tipo: 'SALIDA',
      cantidad: 3,
      motivo: 'Reposición focos hall PB',
      fecha: '2026-04-22T11:00:00.000Z',
      cargadoPor: 'Carlos Domínguez',
    },
    {
      id: 'movinv_seed_3',
      itemId: 'inv_seed_3',
      consorcioId: 'cnsr_001',
      tipo: 'ENTRADA',
      cantidad: 6,
      motivo: 'Compra mensual',
      fecha: '2026-05-02T09:15:00.000Z',
      cargadoPor: 'Luciana Vidal',
    },
  ],
};

/**
 * Items con cantidad por debajo del mínimo — para alertas.
 */
export function itemsBajoMinimo(consorcioId: string): ItemInventario[] {
  return listarInventarioDe(consorcioId).filter(
    (i) => i.cantidadActual < i.minimoStock,
  );
}
