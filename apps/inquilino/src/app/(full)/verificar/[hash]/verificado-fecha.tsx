'use client';

import { useEffect, useState } from 'react';
import { formatFecha } from '@/lib/format';

/**
 * "Verificado el <hoy>" — la fecha de la VISITA, no la del render. Esta página es
 * un Server Component; en el static export (GH Pages) se renderiza en build-time,
 * así que `new Date()` quedaba congelado en la fecha del build. Lo computamos
 * client-side para que muestre la fecha real de quien abre el link.
 */
export function VerificadoFecha() {
  const [hoy, setHoy] = useState<string | null>(null);
  useEffect(() => {
    setHoy(formatFecha(new Date().toISOString()));
  }, []);
  return <>{hoy ?? '…'}</>;
}
