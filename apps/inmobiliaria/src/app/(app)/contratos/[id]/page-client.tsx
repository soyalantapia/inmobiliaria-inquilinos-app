'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { notFound, useParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@llave/ui/dialog';
import { Input } from '@llave/ui/input';
import { Label } from '@llave/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@llave/ui/tabs';
import { Textarea } from '@llave/ui/textarea';
import { toast } from '@llave/ui/use-toast';
import { ContratoDocumentosPanel } from '@/components/contrato-documentos-panel';
import { PinPromptDialog } from '@/components/pin-prompt-dialog';
import { DocumentosInquilinoPanel } from '@/components/documentos-inquilino-panel';
import { ContratoGarantesPanel } from '@/components/contrato-garantes-panel';
import { MensajeInquilinoDialog } from '@/components/mensaje-inquilino-dialog';
import { ScoringInquilinoCard } from '@/components/scoring-inquilino-card';
import { CargosContratoCard } from '@/components/cargos-contrato-card';
import { Topbar } from '@/components/topbar';
import { FinalizarContratoButton } from '@/components/finalizar-contrato-button';
import { AjustarAlquilerButton } from '@/components/ajustar-alquiler-button';
import { GananciaInmoCard } from '@/components/ganancia-inmo-card';
import { RenovarContratoButton } from '@/components/renovar-contrato-button';
import {
  descripcionMora,
  MoraSelector,
  type MoraSeleccion,
} from '@/components/mora-selector';
import { calcularScoringInquilino, type ResumenScoring } from '@/lib/scoring-inquilino';
import { registrarEvento } from '@/lib/auditoria-storage';
import { apiEnabled, apiFetch, ApiError } from '@/lib/api/client';
import { ensureApiSession } from '@/lib/api/session';
import { useCobranza } from '@/lib/api/hooks';
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
  const [abrirEditarMora, setAbrirEditarMora] = useState(false);
  const [abrirAjustarMonto, setAbrirAjustarMonto] = useState(false);

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
            {/* Ajustar el monto del alquiler (PATCH /contratos/:id/monto): re-devenga
                las liquidaciones futuras sin pagos. Solo prod (necesita endpoint +
                PIN); en demo queda deshabilitado con el mismo patrón que otras
                acciones solo-conectadas del panel. */}
            {apiEnabled ? (
              c.estado === 'ACTIVO' && (
                <Button
                  variant="outline"
                  className="flex-1 sm:flex-none"
                  onClick={() => setAbrirAjustarMonto(true)}
                >
                  <TrendingUp className="h-4 w-4" />
                  Ajustar monto
                </Button>
              )
            ) : (
              <Button
                variant="outline"
                className="flex-1 sm:flex-none"
                disabled
                title="Disponible en la versión conectada"
              >
                <TrendingUp className="h-4 w-4" />
                Ajustar monto
              </Button>
            )}
            {apiEnabled && c.estado === 'ACTIVO' && (
              <RenovarContratoButton contratoId={c.id} montoActual={c.monto} fechaFinActual={c.fechaFin} moneda={c.moneda} />
            )}
            {apiEnabled && c.estado === 'ACTIVO' && (
              <AjustarAlquilerButton contratoId={c.id} montoActual={c.monto} moneda={c.moneda} />
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
            <TabsTrigger value="garantes">Garantes</TabsTrigger>
          </TabsList>

          <TabsContent value="resumen" className="space-y-4">
            <GananciaInmoCard contratoId={c.id} moneda={c.moneda} />
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
                  {(c.depositoGarantia ?? 0) > 0 && (
                    <Row
                      label="Depósito de garantía"
                      value={`${formatMonto(c.depositoGarantia!, c.moneda)}${
                        c.estadoDeposito && c.estadoDeposito !== 'RETENIDO'
                          ? ` · ${c.estadoDeposito.charAt(0)}${c.estadoDeposito.slice(1).toLowerCase()}`
                          : ' · en custodia'
                      }`}
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
                      {/* Próximo ajuste programado del alquiler. En prod sale de
                          contrato.proximoAjuste (lo setea el backend al alta); si
                          es null, "sin ajuste programado". En demo no hay dato. */}
                      <Row
                        label="Próximo ajuste"
                        value={
                          apiEnabled
                            ? c.proximoAjuste
                              ? formatFecha(c.proximoAjuste)
                              : 'sin ajuste programado'
                            : '—'
                        }
                      />
                    </>
                  )}
                  {/* Esquema de mora EFECTIVO (resuelto por la cascada contrato →
                      inmobiliaria). "(heredada)" cuando viene del default. */}
                  {c.moraEfectiva && (
                    <Row
                      label="Interés por mora"
                      value={
                        <span className="flex items-center gap-1.5">
                          <Badge variant={c.moraEfectiva.tipo === 'SIN_MORA' ? 'secondary' : 'warning'}>
                            {descripcionMora(c.moraEfectiva.tipo, c.moraEfectiva.valor, c.moneda)}
                            {c.moraEfectiva.origen === 'INMOBILIARIA' ? ' (heredada)' : ''}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-1.5 text-xs"
                            onClick={() => setAbrirEditarMora(true)}
                          >
                            <Pencil className="h-3 w-3" />
                            Editar
                          </Button>
                        </span>
                      }
                    />
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

            {/* Cargos del inquilino (reparaciones imputadas + penalidad de rescisión):
                los pendientes suman a la deuda que ve el inquilino; se pueden marcar
                cobrados. Se rinde sola (null si no hay cargos). */}
            <CargosContratoCard contratoId={c.id} />
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
            {/* El panel sube/lista/borra documentos REALES: en prod vía el API
                (/contratos/:id/documentos + Volume, hook useDocsContrato); en demo
                localStorage. Acá se sube el CONTRATO FIRMADO en PDF, DNIs, etc. */}
            <ContratoDocumentosPanel contrato={c} />
            {/* Documentos que el INQUILINO subió desde su app (DNI, recibos,
                garante) — solo lectura, feature nueva sin equivalente demo. */}
            {apiEnabled && <DocumentosInquilinoPanel contratoId={c.id} />}
          </TabsContent>

          <TabsContent value="garantes" className="space-y-2">
            <ContratoGarantesPanel contratoId={c.id} />
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

      {/* Editar el esquema de mora del contrato (PUT /contratos/:id/mora). */}
      {c.moraEfectiva && (
        <EditarMoraDialog
          open={abrirEditarMora}
          onOpenChange={setAbrirEditarMora}
          contrato={c}
        />
      )}

      {/* Ajustar el monto del alquiler (PATCH /contratos/:id/monto, con PIN).
          Solo prod: en demo el botón está deshabilitado y esto no se monta. */}
      {apiEnabled && (
        <AjustarMontoDialog
          open={abrirAjustarMonto}
          onOpenChange={setAbrirAjustarMonto}
          contrato={c}
        />
      )}
    </>
  );
}

/**
 * Diálogo para pisar (o volver a heredar) el interés por mora de ESTE
 * contrato. "Heredar" manda tipo: null y el backend vuelve a aplicar el
 * default de la inmobiliaria.
 */
function EditarMoraDialog({
  open,
  onOpenChange,
  contrato,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contrato: ContratoListado;
}) {
  const qc = useQueryClient();
  // Default de la inmobiliaria para el label "Heredar (…)": si el fetch de
  // /cobranza no está disponible (permiso/carga), caemos a moraEfectiva
  // cuando el origen ya es INMOBILIARIA.
  const { mora: moraDefault } = useCobranza();
  const heredado =
    moraDefault != null
      ? { tipo: moraDefault.tipoDefault, valor: moraDefault.valorDefault }
      : contrato.moraEfectiva && contrato.moraEfectiva.origen === 'INMOBILIARIA'
        ? { tipo: contrato.moraEfectiva.tipo, valor: contrato.moraEfectiva.valor }
        : null;

  const [seleccion, setSeleccion] = useState<MoraSeleccion>('HEREDAR');
  const [valor, setValor] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Al abrir, arrancamos del override actual del contrato (null = hereda).
  useEffect(() => {
    if (!open) return;
    setSeleccion(contrato.moraTipo ?? 'HEREDAR');
    setValor(contrato.moraValor != null ? String(contrato.moraValor) : '');
    setError(null);
  }, [open, contrato.moraTipo, contrato.moraValor]);

  const valido =
    seleccion === 'HEREDAR' || seleccion === 'SIN_MORA' || Number(valor) > 0;

  const guardar = async () => {
    setGuardando(true);
    setError(null);
    try {
      await ensureApiSession();
      await apiFetch(`/contratos/${contrato.id}/mora`, {
        method: 'PUT',
        body: JSON.stringify(
          seleccion === 'HEREDAR'
            ? { tipo: null }
            : { tipo: seleccion, valor: seleccion === 'SIN_MORA' ? null : Number(valor) },
        ),
      });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['contrato', contrato.id] }),
        qc.invalidateQueries({ queryKey: ['contratos'] }),
      ]);
      toast({ variant: 'success', title: 'Interés por mora actualizado' });
      onOpenChange(false);
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : 'No se pudo guardar la mora. Reintentá en un momento.',
      );
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Interés por mora</DialogTitle>
          <DialogDescription>
            Punitorio que se suma cuando el inquilino paga tarde. Elegí un esquema
            para ESTE contrato o heredá el default de la inmobiliaria.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <MoraSelector
            seleccion={seleccion}
            valor={valor}
            onSeleccionChange={setSeleccion}
            onValorChange={setValor}
            heredado={heredado}
            conHeredar
            montoBase={contrato.monto + (contrato.montoExpensas ?? 0)}
            moneda={contrato.moneda}
            idPrefix="mora-editar"
          />
          {error && (
            <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={guardando}>
              Cancelar
            </Button>
            <Button onClick={guardar} disabled={guardando || !valido}>
              {guardando ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Diálogo para ajustar MANUALMENTE el monto del alquiler (PATCH /contratos/:id/monto).
 * El sistema no tiene la data del índice (ICL/IPC/UVA...), así que cuando llega la
 * fecha de ajuste el operador entra el monto nuevo acá. El endpoint actualiza el
 * monto, reprograma proximoAjuste y RE-DEVENGA las liquidaciones futuras sin pagos.
 * Como es "money code", va con PIN — mismo régimen que cargar pago manual / validar
 * (el server lo exige si el usuario tiene PIN configurado).
 */
function AjustarMontoDialog({
  open,
  onOpenChange,
  contrato,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contrato: ContratoListado;
}) {
  const qc = useQueryClient();
  const [monto, setMonto] = useState('');
  const [proximoAjuste, setProximoAjuste] = useState('');
  const [motivo, setMotivo] = useState('');
  const [showPin, setShowPin] = useState(false);
  // Acción que ejecuta el PIN: devuelve null si salió bien, o el message del
  // server (PIN inválido, datos inválidos, 404) para reintentar en el diálogo.
  const pendingAction = useRef<((pin: string) => Promise<string | null>) | null>(null);

  useEffect(() => {
    if (open) {
      // Sugerimos el monto actual como base editable; el próximo ajuste arranca
      // vacío (opcional: si se deja, el server reprograma con la frecuencia).
      setMonto(String(contrato.monto));
      setProximoAjuste(contrato.proximoAjuste ?? '');
      setMotivo('');
      setShowPin(false);
      pendingAction.current = null;
    }
  }, [open, contrato.monto, contrato.proximoAjuste]);

  const guardar = () => {
    const montoNum = Number(monto);
    if (!Number.isFinite(montoNum) || montoNum <= 0) {
      toast({ title: 'El monto tiene que ser positivo', variant: 'destructive' });
      return;
    }
    // El date puede quedar a medio tipear (yyyy-mm-dd = 10 chars); si tiene algo
    // pero no es una fecha completa, frenamos con un mensaje claro.
    if (proximoAjuste && proximoAjuste.length !== 10) {
      toast({ title: 'Completá la fecha del próximo ajuste', variant: 'destructive' });
      return;
    }
    const proximoTrim = proximoAjuste.trim();
    const motivoTrim = motivo.trim();
    pendingAction.current = async (pin) => {
      try {
        await ensureApiSession();
        const res = await apiFetch<{ liquidacionesReajustadas: number }>(
          `/contratos/${contrato.id}/monto`,
          {
            method: 'PATCH',
            body: JSON.stringify({
              monto: montoNum,
              ...(proximoTrim ? { proximoAjuste: proximoTrim } : {}),
              ...(motivoTrim ? { motivo: motivoTrim } : {}),
              pin,
            }),
          },
        );
        // El ajuste toca el monto + re-devenga liquidaciones futuras: refrescamos
        // el detalle del contrato, la lista y las liquidaciones (tab Pagos).
        await Promise.all([
          qc.invalidateQueries({ queryKey: ['contrato', contrato.id] }),
          qc.invalidateQueries({ queryKey: ['contratos'] }),
          qc.invalidateQueries({ queryKey: ['liquidaciones'] }),
        ]);
        const n = res.liquidacionesReajustadas;
        toast({
          variant: 'success',
          title: 'Monto del alquiler actualizado',
          description:
            n > 0
              ? `Se re-devengaron ${n} liquidación${n === 1 ? '' : 'es'} futura${n === 1 ? '' : 's'} con el monto nuevo.`
              : 'No había liquidaciones futuras sin pagos para re-devengar.',
        });
        onOpenChange(false);
        return null;
      } catch (e) {
        // El message del server (400/403/404/PIN) se muestra en el diálogo de PIN,
        // que queda abierto para corregir y reintentar.
        return e instanceof ApiError
          ? e.message
          : 'No se pudo ajustar el monto. Reintentá en un momento.';
      }
    };
    setShowPin(true);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ajustar monto del alquiler</DialogTitle>
            <DialogDescription>
              Entrá el monto nuevo del alquiler (por índice, acuerdo, etc.). Se
              actualiza el contrato y se re-devengan las liquidaciones futuras que
              todavía no tengan pagos. Los meses ya pagados o con pago no se tocan.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="ajm-monto" className="text-xs" aria-required>
                Monto nuevo <span className="text-destructive">*</span>
              </Label>
              <Input
                id="ajm-monto"
                type="number"
                inputMode="decimal"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                placeholder="0"
                required
              />
              <p className="text-[10px] text-muted-foreground">
                Monto actual: {formatMonto(contrato.monto, contrato.moneda)}
              </p>
            </div>

            <div className="space-y-1">
              <Label htmlFor="ajm-proximo" className="text-xs">
                Próximo ajuste (opcional)
              </Label>
              <Input
                id="ajm-proximo"
                type="date"
                value={proximoAjuste}
                onChange={(e) => setProximoAjuste(e.target.value)}
              />
              <p className="text-[10px] text-muted-foreground">
                Si lo dejás vacío, se reprograma automáticamente según la frecuencia del contrato.
              </p>
            </div>

            <div className="space-y-1">
              <Label htmlFor="ajm-motivo" className="text-xs">
                Motivo (opcional)
              </Label>
              <Textarea
                id="ajm-motivo"
                rows={2}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ej: ajuste ICL semestral · acuerdo con el propietario."
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button className="flex-1" onClick={guardar} disabled={showPin}>
              <TrendingUp className="h-4 w-4" />
              Ajustar monto
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <PinPromptDialog
        abierto={showPin}
        accion="Confirmar ajuste de monto"
        subaccion={`${contrato.inquilino} · ${formatMonto(contrato.monto, contrato.moneda)} → ${formatMonto(Number(monto) || 0, contrato.moneda)}`}
        validacion="servidor"
        onClose={() => setShowPin(false)}
        onConfirmado={async (pin) => {
          const run = pendingAction.current;
          if (!run) return null;
          const err = await run(pin);
          if (err) return err; // mantiene el diálogo abierto para reintentar
          pendingAction.current = null;
          return null;
        }}
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
        {/* Mora al día (punitorio) ya incluida en el total — chip ámbar para
            que se vea de un vistazo cuánto del total es interés por atraso. */}
        {(liq.montoPunitorio ?? 0) > 0 && (
          <span className="rounded-full border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-300">
            +{formatMonto(liq.montoPunitorio ?? 0)} mora
          </span>
        )}
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

