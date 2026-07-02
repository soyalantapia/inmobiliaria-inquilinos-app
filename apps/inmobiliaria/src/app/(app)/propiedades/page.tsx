'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ChevronRight,
  DoorOpen,
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
import { cn } from '@llave/ui/cn';
import { Input } from '@llave/ui/input';
import { Topbar } from '@/components/topbar';
import { urlDeArchivo } from '@/lib/api/client';
import { usePropiedades } from '@/lib/api/hooks';
import {
  TODAS_LAS_SOCIEDADES,
  leerSociedadActiva,
  matcheaConSociedadActiva,
  onSociedadCambiada,
  type SociedadActivaId,
} from '@/lib/sociedad-seleccionada';
import { sociedadPrincipal } from '@/lib/sociedades-storage';
import {
  estadoPropiedadConfig,
  tipoPropiedadLabel,
  type PropiedadEnriquecida,
} from '@/lib/propiedades-helpers';
import { formatMonto } from '@/lib/format';
import type { TipoPropiedad } from '@/lib/types';

const tipoIcono: Record<TipoPropiedad, React.ComponentType<{ className?: string }>> = {
  DEPARTAMENTO: Home,
  CASA: Home,
  LOCAL: Store,
  GALPON: Warehouse,
};

type Filtro = 'TODOS' | 'ALQUILADA' | 'PROBLEMAS' | 'DISPONIBLE';

const FILTROS = [
  {
    key: 'ALQUILADA' as const,
    label: 'Alquiladas',
    descripcion: 'Al día, sin reclamos abiertos',
    icon: CheckCircle2,
    colorActive: 'bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-500/20',
    colorIdle:
      'border-emerald-200 bg-emerald-50/60 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300 dark:border-emerald-900/40 dark:bg-emerald-900/10 dark:text-emerald-300',
    badgeBg: 'bg-emerald-500/20',
  },
  {
    key: 'PROBLEMAS' as const,
    label: 'Con problemas',
    descripcion: 'Reclamos abiertos o pago vencido',
    icon: AlertTriangle,
    colorActive: 'bg-red-500 text-white border-red-500 shadow-lg shadow-red-500/20',
    colorIdle:
      'border-red-200 bg-red-50/60 text-red-700 hover:bg-red-100 hover:border-red-300 dark:border-red-900/40 dark:bg-red-900/10 dark:text-red-300',
    badgeBg: 'bg-red-500/20',
  },
  {
    key: 'DISPONIBLE' as const,
    label: 'Disponibles',
    descripcion: 'Sin inquilino o en edición',
    icon: DoorOpen,
    colorActive: 'bg-amber-500 text-white border-amber-500 shadow-lg shadow-amber-500/20',
    colorIdle:
      'border-amber-200 bg-amber-50/60 text-amber-800 hover:bg-amber-100 hover:border-amber-300 dark:border-amber-900/40 dark:bg-amber-900/10 dark:text-amber-300',
    badgeBg: 'bg-amber-500/20',
  },
] as const;

const FILTROS_LABELS: Record<Filtro, string> = {
  TODOS: 'Todas',
  ALQUILADA: 'Alquiladas',
  PROBLEMAS: 'Con problemas',
  DISPONIBLE: 'Disponibles',
};

// Una propiedad está "con problemas" si tiene reclamos abiertos o el pago
// actual está vencido. Lo usamos como filtro accionable para que el operador
// vea de un vistazo dónde tiene que meter foco.
function tieneProblemas(p: PropiedadEnriquecida): boolean {
  if (p.reclamosAbiertos > 0) return true;
  if (p.contrato?.estadoPagoActual === 'VENCIDO') return true;
  return false;
}

function esDisponible(p: PropiedadEnriquecida): boolean {
  return p.propiedad.estado === 'DISPONIBLE' || p.propiedad.estado === 'EN_EDICION';
}

// Antes esto era `esAlquiladaOk` (ALQUILADA && !tieneProblemas) y
// generaba inconsistencia con el dashboard: el dashboard contaba TODAS
// las ALQUILADAS (5/6 = 83%) y acá veíamos "1 alquilada" porque las
// otras 4 tenían algún reclamo o pago vencido. Misma palabra ("alquilada"),
// dos definiciones → Roberto perdía confianza en los números.
// Ahora "alquilada" = `estado === 'ALQUILADA'` SIEMPRE. Las que tengan
// problemas se cuentan aparte en el counter PROBLEMAS y son un subset.
function esAlquilada(p: PropiedadEnriquecida): boolean {
  return p.propiedad.estado === 'ALQUILADA';
}

export default function PropiedadesPage() {
  const [q, setQ] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('TODOS');
  const [sociedadActiva, setSociedadActivaState] =
    useState<SociedadActivaId>(TODAS_LAS_SOCIEDADES);

  // Sync con el switcher de la topbar (sociedad-seleccionada storage
  // + evento custom para reaccionar sin recargar).
  useEffect(() => {
    setSociedadActivaState(leerSociedadActiva());
    return onSociedadCambiada(setSociedadActivaState);
  }, []);

  const principalId = useMemo(() => sociedadPrincipal().id, []);

  const { propiedades, cargando } = usePropiedades();

  const enriquecidas = useMemo(
    () =>
      propiedades.filter((pe) =>
        matcheaConSociedadActiva(pe.propiedad.sociedadId, sociedadActiva, principalId),
      ),
    [propiedades, sociedadActiva, principalId],
  );

  const counters = useMemo(
    () => ({
      total: enriquecidas.length,
      ALQUILADA: enriquecidas.filter(esAlquilada).length,
      PROBLEMAS: enriquecidas.filter(tieneProblemas).length,
      DISPONIBLE: enriquecidas.filter(esDisponible).length,
      // Excluye PROPIETARIO_DIRECTO: esa plata va del inquilino al dueño sin
      // pasar por la inmobiliaria, no es "ingreso del mes" del estudio.
      ingresosMes: enriquecidas
        .filter(
          (p) =>
            p.propiedad.estado === 'ALQUILADA' &&
            p.contrato &&
            p.contrato.modoCobranza !== 'PROPIETARIO_DIRECTO',
        )
        .reduce((acc, p) => acc + (p.contrato?.monto ?? 0), 0),
      reclamosAbiertos: enriquecidas.reduce((acc, p) => acc + p.reclamosAbiertos, 0),
    }),
    [enriquecidas],
  );

  const filtradas = useMemo(() => {
    const term = q.trim().toLowerCase();
    return enriquecidas.filter((p) => {
      // filtro por estado calculado
      if (filtro === 'ALQUILADA' && !esAlquilada(p)) return false;
      if (filtro === 'PROBLEMAS' && !tieneProblemas(p)) return false;
      if (filtro === 'DISPONIBLE' && !esDisponible(p)) return false;

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

  const togglearFiltro = (f: 'ALQUILADA' | 'PROBLEMAS' | 'DISPONIBLE') => {
    setFiltro((prev) => (prev === f ? 'TODOS' : f));
  };

  return (
    <>
      <Topbar titulo="Propiedades" />
      <main className="flex-1 space-y-6 p-4 md:p-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi
            label="Propiedades"
            value={counters.total.toString()}
            icon={Building2}
            hint={`${counters.ALQUILADA} alquilada${counters.ALQUILADA === 1 ? '' : 's'}`}
          />
          <Kpi
            label="Alquiladas"
            value={counters.ALQUILADA.toString()}
            icon={DoorOpen}
            hint={`${counters.DISPONIBLE} disponible${counters.DISPONIBLE === 1 ? '' : 's'}`}
            accent="emerald"
          />
          <Kpi
            label="Ingresos del mes"
            value={formatMonto(counters.ingresosMes)}
            icon={MapPin}
            hint="Total mensual en ARS"
          />
          <Kpi
            label="Reclamos abiertos"
            value={counters.reclamosAbiertos.toString()}
            icon={AlertTriangle}
            hint="Sumando todas las propiedades"
            accent={counters.reclamosAbiertos > 0 ? 'red' : undefined}
          />
        </div>

        {/* 3 botones grandes de filtro */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {FILTROS.map((f) => {
            const Icon = f.icon;
            const activo = filtro === f.key;
            const count = counters[f.key];
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => togglearFiltro(f.key)}
                aria-pressed={activo}
                className={cn(
                  'flex items-center justify-between gap-3 rounded-xl border px-5 py-4 text-left transition-all duration-200',
                  activo ? f.colorActive : f.colorIdle,
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'grid h-10 w-10 shrink-0 place-items-center rounded-lg',
                      activo ? 'bg-white/20' : f.badgeBg,
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-wide">{f.label}</p>
                    <p className={cn('text-xs', activo ? 'opacity-90' : 'opacity-70')}>
                      {f.descripcion}
                    </p>
                  </div>
                </div>
                <span className={cn('text-3xl font-bold tabular-nums', activo ? 'text-white' : '')}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Buscador + CTA cargar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
              placeholder="Buscar dirección, inquilino o propietario"
              aria-label="Buscar propiedades"
            />
          </div>
          <div className="flex gap-2">
            <Button asChild>
              <Link href="/propiedades/nueva">
                <Plus className="h-4 w-4" />
                Cargar propiedad
              </Link>
            </Button>
          </div>
        </div>

        {filtro !== 'TODOS' && (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Filtrado: <strong className="text-foreground">{FILTROS_LABELS[filtro]}</strong> ·{' '}
              {filtradas.length} resultado{filtradas.length === 1 ? '' : 's'}
            </span>
            <button
              type="button"
              onClick={() => setFiltro('TODOS')}
              className="font-medium text-primary hover:underline"
            >
              Mostrar todas
            </button>
          </div>
        )}

        {cargando && enriquecidas.length === 0 ? (
          <Card>
            <CardContent className="space-y-2 p-10 text-center text-muted-foreground">
              <Building2 className="mx-auto h-10 w-10 animate-pulse" />
              <p className="font-medium text-foreground">Cargando propiedades…</p>
            </CardContent>
          </Card>
        ) : filtradas.length === 0 ? (
          <Card>
            <CardContent className="space-y-2 p-10 text-center text-muted-foreground">
              <Building2 className="mx-auto h-10 w-10" />
              <p className="font-medium text-foreground">
                {enriquecidas.length === 0 ? 'Todavía no cargaste propiedades' : 'Sin resultados'}
              </p>
              {enriquecidas.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setQ('');
                    setFiltro('TODOS');
                  }}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Limpiar filtros
                </button>
              )}
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
                        {/* Con foto real mostramos el thumbnail; sin foto, el ícono del tipo. */}
                        {propiedad.fotoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={urlDeArchivo(propiedad.fotoUrl)}
                            alt=""
                            className="h-12 w-12 shrink-0 rounded-lg border object-cover"
                          />
                        ) : (
                          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                            <Icon className="h-6 w-6" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0 space-y-1">
                          {/* line-clamp-2 — la direccion es el dato
                              identificatorio de la card. Truncar a 1 linea
                              dejaba "Gorriti 4521, 3..." que no permitia
                              distinguir entre unidades del mismo edificio. */}
                          <p className="line-clamp-2 font-semibold leading-tight">
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
                          <span>
                            {propiedad.ambientes} ambiente
                            {propiedad.ambientes === 1 ? '' : 's'}
                          </span>
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
      {/* truncate -> line-clamp-2 — los valores son nombres de personas
          ("Eduardo Castro · Silvana Morales") y se cortaban a "Silvan...". */}
      <span
        className={`min-w-0 text-right line-clamp-2 ${bold ? 'font-semibold' : 'font-medium'} ${muted ? 'italic text-muted-foreground' : ''}`}
      >
        {value}
      </span>
    </div>
  );
}
