'use client';

import { useQuery } from '@tanstack/react-query';
import { Clock } from 'lucide-react';
import { Card } from '@llave/ui/card';
import { money, periodoLargo } from '@/lib/format';
import { apiFetch, type PendientePortal } from '@/lib/api';

/**
 * Lo que ya se cobró de sus unidades y todavía no se le rindió.
 *
 * POR QUÉ EXISTE: la pestaña de Pagos le muestra lo que YA se le depositó, y la de Unidades que
 * el inquilino pagó tal día. Entre las dos quedaba justo el hueco de la llamada más frecuente
 * del dueño: *"¿ya me mandaste lo de agosto?"*. La cuenta existía hace rato en el backend y el
 * portal no la mostraba.
 *
 * EL NÚMERO ES EL DE LA UNIDAD, NO UN NETO ESTIMADO, y el texto lo dice: de ahí todavía se
 * descuenta la comisión y los gastos. Anticipar el neto exigiría replicar la aritmética de la
 * rendición con sus dos caps, y un número que no coincida con el depósito real sería peor que
 * no mostrar ninguno — sobre todo en la pantalla que el dueño abre para controlar a su
 * inmobiliaria.
 */
export function PendienteDeRendir() {
  const pend = useQuery({
    queryKey: ['portal-pendiente'],
    queryFn: () => apiFetch<PendientePortal[]>('/portal/pendiente'),
    staleTime: 60_000,
  });

  // Si falla, no se dice nada: es información de contexto y la pantalla de abajo —lo que YA se
  // rindió— sigue siendo correcta. Un cartel de error acá sembraría dudas sobre ella.
  if (pend.isPending || pend.isError || !pend.data?.length) return null;

  return (
    <section className="space-y-2">
      <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Clock className="h-4 w-4" />
        Cobrado y todavía sin rendirte
      </h2>
      <div className="space-y-2">
        {/* La clave lleva la moneda: el endpoint devuelve una fila por (unidad, moneda), y una
            unidad con historia en dos monedas manda dos. Con sólo el id, React descarta la
            segunda. */}
        {pend.data.map((u) => (
          <Card key={`${u.propiedadId}:${u.moneda}`} className="space-y-1 p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-medium">{u.complejo ?? u.direccion}</span>
              <span className="tabular-nums font-semibold">{money(u.total, u.moneda)}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {u.periodos.map((p) => periodoLargo(p.periodo).toLowerCase()).join(' · ')}
            </p>
            {/* T-53 — El número YA es la parte de este dueño (el backend la prorratea y
                descuenta lo que ya se le rindió A ÉL). Antes mostraba el total de la unidad y
                el copy lo invitaba a multiplicar por su porcentaje: en copropiedad esa cuenta
                daba mal, porque le seguía apareciendo la parte del otro. */}
            <p className="text-xs text-muted-foreground">
              {u.participacionPct < 100
                ? `Es tu ${u.participacionPct}% del alquiler cobrado de la unidad. De ahí se descuentan la comisión y los gastos.`
                : 'Es el alquiler cobrado de la unidad. De ahí se descuentan la comisión y los gastos.'}
            </p>
          </Card>
        ))}
      </div>
    </section>
  );
}
