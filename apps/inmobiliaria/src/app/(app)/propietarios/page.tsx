'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Mail,
  MessageCircle,
  Phone,
  Plus,
  Search,
  Users,
  Wallet,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@llave/ui/avatar';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card, CardContent } from '@llave/ui/card';
import { Input } from '@llave/ui/input';
import { HistorialPropietarioDialog } from '@/components/historial-propietario-dialog';
import {
  RendirPropietarioDialog,
  mensajePedirCbu,
  mensajeRendicion,
} from '@/components/rendir-propietario-dialog';
import { SumarPropietarioDialog } from '@/components/sumar-propietario-dialog';
import { Topbar } from '@/components/topbar';
import { usePropietarios } from '@/lib/api/hooks';
import type { Propietario } from '@/lib/types';
import {
  obtenerRendicion,
  periodoActual,
  type Rendicion,
} from '@/lib/rendiciones-storage';
import { formatMonto } from '@/lib/format';

// Filtros aplicables vía query param (?filtro=sin-cbu / sin-rendir).
// Usado por los cards del dashboard "Para resolver hoy" para que el
// user no caiga en /propietarios genérico y tenga que volver a filtrar.
type FiltroPropietarios = 'TODOS' | 'SIN_CBU' | 'SIN_RENDIR';

const FILTRO_FROM_PARAM: Record<string, FiltroPropietarios> = {
  'sin-cbu': 'SIN_CBU',
  'sin-rendir': 'SIN_RENDIR',
};

export default function PropietariosPage() {
  const searchParams = useSearchParams();
  const [q, setQ] = useState('');
  const [filtroExtra, setFiltroExtra] = useState<FiltroPropietarios>('TODOS');
  const [abrirSumar, setAbrirSumar] = useState(false);
  const [rendiendoA, setRendiendoA] = useState<Propietario | null>(null);
  const [verHistorial, setVerHistorial] = useState<Propietario | null>(null);
  const [rendicionesMap, setRendicionesMap] = useState<Record<string, Rendicion | null>>({});

  const { propietarios, cargando } = usePropietarios();

  const periodo = periodoActual();

  const refrescarRendiciones = () => {
    const map: Record<string, Rendicion | null> = {};
    propietarios.forEach((p) => {
      map[p.id] = obtenerRendicion(p.id, periodo);
    });
    setRendicionesMap(map);
  };

  // `propietarios` es una ref NUEVA cada render (usePropietarios mapea el dato
  // del API sin memoizar), así que dependemos de una key estable (los ids) y
  // no de la ref: si no, el effect setea rendicionesMap en cada render → loop
  // infinito (React #185), que el re-render del Radix Dialog disparaba al abrir.
  const propietariosKey = propietarios.map((p) => p.id).join(',');
  useEffect(() => {
    refrescarRendiciones();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propietariosKey]);

  // Aplica el filtro inicial si llegamos con ?filtro=sin-cbu/sin-rendir.
  useEffect(() => {
    const param = searchParams?.get('filtro');
    if (param && FILTRO_FROM_PARAM[param]) {
      setFiltroExtra(FILTRO_FROM_PARAM[param]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtrados = useMemo(() => {
    const term = q.trim().toLowerCase();
    let base = propietarios as readonly Propietario[];
    if (filtroExtra === 'SIN_CBU') base = base.filter((p) => !p.cbuAlias);
    if (filtroExtra === 'SIN_RENDIR') {
      base = base.filter(
        (p) => !rendicionesMap[p.id] && p.totalRecibirMes > 0,
      );
    }
    if (!term) return base;
    return base.filter(
      (p) =>
        `${p.nombre} ${p.apellido}`.toLowerCase().includes(term) ||
        p.cuit.includes(term) ||
        p.email.toLowerCase().includes(term),
    );
  }, [propietarios, q, filtroExtra, rendicionesMap]);

  const totalPropiedades = propietarios.reduce((acc, p) => acc + p.propiedadesIds.length, 0);
  const totalRecibir = propietarios.reduce((acc, p) => acc + p.totalRecibirMes, 0);
  const sinCbu = propietarios.filter((p) => !p.cbuAlias).length;
  const porRendir = propietarios.filter(
    (p) => !rendicionesMap[p.id] && p.totalRecibirMes > 0,
  ).length;

  return (
    <>
      <Topbar titulo="Propietarios" />
      <main className="flex-1 space-y-6 p-4 md:p-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-5">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Propietarios</p>
              <p className="mt-1 text-2xl font-semibold">{propietarios.length}</p>
              <p className="text-xs text-muted-foreground">{totalPropiedades} contrato{totalPropiedades === 1 ? '' : 's'}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">A rendir este mes</p>
              <p className="mt-1 text-2xl font-semibold text-primary">{formatMonto(totalRecibir)}</p>
              <p className="text-xs text-muted-foreground">Después de comisión</p>
            </CardContent>
          </Card>
          <Card
            className={
              porRendir > 0
                ? 'border-primary/30 bg-primary/5'
                : 'border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-900/10'
            }
          >
            <CardContent className="p-5">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Sin rendir todavía
              </p>
              <p
                className={`mt-1 text-2xl font-semibold ${
                  porRendir > 0 ? 'text-primary' : 'text-emerald-600'
                }`}
              >
                {porRendir}
              </p>
              <p className="text-xs text-muted-foreground">
                {porRendir > 0
                  ? `Tenés ${porRendir} propietario${porRendir === 1 ? '' : 's'} esperando`
                  : 'Todos rendidos este mes 🎉'}
              </p>
            </CardContent>
          </Card>
          <Card
            className={
              sinCbu > 0
                ? 'border-amber-200 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-900/10'
                : ''
            }
          >
            <CardContent className="p-5">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Sin CBU</p>
              <p className={`mt-1 text-2xl font-semibold ${sinCbu > 0 ? 'text-amber-600' : ''}`}>
                {sinCbu}
              </p>
              <p className="text-xs text-muted-foreground">
                {sinCbu > 0 ? 'Pediles los datos antes de rendir' : 'Todos tienen CBU cargado'}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nombre, CUIT o email"
              aria-label="Buscar propietarios"
              className="pl-9"
            />
          </div>
          <Button onClick={() => setAbrirSumar(true)}>
            <Plus className="h-4 w-4" />
            Sumar propietario
          </Button>
        </div>

        {cargando && propietarios.length === 0 ? (
          <Card>
            <CardContent className="space-y-2 p-10 text-center text-muted-foreground">
              <Users className="mx-auto h-8 w-8 animate-pulse" />
              <p className="font-medium text-foreground">Cargando propietarios…</p>
            </CardContent>
          </Card>
        ) : filtrados.length === 0 ? (
          <Card>
            <CardContent className="space-y-2 p-10 text-center text-muted-foreground">
              <Users className="mx-auto h-8 w-8" />
              <p className="font-medium text-foreground">
                {propietarios.length === 0 ? 'Todavía no cargaste propietarios' : `Sin resultados para "${q}"`}
              </p>
              {propietarios.length > 0 && (
                <button type="button" onClick={() => setQ('')} className="text-xs font-medium text-primary hover:underline">
                  Limpiar búsqueda
                </button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtrados.map((p, i) => {
              const tel = p.telefono.replace(/[^\d]/g, '');
              const rendido = rendicionesMap[p.id];
              const necesitaRendir = !rendido && p.totalRecibirMes > 0;
              // Mensaje de WhatsApp contextual: rendición si ya se rindió, pedido
              // de CBU si no tiene, sino aviso de cobranza pronta.
              const mensajeWA = rendido
                ? mensajeRendicion(p, rendido)
                : !p.cbuAlias
                  ? mensajePedirCbu(p)
                  : `Hola ${p.nombre.split(' ')[0]}! Te paso ` +
                    `un update de la cobranza del mes en unos días.`;
              const waUrl = `https://wa.me/${tel}?text=${encodeURIComponent(mensajeWA)}`;
              return (
                <Card
                  key={p.id}
                  className="animate-fade-in transition-shadow hover:shadow-md"
                  style={{ animationDelay: `${i * 40}ms`, animationFillMode: 'backwards' }}
                >
                  <CardContent className="space-y-4 p-5">
                    <button
                      type="button"
                      onClick={() => setVerHistorial(p)}
                      className="block w-full text-left space-y-3 -m-1 rounded-md p-1 transition-colors hover:bg-muted/20"
                    >
                      <div className="flex items-start gap-3">
                        <Avatar>
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {p.nombre[0]}
                            {p.apellido[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          {/* Nombre y CUIT son datos identificatorios clave —
                              antes con truncate se cortaban a "Eduardo Cas..."
                              y "CUIT 20-1234567..." en las cards de 3 cols.
                              Ahora permitimos wrap a 2 líneas para nombres
                              largos y dejamos el CUIT en una línea (entra el
                              formato XX-XXXXXXXX-X completo). */}
                          <p className="font-semibold leading-tight line-clamp-2">
                            {p.nombre} {p.apellido}
                          </p>
                          {/* whitespace-nowrap es CRÍTICO: sin él los
                              guiones del CUIT "20-12345678-2" hacen que
                              el navegador break la línea en cualquier `-`
                              y el CUIT termina partido en 3 líneas. */}
                          <p className="whitespace-nowrap text-xs text-muted-foreground tabular-nums">
                            CUIT {p.cuit}
                          </p>
                        </div>
                        {/* I2-05: este badge comunica ESTADO de rendición.
                            Antes el tercer caso mostraba la cantidad de
                            unidades ("1 unidad") — una semántica distinta en el
                            mismo slot que rompía el escaneo visual. Ahora los
                            tres casos son estados coherentes: Rendido / Por
                            rendir / Al día. La cantidad de unidades vive en la
                            ficha del propietario, no en el badge de estado. */}
                        {rendido ? (
                          <Badge
                            variant="success"
                            className="shrink-0 gap-1 text-[10px]"
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            Rendido
                          </Badge>
                        ) : necesitaRendir ? (
                          <Badge
                            variant="warning"
                            className="shrink-0 gap-1 text-[10px]"
                          >
                            <Wallet className="h-3 w-3" />
                            Por rendir
                          </Badge>
                        ) : (
                          <Badge
                            variant="secondary"
                            className="shrink-0 gap-1 text-[10px]"
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            Al día
                          </Badge>
                        )}
                      </div>

                      <div className="space-y-1.5 text-xs text-muted-foreground">
                        <div className="flex items-center gap-2 truncate">
                          <Mail className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{p.email}</span>
                        </div>
                        <div className="flex items-center gap-2 truncate">
                          <Phone className="h-3.5 w-3.5 shrink-0" />
                          <span>{p.telefono}</span>
                        </div>
                      </div>

                      <div
                        className={`rounded-md border p-3 text-sm ${
                          rendido
                            ? 'border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-900/10'
                            : necesitaRendir
                              ? 'border-primary/30 bg-primary/5'
                              : 'bg-muted/50'
                        }`}
                      >
                        <p className="text-xs text-muted-foreground">
                          {rendido ? 'Rendido este mes' : 'A rendir este mes'}
                        </p>
                        <p className="text-lg font-semibold">
                          {formatMonto(rendido?.montoNeto ?? p.totalRecibirMes)}
                        </p>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          Comisión {p.comisionPct}% · Bruto{' '}
                          {formatMonto(rendido?.montoBruto ?? p.totalCobradoMes)}
                        </p>
                      </div>
                    </button>

                    {!p.cbuAlias && (
                      <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/10 dark:text-amber-200">
                        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        Falta CBU para transferir
                      </div>
                    )}

                    {/* Acciones primarias: WhatsApp pre-armado + Rendir. */}
                    <div className="grid grid-cols-[1fr_1fr_auto] gap-1.5 border-t pt-3">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 border-emerald-200 bg-emerald-50/60 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900/40 dark:bg-emerald-900/10 dark:text-emerald-300"
                        asChild
                      >
                        <a href={waUrl} target="_blank" rel="noreferrer">
                          <MessageCircle className="h-3.5 w-3.5" />
                          WhatsApp
                        </a>
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => setRendiendoA(p)}
                        disabled={!necesitaRendir && !rendido}
                        className="gap-1.5"
                      >
                        <Wallet className="h-3.5 w-3.5" />
                        {rendido ? 'Rendido ✓' : 'Rendir'}
                      </Button>
                      <Button size="sm" variant="ghost" asChild aria-label="Contratos">
                        <Link href={`/contratos?propietario=${p.id}`}>
                          <FileText className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      <SumarPropietarioDialog open={abrirSumar} onOpenChange={setAbrirSumar} />

      <RendirPropietarioDialog
        propietario={rendiendoA}
        open={!!rendiendoA}
        onOpenChange={(v) => !v && setRendiendoA(null)}
        onRendido={() => refrescarRendiciones()}
      />

      <HistorialPropietarioDialog
        propietario={verHistorial}
        open={!!verHistorial}
        onOpenChange={(v) => !v && setVerHistorial(null)}
      />
    </>
  );
}
