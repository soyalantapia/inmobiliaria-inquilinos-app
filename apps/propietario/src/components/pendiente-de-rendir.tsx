'use client';

import { useQuery } from '@tanstack/react-query';
import { Clock } from 'lucide-react';
import { Card } from '@llave/ui/card';
import { money, periodoLargo } from '@/lib/format';
import { apiFetch, type MiCartera, type PendientePortal } from '@/lib/api';

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
  // La cartera ya está cacheada por el layout con esta misma key: no es una request más.
  const cartera = useQuery({
    queryKey: ['mi-cartera'],
    queryFn: () => apiFetch<MiCartera>('/portal/mi-cartera'),
    staleTime: 60_000,
  });

  const pend = useQuery({
    queryKey: ['portal-pendiente'],
    queryFn: () => apiFetch<PendientePortal[]>('/portal/pendiente'),
    staleTime: 60_000,
  });

  // Los tres casos NO son el mismo, y meterlos en un `return null` los hacía indistinguibles.
  //
  // El que importa es el del medio: si la consulta FALLA, desaparecer se lee exactamente igual
  // que "no me deben nada". El dueño cierra el portal tranquilo por un error que nadie vio —el
  // fallo tampoco dejaba rastro—. Y el vacío tampoco es lo mismo que no tener respuesta:
  // decirle que está al día es información, callarse no.
  if (pend.isPending) return null;

  if (pend.isError) {
    return (
      <section className="space-y-2">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Clock className="h-4 w-4" />
          Cobrado y todavía sin rendirte
        </h2>
        {/* Se acota a ESTE bloque: lo de abajo —lo que YA se rindió— sigue siendo correcto, y
            decirlo evita que el dueño desconfíe del número que sí tiene delante. */}
        <Card className="p-4 text-xs text-muted-foreground">
          No pudimos calcular esto ahora.{' '}
          <button type="button" onClick={() => void pend.refetch()} className="underline underline-offset-2">
            Reintentar
          </button>
          . Lo de abajo, lo que ya se te rindió, está al día.
        </Card>
      </section>
    );
  }

  if (!pend.data?.length) {
    return (
      <p className="text-xs text-muted-foreground">
        No hay alquiler cobrado pendiente de rendirte: tu inmobiliaria está al día.
      </p>
    );
  }

  return (
    <section className="space-y-2">
      <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Clock className="h-4 w-4" />
        Cobrado y todavía sin rendirte
      </h2>
      {/* SIN CBU NO LE PUEDEN DEPOSITAR, y era lo único que el dueño no sabía.
          `POST /rendiciones` corta con 409 cuando falta, así que este número crece mes a mes
          sin que nada explique por qué no le llega. El panel hasta tiene un KPI de
          "propietarios sin CBU": el único que no se enteraba era el que lo resuelve en treinta
          segundos.

          Se muestra SÓLO si además hay algo pendiente —sin plata esperando no es un problema
          todavía— y sólo si el server DIJO que falta: con `tieneCbu` undefined (backend viejo)
          no se avisa nada, porque decirle que no tiene CBU cuando sí lo tiene es peor que
          callarse. */}
      {cartera.data?.tieneCbu === false && (
        <Card className="border-amber-300 bg-amber-50 p-4 text-xs dark:border-amber-800 dark:bg-amber-950/30">
          <p className="font-medium text-amber-900 dark:text-amber-200">
            Falta tu CBU para que puedan depositarte
          </p>
          <p className="mt-1 text-amber-800 dark:text-amber-300">
            Tu inmobiliaria no tiene cargado tu CBU o alias, y sin eso no puede transferirte lo
            de arriba. Pasáselo y se destraba.
          </p>
        </Card>
      )}
      <div className="space-y-2">
        {/* La clave lleva la moneda: el endpoint devuelve una fila por (unidad, moneda), y una
            unidad con historia en dos monedas manda dos. Con sólo el id, React descarta la
            segunda. */}
        {pend.data.map((u) => (
          <Card key={`${u.propiedadId}:${u.moneda}`} className="space-y-1 p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              {/* Igual que en la pestaña Unidades: el complejo arriba y la calle abajo, nunca
                  uno EN LUGAR del otro. Con dos unidades en el mismo edificio, mostrar sólo el
                  complejo daba dos tarjetas de plata idénticas con montos distintos. */}
              <span className="min-w-0">
                <span className="block font-medium">{u.complejo ?? u.direccion}</span>
                {u.complejo && <span className="block text-xs text-muted-foreground">{u.direccion}</span>}
              </span>
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
