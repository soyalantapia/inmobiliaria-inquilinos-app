'use client';

import { useQuery } from '@tanstack/react-query';
import { Building2 } from 'lucide-react';
import { Cargando, ErrorCarga, Seccion, Vacio } from '@/components/bloques';
import { FilaPropiedad } from '@/components/portal-piezas';
import { apiFetch, ApiError, type PropiedadPortal } from '@/lib/api';

/** Pestaña UNIDADES: sus propiedades, con el estado de pago del inquilino de cada una. */
export default function UnidadesPage() {
  const propiedades = useQuery({
    queryKey: ['portal-propiedades'],
    queryFn: () => apiFetch<PropiedadPortal[]>('/portal/propiedades'),
  });

  return (
    <Seccion titulo="Tus unidades" icono={<Building2 className="h-4 w-4" />}>
      {propiedades.isPending ? (
        <Cargando />
      ) : propiedades.isError ? (
        <ErrorCarga mensaje={propiedades.error instanceof ApiError ? propiedades.error.message : undefined} />
      ) : propiedades.data.length > 0 ? (
        <div className="space-y-3">
          {propiedades.data.map((p) => (
            <FilaPropiedad key={p.id} p={p} />
          ))}
        </div>
      ) : (
        <Vacio texto="No hay propiedades asociadas a tu cuenta." />
      )}
    </Seccion>
  );
}
