'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { notFound, useParams } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Flag,
  Mail,
  MessageCircle,
  MessageSquare,
  Pencil,
  Phone,
  Send,
  TrendingUp,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@llave/ui/card';
import { cn } from '@llave/ui/cn';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@llave/ui/tabs';
import { toast } from '@llave/ui/use-toast';
import { MensajeInquilinoDialog } from '@/components/mensaje-inquilino-dialog';
import { Topbar } from '@/components/topbar';
import {
  type CanalComunicacion,
  type LiquidacionAdmin,
  type TipoEventoContrato,
  comunicacionesMock,
  contratosMock,
  eventosContratoMock,
  generarLiquidaciones,
} from '@/lib/mock-data';
import { formatFecha, formatMonto } from '@/lib/format';

const estadoLiqVariant: Record<
  LiquidacionAdmin['estado'],
  React.ComponentProps<typeof Badge>['variant']
> = {
  PAGADO: 'success',
  PENDIENTE: 'warning',
  VENCIDO: 'destructive',
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

const eventoColor: Record<TipoEventoContrato, string> = {
  CREADO: 'bg-emerald-500',
  AJUSTE_APLICADO: 'bg-primary',
  PAGO_RECIBIDO: 'bg-emerald-500',
  PAGO_VENCIDO: 'bg-red-500',
  RECLAMO_CREADO: 'bg-blue-500',
  COMUNICACION_ENVIADA: 'bg-muted',
  GARANTE_RENOVADO: 'bg-amber-500',
  INTENCION_RENOVACION: 'bg-purple-500',
};

const canalIcono: Record<CanalComunicacion, LucideIcon> = {
  WHATSAPP: MessageCircle,
  EMAIL: Mail,
  LLAMADA: Phone,
};

export default function DetalleContratoPage() {
  const params = useParams<{ id: string }>();
  const c = contratosMock.find((x) => x.id === params.id);
  if (!c) notFound();

  const [abrirMensaje, setAbrirMensaje] = useState(false);

  const liquidaciones = useMemo(
    () => generarLiquidaciones(c.id, c.monto),
    [c.id, c.monto],
  );
  const eventosDelContrato = useMemo(
    () => eventosContratoMock.filter((e) => e.contratoId === c.id),
    [c.id],
  );
  const comunicaciones = useMemo(
    () => comunicacionesMock.filter((cm) => cm.contratoId === c.id),
    [c.id],
  );

  return (
    <>
      <Topbar titulo="Contrato" />
      <main className="flex-1 space-y-6 p-4 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <Link
              href="/contratos"
              className="mb-2 inline-flex items-center text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3 w-3" />
              Volver a contratos
            </Link>
            <h2 className="truncate text-xl font-semibold">{c.inquilino}</h2>
            <p className="truncate text-sm text-muted-foreground">{c.direccion}</p>
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
            <Button
              className="flex-1 sm:flex-none"
              onClick={() => toast({ title: 'Editor de contrato en construcción' })}
            >
              <Pencil className="h-4 w-4" />
              Editar
            </Button>
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
                  <Row label="Estado" value={<Badge variant="success">{c.estado}</Badge>} />
                  <Row label="Vigencia" value={`${formatFecha(c.fechaInicio)} → ${formatFecha(c.fechaFin)}`} />
                  <Row label="Monto actual" value={formatMonto(c.monto, c.moneda)} bold />
                  <Row label="Próximo vencimiento" value={formatFecha(c.proximoVencimiento)} />
                  <Row label="Índice de ajuste" value="ICL — BCRA" />
                  <Row label="Frecuencia ajuste" value="12 meses" />
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
                  <Row label="Nombre" value={c.inquilino} />
                  <Row label="WhatsApp" value="+54 9 11 4567 8900" />
                  <Row label="Email" value="mariela.sosa@gmail.com" />
                  <Row label="Garante" value="Cobertura SUMA — póliza vigente" />
                </CardContent>
              </Card>
            </div>
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
                  <ol className="space-y-0">
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
            <Card>
              <CardContent className="space-y-3 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Contrato firmado.pdf</p>
                    <p className="text-xs text-muted-foreground">Subido el 28/08/2025 · 1.2 MB</p>
                  </div>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4" />
                    Descargar
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <MensajeInquilinoDialog
        open={abrirMensaje}
        onOpenChange={setAbrirMensaje}
        inquilino={{
          nombre: c.inquilino,
          telefono: '+54 9 11 4567 8900',
          email: 'mariela.sosa@gmail.com',
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
  const totalCobrado = liquidaciones
    .filter((l) => l.estado === 'PAGADO')
    .reduce((acc, l) => acc + l.montoTotal, 0);

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
            Alquiler {formatMonto(liq.montoAlquiler)} + Expensas {formatMonto(liq.montoExpensas)}
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Vence {formatFecha(liq.fechaVencimiento)}
          {liq.fechaPago && ` · Pagado ${formatFecha(liq.fechaPago)}`}
          {liq.metodoPago && ` · ${liq.metodoPago.toLowerCase()}`}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <p className="text-sm font-semibold tabular-nums">{formatMonto(liq.montoTotal)}</p>
        <Badge variant={estadoLiqVariant[liq.estado]} className="text-[10px]">
          {liq.estado}
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

