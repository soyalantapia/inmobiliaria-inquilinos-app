'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { notFound, useParams } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  Clock,
  FileText,
  Flag,
  Landmark,
  Mail,
  MessageCircle,
  MessageSquare,
  Pencil,
  Phone,
  Send,
  ShieldCheck,
  TrendingUp,
  User,
  Wrench,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@llave/ui/card';
import { cn } from '@llave/ui/cn';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@llave/ui/tabs';
import { toast } from '@llave/ui/use-toast';
import { ContratoDocumentosPanel } from '@/components/contrato-documentos-panel';
import { MensajeInquilinoDialog } from '@/components/mensaje-inquilino-dialog';
import { ScoringInquilinoCard } from '@/components/scoring-inquilino-card';
import { Topbar } from '@/components/topbar';
import { FinalizarContratoButton } from '@/components/finalizar-contrato-button';
import { calcularScoringInquilino, type ResumenScoring } from '@/lib/scoring-inquilino';
import { registrarEvento } from '@/lib/auditoria-storage';
import { apiEnabled } from '@/lib/api/client';
import { useContrato } from '@/lib/api/use-contrato';
import {
  type CanalComunicacion,
  type LiquidacionAdmin,
  type TipoEventoContrato,
} from '@/lib/mock-data';
import type { ContratoListado, EstadoContrato, Propietario } from '@/lib/types';
import { formatFecha, formatMonto } from '@/lib/format';

const estadoLiqVariant: Record<
  LiquidacionAdmin['estado'],
  React.ComponentProps<typeof Badge>['variant']
> = {
  PAGADO: 'success',
  PENDIENTE: 'warning',
  VENCIDO: 'destructive',
  // Parcial: cobrado en parte. Sin esta key, al mapear liquidaciones reales con
  // estado PARCIAL el Badge quedaba sin variant (undefined).
  PARCIAL: 'warning',
};

// Estado del contrato → color del badge. Antes estaba hardcodeado 'success'
// (siempre verde): un BORRADOR/FINALIZADO/RESCINDIDO se veía como ACTIVO.
const estadoContratoVariant: Record<EstadoContrato, React.ComponentProps<typeof Badge>['variant']> = {
  ACTIVO: 'success',
  BORRADOR: 'warning',
  FINALIZADO: 'secondary',
  RESCINDIDO: 'destructive',
};

const eventoIcono: Record<TipoEventoContrato, LucideIcon> = {
  CREADO: Flag,
  AJUSTE_APLICADO: TrendingUp,
  PAGO_RECIBIDO: CheckCircle2,
  PAGO_VENCIDO: Clock,
  RECLAMO_CREADO: Wrench,
  COMUNICACION_ENVIADA: MessageSquare,
  GARANTE_RENOVADO: FileText,
  INTENCION_RENOVACION: Flag,
};

// Verde (emerald) = OK/pago, rojo = vencido/mora, ámbar = aviso garante; el
// resto va a la marca (primary, violeta) vía token en vez de colores sueltos.
const eventoColor: Record<TipoEventoContrato, string> = {
  CREADO: 'bg-emerald-500',
  AJUSTE_APLICADO: 'bg-primary',
  PAGO_RECIBIDO: 'bg-emerald-500',
  PAGO_VENCIDO: 'bg-red-500',
  RECLAMO_CREADO: 'bg-primary',
  COMUNICACION_ENVIADA: 'bg-muted',
  GARANTE_RENOVADO: 'bg-amber-500',
  INTENCION_RENOVACION: 'bg-primary',
};

const canalIcono: Record<CanalComunicacion, LucideIcon> = {
  WHATSAPP: MessageCircle,
  EMAIL: Mail,
  LLAMADA: Phone,
};

export default function DetalleContratoPage() {
  const params = useParams<{ id: string }>();
  const { detalle, cargando, noEncontrado } = useContrato(params.id);

  // En build demo (!apiEnabled) el id inexistente da 404 sin tirar request:
  // mantenemos el comportamiento original de notFound().
  if (!apiEnabled && noEncontrado) notFound();

  const [abrirMensaje, setAbrirMensaje] = useState(false);

  const c = detalle?.contrato ?? null;
  const contacto = detalle?.contacto ?? null;

  // Scoring calculado sólo en cliente para evitar hydration mismatch:
  // calcularAntiguedad() usa Date.now() que difiere entre SSR y CSR.
  const [scoring, setScoring] = useState<ResumenScoring | null>(null);
  useEffect(() => {
    // El scoring del inquilino es fabricado (calcularScoringInquilino) sin
    // fuente real. En prod no lo mostramos: dejamos scoring en null y la
    // ScoringInquilinoCard no se renderiza.
    if (apiEnabled) return;
    setScoring(c ? calcularScoringInquilino(c) : null);
  }, [c?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (cargando) {
    return (
      <>
        <Topbar titulo="Contrato" />
        <main className="flex-1 space-y-6 p-4 md:p-6">
          <div className="h-4 w-40 animate-pulse rounded bg-muted" />
          <div className="h-8 w-2/3 animate-pulse rounded bg-muted" />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="h-56 animate-pulse rounded-lg bg-muted" />
            <div className="h-56 animate-pulse rounded-lg bg-muted" />
          </div>
        </main>
      </>
    );
  }

  if (!detalle || !c) {
    return (
      <>
        <Topbar titulo="Contrato" />
        <main className="flex-1 space-y-4 p-4 md:p-6">
          <Link
            href="/contratos"
            className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" />
            Volver a contratos
          </Link>
          <Card>
            <CardContent className="p-10 text-center">
              <FileText className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">No encontramos este contrato.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Puede que se haya eliminado o que no tengas acceso.
              </p>
            </CardContent>
          </Card>
        </main>
      </>
    );
  }

  const liquidaciones = detalle.liquidaciones;
  const eventosDelContrato = detalle.eventos;
  const comunicaciones = detalle.comunicaciones;

  return (
    <>
      <Topbar titulo="Contrato" />
      <main className="flex-1 space-y-6 p-4 md:p-6">
        {/* Card de aprobación: aparece cuando el contrato lo cargó un usuario
            con rol CARGA y todavía no fue aprobado por un ADMIN. */}
        {c.pendienteAprobacion && (
          <AprobacionContratoCard
            contratoId={c.id}
            cargadoPor={c.cargadoPor ?? 'Usuario desconocido'}
            cargadoAt={c.cargadoAt ?? ''}
            inquilino={c.inquilino}
          />
        )}

        <ModoCobranzaCard contrato={c} propietarioDirecto={detalle.propietarioDirecto} />

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <Link
              href="/contratos"
              className="mb-2 inline-flex items-center text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3 w-3" />
              Volver a contratos
            </Link>
            <h2 className="line-clamp-2 text-xl font-semibold leading-tight">{c.inquilino}</h2>
            <p className="line-clamp-2 text-sm text-muted-foreground">{c.direccion}</p>
          </div>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <Button
              variant="outline"
              className="flex-1 sm:flex-none"
              onClick={() => setAbrirMensaje(true)}
            >
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">Mensaje al inquilino</span>
              <span className="sm:hidden">Mensaje</span>
            </Button>
            {apiEnabled ? (
              <Button className="flex-1 sm:flex-none" disabled title="Próximamente">
                <Pencil className="h-4 w-4" />
                Editar
              </Button>
            ) : (
              <Button
                className="flex-1 sm:flex-none"
                onClick={() => toast({ title: 'Editor de contrato en construcción' })}
              >
                <Pencil className="h-4 w-4" />
                Editar
              </Button>
            )}
            {apiEnabled && c.estado === 'ACTIVO' && (
              <FinalizarContratoButton contratoId={c.id} direccion={c.direccion} />
            )}
          </div>
        </div>

        <Tabs defaultValue="resumen">
          <TabsList className="flex w-full flex-wrap justify-start gap-1 sm:w-auto sm:gap-0">
            <TabsTrigger value="resumen">Resumen</TabsTrigger>
            <TabsTrigger value="pagos">
              Pagos
              <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">
                {liquidaciones.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="historial">Historial</TabsTrigger>
            <TabsTrigger value="comunicaciones">
              Comunicaciones
              <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[10px]">
                {comunicaciones.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="documentos">Documentos</TabsTrigger>
          </TabsList>

          <TabsContent value="resumen" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Datos del contrato
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <Row
                    label="Estado"
                    value={
                      <Badge variant={estadoContratoVariant[c.estado] ?? 'secondary'}>
                        {c.estado.charAt(0) + c.estado.slice(1).toLowerCase()}
                      </Badge>
                    }
                  />
                  <Row
                    label="Tipo de contrato"
                    value={
                      <Badge variant="outline">
                        {c.tipoContrato === 'SOLO_EXPENSAS'
                          ? 'Sólo expensas'
                          : c.tipoContrato === 'ALQUILER'
                            ? 'Sólo alquiler'
                            : 'Alquiler + expensas'}
                      </Badge>
                    }
                  />
                  <Row label="Vigencia" value={`${formatFecha(c.fechaInicio)} → ${formatFecha(c.fechaFin)}`} />
                  {c.tipoContrato !== 'SOLO_EXPENSAS' && (
                    <Row label="Alquiler" value={formatMonto(c.monto, c.moneda)} bold />
                  )}
                  {(c.montoExpensas ?? 0) > 0 && (
                    <Row
                      label="Expensas"
                      value={formatMonto(c.montoExpensas!, c.moneda)}
                      bold={c.tipoContrato === 'SOLO_EXPENSAS'}
                    />
                  )}
                  <Row label="Próximo vencimiento" value={formatFecha(c.proximoVencimiento)} />
                  {c.tipoContrato !== 'SOLO_EXPENSAS' && (
                    <>
                      <Row
                        label="Índice de ajuste"
                        value={apiEnabled ? c.indiceAjuste ?? '—' : 'ICL — BCRA'}
                      />
                      <Row
                        label="Frecuencia ajuste"
                        value={
                          apiEnabled
                            ? c.frecuenciaAjusteMeses != null
                              ? `${c.frecuenciaAjusteMeses} meses`
                              : '—'
                            : '12 meses'
                        }
                      />
                    </>
                  )}
                  {c.cbuAlias && (
                    <>
                      <Row
                        label="CBU/Alias específico"
                        value={<span className="font-mono">{c.cbuAlias}</span>}
                      />
                      {c.titularCuenta && (
                        <Row label="Titular de la cuenta" value={c.titularCuenta} />
                      )}
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Inquilino
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {/* WhatsApp/Email/Garante salen del contacto real resuelto por
                      contratoId (API en prod, mock en demo). Antes eran strings
                      hardcoded idénticos para todos los contratos. */}
                  <Row label="Nombre" value={c.inquilino} />
                  <Row label="WhatsApp" value={contacto?.titular.telefono ?? '—'} />
                  <Row label="Email" value={contacto?.titular.email ?? '—'} />
                  <Row
                    label="Garante"
                    value={
                      contacto?.garante
                        ? `${contacto.garante.nombre} · ${contacto.garante.tipo}`
                        : 'Sin garante registrado'
                    }
                  />
                </CardContent>
              </Card>
            </div>

            {scoring && <ScoringInquilinoCard scoring={scoring} />}
          </TabsContent>

          {/* PAGOS */}
          <TabsContent value="pagos" className="space-y-4">
            <ResumenPagos liquidaciones={liquidaciones} />
            <Card>
              <CardContent className="p-0">
                <div className="divide-y">
                  {liquidaciones.map((l) => (
                    <LiquidacionRow key={l.id} liq={l} />
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* HISTORIAL */}
          <TabsContent value="historial" className="space-y-4">
            <Card>
              <CardContent className="space-y-0 p-6">
                {eventosDelContrato.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Sin eventos registrados todavía.
                  </p>
                ) : (
                  <ol role="list" className="space-y-0">
                    {[...eventosDelContrato]
                      .sort((a, b) => b.fecha.localeCompare(a.fecha))
                      .map((ev, i, arr) => (
                        <EventoTimelineRow
                          key={ev.id}
                          evento={ev}
                          esUltimo={i === arr.length - 1}
                        />
                      ))}
                  </ol>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* COMUNICACIONES */}
          <TabsContent value="comunicaciones" className="space-y-4">
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setAbrirMensaje(true)}>
                <Send className="h-3.5 w-3.5" />
                Nuevo mensaje
              </Button>
            </div>
            <Card>
              <CardContent className="p-0">
                {comunicaciones.length === 0 ? (
                  <p className="p-8 text-center text-sm text-muted-foreground">
                    No hay comunicaciones registradas con este inquilino.
                  </p>
                ) : (
                  <div className="divide-y">
                    {[...comunicaciones]
                      .sort((a, b) => b.fecha.localeCompare(a.fecha))
                      .map((cm) => (
                        <ComunicacionRow key={cm.id} comunicacion={cm} />
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="documentos" className="space-y-2">
            {/* El panel de documentos sube/elimina archivos en localStorage
                (contrato-documentos-storage), sin endpoint todavía. En modo API
                lo deshabilitamos para no escribir estado fantasma en prod. */}
            {apiEnabled ? (
              <Card>
                <CardContent className="p-10 text-center">
                  <FileText className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                  <p className="text-sm font-medium">Gestión de documentos próximamente</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    La carga y descarga de documentos del expediente estará disponible
                    en breve.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <ContratoDocumentosPanel contrato={c} />
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* El contacto real (titular tel/email) se resuelve por contratoId desde
          el API en prod o el mock en demo. Antes iban hardcoded e idénticos para
          todos los contratos. */}
      <MensajeInquilinoDialog
        open={abrirMensaje}
        onOpenChange={setAbrirMensaje}
        inquilino={{
          nombre: c.inquilino,
          telefono: contacto?.titular.telefono ?? '',
          email: contacto?.titular.email ?? '',
        }}
        direccion={c.direccion}
        fechaFin={formatFecha(c.fechaFin)}
      />
    </>
  );
}

function ResumenPagos({ liquidaciones }: { liquidaciones: LiquidacionAdmin[] }) {
  const pagados = liquidaciones.filter((l) => l.estado === 'PAGADO').length;
  const vencidos = liquidaciones.filter((l) => l.estado === 'VENCIDO').length;
  // Total cobrado = montoTotal de las PAGADAS + lo conciliado de las PARCIALES.
  // Antes sólo sumaba PAGADO → lo cobrado en un parcial no aparecía (bug 3/4).
  const totalCobrado = liquidaciones.reduce(
    (acc, l) => acc + (l.estado === 'PAGADO' ? l.montoTotal : l.estado === 'PARCIAL' ? l.montoPagado ?? 0 : 0),
    0,
  );

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <StatCard label="Liquidaciones" value={liquidaciones.length} />
      <StatCard label="Pagadas" value={pagados} tone="emerald" />
      <StatCard label="Vencidas" value={vencidos} tone={vencidos > 0 ? 'red' : 'muted'} />
      <StatCard label="Total cobrado" value={formatMonto(totalCobrado)} />
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: 'emerald' | 'red' | 'muted';
}) {
  return (
    <Card className="p-4">
      <p
        className={cn(
          'text-xl font-semibold tabular-nums md:text-2xl',
          tone === 'emerald' && 'text-emerald-600',
          tone === 'red' && 'text-destructive',
          tone === 'muted' && 'text-muted-foreground',
        )}
      >
        {value}
      </p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </Card>
  );
}

function LiquidacionRow({ liq }: { liq: LiquidacionAdmin }) {
  return (
    <div className="flex items-center gap-3 p-4">
      <div className="flex shrink-0 flex-col items-center">
        <span className="text-xs uppercase text-muted-foreground">
          {new Date(Number(liq.periodo.split('-')[0]), Number(liq.periodo.split('-')[1]) - 1, 1).toLocaleDateString('es-AR', { month: 'short' })}
        </span>
        <span className="text-lg font-semibold tabular-nums">
          {liq.periodo.split('-')[0]}
        </span>
      </div>
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium">
            {liq.montoExpensas != null && liq.montoExpensas > 0 && liq.montoAlquiler > 0
              ? `Alquiler ${formatMonto(liq.montoAlquiler)} + Expensas ${formatMonto(liq.montoExpensas)}`
              : liq.montoAlquiler === 0 && liq.montoExpensas != null && liq.montoExpensas > 0
                ? `Expensas ${formatMonto(liq.montoExpensas)}`
                : `Alquiler ${formatMonto(liq.montoAlquiler)}`}
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Vence {formatFecha(liq.fechaVencimiento)}
          {liq.fechaPago && ` · Pagado ${formatFecha(liq.fechaPago)}`}
          {liq.metodoPago && ` · ${liq.metodoPago.toLowerCase()}`}
        </p>
        {/* Parcial: mostramos lo cobrado y el saldo restante — antes el detalle
            no reflejaba que ya se había cobrado una parte (bug 4). */}
        {liq.estado === 'PARCIAL' && (liq.montoPagado ?? 0) > 0 && (
          <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
            Cobrado {formatMonto(liq.montoPagado ?? 0)} · Falta {formatMonto(liq.saldo ?? liq.montoTotal)}
          </p>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <p className="text-sm font-semibold tabular-nums">{formatMonto(liq.montoTotal)}</p>
        <Badge variant={estadoLiqVariant[liq.estado]} className="text-[10px]">
          {liq.estado.charAt(0) + liq.estado.slice(1).toLowerCase()}
        </Badge>
      </div>
    </div>
  );
}

function EventoTimelineRow({
  evento,
  esUltimo,
}: {
  evento: { tipo: TipoEventoContrato; titulo: string; detalle: string | null; fecha: string; autor: string };
  esUltimo: boolean;
}) {
  const Icon = eventoIcono[evento.tipo];
  return (
    <li className="relative flex gap-4">
      {!esUltimo && (
        <span
          aria-hidden
          className="absolute left-[19px] top-10 h-[calc(100%-32px)] w-0.5 bg-border"
        />
      )}
      <div
        className={cn(
          'relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-full text-white',
          eventoColor[evento.tipo],
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0 pb-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-medium">{evento.titulo}</p>
          <p className="text-[11px] tabular-nums text-muted-foreground">
            {formatFecha(evento.fecha)} · {new Date(evento.fecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        {evento.detalle && (
          <p className="mt-0.5 text-xs text-muted-foreground">{evento.detalle}</p>
        )}
        <p className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground/70">
          {evento.autor}
        </p>
      </div>
    </li>
  );
}

function ComunicacionRow({
  comunicacion,
}: {
  comunicacion: {
    canal: CanalComunicacion;
    direccion: 'SALIENTE' | 'ENTRANTE';
    asunto: string;
    preview: string;
    fecha: string;
    autor: string;
    leida: boolean;
  };
}) {
  const Icon = canalIcono[comunicacion.canal];
  return (
    <div className="flex items-start gap-3 p-4">
      <div
        className={cn(
          'grid h-9 w-9 shrink-0 place-items-center rounded-md',
          comunicacion.direccion === 'SALIENTE'
            ? 'bg-primary/10 text-primary'
            : 'bg-muted text-muted-foreground',
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium">{comunicacion.asunto}</p>
          <Badge variant="outline" className="shrink-0 text-[10px]">
            {comunicacion.direccion === 'SALIENTE' ? 'Enviado' : 'Recibido'}
          </Badge>
          {!comunicacion.leida && comunicacion.direccion === 'SALIENTE' && (
            <Badge variant="warning" className="shrink-0 text-[10px]">
              Sin leer
            </Badge>
          )}
        </div>
        <p className="line-clamp-2 text-xs text-muted-foreground">{comunicacion.preview}</p>
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
          {formatFecha(comunicacion.fecha)} ·{' '}
          {new Date(comunicacion.fecha).toLocaleTimeString('es-AR', {
            hour: '2-digit',
            minute: '2-digit',
          })}{' '}
          · {comunicacion.autor}
        </p>
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: React.ReactNode; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={bold ? 'font-semibold' : ''}>{value}</span>
    </div>
  );
}

function AprobacionContratoCard({
  contratoId,
  cargadoPor,
  cargadoAt,
  inquilino,
}: {
  contratoId: string;
  cargadoPor: string;
  cargadoAt: string;
  inquilino: string;
}) {
  const [resuelto, setResuelto] = useState<'APROBADO' | 'RECHAZADO' | null>(null);

  if (resuelto === 'APROBADO') {
    return (
      <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/30">
        <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4" />
          <span className="font-medium">
            Contrato aprobado. Pasa a estado Activo y se le notifica al inquilino.
          </span>
        </div>
      </div>
    );
  }

  if (resuelto === 'RECHAZADO') {
    return (
      <div className="rounded-lg border border-red-300 bg-red-50 p-4 dark:border-red-900/40 dark:bg-red-950/30">
        <div className="flex items-center gap-2 text-sm text-red-700 dark:text-red-300">
          <XCircle className="h-4 w-4" />
          <span className="font-medium">
            Contrato rechazado. {cargadoPor} ya recibió la notificación.
          </span>
        </div>
      </div>
    );
  }

  const handleAprobar = () => {
    // Acá registramos en auditoría — el evento queda visible en /configuracion.
    registrarEvento({
      tipo: 'CONTRATO_APROBADO',
      autor: 'Roberto Tapia',
      rolAutor: 'ADMIN',
      entidadId: contratoId,
      entidadDescripcion: `Contrato ${contratoId} · ${inquilino}`,
      detalle: `Revisión OK. Activado el ${new Date().toLocaleDateString('es-AR')}.`,
    });
    setResuelto('APROBADO');
    toast({
      title: 'Contrato aprobado',
      description: `${inquilino} pasa a Activo. Se notifica al inquilino y a ${cargadoPor}.`,
    });
  };

  const handleRechazar = () => {
    registrarEvento({
      tipo: 'CONTRATO_RECHAZADO',
      autor: 'Roberto Tapia',
      rolAutor: 'ADMIN',
      entidadId: contratoId,
      entidadDescripcion: `Contrato ${contratoId} · ${inquilino}`,
      detalle: `Cargado por ${cargadoPor} · rechazado por el admin`,
    });
    setResuelto('RECHAZADO');
    toast({
      title: 'Contrato rechazado',
      description: `Avísale a ${cargadoPor} qué corregir.`,
    });
  };

  return (
    <Card className="border-amber-300 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/30">
      <CardContent className="space-y-3 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-700 dark:text-amber-300" />
            <div>
              <h3 className="text-sm font-semibold">Pendiente de aprobación</h3>
              <p className="text-xs text-muted-foreground">
                Cargado por <strong>{cargadoPor}</strong>
                {cargadoAt && ` · ${formatFecha(cargadoAt)}`}
              </p>
            </div>
          </div>
          <Badge variant="warning">Borrador</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Revisá los datos en el resumen y los documentos. Si está todo en orden,
          aprobalo para que pase a ACTIVO y empiece a facturar.
        </p>
        {/* Aprobar/Rechazar registran en auditoría local (registrarEvento) sin
            endpoint todavía. En modo API los deshabilitamos para no escribir
            estado fantasma en prod. */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={handleRechazar}
            disabled={apiEnabled}
            title={apiEnabled ? 'Próximamente' : undefined}
          >
            <XCircle className="h-4 w-4" />
            Rechazar
          </Button>
          <Button
            onClick={handleAprobar}
            disabled={apiEnabled}
            title={apiEnabled ? 'Próximamente' : undefined}
          >
            <ShieldCheck className="h-4 w-4" />
            Aprobar contrato
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// MODO DE COBRANZA
// ============================================================
// Permite elegir si el alquiler se cobra a la cuenta recaudadora de la
// inmobiliaria (default) o si el inquilino deposita directo al propietario
// y la inmo sólo audita. Se puede cambiar en cualquier momento — queda
// registrado en auditoría.
function ModoCobranzaCard({
  contrato,
  propietarioDirecto,
}: {
  contrato: ContratoListado;
  propietarioDirecto: Propietario | null;
}) {
  const inicial: 'INMOBILIARIA' | 'PROPIETARIO_DIRECTO' =
    contrato.modoCobranza ?? 'INMOBILIARIA';
  const [modo, setModo] = useState<'INMOBILIARIA' | 'PROPIETARIO_DIRECTO'>(inicial);

  function cambiarA(nuevo: 'INMOBILIARIA' | 'PROPIETARIO_DIRECTO') {
    if (nuevo === modo) return;
    // Sin endpoint PATCH del modo de cobranza todavía: en modo API esto sólo
    // escribiría auditoría local fantasma. Lo bloqueamos en prod.
    if (apiEnabled) {
      toast({ title: 'Cambiar el modo de cobranza estará disponible próximamente.' });
      return;
    }
    if (nuevo === 'PROPIETARIO_DIRECTO' && !propietarioDirecto?.cuentaCobranza) {
      toast({
        title: 'Cargá la cuenta del propietario primero',
        description: 'Para cobrar directo necesitás el CBU del propietario.',
        variant: 'destructive',
      });
      return;
    }
    setModo(nuevo);
    registrarEvento({
      tipo: 'MODO_COBRANZA_CAMBIADO',
      autor: 'Roberto Tapia',
      rolAutor: 'ADMIN',
      entidadId: contrato.id,
      entidadDescripcion: `Contrato · ${contrato.inquilino}`,
      detalle: `Cambiado a ${nuevo === 'INMOBILIARIA' ? 'cobranza por inmobiliaria' : 'cobranza directa al propietario'}`,
    });
    toast({
      title: 'Modo de cobranza actualizado',
      description:
        nuevo === 'INMOBILIARIA'
          ? 'El inquilino transfiere a la cuenta recaudadora.'
          : `El inquilino transfiere directo a ${propietarioDirecto?.nombre} ${propietarioDirecto?.apellido}.`,
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <Landmark className="h-4 w-4" />
          Modo de cobranza
        </CardTitle>
        <Badge variant={modo === 'INMOBILIARIA' ? 'secondary' : 'success'}>
          {modo === 'INMOBILIARIA' ? 'Por inmobiliaria' : 'Directa al propietario'}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <button
            type="button"
            onClick={() => cambiarA('INMOBILIARIA')}
            disabled={apiEnabled && modo !== 'INMOBILIARIA'}
            title={apiEnabled ? 'Próximamente' : undefined}
            className={cn(
              'flex flex-col gap-2 rounded-lg border p-3 text-left transition-all disabled:cursor-not-allowed',
              modo === 'INMOBILIARIA'
                ? 'border-primary bg-primary/5 ring-1 ring-primary'
                : 'hover:bg-muted/40',
            )}
          >
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">Cuenta recaudadora</span>
              {modo === 'INMOBILIARIA' && (
                <CheckCircle2 className="ml-auto h-4 w-4 text-primary" />
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              El inquilino transfiere a la cuenta de la inmobiliaria (tipo Banco
              Roela / Consorcio Abierto). La inmo después rinde al propietario.
            </p>
          </button>

          <button
            type="button"
            onClick={() => cambiarA('PROPIETARIO_DIRECTO')}
            disabled={apiEnabled && modo !== 'PROPIETARIO_DIRECTO'}
            title={apiEnabled ? 'Próximamente' : undefined}
            className={cn(
              'flex flex-col gap-2 rounded-lg border p-3 text-left transition-all disabled:cursor-not-allowed',
              modo === 'PROPIETARIO_DIRECTO'
                ? 'border-primary bg-primary/5 ring-1 ring-primary'
                : 'hover:bg-muted/40',
            )}
          >
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">Directo al propietario</span>
              {modo === 'PROPIETARIO_DIRECTO' && (
                <CheckCircle2 className="ml-auto h-4 w-4 text-primary" />
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              El inquilino deposita directo al CBU del propietario. Sube el
              comprobante y el propietario confirma recepción.
            </p>
          </button>
        </div>

        {modo === 'PROPIETARIO_DIRECTO' && propietarioDirecto?.cuentaCobranza && (
          <div className="space-y-2 rounded-md border bg-muted/30 p-3 text-xs">
            <p className="text-muted-foreground">
              Cuenta de destino — <strong className="text-foreground">{propietarioDirecto.nombre}{' '}
              {propietarioDirecto.apellido}</strong>
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-muted-foreground">Banco</p>
                <p className="font-medium">{propietarioDirecto.cuentaCobranza.banco}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Titular</p>
                <p className="font-medium">{propietarioDirecto.cuentaCobranza.titular}</p>
              </div>
              <div className="col-span-2">
                <p className="text-muted-foreground">CBU</p>
                <p className="font-mono font-medium">{propietarioDirecto.cuentaCobranza.cbu}</p>
              </div>
              <div className="col-span-2">
                <p className="text-muted-foreground">Alias</p>
                <p className="font-mono font-medium">{propietarioDirecto.cuentaCobranza.alias}</p>
              </div>
            </div>
          </div>
        )}

        {modo === 'PROPIETARIO_DIRECTO' && !propietarioDirecto?.cuentaCobranza && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/10 dark:text-amber-200">
            Falta cargar la cuenta del propietario para poder cobrar en modo directo.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

