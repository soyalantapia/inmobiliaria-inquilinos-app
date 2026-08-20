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
 * EL NÚMERO ES LA PARTE DE ESTE DUEÑO, YA PRORRATEADA, y NO es el neto: de ahí todavía se
 * descuentan la comisión y los gastos, y el texto lo dice.
 *
 * Antes era el remanente de la UNIDAD, con un "te corresponde el X%" al lado. Con un solo
 * dueño daba igual; con dos les mentía a los dos, porque apenas se le rinde a uno el remanente
 * deja de ser proporcional y pasa a ser íntegramente del otro. Ahora la cuenta la hace el
 * server replicando la aritmética de POST /rendiciones —doble cap incluido—, que es la única
 * forma de que el número no contradiga al depósito real en la pantalla que el dueño abre
 * justamente para controlar a su inmobiliaria.
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
            {/* El monto ya es LA PARTE DE ESTE DUEÑO, no el total de la unidad: el server
                aplica su porcentaje y le resta lo que ya se le rindió a él. Por eso acá no va
                ningún "te corresponde el X%": ese texto invitaba a multiplicar de nuevo, sobre
                una base que además dejaba de ser proporcional apenas se le rendía a otro dueño.
                Lo que sí falta descontar es la comisión y los gastos, y eso se dice. */}
            <p className="text-xs text-muted-foreground">
              Es tu parte del alquiler ya cobrado
              {u.participacionPct < 100 && ` (el ${u.participacionPct}% de esta unidad, ya aplicado)`}.
              De ahí todavía se descuentan la comisión y los gastos.
            </p>
          </Card>
        ))}
      </div>
    </section>
  );
}
