'use client';

import { useQuery } from '@tanstack/react-query';
import { Receipt } from 'lucide-react';
import { Cargando, ErrorCarga, Seccion, Vacio } from '@/components/bloques';
import { FilaRendicion } from '@/components/portal-piezas';
import { ResumenPagos } from '@/components/resumen-pagos';
import { apiFetch, ApiError, leerSesion, type MiCartera, type RendicionPortal } from '@/lib/api';

/** Pestaña PAGOS: lo que la inmobiliaria le depositó, con el desglose de cada rendición. */
export default function PagosPage() {
  const sesion = typeof window !== 'undefined' ? leerSesion() : null;
  const cartera = useQuery({ queryKey: ['mi-cartera'], queryFn: () => apiFetch<MiCartera>('/portal/mi-cartera') });
  const rendiciones = useQuery({
    queryKey: ['portal-rendiciones'],
    queryFn: () => apiFetch<RendicionPortal[]>('/portal/rendiciones'),
  });

  return (
    <Seccion titulo="Lo que te rindieron" icono={<Receipt className="h-4 w-4" />}>
      {rendiciones.isPending ? (
        <Cargando />
      ) : rendiciones.isError ? (
        <ErrorCarga mensaje={rendiciones.error instanceof ApiError ? rendiciones.error.message : undefined} />
      ) : rendiciones.data.length > 0 ? (
        <div className="space-y-4">
          <ResumenPagos rendiciones={rendiciones.data} />
          <div className="space-y-2">
          {rendiciones.data.map((r) => (
            <FilaRendicion
              key={r.id}
              r={r}
              propietario={cartera.data?.nombre ?? sesion?.nombre ?? ''}
              inmobiliaria={cartera.data?.inmobiliaria.nombre ?? sesion?.inmobiliaria ?? ''}
            />
          ))}
          </div>
        </div>
      ) : (
        <Vacio texto="Todavía no hay rendiciones cargadas. Cuando tu inmobiliaria te rinda un período, lo vas a ver acá con el detalle." />
      )}
    </Seccion>
  );
}
