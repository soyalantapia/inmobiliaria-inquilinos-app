'use client';

import { useQuery } from '@tanstack/react-query';
import { Receipt } from 'lucide-react';
import { Cargando, ErrorCarga, Seccion, Vacio } from '@/components/bloques';
import { FilaRendicion } from '@/components/portal-piezas';
import { AvisosInmobiliaria } from '@/components/avisos-inmobiliaria';
import { PendienteDeRendir } from '@/components/pendiente-de-rendir';
import { ImprimirAnual } from '@/components/imprimir-anual';
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
    <div className="space-y-6">
      <AvisosInmobiliaria />
      {/* Antes de lo que YA se rindió: contesta "¿ya me mandaste lo de agosto?", que es la
          pregunta con la que el dueño levanta el teléfono. */}
      <PendienteDeRendir />
      <Seccion titulo="Lo que te rindieron" icono={<Receipt className="h-4 w-4" />}>
      {rendiciones.isPending ? (
        <Cargando />
      ) : rendiciones.isError ? (
        <ErrorCarga mensaje={rendiciones.error instanceof ApiError ? rendiciones.error.message : undefined} />
      ) : rendiciones.data.length > 0 ? (
        <div className="space-y-4">
          <ResumenPagos rendiciones={rendiciones.data} />
          {/* Debajo del resumen del año y ARRIBA del detalle mes a mes: el que baja hasta acá
              ya vio el total y lo que sigue es la lista larga. Es el momento en que alguien
              piensa "esto se lo tengo que pasar al contador". */}
          <ImprimirAnual
            rendiciones={rendiciones.data}
            anio={new Date().getFullYear()}
            propietario={cartera.data?.nombre ?? sesion?.nombre ?? ''}
            inmobiliaria={cartera.data?.inmobiliaria.nombre ?? sesion?.inmobiliaria ?? ''}
          />
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
    </div>
  );
}
