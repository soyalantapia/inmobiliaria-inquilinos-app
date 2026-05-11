'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Building2,
  ChevronRight,
  DoorOpen,
  Filter,
  Home,
  MapPin,
  Plus,
  Search,
  Store,
  Warehouse,
} from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card, CardContent } from '@llave/ui/card';
import { Input } from '@llave/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@llave/ui/select';
import { Topbar } from '@/components/topbar';
import { propiedadesMock } from '@/lib/mock-data';
import {
  enriquecerPropiedad,
  estadoPropiedadConfig,
  tipoPropiedadLabel,
} from '@/lib/propiedades-helpers';
import { formatMonto } from '@/lib/format';
import type { EstadoPropiedad, TipoPropiedad } from '@/lib/types';

const tipoIcono: Record<TipoPropiedad, React.ComponentType<{ className?: string }>> = {
  DEPARTAMENTO: Home,
  CASA: Home,
  LOCAL: Store,
  GALPON: Warehouse,
};

type FiltroEstado = 'TODOS' | EstadoPropiedad;

export default function PropiedadesPage() {
  const [q, setQ] = useState('');
  const [filtro, setFiltro] = useState<FiltroEstado>('TODOS');

  const enriquecidas = useMemo(
    () => propiedadesMock.map(enriquecerPropiedad),
    [],
  );

  const filtradas = useMemo(() => {
    const term = q.trim().toLowerCase();
    return enriquecidas.filter((p) => {
      if (filtro !== 'TODOS' && p.propiedad.estado !== filtro) return false;
      if (!term) return true;
      return (
        p.propiedad.direccion.toLowerCase().includes(term) ||
        p.propiedad.ciudad.toLowerCase().includes(term) ||
        p.propietarios.some((o) =>
          `${o.nombre} ${o.apellido}`.toLowerCase().includes(term),
        ) ||
        (p.contrato?.inquilino.toLowerCase().includes(term) ?? false)
      );
    });
  }, [enriquecidas, q, filtro]);

  const counters = useMemo(
    () => ({
      total: enriquecidas.length,
      alquiladas: enriquecidas.filter((p) => p.propiedad.estado === 'ALQUILADA').length,
      disponibles: enriquecidas.filter((p) => p.propiedad.estado === 'DISPONIBLE').length,
      ingresosMes: enriquecidas
        .filter((p) => p.propiedad.estado === 'ALQUILADA' && p.contrato)
        .reduce((acc, p) => acc + (p.contrato?.monto ?? 0), 0),
      reclamosAbiertos: enriquecidas.reduce((acc, p) => acc + p.reclamosAbiertos, 0),
    }),
    [enriquecidas],
  );

  return (
    <>
      <Topbar titulo="Propiedades" />
      <main className="flex-1 space-y-6 p-4 md:p-6">
        <div className="grid gap-4 md:grid-cols-4">
          <Kpi label="Propiedades" value={counters.total.toString()} icon={Building2} hint={`${counters.alquiladas} alquiladas`} />
          <Kpi
            label="Alquiladas"
            value={counters.alquiladas.toString()}
            icon={DoorOpen}
            hint={`${counters.disponibles} disponibles`}
            accent="emerald"
          />
          <Kpi
            label="Ingresos del mes"
            value={formatMonto(counters.ingresosMes)}
            icon={MapPin}
            hint="suma de alquileres ARS"
          />
          <Kpi
            label="Reclamos abiertos"
            value={counters.reclamosAbiertos.toString()}
            icon={AlertTriangle}
            hint="suman de todas las propiedades"
            accent={counters.reclamosAbiertos > 0 ? 'red' : undefined}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="w-72 pl-9"
                placeholder="Buscar dirección, inquilino o propietario"
              />
            </div>
            <Select value={filtro} onValueChange={(v) => setFiltro(v as FiltroEstado)}>
              <SelectTrigger className="w-44">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODOS">Todas</SelectItem>
                <SelectItem value="ALQUILADA">Alquiladas</SelectItem>
                <SelectItem value="DISPONIBLE">Disponibles</SelectItem>
                <SelectItem value="EN_EDICION">En edición</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button>
            <Plus className="h-4 w-4" />
            Cargar propiedad
          </Button>
        </div>

        {filtradas.length === 0 ? (
          <Card>
            <CardContent className="space-y-2 p-10 text-center text-muted-foreground">
              <Building2 className="mx-auto h-10 w-10" />
              <p className="font-medium text-foreground">Sin resultados</p>
              <button
                onClick={() => {
                  setQ('');
                  setFiltro('TODOS');
                }}
                className="text-xs font-medium text-primary hover:underline"
              >
                Limpiar filtros
              </button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtradas.map(({ propiedad, contrato, propietarios, reclamosAbiertos }, i) => {
              const Icon = tipoIcono[propiedad.tipo];
              const estadoCfg = estadoPropiedadConfig[propiedad.estado];
              const propietariosTexto = propietarios
                .map((o) => `${o.nombre} ${o.apellido}`)
                .join(' · ');
              return (
                <Link key={propiedad.id} href={`/propiedades/${propiedad.id}`}>
                  <Card
                    className="group h-full animate-fade-in cursor-pointer transition-shadow hover:shadow-md"
                    style={{ animationDelay: `${i * 40}ms`, animationFillMode: 'backwards' }}
                  >
                    <CardContent className="space-y-4 p-5">
                      <div className="flex items-start gap-3">
                        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                          <Icon className="h-6 w-6" />
                        </div>
                        <div className="flex-1 min-w-0 space-y-1">
                          <p className="truncate font-semibold leading-tight">
                            {propiedad.direccion}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {propiedad.ciudad}, {propiedad.provincia} ·{' '}
                            {tipoPropiedadLabel[propiedad.tipo]}
                          </p>
                        </div>
                        <Badge variant={estadoCfg.variant} className="shrink-0">
                          {estadoCfg.label}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        {propiedad.ambientes !== null && (
                          <span>{propiedad.ambientes} ambientes</span>
                        )}
                        {propiedad.m2 !== null && <span>{propiedad.m2} m²</span>}
                      </div>

                      <div className="space-y-2 rounded-md border bg-muted/40 p-3 text-sm">
                        <Row
                          label="Inquilino"
                          value={contrato?.inquilino ?? '— sin inquilino —'}
                          muted={!contrato}
                        />
                        <Row label="Propietario" value={propietariosTexto || '—'} />
                        {contrato && (
                          <Row label="Alquiler" value={formatMonto(contrato.monto, contrato.moneda)} bold />
                        )}
                      </div>

                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        {reclamosAbiertos > 0 ? (
                          <span className="flex items-center gap-1 font-medium text-destructive">
                            <AlertTriangle className="h-3 w-3" />
                            {reclamosAbiertos} reclamo
                            {reclamosAbiertos === 1 ? '' : 's'} abierto
                            {reclamosAbiertos === 1 ? '' : 's'}
                          </span>
                        ) : (
                          <span>Sin reclamos abiertos</span>
                        )}
                        <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}

function Kpi({
  label,
  value,
  hint,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: 'emerald' | 'red';
}) {
  const valueColor =
    accent === 'emerald'
      ? 'text-emerald-600'
      : accent === 'red'
        ? 'text-destructive'
        : '';
  return (
    <Card>
      <CardContent className="flex items-start justify-between p-5">
        <div className="space-y-1 min-w-0">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className={`text-2xl font-semibold tabular-nums ${valueColor}`}>{value}</p>
          {hint && <p className="truncate text-xs text-muted-foreground">{hint}</p>}
        </div>
        <Icon className="h-5 w-5 text-primary" />
      </CardContent>
    </Card>
  );
}

function Row({
  label,
  value,
  bold,
  muted,
}: {
  label: string;
  value: string;
  bold?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={`truncate ${bold ? 'font-semibold' : 'font-medium'} ${muted ? 'italic text-muted-foreground' : ''}`}
      >
        {value}
      </span>
    </div>
  );
}
