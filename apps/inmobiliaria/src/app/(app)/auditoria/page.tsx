'use client';

import { Badge } from '@llave/ui/badge';
import { Card, CardContent } from '@llave/ui/card';
import { Topbar } from '@/components/topbar';
import { formatFecha } from '@/lib/format';
import { useEventos } from '@/lib/api/use-eventos';

const TIPO_LABEL: Record<string, string> = {
  PAGO_CONCILIADO: 'Pago conciliado',
  PAGO_RECHAZADO: 'Pago rechazado',
  PAGO_REVERTIDO: 'Pago revertido',
  PAGO_MANUAL_CARGADO: 'Pago manual',
  GASTO_CAJA_CARGADO: 'Gasto cargado',
  GASTO_CAJA_ELIMINADO: 'Gasto eliminado',
  PROPIETARIO_RENDIDO: 'Rendición',
  CONTRATO_APROBADO: 'Contrato aprobado',
  CONTRATO_RECHAZADO: 'Contrato rechazado',
  CONTRATO_CARGADO: 'Contrato cargado',
  PROPIEDAD_CARGADA: 'Propiedad cargada',
  EQUIPO_INVITADO: 'Equipo · alta',
  EQUIPO_REMOVIDO: 'Equipo · baja',
};

const TIPO_VARIANT: Record<string, 'success' | 'destructive' | 'warning' | 'secondary'> = {
  PAGO_CONCILIADO: 'success',
  PROPIETARIO_RENDIDO: 'success',
  CONTRATO_APROBADO: 'success',
  EQUIPO_INVITADO: 'success',
  PAGO_RECHAZADO: 'destructive',
  GASTO_CAJA_ELIMINADO: 'destructive',
  CONTRATO_RECHAZADO: 'destructive',
  EQUIPO_REMOVIDO: 'destructive',
};

export default function AuditoriaPage() {
  const { eventos, cargando, deApi } = useEventos();

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
              Todavía no hay eventos registrados. Aparecen acá a medida que tu equipo concilia pagos,
              rinde a propietarios, aprueba contratos o cambia el equipo.
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
