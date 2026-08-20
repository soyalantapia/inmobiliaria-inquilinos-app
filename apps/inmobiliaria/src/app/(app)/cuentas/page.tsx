'use client';

import { Topbar } from '@/components/topbar';
import { CuentasPanel } from '@/components/cuentas-panel';

/**
 * Ruta suelta de Cuentas.
 *
 * El camino que ofrece el menú es la pestaña **Cuentas dentro de /caja**: Camila fue a caja
 * buscando esto y no lo encontró (03/08, *"abajo de caja no aparece ahí en caja, pero sí
 * aparece cuentas"*), porque eran dos pantallas hermanas sin un solo link entre ellas.
 * "Cuentas" es una subdivisión de la caja, no un par.
 *
 * Esta ruta se mantiene igual para no romper un favorito o un link viejo, pero el contenido
 * vive en `components/cuentas-panel.tsx` — un `page.tsx` de App Router sólo puede exportar el
 * default, así que el panel no podía quedar acá y ser reusado por /caja.
 */
export default function CuentasPage() {
  return (
    <>
      <Topbar titulo="Cuentas" />
      <main className="flex-1 p-4 md:p-6">
        <CuentasPanel />
      </main>
    </>
  );
}
