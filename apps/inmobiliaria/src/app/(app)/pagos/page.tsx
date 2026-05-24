'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock,
  Download,
  Inbox,
  ShieldCheck,
} from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card, CardContent } from '@llave/ui/card';
import { cn } from '@llave/ui/cn';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@llave/ui/table';
import { toast } from '@llave/ui/use-toast';
import { AlertasServiciosCard } from '@/components/alertas-servicios-card';
import { CargarPagoManualButton } from '@/components/cargar-pago-manual';
import { CargosACobrar } from '@/components/cargos-a-cobrar';
import { MorososPanel } from '@/components/morosos-panel';
import { PagosPorValidar } from '@/components/pagos-por-validar';
import { Topbar } from '@/components/topbar';
import { ValidadorResumenDialog } from '@/components/validador-resumen-dialog';
import {
  contactosCobranzaMock,
  contratosMock,
  pagosInformadosMock,
  propiedadesMock,
  propietariosMock,
} from '@/lib/mock-data';
import { estadoDePago } from '@/lib/conciliacion-storage';
import { formatFecha, formatMonto } from '@/lib/format';
import { abrirReporteImprimible } from '@/lib/reportes-pdf';
import { diasHastaVencimiento } from '@/lib/format';
import {
  CONDICION_FISCAL_LABEL,
  listarSociedades,
  sociedadPrincipal,
} from '@/lib/sociedades-storage';
import type { EstadoLiquidacion } from '@/lib/types';

type Filtro = 'TODOS' | 'A_RESOLVER' | 'VENCIDO' | 'PENDIENTE' | 'PAGADO';

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

// Configuración de los botones de filtro grandes. "A resolver" va primero —
// son comprobantes que un inquilino informó y todavía no decidiste si los
// confirmás o los rechazás. Si hay alguno, esto es lo más urgente de tu día.
const FILTROS = [
  {
    key: 'A_RESOLVER' as const,
    label: 'A resolver',
    icon: Inbox,
    colorActive: 'bg-violet-500 text-white border-violet-500 shadow-lg shadow-violet-500/20',
    colorIdle:
      'border-violet-200 bg-violet-50/60 text-violet-700 hover:bg-violet-100 hover:border-violet-300 dark:border-violet-900/40 dark:bg-violet-900/10 dark:text-violet-300',
    badgeBg: 'bg-violet-500/20',
  },
  {
    key: 'VENCIDO' as const,
    label: 'Vencidos',
    icon: AlertTriangle,
    colorActive: 'bg-red-500 text-white border-red-500 shadow-lg shadow-red-500/20',
    colorIdle:
      'border-red-200 bg-red-50/60 text-red-700 hover:bg-red-100 hover:border-red-300 dark:border-red-900/40 dark:bg-red-900/10 dark:text-red-300',
    badgeBg: 'bg-red-500/20',
  },
  {
    key: 'PENDIENTE' as const,
    label: 'Pendientes',
    icon: Clock,
    colorActive: 'bg-amber-500 text-white border-amber-500 shadow-lg shadow-amber-500/20',
    colorIdle:
      'border-amber-200 bg-amber-50/60 text-amber-800 hover:bg-amber-100 hover:border-amber-300 dark:border-amber-900/40 dark:bg-amber-900/10 dark:text-amber-300',
    badgeBg: 'bg-amber-500/20',
  },
  {
    key: 'PAGADO' as const,
    label: 'Pagados',
    icon: CheckCircle2,
    colorActive: 'bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-500/20',
    colorIdle:
      'border-emerald-200 bg-emerald-50/60 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300 dark:border-emerald-900/40 dark:bg-emerald-900/10 dark:text-emerald-300',
    badgeBg: 'bg-emerald-500/20',
  },
] as const;

export default function PagosPage() {
  // Default al filtro "A resolver" si hay comprobantes pendientes — así lo
  // primero que ve el usuario es lo que tiene que decidir.
  const [filtro, setFiltro] = useState<Filtro>('TODOS');
  const [aResolverCount, setAResolverCount] = useState(0);
  const [validadorOpen, setValidadorOpen] = useState(false);

  // Recalculamos el contador de pagos "a resolver" en cliente porque
  // estadoDePago lee de localStorage (acciones previas del admin).
  useEffect(() => {
    const recount = () => {
      const pendientes = pagosInformadosMock.filter(
        (p) => estadoDePago(p.id) === 'INFORMADO',
      ).length;
      setAResolverCount(pendientes);
      // Default a "A resolver" si hay algo, sólo la primera vez (no
      // sobreescribimos si el usuario ya cambió de filtro).
      setFiltro((prev) => {
        if (prev !== 'TODOS') return prev;
        return pendientes > 0 ? 'A_RESOLVER' : 'TODOS';
      });
    };
    recount();
    // Re-chequear cuando cambia el storage en otra pestaña / acción
    const onStorage = (e: StorageEvent) => {
      if (e.key?.startsWith('llave-inmo:conciliacion')) recount();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const counters = useMemo(
    () => ({
      A_RESOLVER: aResolverCount,
      VENCIDO: contratosMock.filter((c) => c.estadoPagoActual === 'VENCIDO').length,
      PENDIENTE: contratosMock.filter((c) => c.estadoPagoActual === 'PENDIENTE').length,
      PAGADO: contratosMock.filter((c) => c.estadoPagoActual === 'PAGADO').length,
    }),
    [aResolverCount],
  );

  const totalCobrado = useMemo(
    () =>
      contratosMock
        .filter((c) => c.estadoPagoActual === 'PAGADO')
        .reduce((acc, c) => acc + c.monto, 0),
    [],
  );
  const totalPendiente = useMemo(
    () =>
      contratosMock
        .filter((c) => c.estadoPagoActual !== 'PAGADO')
        .reduce((acc, c) => acc + c.monto, 0),
    [],
  );

  const filtradas = useMemo(() => {
    if (filtro === 'TODOS' || filtro === 'A_RESOLVER') return contratosMock;
    return contratosMock.filter((c) => c.estadoPagoActual === filtro);
  }, [filtro]);

  const togglearFiltro = (f: 'A_RESOLVER' | 'VENCIDO' | 'PENDIENTE' | 'PAGADO') => {
    setFiltro((prev) => (prev === f ? 'TODOS' : f));
  };

  // PDF de morosos para llevar a cobranza física.
  // Incluye titular + garante con sus teléfonos y los días de atraso.
  const exportarMorososPdf = () => {
    const morosos = contratosMock.filter((c) => c.estadoPagoActual === 'VENCIDO');
    const filas: (string | number)[][] = morosos.map((c) => {
      const contacto = contactosCobranzaMock.find((x) => x.contratoId === c.id);
      const dias = -diasHastaVencimiento(c.proximoVencimiento);
      return [
        c.inquilino,
        c.direccion,
        contacto?.titular.telefono ?? '—',
        contacto?.garante ? `${contacto.garante.nombre} · ${contacto.garante.telefono}` : 'Sin garante registrado',
        `${dias} días`,
        formatMonto(c.monto, c.moneda),
      ];
    });
    const totalDeuda = morosos.reduce((acc, c) => acc + c.monto, 0);
    abrirReporteImprimible({
      titulo: 'Morosos · cobranza',
      subtitulo: `Mayo 2026 · ${morosos.length} contrato${morosos.length === 1 ? '' : 's'} con atraso`,
      inmobiliaria: sociedadPrincipal().razonSocial,
      columnas: [
        { header: 'Inquilino', width: '20%' },
        { header: 'Propiedad', width: '20%' },
        { header: 'Teléfono', width: '14%' },
        { header: 'Garante (nombre · tel)', width: '26%' },
        { header: 'Atraso', width: '8%', align: 'center' },
        { header: 'Monto', width: '12%', align: 'right' },
      ],
      filas,
      totales: [
        { label: 'Cantidad', valor: morosos.length.toString() },
        { label: 'Deuda total', valor: formatMonto(totalDeuda) },
      ],
      notaFinal:
        'Imprimí esta hoja para llevar de visita o pegar en el tablero. Al ' +
        'volver, marcá las gestiones realizadas en la ficha del contrato.',
    });
  };

  // PDF de morosos agrupado por SOCIEDAD GESTORA.
  // Sirve cuando la inmobiliaria opera con varias razones sociales
  // (S.R.L. residencial + S.A. comercial + fideicomiso) y necesita
  // imprimir un reporte por cada una con su propio CUIT como emisor.
  // Cada sección es una sociedad, con sus contratos morosos.
  const exportarMorososPorSociedadPdf = () => {
    const morosos = contratosMock.filter((c) => c.estadoPagoActual === 'VENCIDO');
    if (morosos.length === 0) {
      toast({
        title: 'No hay morosos este mes',
        description: 'Todos los contratos están al día o pendientes pero no vencidos.',
      });
      return;
    }

    const sociedades = listarSociedades();
    const principal = sociedadPrincipal();

    const secciones = sociedades
      .map((soc) => {
        // Una propiedad pertenece a la sociedad si:
        //  - tiene sociedadId explícito que matchea, o
        //  - no tiene sociedadId y soc es la principal (fallback).
        const propsDeSoc = propiedadesMock.filter((p) =>
          p.sociedadId
            ? p.sociedadId === soc.id
            : soc.id === principal.id,
        );
        const contratosIds = new Set(
          propsDeSoc.map((p) => p.contratoActualId).filter((x): x is string => !!x),
        );
        const morososDeSoc = morosos.filter((c) => contratosIds.has(c.id));
        if (morososDeSoc.length === 0) return null;

        const filas: (string | number)[][] = morososDeSoc.map((c) => {
          const contacto = contactosCobranzaMock.find((x) => x.contratoId === c.id);
          const dias = -diasHastaVencimiento(c.proximoVencimiento);
          // Apellido del primer propietario para que la inmo sepa a quién
          // rinde dentro de esa sociedad (un fideicomiso puede tener
          // varios dueños, por ejemplo).
          const propiedad = propsDeSoc.find((p) => p.contratoActualId === c.id);
          const primerOwnerId = propiedad?.propietariosIds[0];
          const ownerNombre = primerOwnerId
            ? (() => {
                const ow = propietariosMock.find((x) => x.id === primerOwnerId);
                return ow ? `${ow.nombre} ${ow.apellido}` : '—';
              })()
            : '—';

          return [
            c.inquilino,
            c.direccion,
            ownerNombre,
            contacto?.titular.telefono ?? '—',
            `${dias} días`,
            formatMonto(c.monto, c.moneda),
          ];
        });

        const subtotal = morososDeSoc.reduce((acc, c) => acc + c.monto, 0);
        return {
          titulo: soc.razonSocial,
          subtitulo: `CUIT ${soc.cuit} · ${CONDICION_FISCAL_LABEL[soc.condicionFiscal]} · ${morososDeSoc.length} contrato${morososDeSoc.length === 1 ? '' : 's'} moroso${morososDeSoc.length === 1 ? '' : 's'}`,
          filas,
          subtotal: {
            label: 'Subtotal de la sociedad',
            valor: formatMonto(subtotal),
          },
        };
      })
      .filter((s): s is NonNullable<typeof s> => s !== null);

    const totalDeuda = morosos.reduce((acc, c) => acc + c.monto, 0);

    abrirReporteImprimible({
      titulo: 'Morosos por sociedad',
      subtitulo: `Mayo 2026 · ${secciones.length} sociedad${secciones.length === 1 ? '' : 'es'} con cartera atrasada · ${morosos.length} contrato${morosos.length === 1 ? '' : 's'} vencido${morosos.length === 1 ? '' : 's'}`,
      inmobiliaria: principal.razonSocial,
      columnas: [
        { header: 'Inquilino', width: '20%' },
        { header: 'Propiedad', width: '24%' },
        { header: 'Propietario', width: '18%' },
        { header: 'Teléfono', width: '14%' },
        { header: 'Atraso', width: '10%', align: 'center' },
        { header: 'Monto', width: '14%', align: 'right' },
      ],
      secciones,
      totales: [
        { label: 'Sociedades afectadas', valor: secciones.length.toString() },
        { label: 'Contratos morosos', valor: morosos.length.toString() },
        { label: 'Deuda total', valor: formatMonto(totalDeuda) },
      ],
      notaFinal:
        'Cada sección representa una sociedad de la inmobiliaria con su propio CUIT. ' +
        'Podés imprimir solo las páginas que te interesen para llevar el reporte ' +
        'al estudio o al propietario que corresponda.',
    });
  };

  // PDF detallado de lo cobrado en el mes.
  // Se usa para rendir a propietarios y para archivo del estudio.
  const exportarCobradoPdf = () => {
    const pagados = contratosMock.filter((c) => c.estadoPagoActual === 'PAGADO');
    const filas: (string | number)[][] = pagados.map((c) => [
      c.inquilino,
      c.direccion,
      formatFecha(c.proximoVencimiento),
      'Transferencia',
      formatMonto(c.monto, c.moneda),
    ]);
    abrirReporteImprimible({
      titulo: 'Cobranzas del mes',
      subtitulo: `Mayo 2026 · ${pagados.length} pago${pagados.length === 1 ? '' : 's'} acreditado${pagados.length === 1 ? '' : 's'}`,
      inmobiliaria: sociedadPrincipal().razonSocial,
      columnas: [
        { header: 'Inquilino', width: '24%' },
        { header: 'Propiedad', width: '28%' },
        { header: 'Vencimiento', width: '14%' },
        { header: 'Método', width: '14%' },
        { header: 'Monto', width: '20%', align: 'right' },
      ],
      filas,
      totales: [
        { label: 'Cantidad', valor: pagados.length.toString() },
        { label: 'Total cobrado', valor: formatMonto(totalCobrado) },
      ],
      notaFinal:
        'Este reporte detalla los pagos acreditados y conciliados en el período. Sirve ' +
        'como respaldo para las rendiciones a propietarios.',
    });
  };

  return (
    <>
      <Topbar titulo="Pagos del mes" />
      <main className="flex-1 space-y-6 p-4 md:p-6">
        {/* 2 stats GRANDES: montos cobrado y pendiente */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-900/10">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="h-4 w-4" />
                <p className="text-xs font-semibold uppercase tracking-wide">Cobrado</p>
              </div>
              <p className="mt-2 text-3xl font-bold text-emerald-700 tabular-nums dark:text-emerald-300 md:text-4xl">
                {formatMonto(totalCobrado)}
              </p>
              <p className="text-xs text-emerald-700/70 dark:text-emerald-300/70">
                {counters.PAGADO} propiedad{counters.PAGADO === 1 ? '' : 'es'} al día este mes
              </p>
            </CardContent>
          </Card>
          <Card className="border-amber-200 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-900/10">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
                <Clock className="h-4 w-4" />
                <p className="text-xs font-semibold uppercase tracking-wide">Pendiente</p>
              </div>
              <p className="mt-2 text-3xl font-bold text-amber-700 tabular-nums dark:text-amber-300 md:text-4xl">
                {formatMonto(totalPendiente)}
              </p>
              <p className="text-xs text-amber-700/70 dark:text-amber-300/70">
                Suma de alquileres no cobrados todavía
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Cargos USO_Y_GOCE generados al inquilino (cobranza vía alquiler) */}
        <CargosACobrar />

        {/* Panel inline de morosos con teléfonos del titular y garante,
            plantillas WhatsApp y filtros. Reemplaza al "tenés que abrir
            el PDF para ver los contactos" con datos accionables. */}
        <MorososPanel inmobiliaria={sociedadPrincipal().nombreComercial} />

        {/* Alertas de servicios: inquilinos que no subieron boletas o
            las tienen vencidas. El feedback pidió tratarlo como
            morosidad blanda (Sección 5 + 7). */}
        <AlertasServiciosCard />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Liquidaciones — Mayo 2026</h2>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              className="gap-1 bg-violet-600 text-white hover:bg-violet-700"
              onClick={() => setValidadorOpen(true)}
            >
              <ShieldCheck className="h-4 w-4" />
              Validar por resumen
            </Button>
            <CargarPagoManualButton />
            <Button variant="outline" size="sm" onClick={() => exportarMorososPdf()}>
              <Download className="h-4 w-4" />
              PDF de morosos
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportarMorososPorSociedadPdf()}
            >
              <Download className="h-4 w-4" />
              PDF morosos por sociedad
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportarCobradoPdf()}>
              <Download className="h-4 w-4" />
              PDF cobranzas
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                toast({
                  title: 'Recordatorios enviados',
                  description: 'Le mandamos WhatsApp y mail a los inquilinos con pagos vencidos.',
                })
              }
            >
              <Bell className="h-4 w-4" />
              Recordar a morosos
            </Button>
          </div>
        </div>

        {/* 4 botones grandes de filtro, ocupan de punta a punta */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {FILTROS.map((f) => {
            const Icon = f.icon;
            const activo = filtro === f.key;
            const count = counters[f.key];
            return (
              <button
                key={f.key}
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
                      {count} contrato{count === 1 ? '' : 's'}
                    </p>
                  </div>
                </div>
                <span
                  className={cn(
                    'text-3xl font-bold tabular-nums',
                    activo ? 'text-white' : '',
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {filtro !== 'TODOS' && filtro !== 'A_RESOLVER' && (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Filtrado: <strong className="text-foreground">{estadoLabel[filtro]}</strong> ·{' '}
              {filtradas.length} resultado{filtradas.length === 1 ? '' : 's'}
            </span>
            <button
              onClick={() => setFiltro('TODOS')}
              className="font-medium text-primary hover:underline"
            >
              Mostrar todos
            </button>
          </div>
        )}

        {/* Vista "A resolver": comprobantes informados pendientes de tu OK.
            Se resuelve en este mismo lugar (sin cards sueltas arriba). */}
        {filtro === 'A_RESOLVER' ? (
          <PagosPorValidar onChange={(pendientes) => setAResolverCount(pendientes)} />
        ) : /* Mobile: lista de cards. Desktop (md+): tabla.
            En mobile la tabla se cortaba horizontalmente. Las cards muestran
            la misma info verticalmente y son tap-friendly. */
        filtradas.length === 0 ? (
          <Card>
            <div className="py-10 text-center text-sm text-muted-foreground">
              No hay contratos {estadoLabel[filtro as EstadoLiquidacion].toLowerCase()}s en
              este momento.
            </div>
          </Card>
        ) : (
          <>
            {/* Cards mobile */}
            <div className="space-y-3 md:hidden">
              {filtradas.map((c) => (
                <Link
                  key={c.id}
                  href={`/contratos/${c.id}`}
                  className="block"
                >
                  <Card className="space-y-3 p-4 transition-colors hover:bg-muted/30">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{c.inquilino}</p>
                        <p className="truncate text-xs text-muted-foreground">{c.direccion}</p>
                      </div>
                      <Badge variant={estadoVariant[c.estadoPagoActual]} className="shrink-0">
                        {estadoLabel[c.estadoPagoActual]}
                      </Badge>
                    </div>
                    <div className="flex items-end justify-between gap-3 border-t pt-3">
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          Vence
                        </p>
                        <p className="text-sm font-medium tabular-nums">
                          {formatFecha(c.proximoVencimiento)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          Monto
                        </p>
                        <p className="text-base font-semibold tabular-nums">
                          {formatMonto(c.monto, c.moneda)}
                        </p>
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>

            {/* Tabla desktop */}
            <Card className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Inquilino</TableHead>
                    <TableHead>Dirección</TableHead>
                    <TableHead>Vencimiento</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtradas.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.inquilino}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{c.direccion}</TableCell>
                      <TableCell className="text-sm">{formatFecha(c.proximoVencimiento)}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatMonto(c.monto, c.moneda)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={estadoVariant[c.estadoPagoActual]}>
                          {estadoLabel[c.estadoPagoActual]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        <Link href={`/contratos/${c.id}`} className="text-primary hover:underline">
                          Ver contrato
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </>
        )}
      </main>

      {/* Dialog "Validar por resumen": el inmo sube el PDF del banco
          y conciliamos en bloque contra los pagos informados. */}
      <ValidadorResumenDialog
        open={validadorOpen}
        onOpenChange={setValidadorOpen}
        onConciliado={() => {
          // Recalculamos el contador de "a resolver" después de conciliar.
          const pendientes = pagosInformadosMock.filter(
            (p) => estadoDePago(p.id) === 'INFORMADO',
          ).length;
          setAResolverCount(pendientes);
        }}
      />
    </>
  );
}

