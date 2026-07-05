'use client';

import Link from 'next/link';
import { AlertCircle, ArrowLeft, Building2, FileText, ShieldAlert, ShieldCheck, Wrench } from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card, CardContent } from '@llave/ui/card';
import { Separator } from '@llave/ui/separator';
import { Topbar } from '@/components/topbar';
import { usePersona } from '@/lib/api/use-inquilinos';
import { formatFechaCorta, formatMonto, formatRangoVigencia } from '@/lib/format';

function Stat({ label, value, accent }: { label: string; value: string; accent?: 'red' | 'green' | 'muted' }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={
          accent === 'red'
            ? 'mt-1 text-lg font-semibold text-destructive'
            : accent === 'green'
              ? 'mt-1 text-lg font-semibold text-emerald-600 dark:text-emerald-400'
              : 'mt-1 text-lg font-semibold'
        }
      >
        {value}
      </p>
    </div>
  );
}

export default function InquilinoFichaPage({ params }: { params: { id: string } }) {
  const { persona, cargando, error } = usePersona(params.id);

  const nombre = persona ? `${persona.nombre} ${persona.apellido ?? ''}`.trim() : '';

  return (
    <>
      <Topbar titulo="Ficha del inquilino" />
      <main className="flex-1 space-y-6 p-4 md:p-6">
        <Button variant="ghost" size="sm" asChild className="-ml-2 w-fit">
          <Link href="/inquilinos">
            <ArrowLeft className="h-4 w-4" />
            Inquilinos
          </Link>
        </Button>

        {error ? (
          <Card className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
            <AlertCircle className="h-5 w-5 text-destructive" />
            No pudimos cargar la ficha. Revisá tu conexión e intentá de nuevo.
          </Card>
        ) : cargando ? (
          <div className="space-y-3">
            <div className="h-24 animate-pulse rounded-lg border bg-muted/50" />
            <div className="h-40 animate-pulse rounded-lg border bg-muted/50" />
          </div>
        ) : !persona ? (
          <Card className="p-10 text-center text-sm text-muted-foreground">No encontramos esta persona.</Card>
        ) : (
          <>
            {/* Encabezado */}
            <Card>
              <CardContent className="flex flex-wrap items-start justify-between gap-3 p-6">
                <div>
                  <h1 className="text-xl font-semibold">{nombre}</h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {persona.dni ? `DNI ${persona.dni}` : 'Sin DNI'}
                    {persona.email ? ` · ${persona.email}` : ''}
                    {persona.telefono ? ` · ${persona.telefono}` : ''}
                  </p>
                </div>
                {persona.resumen.tuvoMora ? (
                  <Badge variant="destructive" className="gap-1">
                    <ShieldAlert className="h-3.5 w-3.5" />
                    Con morosidad
                  </Badge>
                ) : (
                  <Badge variant="success" className="gap-1">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Sin morosidad
                  </Badge>
                )}
              </CardContent>
            </Card>

            {/* Resumen */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Stat label="Contratos" value={String(persona.resumen.totalContratos)} />
              <Stat label="Activos" value={String(persona.resumen.activos)} accent="green" />
              <Stat
                label="Deuda vigente"
                value={formatMonto(persona.resumen.deudaVigente)}
                accent={persona.resumen.deudaVigente > 0 ? 'red' : 'muted'}
              />
              <Stat
                label="Reclamos abiertos"
                value={String(persona.resumen.reclamosAbiertos)}
                accent={persona.resumen.reclamosAbiertos > 0 ? 'red' : 'muted'}
              />
            </div>

            {/* Contratos / propiedades por las que pasó */}
            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Contratos y propiedades
              </h2>
              {persona.contratos.map((c) => (
                <Card key={c.id}>
                  <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="truncate font-medium">{c.propiedad?.direccion ?? '—'}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatRangoVigencia(c.fechaInicio, c.fechaFin)} · {formatMonto(c.monto, c.moneda)}
                        {c.deuda > 0 && (
                          <span className="text-destructive">
                            {' '}
                            · Debe {formatMonto(c.deuda, c.moneda)} ({c.cuotasVencidas} cuota
                            {c.cuotasVencidas === 1 ? '' : 's'})
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge variant={c.estado === 'ACTIVO' ? 'success' : 'secondary'}>
                        {c.estado.charAt(0) + c.estado.slice(1).toLowerCase()}
                      </Badge>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/contratos/${c.id}`}>
                          <FileText className="h-4 w-4" />
                          Ver
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </section>

            {/* Reclamos */}
            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Reclamos ({persona.reclamos.length})
              </h2>
              {persona.reclamos.length === 0 ? (
                <Card className="p-6 text-sm text-muted-foreground">Sin reclamos registrados.</Card>
              ) : (
                <Card className="divide-y">
                  {persona.reclamos.map((r) => (
                    <div key={r.id} className="flex items-start gap-3 p-4">
                      <Wrench className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium">{r.categoria}</span>
                          <Badge variant="outline" className="text-[10px]">
                            {r.estado}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{formatFechaCorta(r.createdAt)}</span>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">{r.descripcion}</p>
                      </div>
                    </div>
                  ))}
                </Card>
              )}
            </section>
          </>
        )}
      </main>
    </>
  );
}
