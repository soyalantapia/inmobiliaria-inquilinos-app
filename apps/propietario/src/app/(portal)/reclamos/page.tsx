'use client';

import { useQuery } from '@tanstack/react-query';
import { Wrench } from 'lucide-react';
import { Cargando, ErrorCarga, Seccion, Vacio } from '@/components/bloques';
import { ListaReclamos } from '@/components/portal-piezas';
import { apiFetch, ApiError, type ReclamoPortal } from '@/lib/api';

/** Pestaña RECLAMOS: qué se rompió en sus unidades y en qué anda. */
export default function ReclamosPage() {
  const reclamos = useQuery({
    queryKey: ['portal-reclamos'],
    queryFn: () => apiFetch<ReclamoPortal[]>('/portal/reclamos'),
  });

  return (
    <Seccion titulo="Reclamos de tus unidades" icono={<Wrench className="h-4 w-4" />}>
      {reclamos.isPending ? (
        <Cargando />
      ) : reclamos.isError ? (
        <ErrorCarga mensaje={reclamos.error instanceof ApiError ? reclamos.error.message : undefined} />
      ) : reclamos.data.length > 0 ? (
        <ListaReclamos reclamos={reclamos.data} />
      ) : (
        // La consulta se recorta al CONTRATO VIGENTE de cada unidad, así que una unidad vacía
        // hoy devuelve cero aunque el mes pasado se haya roto el termotanque. El texto dice lo
        // que realmente cubre.
        <Vacio texto="No hay reclamos abiertos ni resueltos del inquilino que vive hoy en tus unidades. Los de inquilinos anteriores no se muestran acá." />
      )}
    </Seccion>
  );
}
