'use client';

/**
 * Co-inquilinos de un contrato (panel inmo). En prod (apiEnabled) van contra el
 * CRUD real /contratos/:contratoId/co-inquilinos (tabla CoInquilino, tenant-scope);
 * en demo caen al localStorage de co-inquilinos-extra-storage, intacto.
 *
 * Antes el panel escribía SOLO en localStorage → el toast decía "se le envía el
 * link por WhatsApp" pero nada llegaba a la DB ni daba acceso real al co-inquilino.
 */
import { useCallback, useEffect, useState } from 'react';
import { apiEnabled, apiFetch } from './client';
import {
  type AgregarCoInquilinoInput,
  type CoInquilinoExtra,
  type PermisoCoInquilino,
  agregarCoInquilino,
  coInquilinosDePropiedad,
  eliminarCoInquilino,
} from '@/lib/co-inquilinos-extra-storage';

// Fila Prisma CoInquilino devuelta por la API.
interface CoInquilinoApi {
  id: string;
  contratoId: string;
  nombre: string;
  email: string;
  telefono: string | null;
  dni: string | null;
  relacion: string;
  permiso: PermisoCoInquilino;
  estado: 'PENDIENTE' | 'ACEPTADO';
  invitadoAt: string;
  aceptadoAt: string | null;
}

function mapCoInquilino(c: CoInquilinoApi): CoInquilinoExtra {
  // El modelo guarda un único `nombre`; el panel lo muestra como nombre + apellido.
  const partes = c.nombre.trim().split(/\s+/);
  const nombre = partes[0] ?? c.nombre;
  const apellido = partes.slice(1).join(' ');
  return {
    id: c.id,
    propiedadId: '', // no aplica en modo API (se lista por contrato)
    contratoId: c.contratoId,
    nombre,
    apellido,
    celular: c.telefono ?? '',
    email: c.email || undefined,
    dni: c.dni ?? undefined,
    relacion: c.relacion,
    permiso: c.permiso,
    estado: c.estado === 'ACEPTADO' ? 'ACTIVO' : 'PENDIENTE_ACTIVACION',
    invitadoAt: c.invitadoAt,
    activadoAt: c.aceptadoAt ?? null,
  };
}

export function useCoInquilinos(
  propiedadId: string,
  contratoId: string | null | undefined,
): {
  coInquilinos: CoInquilinoExtra[];
  hidratado: boolean;
  deApi: boolean;
  /** En prod el email es obligatorio (la activación del co-inquilino es por email). */
  emailRequerido: boolean;
  agregar: (input: AgregarCoInquilinoInput) => Promise<void>;
  eliminar: (co: CoInquilinoExtra) => Promise<void>;
} {
  const [coInquilinos, setCoInquilinos] = useState<CoInquilinoExtra[]>([]);
  const [hidratado, setHidratado] = useState(false);

  const recargar = useCallback(async () => {
    if (!apiEnabled) {
      setCoInquilinos(coInquilinosDePropiedad(propiedadId));
      setHidratado(true);
      return;
    }
    if (!contratoId) {
      setCoInquilinos([]);
      setHidratado(true);
      return;
    }
    try {
      const filas = await apiFetch<CoInquilinoApi[]>(`/contratos/${contratoId}/co-inquilinos`);
      setCoInquilinos(filas.map(mapCoInquilino));
    } catch {
      setCoInquilinos([]);
    } finally {
      setHidratado(true);
    }
  }, [propiedadId, contratoId]);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  const agregar = useCallback(
    async (input: AgregarCoInquilinoInput) => {
      if (!apiEnabled) {
        agregarCoInquilino(input);
        setCoInquilinos(coInquilinosDePropiedad(propiedadId));
        return;
      }
      if (!contratoId) throw new Error('Este inquilino no tiene un contrato activo');
      await apiFetch(`/contratos/${contratoId}/co-inquilinos`, {
        method: 'POST',
        body: JSON.stringify({
          nombre: `${input.nombre} ${input.apellido}`.trim(),
          email: (input.email ?? '').trim().toLowerCase(),
          ...(input.celular ? { telefono: input.celular } : {}),
          ...(input.dni ? { dni: input.dni } : {}),
          relacion: input.relacion,
          permiso: input.permiso,
        }),
      });
      await recargar();
    },
    [propiedadId, contratoId, recargar],
  );

  const eliminar = useCallback(
    async (co: CoInquilinoExtra) => {
      if (!apiEnabled) {
        eliminarCoInquilino(co.id);
        setCoInquilinos(coInquilinosDePropiedad(propiedadId));
        return;
      }
      if (!contratoId) return;
      await apiFetch(`/contratos/${contratoId}/co-inquilinos/${co.id}`, { method: 'DELETE' });
      await recargar();
    },
    [propiedadId, contratoId, recargar],
  );

  return { coInquilinos, hidratado, deApi: apiEnabled, emailRequerido: apiEnabled, agregar, eliminar };
}
