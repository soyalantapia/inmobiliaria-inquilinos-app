'use client';

/**
 * Inquilinos invitados desde el panel inmobiliario.
 *
 * Cuando un agente carga un inquilino nuevo a una propiedad, queda
 * guardado acá con estado PENDIENTE_ACTIVACION hasta que el inquilino
 * entra por primera vez con su email + código OTP.
 *
 * En backend real esto vive en una tabla con FK al contrato y al
 * propietario. Acá usamos localStorage.
 *
 * NOTA: la app del inquilino usa el mismo schema en su propio
 * localStorage (origen distinto) — para la demo, los emails registrados
 * desde acá son los que el inquilino puede usar para loguearse.
 */

import { contratosMock, propiedadesMock } from '@/lib/mock-data';

const STORAGE_KEY = 'llave-inmo:inquilinos-invitados:v1';
// Clave que lee el LOGIN de la app inquilino (auth-otp.ts) — otra forma
// (InvitadoRegistrado). Espejamos ahí los invitados para que, cuando ambas apps
// comparten origin (GH Pages), el inquilino entre con su contrato/dirección reales.
const INQUILINO_AUTH_KEY = 'llave-inquilino:auth:invitados:v1';

export type EstadoInvitacion = 'PENDIENTE_ACTIVACION' | 'ACTIVO';

export interface CoInquilinoInvitado {
  nombre: string;
  apellido: string;
  /** WhatsApp obligatorio (canal principal de comunicación). */
  celular: string;
  email?: string;
  relacion: string; // ej: "Conviviente", "Cónyuge", "Hijo/a"
  permiso: 'VER' | 'PAGAR' | 'COMPLETO';
}

export interface DocumentoAdjunto {
  nombre: string;
  tipoMime: string;
  tamanioBytes: number;
  dataUrl: string;
  subidoAt: string;
}

export interface InquilinoInvitado {
  id: string;
  propiedadId: string;
  contratoId: string | null; // null si todavía no se le asignó contrato
  // Datos personales
  nombre: string;
  apellido: string;
  /**
   * WhatsApp es el canal principal. Email pasa a ser opcional según
   * el feedback de los clientes piloto.
   */
  telefono: string;
  email?: string;
  dni: string;
  fechaNacimiento: string | null;
  // Co-inquilinos
  coInquilinos: CoInquilinoInvitado[];
  // Documentos iniciales
  documentos: DocumentoAdjunto[];
  // Estado
  estado: EstadoInvitacion;
  invitadoAt: string;
  invitadoPor: string; // usuario inmo que lo cargó
  activadoAt: string | null;
}

export function listarInvitados(): InquilinoInvitado[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as InquilinoInvitado[]) : [];
  } catch {
    return [];
  }
}

export function invitadosDePropiedad(propiedadId: string): InquilinoInvitado[] {
  return listarInvitados().filter((i) => i.propiedadId === propiedadId);
}

export interface CrearInvitadoInput {
  propiedadId: string;
  contratoId?: string | null;
  nombre: string;
  apellido: string;
  /** WhatsApp obligatorio. */
  telefono: string;
  email?: string;
  dni: string;
  fechaNacimiento?: string | null;
  coInquilinos?: CoInquilinoInvitado[];
  documentos?: DocumentoAdjunto[];
  invitadoPor?: string;
}

export function crearInvitado(input: CrearInvitadoInput): InquilinoInvitado {
  const ahora = new Date().toISOString();
  const nuevo: InquilinoInvitado = {
    id: `inv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    propiedadId: input.propiedadId,
    contratoId: input.contratoId ?? null,
    nombre: input.nombre.trim(),
    apellido: input.apellido.trim(),
    telefono: input.telefono.trim(),
    email: input.email?.trim().toLowerCase() || undefined,
    dni: input.dni.trim(),
    fechaNacimiento: input.fechaNacimiento ?? null,
    coInquilinos: input.coInquilinos ?? [],
    documentos: input.documentos ?? [],
    estado: 'PENDIENTE_ACTIVACION',
    invitadoAt: ahora,
    invitadoPor: input.invitadoPor ?? 'Equipo de la inmobiliaria',
    activadoAt: null,
  };
  if (typeof window !== 'undefined') {
    try {
      const lista = listarInvitados();
      lista.unshift(nuevo);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lista));
      if (nuevo.email) espejarParaLoginInquilino(nuevo);
    } catch {
      // ignore
    }
  }
  return nuevo;
}

/**
 * Espeja el invitado en la clave que lee el login del inquilino, con la forma
 * InvitadoRegistrado (email/nombre/apellido/direccion/contratoId/invitadoAt). La
 * dirección sale del contrato asignado o de la propiedad. Sin esto, un invitado
 * cargado desde el panel se logueaba con sesión genérica (direccion/contrato '—').
 */
function espejarParaLoginInquilino(inv: InquilinoInvitado): void {
  try {
    const contrato = inv.contratoId ? contratosMock.find((c) => c.id === inv.contratoId) : null;
    const propiedad = propiedadesMock.find((p) => p.id === inv.propiedadId);
    const registro = {
      email: (inv.email ?? '').toLowerCase(),
      nombre: inv.nombre,
      apellido: inv.apellido,
      direccion: contrato?.direccion ?? propiedad?.direccion ?? '—',
      contratoId: inv.contratoId ?? '—',
      invitadoAt: inv.invitadoAt,
    };
    const raw = window.localStorage.getItem(INQUILINO_AUTH_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    const lista = Array.isArray(parsed) ? parsed.filter((r) => r?.email !== registro.email) : [];
    lista.unshift(registro);
    window.localStorage.setItem(INQUILINO_AUTH_KEY, JSON.stringify(lista));
  } catch {
    // ignore
  }
}

export function eliminarInvitado(id: string): void {
  if (typeof window === 'undefined') return;
  try {
    const lista = listarInvitados().filter((i) => i.id !== id);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lista));
  } catch {
    // ignore
  }
}

export async function leerArchivoComoDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
