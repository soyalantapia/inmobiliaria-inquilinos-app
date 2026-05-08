'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Filter, Plus, Search } from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card } from '@llave/ui/card';
import { Input } from '@llave/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@llave/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@llave/ui/table';
import { Topbar } from '@/components/topbar';
import { contratosMock } from '@/lib/mock-data';
import { formatFecha, formatMonto } from '@/lib/format';
import type { EstadoContrato, EstadoLiquidacion } from '@/lib/types';

const estadoVariant: Record<EstadoLiquidacion, React.ComponentProps<typeof Badge>['variant']> = {
  PENDIENTE: 'warning',
  PAGADO: 'success',
  PARCIAL: 'warning',
  VENCIDO: 'destructive',
};

const estadoLabel: Record<EstadoLiquidacion, string> = {
  PENDIENTE: 'Pendiente',
  PAGADO: 'Pagado',
  PARCIAL: 'Parcial',
  VENCIDO: 'Vencido',
};

export default function ContratosPage() {
  const [q, setQ] = useState('');
  const [filtro, setFiltro] = useState<EstadoContrato | 'TODOS'>('TODOS');

  const filtrados = useMemo(() => {
    return contratosMock.filter((c) => {
      const matchQ = q
        ? c.inquilino.toLowerCase().includes(q.toLowerCase()) ||
          c.direccion.toLowerCase().includes(q.toLowerCase())
        : true;
      const matchEstado = filtro === 'TODOS' ? true : c.estado === filtro;
      return matchQ && matchEstado;
    });
  }, [q, filtro]);

  return (
    <>
      <Topbar titulo="Contratos" />
      <main className="flex-1 space-y-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="w-72 pl-9"
                placeholder="Buscar por inquilino o dirección"
              />
            </div>
            <Select value={filtro} onValueChange={(v) => setFiltro(v as typeof filtro)}>
              <SelectTrigger className="w-44">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODOS">Todos los estados</SelectItem>
                <SelectItem value="ACTIVO">Activos</SelectItem>
                <SelectItem value="BORRADOR">Borradores</SelectItem>
                <SelectItem value="FINALIZADO">Finalizados</SelectItem>
                <SelectItem value="RESCINDIDO">Rescindidos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button asChild>
            <Link href="/contratos/nuevo">
              <Plus className="h-4 w-4" />
              Cargar contrato
            </Link>
          </Button>
        </div>

        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Inquilino</TableHead>
                <TableHead>Dirección</TableHead>
                <TableHead>Vigencia</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead>Estado contrato</TableHead>
                <TableHead>Pago actual</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtrados.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.inquilino}</TableCell>
                  <TableCell className="text-muted-foreground">{c.direccion}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatFecha(c.fechaInicio)} → {formatFecha(c.fechaFin)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatMonto(c.monto, c.moneda)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={c.estado === 'ACTIVO' ? 'success' : 'secondary'}>
                      {c.estado}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={estadoVariant[c.estadoPagoActual]}>
                      {estadoLabel[c.estadoPagoActual]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/contratos/${c.id}`}
                      className="inline-flex items-center text-primary hover:underline"
                    >
                      Ver <ChevronRight className="h-4 w-4" />
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
              {filtrados.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                    No encontramos contratos con esos filtros.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </main>
    </>
  );
}
