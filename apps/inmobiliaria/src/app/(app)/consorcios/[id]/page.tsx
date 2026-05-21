import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowDownCircle,
  ArrowUpCircle,
  Building2,
  CalendarCheck,
  HardHat,
  MapPin,
  MessageCircle,
  TrendingDown,
  TrendingUp,
  Users,
  Vote,
} from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card, CardContent } from '@llave/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@llave/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@llave/ui/table';
import { Topbar } from '@/components/topbar';
import {
  CATEGORIA_MOVIMIENTO_LABEL,
  ESTADO_UF_COLOR,
  ESTADO_UF_LABEL,
  balanceConsorcio,
  consorcioPorId,
  consorciosMock,
  morosidadConsorcio,
} from '@/lib/consorcios-storage';
import { sociedadById } from '@/lib/sociedades-storage';
import { formatFecha, formatMonto } from '@/lib/format';

export function generateStaticParams() {
  return consorciosMock.map((c) => ({ id: c.id }));
}

export const dynamicParams = false;

export default function DetalleConsorcioPage({ params }: { params: { id: string } }) {
  const consorcio = consorcioPorId(params.id);
  if (!consorcio) notFound();

  const balance = balanceConsorcio(consorcio);
  const morosidad = morosidadConsorcio(consorcio);
  const soc = sociedadById(consorcio.sociedadId);

  // Cobranza nominal por UF = expensa del mes × coeficiente / 100
  const expensaPorUf = (coef: number) =>
    Math.round((consorcio.expensasPeriodoActual * coef) / 100);

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
                    {consorcio.cantUf} unidades funcionales
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
                  <span>Administrado desde {formatFecha(consorcio.desde)}</span>
                </div>
                {soc && (
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
                    <TableHead className="text-right">Coef. %</TableHead>
                    <TableHead className="text-right">Expensa</TableHead>
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
                        {u.coeficiente.toFixed(1)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMonto(expensaPorUf(u.coeficiente))}
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
                          <TableCell className="text-sm">{formatFecha(m.fecha)}</TableCell>
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

          {/* ASAMBLEAS */}
          <TabsContent value="asambleas" className="space-y-3">
            {consorcio.asambleas.length === 0 ? (
              <Card className="p-8 text-center">
                <Vote className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-2 text-sm font-medium">Sin asambleas registradas</p>
                <p className="text-xs text-muted-foreground">
                  Cargá el acta y los acuerdos para tener un registro centralizado.
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
                          {formatFecha(a.fecha)} · {a.asistentes} asistente
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
