'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  ChevronDown,
  Clock,
  Download,
  Inbox,
  PieChart,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card, CardContent } from '@llave/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@llave/ui/dropdown-menu';
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
import { ValidadorResumenApiDialog } from '@/components/validador-resumen-api-dialog';
import { apiEnabled } from '@/lib/api/client';
import { useContratos } from '@/lib/api/hooks';
import { useAResolverCount, useDevengar, usePagosConciliados } from '@/lib/api/use-pagos';
import {
  contactosCobranzaMock,
  pagosInformadosMock,
  propiedadesMock,
  propietariosMock,
  type MetodoPagoInformado,
} from '@/lib/mock-data';
import { estadoDePago } from '@/lib/conciliacion-storage';
import { formatFecha, formatFechaCorta, formatMonto, formatPeriodo, periodoActualFormat } from '@/lib/format';
import { abrirReporteImprimible } from '@/lib/reportes-pdf';
import { diasHastaVencimiento } from '@/lib/format';
import {
  CONDICION_FISCAL_LABEL,
  listarSociedades,
  sociedadPrincipal,
} from '@/lib/sociedades-storage';
import type { EstadoLiquidacion } from '@/lib/types';

type Filtro = 'TODOS' | 'A_RESOLVER' | 'VENCIDO' | 'PENDIENTE' | 'PARCIAL' | 'PAGADO';

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

// Plural para el empty-state ("No hay contratos {plural}…"): antes se derivaba
// concatenando 's' al label, que para PARCIAL daba "parcials". Explícito y correcto.
const estadoLabelPlural: Record<EstadoLiquidacion, string> = {
  PENDIENTE: 'pendientes',
  PAGADO: 'pagados',
  PARCIAL: 'parciales',
  VENCIDO: 'vencidos',
};

// Label humano del método de pago para el PDF de cobranzas (mismos textos que
// la bandeja de validación).
const metodoPagoLabel: Record<MetodoPagoInformado, string> = {
  TRANSFERENCIA: 'Transferencia',
  MERCADOPAGO: 'Mercado Pago',
  EFECTIVO: 'Efectivo',
  CHEQUE: 'Cheque',
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
    // Parcial: el inquilino cobró una parte del mes. Va entre Pendientes y Pagados
    // (a mitad de camino). Color sky para no confundirse con el ámbar de Pendiente.
    key: 'PARCIAL' as const,
    label: 'Parciales',
    icon: PieChart,
    colorActive: 'bg-sky-500 text-white border-sky-500 shadow-lg shadow-sky-500/20',
    colorIdle:
      'border-sky-200 bg-sky-50/60 text-sky-700 hover:bg-sky-100 hover:border-sky-300 dark:border-sky-900/40 dark:bg-sky-900/10 dark:text-sky-300',
    badgeBg: 'bg-sky-500/20',
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
  const [devengando, setDevengando] = useState(false);
  const { devengar } = useDevengar();

  // En producción (API) la cartera real viene de useContratos; los paneles
  // de conciliación todavía-no-cableados (morosos/cargos/servicios) se
  // muestran solo en el build demo (!apiEnabled) para no inventar data. La
  // cola "A resolver" (pagos informados) SÍ está cableada al API.
  const real = apiEnabled;
  const { contratos } = useContratos();

  // Conteo de comprobantes "a resolver". En prod sale de /pagos (estado
  // INFORMADO); en demo, del mock + localStorage. El hook ya hace el branch.
  // isError: con la query caída el count es un 0 FALSO → el botón muestra '—'.
  const { count: aResolverApi, deApi: aResolverDeApi, isError: aResolverError } = useAResolverCount();

  // Pagos ya CONCILIADOS (solo prod): el PDF "Cobranzas del mes" se arma desde
  // los cobros reales (fecha/método/monto de cada pago), no desde el canon.
  // isError/cargando: con la query caída o pendiente el PDF saldría "Total $0"
  // como si no se hubiera cobrado nada — lo abortamos con un toast.
  const {
    pagos: pagosConciliados,
    isError: conciliadosError,
    cargando: conciliadosCargando,
  } = usePagosConciliados();

  // En modo API el contador es reactivo (viene del hook): lo reflejamos y
  // defaulteamos a "A resolver" si hay pendientes la primera vez.
  useEffect(() => {
    if (!aResolverDeApi) return;
    setAResolverCount(aResolverApi);
    setFiltro((prev) => {
      if (prev !== 'TODOS') return prev;
      return aResolverApi > 0 ? 'A_RESOLVER' : 'TODOS';
    });
  }, [aResolverDeApi, aResolverApi]);

  // En modo demo recalculamos en cliente porque estadoDePago lee de
  // localStorage (acciones previas del admin) y cambia entre pestañas.
  useEffect(() => {
    if (aResolverDeApi) return;
    const recount = () => {
      const pendientes = pagosInformadosMock.filter(
        (p) => estadoDePago(p.id) === 'INFORMADO',
      ).length;
      setAResolverCount(pendientes);
      setFiltro((prev) => {
        if (prev !== 'TODOS') return prev;
        return pendientes > 0 ? 'A_RESOLVER' : 'TODOS';
      });
    };
    recount();
    const onStorage = (e: StorageEvent) => {
      if (e.key?.startsWith('llave-inmo:conciliacion')) recount();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aResolverDeApi]);

  // Cobranza: sólo contratos con liquidaciones reales. Un BORRADOR (p.ej. uno
  // cargado y luego rechazado) no se cobra y su estadoPagoActual derivado cae a
  // PENDIENTE → inflaba el KPI "Pendiente" y aparecía en la lista de cobros.
  // Excluye PROPIETARIO_DIRECTO: ese alquiler va directo del inquilino al dueño,
  // la inmo no lo cobra → no debe inflar "Pendiente"/"Cobrado" ni aparecer en la
  // cartera de cobro (alinea con dashboard-helpers, que ya lo excluye).
  const cobrables = useMemo(
    () => contratos.filter((c) => c.estado !== 'BORRADOR' && c.modoCobranza !== 'PROPIETARIO_DIRECTO'),
    [contratos],
  );

  const counters = useMemo(
    () => ({
      A_RESOLVER: aResolverCount,
      VENCIDO: cobrables.filter((c) => c.estadoPagoActual === 'VENCIDO').length,
      PENDIENTE: cobrables.filter((c) => c.estadoPagoActual === 'PENDIENTE').length,
      PARCIAL: cobrables.filter((c) => c.estadoPagoActual === 'PARCIAL').length,
      PAGADO: cobrables.filter((c) => c.estadoPagoActual === 'PAGADO').length,
    }),
    [aResolverCount, cobrables],
  );

  const totalCobrado = useMemo(
    () =>
      // Suma lo REALMENTE cobrado del período por contrato (montoPagado, del
      // API), no solo el canon de los PAGADO: validar un parcial mueve 'Cobrado'
      // al instante y Cobrado+Pendiente cierran (antes el parcial bajaba
      // 'Pendiente' pero 'Cobrado' no se movía → descuadre visible). En PAGADO
      // usamos montoPagado si vino (puede incluir mora cobrada); demo (sin
      // montoPagado) cae al comportamiento de siempre: canon si PAGADO, 0 si no.
      cobrables.reduce(
        (acc, c) =>
          acc +
          (c.estadoPagoActual === 'PAGADO' ? (c.montoPagado ?? c.monto) : (c.montoPagado ?? 0)),
        0,
      ),
    [cobrables],
  );
  const totalPendiente = useMemo(
    () =>
      cobrables
        .filter((c) => c.estadoPagoActual !== 'PAGADO')
        .reduce((acc, c) => {
          // Restamos lo ya conciliado del período actual (montoPagado) en CUALQUIER
          // contrato no pagado, no sólo los PARCIAL: un parcial VENCIDO reporta
          // estadoPagoActual='VENCIDO' (no 'PARCIAL', tras el fix A2) pero igual tiene
          // una parte cobrada. Contar el mes entero sobreestimaría la mora. montoPagado
          // viene del API (0/ausente en demo). Clamp a ≥0 por si lo conciliado supera
          // el canon (p.ej. la liq incluye expensas).
          return acc + Math.max(0, c.monto - (c.montoPagado ?? 0));
        }, 0),
    [cobrables],
  );

  const filtradas = useMemo(() => {
    if (filtro === 'TODOS' || filtro === 'A_RESOLVER') return cobrables;
    return cobrables.filter((c) => c.estadoPagoActual === filtro);
  }, [filtro, cobrables]);

  const togglearFiltro = (f: 'A_RESOLVER' | 'VENCIDO' | 'PENDIENTE' | 'PARCIAL' | 'PAGADO') => {
    setFiltro((prev) => (prev === f ? 'TODOS' : f));
  };

  // PDF de morosos para llevar a cobranza física.
  // Incluye titular + garante con sus teléfonos y los días de atraso.
  const exportarMorososPdf = () => {
    // Sobre `cobrables` (no `contratos` crudo): un BORRADOR no se cobra y un
    // PROPIETARIO_DIRECTO lo cobra el dueño — ninguna de esas deudas es de la
    // inmo y no van en el PDF que se lleva a cobranza.
    const morosos = cobrables.filter((c) => c.estadoPagoActual === 'VENCIDO');
    const filas: (string | number)[][] = morosos.map((c) => {
      // Teléfono/garante: solo del mock en demo. En prod no hay endpoint que
      // los exponga → '—'/'Sin garante' (no dependemos del mismatch de ids).
      const contacto = apiEnabled ? undefined : contactosCobranzaMock.find((x) => x.contratoId === c.id);
      const dias = -diasHastaVencimiento(c.proximoVencimiento);
      return [
        c.inquilino,
        c.direccion,
        contacto?.titular.telefono ?? '—',
        contacto?.garante ? `${contacto.garante.nombre} · ${contacto.garante.telefono}` : 'Sin garante registrado',
        `${dias} día${dias === 1 ? '' : 's'}`,
        // Deuda REAL acumulada (todas las cuotas impagas + mora), no el alquiler
        // mensual. En demo (sin deudaTotal) cae al monto del mock.
        formatMonto(c.deudaTotal ?? c.monto, c.moneda),
      ];
    });
    const totalDeuda = morosos.reduce((acc, c) => acc + (c.deudaTotal ?? c.monto), 0);
    abrirReporteImprimible({
      titulo: 'Morosos · cobranza',
      subtitulo: `${formatPeriodo(periodoActualFormat())} · ${morosos.length} contrato${morosos.length === 1 ? '' : 's'} con atraso`,
      inmobiliaria: sociedadPrincipal().razonSocial,
      columnas: [
        { header: 'Inquilino', width: '20%' },
        { header: 'Propiedad', width: '20%' },
        { header: 'Teléfono', width: '14%' },
        { header: 'Garante (nombre · tel)', width: '26%' },
        { header: 'Atraso', width: '8%', align: 'center' },
        { header: 'Deuda total', width: '12%', align: 'right' },
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
    const morosos = contratos.filter((c) => c.estadoPagoActual === 'VENCIDO');
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
          const contacto = apiEnabled ? undefined : contactosCobranzaMock.find((x) => x.contratoId === c.id);
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
            `${dias} día${dias === 1 ? '' : 's'}`,
            formatMonto(c.deudaTotal ?? c.monto, c.moneda),
          ];
        });

        const subtotal = morososDeSoc.reduce((acc, c) => acc + (c.deudaTotal ?? c.monto), 0);
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

    const totalDeuda = morosos.reduce((acc, c) => acc + (c.deudaTotal ?? c.monto), 0);

    abrirReporteImprimible({
      titulo: 'Morosos por sociedad',
      subtitulo: `${formatPeriodo(periodoActualFormat())} · ${secciones.length} sociedad${secciones.length === 1 ? '' : 'es'} con cartera atrasada · ${morosos.length} contrato${morosos.length === 1 ? '' : 's'} vencido${morosos.length === 1 ? '' : 's'}`,
      inmobiliaria: principal.razonSocial,
      columnas: [
        { header: 'Inquilino', width: '20%' },
        { header: 'Propiedad', width: '24%' },
        { header: 'Propietario', width: '18%' },
        { header: 'Teléfono', width: '14%' },
        { header: 'Atraso', width: '10%', align: 'center' },
        { header: 'Deuda total', width: '14%', align: 'right' },
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
    if (real) {
      // Prod: filas desde los pagos CONCILIADO reales (fecha en que pagó,
      // método real, monto realmente cobrado — incluye parciales). Antes salía
      // del contrato: método 'Transferencia' hardcodeado, monto = canon (no lo
      // cobrado) y fecha = PRÓXIMO vencimiento → el respaldo mentía.
      if (conciliadosCargando || conciliadosError) {
        // Con la query caída/pendiente el PDF saldría vacío ('Total $0') como
        // si el mes no hubiera cobrado nada.
        toast({
          title: 'No pudimos cargar los cobros',
          description: conciliadosError ? 'Reintentá en unos segundos.' : 'Todavía están cargando — probá de nuevo.',
          variant: 'destructive',
        });
        return;
      }
      const periodo = periodoActualFormat();
      // "Del mes" = cobrados ESTE mes (fecha del pago), no liquidaciones de
      // este período: un cobro de deuda vieja conciliado hoy es plata que entró
      // hoy y antes no aparecía en ningún reporte. El período de cada pago va
      // como columna. Y afuera los PROPIETARIO_DIRECTO (LOCKED: esa plata va
      // del inquilino al dueño, no es ingreso de la inmo — sumarla descuadraba
      // contra el KPI Cobrado y contra caja).
      const delMes = pagosConciliados.filter(
        (p) => (p.fechaTransferencia ?? '').slice(0, 7) === periodo && p.modoCobranza !== 'PROPIETARIO_DIRECTO',
      );
      const filasReales: (string | number)[][] = delMes.map((p) => [
        p.inquilino,
        p.direccion,
        formatPeriodo(p.periodo),
        formatFecha(p.fechaTransferencia),
        metodoPagoLabel[p.metodo],
        formatMonto(p.monto),
      ]);
      const totalReal = delMes.reduce((acc, p) => acc + p.monto, 0);
      abrirReporteImprimible({
        titulo: 'Cobranzas del mes',
        subtitulo: `${formatPeriodo(periodo)} · ${delMes.length} pago${delMes.length === 1 ? '' : 's'} acreditado${delMes.length === 1 ? '' : 's'} en el mes`,
        inmobiliaria: sociedadPrincipal().razonSocial,
        columnas: [
          { header: 'Inquilino', width: '21%' },
          { header: 'Propiedad', width: '25%' },
          { header: 'Período', width: '12%' },
          { header: 'Fecha de pago', width: '14%' },
          { header: 'Método', width: '12%' },
          { header: 'Monto', width: '16%', align: 'right' },
        ],
        filas: filasReales,
        totales: [
          { label: 'Cantidad', valor: delMes.length.toString() },
          { label: 'Total cobrado', valor: formatMonto(totalReal) },
        ],
        notaFinal:
          'Este reporte detalla los pagos acreditados y conciliados durante el mes (por fecha de cobro; ' +
          'incluye cobros de períodos anteriores). No incluye contratos con cobranza directa al propietario. ' +
          'Sirve como respaldo para las rendiciones a propietarios.',
      });
      return;
    }
    const pagados = contratos.filter((c) => c.estadoPagoActual === 'PAGADO');
    const filas: (string | number)[][] = pagados.map((c) => [
      c.inquilino,
      c.direccion,
      formatFecha(c.proximoVencimiento),
      'Transferencia',
      formatMonto(c.monto, c.moneda),
    ]);
    abrirReporteImprimible({
      titulo: 'Cobranzas del mes',
      subtitulo: `${formatPeriodo(periodoActualFormat())} · ${pagados.length} pago${pagados.length === 1 ? '' : 's'} acreditado${pagados.length === 1 ? '' : 's'}`,
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
        <p className="text-sm text-muted-foreground">
          La plata del mes: quién pagó, quién debe y los pagos a validar. Las
          autorizaciones que carga tu equipo van en{' '}
          <span className="font-medium text-foreground">Aprobaciones</span>.
        </p>
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

        {/* Paneles de conciliación todavía sobre datos demo (cargos
            USO_Y_GOCE, morosos con contactos, alertas de servicios). Se
            muestran solo en el build demo; en producción se ocultan hasta
            cablearlos al API para no mezclar data ficticia con la real. */}
        {!real && (
          <>
            <CargosACobrar />
            <MorososPanel inmobiliaria={sociedadPrincipal().nombreComercial} />
            <AlertasServiciosCard />
          </>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Liquidaciones — {formatPeriodo(periodoActualFormat())}</h2>
          <div className="flex flex-wrap gap-2">
            {!real && (
              <>
                <Button
                  size="sm"
                  className="gap-1 bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={() => setValidadorOpen(true)}
                >
                  <ShieldCheck className="h-4 w-4" />
                  Validar por resumen
                </Button>
                <CargarPagoManualButton />
              </>
            )}
            {real && (
              <>
                <Button size="sm" className="gap-1 bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setValidadorOpen(true)}>
                  <ShieldCheck className="h-4 w-4" />
                  Validar por resumen
                </Button>
                {/* Registrar un cobro que no pasó por la app: efectivo en la
                    oficina o "el dueño confirmó que cobró" (PROPIETARIO_DIRECTO).
                    Sin esto los contratos directos quedaban VENCIDO acumulando
                    mora para siempre. El dialog cablea POST /pagos/manual. */}
                <CargarPagoManualButton />
              </>
            )}
            {real && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                disabled={devengando}
                onClick={async () => {
                  setDevengando(true);
                  try {
                    const r = await devengar();
                    toast({
                      title:
                        r.liquidacionesNuevas > 0
                          ? `Se generaron ${r.liquidacionesNuevas} liquidación${r.liquidacionesNuevas === 1 ? '' : 'es'}`
                          : 'Todo al día',
                      description:
                        r.liquidacionesNuevas > 0
                          ? `Completé los períodos que faltaban en ${r.contratosProcesados} contrato${r.contratosProcesados === 1 ? '' : 's'} activo${r.contratosProcesados === 1 ? '' : 's'}.`
                          : `No faltaba ningún período en los ${r.contratosProcesados} contratos activos.`,
                    });
                  } catch (e) {
                    toast({
                      variant: 'destructive',
                      title: 'No se pudieron generar',
                      description: e instanceof Error ? e.message : 'Reintentá en un momento.',
                    });
                  } finally {
                    setDevengando(false);
                  }
                }}
              >
                <RefreshCw className={cn('h-4 w-4', devengando && 'animate-spin')} />
                {devengando ? 'Generando…' : 'Generar liquidaciones'}
              </Button>
            )}
            {/* Antes eran 3 botones PDF consecutivos ("PDF de
                morosos", "PDF morosos por sociedad", "PDF cobranzas")
                que saturaban la fila y obligaban a leer cada uno para
                decidir. Consolidado en un dropdown con las 3 opciones
                bajo "Exportar PDF ▾". */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4" />
                  Exportar PDF
                  <ChevronDown className="h-3 w-3 opacity-70" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => exportarMorososPdf()}>
                  Morosos del mes
                </DropdownMenuItem>
                {!real && (
                  <DropdownMenuItem onClick={() => exportarMorososPorSociedadPdf()}>
                    Morosos agrupados por sociedad
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => exportarCobradoPdf()}>
                  Cobranzas del mes
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                real
                  ? toast({
                      title: 'Próximamente',
                      description:
                        'El recordatorio automático a morosos por WhatsApp y mail todavía no está disponible.',
                    })
                  : toast({
                      title: 'Recordatorios simulados',
                      description:
                        'En producción se envían WhatsApp y mail a los inquilinos con pagos vencidos. En la demo no se manda nada.',
                    })
              }
            >
              <Bell className="h-4 w-4" />
              Recordar a morosos
            </Button>
          </div>
        </div>

        {/* 5 botones grandes de filtro, ocupan de punta a punta */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {FILTROS.map((f) => {
            const Icon = f.icon;
            const activo = filtro === f.key;
            const count = counters[f.key];
            // Con la query de pagos informados caída el count de "A resolver"
            // es un 0 FALSO (query error, no bandeja vacía) → mostramos '—'.
            const conError = f.key === 'A_RESOLVER' && aResolverError;
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
                      {conError ? 'sin conexión' : `${count} contrato${count === 1 ? '' : 's'}`}
                    </p>
                  </div>
                </div>
                <span
                  className={cn(
                    'text-3xl font-bold tabular-nums',
                    activo ? 'text-white' : '',
                  )}
                >
                  {conError ? '—' : count}
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
              type="button"
              onClick={() => setFiltro('TODOS')}
              className="font-medium text-primary hover:underline"
            >
              Mostrar todos
            </button>
          </div>
        )}

        {/* Vista "A resolver": comprobantes informados pendientes de tu OK.
            Se resuelve en este mismo lugar (sin cards sueltas arriba).
            PagosPorValidar internamente usa el API en prod y el mock en demo;
            su onChange refleja el conteo real (y solo lo sobreescribimos en
            demo: en prod el contador ya es reactivo vía useAResolverCount). */}
        {filtro === 'A_RESOLVER' ? (
          <PagosPorValidar
            onChange={(pendientes) => {
              if (!aResolverDeApi) setAResolverCount(pendientes);
            }}
          />
        ) : /* Mobile: lista de cards. Desktop (md+): tabla.
            En mobile la tabla se cortaba horizontalmente. Las cards muestran
            la misma info verticalmente y son tap-friendly. */
        filtradas.length === 0 ? (
          <Card>
            <div className="py-10 text-center text-sm text-muted-foreground">
              {filtro === 'TODOS'
                ? 'No hay contratos para mostrar en este momento.'
                : `No hay contratos ${estadoLabelPlural[filtro as EstadoLiquidacion]} en este momento.`}
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
                          {formatFechaCorta(c.proximoVencimiento)}
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
                    <TableHead><span className="sr-only">Acciones</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtradas.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.inquilino}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{c.direccion}</TableCell>
                      <TableCell className="text-sm">{formatFechaCorta(c.proximoVencimiento)}</TableCell>
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

      {/* Dialog "Validar por resumen": el inmo sube el extracto del banco y
          conciliamos contra los pagos/liquidaciones reales. En demo sigue
          siendo la simulación (PDF/imagen, matching sintético); en prod es
          el parseo real de CSV/Excel (ver ValidadorResumenApiDialog). */}
      {!real && (
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
      )}
      {real && <ValidadorResumenApiDialog open={validadorOpen} onOpenChange={setValidadorOpen} />}
    </>
  );
}

