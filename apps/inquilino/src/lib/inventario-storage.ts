// Inventario inicial del depto: foto-checklist por ambiente del estado al
// entrar a vivir. La inmobiliaria lo "firma" digitalmente (en esta demo
// es un flag boolean) y al devolver el depósito sirve de referencia.
// En backend real esto vive en una tabla Inventario con S3 para las fotos.

const STORAGE_KEY = 'llave:inventario:v1';

export type EstadoItem = 'BUENO' | 'REGULAR' | 'MALO' | 'FALTANTE';

export interface ItemInventario {
  id: string;
  ambiente: string;
  descripcion: string;
  estado: EstadoItem;
  observaciones: string | null;
  fotoUrl: string | null; // dataUrl en demo
  createdAt: string;
}

export interface EstadoInventario {
  items: ItemInventario[];
  firmadoInmobiliaria: boolean;
  firmadoAt: string | null;
}

const DEFAULT: EstadoInventario = {
  items: [],
  firmadoInmobiliaria: false,
  firmadoAt: null,
};

export function leerInventario(): EstadoInventario {
  if (typeof window === 'undefined') return DEFAULT;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT;
    return { ...DEFAULT, ...JSON.parse(raw) };
  } catch {
    return DEFAULT;
  }
}

export function guardarInventario(estado: EstadoInventario): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(estado));
  } catch {
    // ignore
  }
}

export function agregarItem(item: Omit<ItemInventario, 'id' | 'createdAt'>): ItemInventario {
  const nuevo: ItemInventario = {
    ...item,
    id: `inv_${Date.now()}`,
    createdAt: new Date().toISOString(),
  };
  const estado = leerInventario();
  guardarInventario({ ...estado, items: [nuevo, ...estado.items] });
  return nuevo;
}

export function eliminarItem(id: string): void {
  const estado = leerInventario();
  guardarInventario({
    ...estado,
    items: estado.items.filter((i) => i.id !== id),
  });
}

export function actualizarItem(id: string, cambios: Partial<ItemInventario>): void {
  const estado = leerInventario();
  guardarInventario({
    ...estado,
    items: estado.items.map((i) => (i.id === id ? { ...i, ...cambios } : i)),
  });
}

export function firmarInmobiliaria(): void {
  const estado = leerInventario();
  guardarInventario({
    ...estado,
    firmadoInmobiliaria: true,
    firmadoAt: new Date().toISOString(),
  });
}

export const AMBIENTES_DEFAULT = [
  'Living',
  'Cocina',
  'Baño',
  'Dormitorio',
  'Balcón',
  'Otros',
] as const;

export const estadoLabel: Record<EstadoItem, string> = {
  BUENO: 'Bueno',
  REGULAR: 'Regular',
  MALO: 'Malo',
  FALTANTE: 'Faltante',
};

export const estadoColor: Record<EstadoItem, string> = {
  BUENO: 'bg-emerald-500',
  REGULAR: 'bg-amber-500',
  MALO: 'bg-orange-500',
  FALTANTE: 'bg-red-500',
};
