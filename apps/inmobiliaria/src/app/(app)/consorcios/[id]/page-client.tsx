'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowDownCircle,
  ArrowUpCircle,
  Boxes,
  Building2,
  CalendarCheck,
  HardHat,
  MapPin,
  MessageCircle,
  Receipt,
  TrendingDown,
  TrendingUp,
  Users,
  Vote,
} from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card, CardContent } from '@llave/ui/card';
import { Skeleton } from '@llave/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@llave/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@llave/ui/table';
import { ConsorcioInventarioTab } from '@/components/consorcio-inventario-tab';
import { ConsorcioServiciosTab } from '@/components/consorcio-servicios-tab';
import { Topbar } from '@/components/topbar';
import {
  CATEGORIA_MOVIMIENTO_LABEL,
  ESTADO_UF_COLOR,
  ESTADO_UF_LABEL,
  balanceConsorcio,
  morosidadConsorcio,
} from '@/lib/consorcios-storage';
import { apiEnabled } from '@/lib/api/client';
import { useConsorcio } from '@/lib/api/use-consorcios';
import { sociedadById } from '@/lib/sociedades-storage';
import { formatFechaCorta, formatMonto } from '@/lib/format';

export default function DetalleConsorcioPage() {
  const params = useParams<{ id: string }>();
  const { consorcio, cargando } = useConsorcio(params?.id);

  if (cargando || consorcio === undefined) return <DetalleSkeleton />;

  if (consorcio === null) {
    return (
      <>
        <Topbar titulo="Detalle de consorcio" />
        <main className="flex-1 p-4 md:p-6">
          <Card>
            <CardContent className="space-y-2 p-8 text-center">
              <Building2 className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="font-medium">Consorcio no encontrado</p>
              <Button asChild className="mt-2">
                <Link href="/consorcios">Volver a consorcios</Link>
              </Button>
            </CardContent>
          </Card>
        </main>
      </>
    );
  }

  const balance = balanceConsorcio(consorcio);
  const morosidad = morosidadConsorcio(consorcio);
  const soc = sociedadById(consorcio.sociedadId);

  // Cobranza nominal por UF = monto fijo si lo tiene, o expensa del mes ×
  // coeficiente / 100. El feedback pidió soportar las dos modalidades
  // porque hay unidades que pactan un monto fijo con el consorcio.
  const expensaPorUf = (uf: { coeficiente: number; cargoFijo?: number }) =>
    uf.cargoFijo ??
    Math.round((consorcio.expensasPeriodoActual * uf.coeficiente) / 100);

  return (
    <>
      <Topbar titulo="Detalle de consorcio" />
      <main className="flex-1 space-y-6 p-4 md:p-6">
        <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
          <Link href="/consorcios">
            <ArrowLeft className="h-4 w-4" />
            Todos los consorcios
          </Link>
        </Button>

        {/* Hero */}
        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="flex flex-wrap items-start gap-4">
              <div className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <Building2 className="h-8 w-8" />
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                <h1 className="text-2xl font-semibold leading-tight">
                  {consorcio.nombre}
                </h1>
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  {consorcio.direccion}
                </p>
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span>
                    <Users className="mr-1 inline h-3 w-3" />
                    {consorcio.cantUf} unidad{consorcio.cantUf === 1 ? '' : 'es'} funcional
                    {consorcio.cantUf === 1 ? '' : 'es'}
                  </span>
                  {consorcio.encargado && (
                    <>
                      <span>·</span>
                      <span>
                        <HardHat className="mr-1 inline h-3 w-3" />
                        {consorcio.encargado.nombre}
                      </span>
                    </>
                  )}
                  <span>·</span>
                  <span>Administrado desde {formatFechaCorta(consorcio.desde)}</span>
                </div>
                {/* Razón social + CUIT salen de sociedadById (seed local). En
                    prod (apiEnabled) no mostramos ese dato fabricado. */}
                {!apiEnabled && soc && (
                  <p className="text-[11px] text-muted-foreground">
                    Bajo razón social{' '}
                    <strong className="text-foreground">{soc.nombreComercial}</strong> · CUIT{' '}
                    {soc.cuit}
                  </p>
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3 border-t pt-4 md:grid-cols-4">
              <Stat
                label="Expensa del mes"
                value={formatMonto(consorcio.expensasPeriodoActual)}
              />
              <Stat
                label="Ingresos del mes"
                value={formatMonto(balance.ingresos)}
                accent="emerald"
              />
              <Stat
                label="Egresos del mes"
                value={formatMonto(balance.egresos)}
                accent="amber"
              />
              <Stat
                label="Saldo del mes"
                value={formatMonto(balance.saldoMes)}
                accent={balance.saldoMes >= 0 ? 'emerald' : 'red'}
              />
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="unidades">
          <TabsList className="h-auto flex-wrap justify-start gap-1 p-1">
            <TabsTrigger value="unidades">
              <Users className="mr-1.5 h-3.5 w-3.5" />
              Unidades ({consorcio.unidades.length})
            </TabsTrigger>
            <TabsTrigger value="movimientos">
              <ArrowUpCircle className="mr-1.5 h-3.5 w-3.5" />
              Movimientos ({consorcio.movimientos.length})
            </TabsTrigger>
            <TabsTrigger value="servicios">
              <Receipt className="mr-1.5 h-3.5 w-3.5" />
              Servicios
            </TabsTrigger>
            <TabsTrigger value="inventario">
              <Boxes className="mr-1.5 h-3.5 w-3.5" />
              Inventario
            </TabsTrigger>
            <TabsTrigger value="asambleas">
              <Vote className="mr-1.5 h-3.5 w-3.5" />
              Asambleas ({consorcio.asambleas.length})
            </TabsTrigger>
          </TabsList>

          {/* UNIDADES */}
          <TabsContent value="unidades" className="space-y-4">
            {morosidad.totalDeuda > 0 && (
              <Card className="border-amber-200 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-900/10">
                <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <div>
                      <p className="text-sm font-medium">
                        {morosidad.ufsMorosas} unidad{morosidad.ufsMorosas === 1 ? '' : 'es'} con
                        deuda
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Total a recuperar:{' '}
                        <strong className="text-foreground">
                          {formatMonto(morosidad.totalDeuda)}
                        </strong>
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    asChild
                    className="bg-background"
                  >
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(
                        `Hola, te recordamos que tenés un saldo pendiente de expensas en ${consorcio.nombre}. Por favor regularizalo lo antes posible.`,
                      )}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      Avisar morosos por WhatsApp
                    </a>
                  </Button>
                </CardContent>
              </Card>
            )}

            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>UF</TableHead>
                    <TableHead>Titular</TableHead>
                    <TableHead className="text-right">Coef. % / Fijo</TableHead>
                    <TableHead className="text-right">Expensa</TableHead>
                    <TableHead>Servicios</TableHead>
                    <TableHead className="text-right">Saldo deudor</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {consorcio.unidades.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.identificacion}</TableCell>
                      <TableCell className="text-sm">
                        <div className="space-y-0.5">
                          <p className="font-medium">{u.titular}</p>
                          <p className="text-[11px] text-muted-foreground">
                            💬 {u.telefono}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {u.cargoFijo ? (
                          <Badge variant="outline" className="text-[10px]">
                            Fijo
                          </Badge>
                        ) : (
                          u.coeficiente.toFixed(1)
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMonto(expensaPorUf(u))}
                      </TableCell>
                      <TableCell className="text-[10px]">
                        {u.serviciosUf ? (
                          <div className="space-y-0.5">
                            {u.serviciosUf.luz && (
                              <p>
                                <span className="text-muted-foreground">Luz</span>{' '}
                                <span className="font-mono">{u.serviciosUf.luz.nis}</span>
                              </p>
                            )}
                            {u.serviciosUf.gas && (
                              <p>
                                <span className="text-muted-foreground">Gas</span>{' '}
                                <span className="font-mono">{u.serviciosUf.gas.nis}</span>
                              </p>
                            )}
                            {u.serviciosUf.agua && (
                              <p>
                                <span className="text-muted-foreground">Agua</span>{' '}
                                <span className="font-mono">{u.serviciosUf.agua.nis}</span>
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell
                        className={`text-right tabular-nums font-medium ${
                          u.saldoDeudor > 0
                            ? 'text-amber-700 dark:text-amber-300'
                            : 'text-muted-foreground'
                        }`}
                      >
                        {u.saldoDeudor > 0 ? formatMonto(u.saldoDeudor) : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-[10px] ${ESTADO_UF_COLOR[u.estado]}`}>
                          {ESTADO_UF_LABEL[u.estado]}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* MOVIMIENTOS */}
          <TabsContent value="movimientos" className="space-y-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <Card className="border-emerald-200 bg-emerald-50/40 p-4 dark:border-emerald-900/40 dark:bg-emerald-900/10">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <p className="text-xs uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                    Ingresos
                  </p>
                </div>
                <p className="mt-2 text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                  {formatMonto(balance.ingresos)}
                </p>
              </Card>
              <Card className="border-amber-200 bg-amber-50/40 p-4 dark:border-amber-900/40 dark:bg-amber-900/10">
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <p className="text-xs uppercase tracking-wide text-amber-700 dark:text-amber-300">
                    Egresos
                  </p>
                </div>
                <p className="mt-2 text-2xl font-bold tabular-nums text-amber-700 dark:text-amber-300">
                  {formatMonto(balance.egresos)}
                </p>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-2">
                  <CalendarCheck className="h-4 w-4 text-primary" />
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Saldo del mes
                  </p>
                </div>
                <p
                  className={`mt-2 text-2xl font-bold tabular-nums ${
                    balance.saldoMes >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'
                  }`}
                >
                  {formatMonto(balance.saldoMes)}
                </p>
              </Card>
            </div>

            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Concepto</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...consorcio.movimientos]
                    .sort((a, b) => b.fecha.localeCompare(a.fecha))
                    .map((m) => {
                      const ingreso = m.monto >= 0;
                      return (
                        <TableRow key={m.id}>
                          <TableCell className="text-sm">{formatFechaCorta(m.fecha)}</TableCell>
                          <TableCell>
                            <div className="flex items-start gap-2">
                              {ingreso ? (
                                <ArrowUpCircle className="mt-0.5 h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                              ) : (
                                <ArrowDownCircle className="mt-0.5 h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                              )}
                              <p className="text-sm">{m.concepto}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px]">
                              {CATEGORIA_MOVIMIENTO_LABEL[m.categoria]}
                            </Badge>
                          </TableCell>
                          <TableCell
                            className={`text-right font-semibold tabular-nums ${
                              ingreso
                                ? 'text-emerald-700 dark:text-emerald-300'
                                : 'text-amber-700 dark:text-amber-300'
                            }`}
                          >
                            {ingreso ? '+' : '−'} {formatMonto(Math.abs(m.monto))}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* SERVICIOS COMUNES */}
          <TabsContent value="servicios" className="space-y-3">
            <ConsorcioServiciosTab consorcioId={consorcio.id} />
          </TabsContent>

          {/* INVENTARIO */}
          <TabsContent value="inventario" className="space-y-3">
            <ConsorcioInventarioTab consorcioId={consorcio.id} />
          </TabsContent>

          {/* ASAMBLEAS */}
          <TabsContent value="asambleas" className="space-y-3">
            {consorcio.asambleas.length === 0 ? (
              <Card className="p-8 text-center">
                <Vote className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-2 text-sm font-medium">Sin asambleas registradas</p>
                <p className="text-xs text-muted-foreground">
                  {apiEnabled
                    ? 'Todavía no hay actas cargadas para este consorcio.'
                    : 'Cargá el acta y los acuerdos para tener un registro centralizado.'}
                </p>
              </Card>
            ) : (
              consorcio.asambleas.map((a) => (
                <Card key={a.id}>
                  <CardContent className="space-y-3 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold">{a.asunto}</p>
                          <Badge
                            variant={a.tipo === 'ORDINARIA' ? 'secondary' : 'warning'}
                            className="text-[10px]"
                          >
                            {a.tipo === 'ORDINARIA' ? 'Ordinaria' : 'Extraordinaria'}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {formatFechaCorta(a.fecha)} · {a.asistentes} asistente
                          {a.asistentes === 1 ? '' : 's'}
                        </p>
                      </div>
                    </div>
                    <div className="rounded-md border bg-muted/30 p-3 text-xs">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Acuerdo principal
                      </p>
                      <p className="mt-1">{a.acuerdoPrincipal}</p>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </main>
    </>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: 'emerald' | 'amber' | 'red';
}) {
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={`text-base font-semibold tabular-nums md:text-lg ${
          accent === 'emerald'
            ? 'text-emerald-700 dark:text-emerald-300'
            : accent === 'amber'
              ? 'text-amber-700 dark:text-amber-300'
              : accent === 'red'
                ? 'text-red-700 dark:text-red-300'
                : ''
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function DetalleSkeleton() {
  return (
    <>
      <Topbar titulo="Detalle de consorcio" />
      <main className="flex-1 space-y-6 p-4 md:p-6">
        <Skeleton className="h-8 w-40" />
        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="flex items-start gap-4">
              <Skeleton className="h-16 w-16 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-6 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 border-t pt-4 md:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-1">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-5 w-24" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Skeleton className="h-10 w-full max-w-md" />
        <Card>
          <CardContent className="space-y-3 p-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </CardContent>
        </Card>
      </main>
    </>
  );
}
