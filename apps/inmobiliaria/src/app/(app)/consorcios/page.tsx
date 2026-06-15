'use client';

import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  HardHat,
  Plus,
  TrendingUp,
  Users,
} from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card, CardContent } from '@llave/ui/card';
import { Skeleton } from '@llave/ui/skeleton';
import { Topbar } from '@/components/topbar';
import {
  balanceConsorcio,
  morosidadConsorcio,
} from '@/lib/consorcios-storage';
import { apiEnabled } from '@/lib/api/client';
import { useConsorcios } from '@/lib/api/use-consorcios';
import { sociedadById } from '@/lib/sociedades-storage';
import { formatMonto } from '@/lib/format';

/**
 * Página principal del módulo de Consorcios. Lista los edificios que
 * la inmo administra con métricas claves: cantidad de UF, morosidad,
 * saldo del mes. Click → detalle del consorcio.
 *
 * Este módulo es independiente del flujo de alquileres residenciales:
 * acá manejamos propiedad horizontal (PH) y todo lo que conlleva
 * (expensas, gastos comunes, asambleas, libro de actas).
 */
export default function ConsorciosPage() {
  const { consorcios, cargando } = useConsorcios();

  // KPIs cabecera (con guardas por si todavía no llegó la data del API)
  const lista = consorcios ?? [];
  const totalConsorcios = lista.length;
  const totalUF = lista.reduce((s, c) => s + c.cantUf, 0);
  const totalIngresosMes = lista.reduce(
    (s, c) => s + balanceConsorcio(c).ingresos,
    0,
  );
  const totalMorosidad = lista.reduce(
    (s, c) => s + morosidadConsorcio(c).totalDeuda,
    0,
  );

  return (
    <>
      <Topbar titulo="Consorcios" />
      <main className="flex-1 space-y-6 p-4 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Administración
            </p>
            <h1 className="text-2xl font-semibold md:text-3xl">Consorcios</h1>
            <p className="text-sm text-muted-foreground">
              Edificios bajo propiedad horizontal. Expensas, cobranzas, gastos
              comunes y asambleas.
            </p>
          </div>
          {/* Alta de consorcio: sin endpoint en el API. En demo (!apiEnabled)
              queda como stub navegable; en prod lo deshabilitamos con tooltip
              "próximamente" para no escribir mock sobre datos reales. */}
          <Button
            asChild={!apiEnabled}
            size="sm"
            variant="outline"
            disabled={apiEnabled}
            title={apiEnabled ? 'Próximamente' : undefined}
            className="opacity-60 hover:opacity-100"
          >
            {apiEnabled ? (
              <>
                <Plus className="h-4 w-4" />
                Sumar consorcio
              </>
            ) : (
              <Link href="/consorcios#proximamente">
                <Plus className="h-4 w-4" />
                Sumar consorcio
              </Link>
            )}
          </Button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi
            label="Consorcios"
            valor={totalConsorcios.toString()}
            icon={<Building2 className="h-4 w-4" />}
            tone="primary"
          />
          <Kpi
            label="Total unidades"
            valor={totalUF.toString()}
            icon={<Users className="h-4 w-4" />}
            tone="muted"
          />
          <Kpi
            label="Ingresos del mes"
            valor={formatMonto(totalIngresosMes)}
            icon={<TrendingUp className="h-4 w-4" />}
            tone="emerald"
          />
          <Kpi
            label="Deuda total"
            valor={formatMonto(totalMorosidad)}
            icon={<AlertTriangle className="h-4 w-4" />}
            tone={totalMorosidad > 0 ? 'amber' : 'muted'}
          />
        </div>

        {/* Lista */}
        <div className="space-y-3">
          {cargando && consorcios === null
            ? Array.from({ length: 2 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="space-y-3 p-5">
                    <div className="flex items-start gap-3">
                      <Skeleton className="h-12 w-12 rounded-xl" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-1/2" />
                        <Skeleton className="h-3 w-2/3" />
                      </div>
                    </div>
                    <Skeleton className="h-16 w-full rounded-md" />
                  </CardContent>
                </Card>
              ))
            : null}

          {!cargando && lista.length === 0 ? (
            <Card>
              <CardContent className="space-y-2 p-8 text-center">
                <Building2 className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="text-sm font-medium">Sin consorcios todavía</p>
                <p className="text-xs text-muted-foreground">
                  Cuando sumes un edificio bajo administración va a aparecer acá
                  con sus expensas, cobranzas y asambleas.
                </p>
              </CardContent>
            </Card>
          ) : null}

          {lista.map((c) => {
            const balance = balanceConsorcio(c);
            const morosidad = morosidadConsorcio(c);
            const soc = sociedadById(c.sociedadId);
            return (
              <Link key={c.id} href={`/consorcios/${c.id}`} className="block">
                <Card className="transition-shadow hover:shadow-md">
                  <CardContent className="space-y-3 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                          <Building2 className="h-6 w-6" />
                        </div>
                        <div className="min-w-0">
                          <p className="line-clamp-2 text-base font-semibold leading-tight">
                            {c.nombre}
                          </p>
                          <p className="line-clamp-2 text-xs text-muted-foreground">
                            {c.direccion}
                          </p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            <Badge variant="outline" className="text-[10px]">
                              {c.cantUf} UF
                            </Badge>
                            {c.encargado && (
                              <Badge variant="outline" className="text-[10px]">
                                <HardHat className="mr-1 h-2.5 w-2.5" />
                                {c.encargado.nombre.split(' ')[0]}
                              </Badge>
                            )}
                            {soc && (
                              <Badge variant="secondary" className="text-[10px]">
                                Gestiona {soc.nombreComercial}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </div>

                    <div className="grid grid-cols-2 gap-3 rounded-md border bg-muted/30 p-3 text-xs md:grid-cols-4">
                      <Mini
                        label="Expensa del mes"
                        valor={formatMonto(c.expensasPeriodoActual)}
                      />
                      <Mini
                        label="Ingresos del mes"
                        valor={formatMonto(balance.ingresos)}
                        accent="emerald"
                      />
                      <Mini
                        label="Egresos del mes"
                        valor={formatMonto(balance.egresos)}
                        accent="amber"
                      />
                      <Mini
                        label="UF al día"
                        valor={`${morosidad.porcentajeAlDia}%`}
                        sub={`${morosidad.ufsAlDia}/${c.unidades.length}`}
                        accent={morosidad.porcentajeAlDia >= 90 ? 'emerald' : 'amber'}
                      />
                    </div>

                    {morosidad.totalDeuda > 0 && (
                      <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50/60 p-2 text-xs dark:border-amber-900/40 dark:bg-amber-900/10">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                        <p className="text-amber-900 dark:text-amber-200">
                          {morosidad.ufsMorosas} UF con deuda · {formatMonto(morosidad.totalDeuda)} total
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </main>
    </>
  );
}

function Kpi({
  label,
  valor,
  icon,
  tone,
}: {
  label: string;
  valor: string;
  icon: React.ReactNode;
  tone: 'primary' | 'emerald' | 'amber' | 'muted';
}) {
  const tones = {
    primary: 'bg-primary/10 text-primary',
    emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    muted: 'bg-muted text-muted-foreground',
  };
  return (
    <Card className="space-y-2 p-4">
      <div className={`inline-grid h-8 w-8 place-items-center rounded-md ${tones[tone]}`}>
        {icon}
      </div>
      <div>
        <p className="text-xl font-semibold tabular-nums md:text-2xl">{valor}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </Card>
  );
}

function Mini({
  label,
  valor,
  sub,
  accent,
}: {
  label: string;
  valor: string;
  sub?: string;
  accent?: 'emerald' | 'amber';
}) {
  return (
    <div className="min-w-0">
      <p className="text-[9px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={`truncate font-semibold tabular-nums ${
          accent === 'emerald'
            ? 'text-emerald-700 dark:text-emerald-300'
            : accent === 'amber'
              ? 'text-amber-700 dark:text-amber-300'
              : ''
        }`}
      >
        {valor}
      </p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}
