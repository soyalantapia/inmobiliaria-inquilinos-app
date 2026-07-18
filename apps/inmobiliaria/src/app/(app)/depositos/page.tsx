'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AlertCircle, ChevronRight, ShieldCheck } from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card, CardContent } from '@llave/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@llave/ui/table';
import { ResolverDepositoDialog } from '@/components/resolver-deposito-dialog';
import { Topbar } from '@/components/topbar';
import { useDepositosEnCustodia, type DepositoContrato } from '@/lib/api/use-depositos';
import { formatFechaCorta, formatMonto } from '@/lib/format';

export default function DepositosPage() {
  const { data, cargando, disponible, error, resolver } = useDepositosEnCustodia();
  const [resolviendo, setResolviendo] = useState<DepositoContrato | null>(null);

  return (
    <>
      <Topbar titulo="Depósitos en custodia" />
      <main className="flex-1 space-y-6 p-4 md:p-6">
        <p className="text-sm text-muted-foreground">
          Plata de terceros que tenés que <strong>cuidar</strong>: la garantía que dejó cada inquilino y que
          le tenés que devolver al terminar el contrato (neta de deudas o daños). Este es el total que
          deberías tener guardado.
        </p>

        {!disponible ? (
          <Card className="p-6 text-sm text-muted-foreground">Los depósitos se ven en producción.</Card>
        ) : error ? (
          <Card className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
            <AlertCircle className="h-5 w-5 text-destructive" />
            No pudimos cargar los depósitos. Revisá tu conexión e intentá de nuevo.
          </Card>
        ) : cargando ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="h-24 animate-pulse rounded-lg border bg-muted/50" />
            <div className="h-24 animate-pulse rounded-lg border bg-muted/50" />
          </div>
        ) : (
          <>
            {/* KPI: total en custodia por moneda */}
            {data.porMoneda.length === 0 ? (
              <Card className="flex flex-col items-center gap-2 p-10 text-center">
                <ShieldCheck className="h-10 w-10 text-muted-foreground" />
                <p className="font-medium">Sin depósitos en custodia</p>
                <p className="text-sm text-muted-foreground">
                  Cuando cargues un contrato con depósito de garantía, aparece acá.
                </p>
              </Card>
            ) : (
              // Columnas = cantidad de monedas (tope 3): con una sola moneda el KPI
              // ocupa TODO el ancho en vez de quedar como un cuadradito al costado.
              <div
                className={`grid gap-3 ${
                  data.porMoneda.length === 1
                    ? 'grid-cols-1'
                    : data.porMoneda.length === 2
                      ? 'grid-cols-1 sm:grid-cols-2'
                      : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                }`}
              >
                {data.porMoneda.map((m) => (
                  <Card key={m.moneda} className="border-primary/20 bg-primary/5">
                    <CardContent className="p-5">
                      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                        <ShieldCheck className="h-4 w-4" />
                        En custodia · {m.moneda}
                      </div>
                      <p className="mt-1 text-2xl font-semibold">{formatMonto(m.total, m.moneda)}</p>
                      <p className="text-xs text-muted-foreground">
                        {m.cantidad} contrato{m.cantidad === 1 ? '' : 's'} con depósito
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Listado por contrato */}
            {data.contratos.length > 0 && (
              <Card className="overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Inquilino</TableHead>
                      <TableHead className="hidden md:table-cell">Propiedad</TableHead>
                      <TableHead>Contrato</TableHead>
                      <TableHead className="text-right">Depósito</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.contratos.map((c) => (
                      <TableRow key={c.contratoId}>
                        <TableCell className="font-medium">{c.inquilino}</TableCell>
                        <TableCell className="hidden text-muted-foreground md:table-cell">{c.propiedad}</TableCell>
                        <TableCell>
                          <Badge variant={c.estadoContrato === 'ACTIVO' ? 'success' : 'secondary'}>
                            {c.estadoContrato.charAt(0) + c.estadoContrato.slice(1).toLowerCase()}
                          </Badge>
                          <span className="ml-2 hidden text-xs text-muted-foreground sm:inline">
                            desde {formatFechaCorta(c.fechaInicio)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatMonto(c.monto, c.moneda)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {/* Solo se resuelve el depósito de un contrato TERMINADO (el de
                                un contrato ACTIVO sigue en custodia hasta que el inquilino se va). */}
                            {c.estadoContrato !== 'ACTIVO' ? (
                              <Button size="sm" variant="outline" onClick={() => setResolviendo(c)}>
                                Resolver
                              </Button>
                            ) : (
                              <span
                                className="text-[11px] text-muted-foreground"
                                title="El depósito se resuelve (devolver/retener) cuando termina el contrato y el inquilino se va."
                              >
                                En custodia
                              </span>
                            )}
                            <Link href={`/contratos/${c.contratoId}`} aria-label="Ver contrato">
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            </Link>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}
          </>
        )}
      </main>
      <ResolverDepositoDialog
        deposito={resolviendo}
        resolver={resolver}
        onClose={() => setResolviendo(null)}
      />
    </>
  );
}
