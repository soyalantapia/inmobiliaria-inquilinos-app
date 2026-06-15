'use client';

/**
 * Mi certificado de inquilino — API si hay NEXT_PUBLIC_API_URL, mock local
 * si no (demo offline intacta).
 *
 * Endpoint: GET /certificado (handler apps/api/src/routes/inquilino-mundo.ts).
 * Devuelve el snapshot del certificado del inquilino logueado. El token de
 * sesión lo agrega apiFetch solo.
 *
 * Shape de la página = CertificadoInquilino (src/lib/certificado-inquilino.ts).
 * Diferencias del API a normalizar:
 *   - inquilino.dni / inquilino.telefono pueden venir null (Prisma) → ''
 *   - generadoAt / validoHasta llegan como ISO con hora (Prisma Date) →
 *     .slice(0,10) para que parseLocal/formatFecha los lean como día
 *     calendárico (la UI sólo muestra la fecha, no la hora).
 *   - montoMensual ya viene como number desde el handler.
 */
import { useQuery } from '@tanstack/react-query';
import { apiEnabled, apiFetch } from './client';
import {
  generarCertificado,
  type CertificadoInquilino,
  type NivelHistorial,
} from '@/lib/certificado-inquilino';

interface CertificadoApi {
  id: string;
  hash: string;
  inquilino: {
    nombre: string;
    dni: string | null;
    email: string | null;
    telefono: string | null;
  };
  contratoActual: {
    direccion: string;
    inmobiliaria: string;
    fechaInicio: string;
    montoMensual: number;
    moneda: CertificadoInquilino['contratoActual']['moneda'];
    mesesCumplidos: number;
  };
  historial: CertificadoInquilino['historial'];
  nivel: NivelHistorial;
  nivelDetalle: string;
  generadoAt: string;
  validoHasta: string;
  urlVerificacion: string;
  revocadoAt?: string | null;
}

function mapCertificado(c: CertificadoApi): CertificadoInquilino {
  return {
    hash: c.hash,
    inquilino: {
      nombre: c.inquilino.nombre,
      dni: c.inquilino.dni ?? '',
      email: c.inquilino.email ?? '',
      telefono: c.inquilino.telefono ?? '',
    },
    contratoActual: {
      direccion: c.contratoActual.direccion,
      inmobiliaria: c.contratoActual.inmobiliaria,
      fechaInicio: (c.contratoActual.fechaInicio ?? '').slice(0, 10),
      montoMensual: Number(c.contratoActual.montoMensual),
      moneda: c.contratoActual.moneda,
      mesesCumplidos: c.contratoActual.mesesCumplidos,
    },
    historial: c.historial,
    nivel: c.nivel,
    nivelDetalle: c.nivelDetalle,
    generadoAt: (c.generadoAt ?? '').slice(0, 10),
    validoHasta: (c.validoHasta ?? '').slice(0, 10),
    urlVerificacion: c.urlVerificacion,
  };
}

export function useMiCertificado(): {
  certificado: CertificadoInquilino | null;
  cargando: boolean;
  deApi: boolean;
} {
  const q = useQuery({
    queryKey: ['mi-certificado'],
    queryFn: () => apiFetch<CertificadoApi>('/certificado'),
    enabled: apiEnabled,
    staleTime: 60_000,
  });

  // Demo offline: regeneramos el certificado del inquilino mock, igual que antes.
  if (!apiEnabled) {
    return { certificado: generarCertificado(), cargando: false, deApi: false };
  }
  // En prod, si el endpoint falla, no inventamos: certificado null.
  if (q.isError) return { certificado: null, cargando: false, deApi: true };
  const d = q.data;
  if (!d) return { certificado: null, cargando: q.isPending, deApi: true };
  return { certificado: mapCertificado(d), cargando: false, deApi: true };
}
