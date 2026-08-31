'use client';

import { Badge } from '@llave/ui/badge';
import { Card, CardContent } from '@llave/ui/card';
import { Topbar } from '@/components/topbar';
import { formatFecha } from '@/lib/format';
import { useEventos } from '@/lib/api/use-eventos';
import { TIPO_LABEL, TIPO_VARIANT } from '@/lib/auditoria-labels';

export default function AuditoriaPage() {
  const { eventos, cargando, deApi, error } = useEventos();

  return (
    <>
      <Topbar titulo="Auditoría" />
      <main className="flex-1 space-y-4 p-4 md:p-6">
        <p className="text-sm text-muted-foreground">
          Rastro de las acciones sensibles (plata y equipo): quién hizo qué y cuándo.
          {deApi ? '' : ' Vista de demostración.'}
        </p>

        {cargando ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : eventos.length === 0 ? (
          <Card>
            <CardContent className="p-10 text-center text-sm text-muted-foreground">
              {/* "Todavía no hay eventos" es una AFIRMACIÓN sobre lo que hizo el equipo, y con la
                  consulta caída era falsa: el admin concluía que nadie tocó nada. */}
              {error
                ? 'No pudimos traer el historial. No quiere decir que no haya movimientos: volvé a cargar la página.'
                : 'Todavía no hay eventos registrados. Aparecen acá a medida que tu equipo concilia pagos, rinde a propietarios, aprueba contratos o cambia el equipo.'}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="divide-y p-0">
              {eventos.map((e) => (
                <div key={e.id} className="flex flex-wrap items-start justify-between gap-2 p-4">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={TIPO_VARIANT[e.tipo] ?? 'secondary'}>{TIPO_LABEL[e.tipo] ?? e.tipo}</Badge>
                      <span className="truncate text-sm font-medium">{e.entidadDescripcion}</span>
                    </div>
                    {e.detalle && <p className="text-xs text-muted-foreground">{e.detalle}</p>}
                    <p className="text-xs text-muted-foreground">
                      {e.autor} · {e.rolAutor}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatFecha(e.fecha)}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </main>
    </>
  );
}
