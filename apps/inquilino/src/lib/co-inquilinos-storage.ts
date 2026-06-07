// Co-inquilinos: gente que vive con vos y puede ver/actuar sobre el contrato.
// Modelo típico de Argentina: pareja o roommate que comparte alquiler. En
// backend real estarían vinculados como User con role TENANT_SECONDARY al
// mismo contrato + sistema de permisos granular.

const STORAGE_KEY = 'llave:co-inquilinos:v1';

export type PermisoCoInquilino = 'VER' | 'PAGAR' | 'COMPLETO';

export type EstadoInvitacion = 'PENDIENTE' | 'ACEPTADO';

export interface CoInquilino {
  id: string;
  nombre: string;
  email: string;
  telefono: string | null;
  dni?: string;
  relacion: string; // ej: "Pareja", "Hermano", "Amigo" o lo aclarado en "Otro"
  permiso: PermisoCoInquilino;
  estado: EstadoInvitacion;
  invitadoAt: string;
  aceptadoAt: string | null;
}

export function listarCoInquilinos(): CoInquilino[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as CoInquilino[];
  } catch {
    return [];
  }
}

export function invitarCoInquilino(
  data: Omit<CoInquilino, 'id' | 'estado' | 'invitadoAt' | 'aceptadoAt'>,
): CoInquilino {
  const nuevo: CoInquilino = {
    ...data,
    id: `co_${Date.now()}`,
    estado: 'PENDIENTE',
    invitadoAt: new Date().toISOString(),
    aceptadoAt: null,
  };
  const lista = listarCoInquilinos();
  guardar([nuevo, ...lista]);
  return nuevo;
}

export function aceptarInvitacion(id: string): void {
  const lista = listarCoInquilinos().map((c) =>
    c.id === id ? { ...c, estado: 'ACEPTADO' as const, aceptadoAt: new Date().toISOString() } : c,
  );
  guardar(lista);
}

export function eliminarCoInquilino(id: string): void {
  guardar(listarCoInquilinos().filter((c) => c.id !== id));
}

export function cambiarPermiso(id: string, permiso: PermisoCoInquilino): void {
  const lista = listarCoInquilinos().map((c) => (c.id === id ? { ...c, permiso } : c));
  guardar(lista);
}

function guardar(lista: CoInquilino[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lista));
  } catch {
    // ignore
  }
}

export const permisoLabel: Record<PermisoCoInquilino, string> = {
  VER: 'Solo ver',
  PAGAR: 'Ver y pagar',
  COMPLETO: 'Todo',
};

export const permisoDescripcion: Record<PermisoCoInquilino, string> = {
  VER: 'Ve el contrato, los pagos y los reclamos. No puede actuar.',
  PAGAR: 'Puede ver todo + informar pagos en su nombre.',
  COMPLETO: 'Puede ver todo + pagar + crear reclamos + decidir renovación.',
};
