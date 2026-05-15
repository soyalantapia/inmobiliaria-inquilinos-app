import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Download,
  FileText,
  Home,
  IdCard,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Plus,
  ShieldCheck,
  Store,
  UserRound,
  Users,
  Warehouse,
  Wrench,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@llave/ui/avatar';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { BotonProximamente } from '@/components/boton-proximamente';
import { Card, CardContent } from '@llave/ui/card';
import { Separator } from '@llave/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@llave/ui/tabs';
import { Topbar } from '@/components/topbar';
import {
  type CoInquilinoAdmin,
  coInquilinosMock,
  contratosMock,
  propiedadesMock,
} from '@/lib/mock-data';
import {
  participacionesDe,
  validarParticipaciones,
  montoQueLeToca,
} from '@/lib/participaciones';
import {
  enriquecerPropiedad,
  estadoPropiedadConfig,
  tipoPropiedadLabel,
} from '@/lib/propiedades-helpers';
import {
  categoriaIcono,
  categoriaLabel,
  estadoConfig,
  tiempoRelativo,
  urgenciaConfig,
} from '@/lib/reclamos-config';
import { formatFecha, formatMonto } from '@/lib/format';
import type { TipoPropiedad } from '@/lib/types';

const tipoIcono: Record<TipoPropiedad, React.ComponentType<{ className?: string }>> = {
  DEPARTAMENTO: Home,
  CASA: Home,
  LOCAL: Store,
  GALPON: Warehouse,
};

export function generateStaticParams() {
  return propiedadesMock.map((p) => ({ id: p.id }));
}

export const dynamicParams = false;

export default function DetallePropiedadPage({ params }: { params: { id: string } }) {
  const raw = propiedadesMock.find((p) => p.id === params.id);
  if (!raw) notFound();
  const { propiedad, contrato, propietarios, reclamos, reclamosAbiertos } =
    enriquecerPropiedad(raw);

  const Icon = tipoIcono[propiedad.tipo];
  const estadoCfg = estadoPropiedadConfig[propiedad.estado];

  return (
    <>
      <Topbar titulo="Propiedad" />
      <main className="flex-1 space-y-6 p-4 md:p-6">
        <Link
          href="/propiedades"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          Volver a propiedades
        </Link>

        {/* Hero */}
        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="flex flex-wrap items-start gap-4">
              <div className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <Icon className="h-8 w-8" />
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-semibold leading-tight">{propiedad.direccion}</h1>
                  <Badge variant={estadoCfg.variant}>{estadoCfg.label}</Badge>
                </div>
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  {propiedad.ciudad}, {propiedad.provincia}
                </p>
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span>{tipoPropiedadLabel[propiedad.tipo]}</span>
                  {propiedad.ambientes !== null && (
                    <>
                      <span>·</span>
                      <span>{propiedad.ambientes} ambientes</span>
                    </>
                  )}
                  {propiedad.m2 !== null && (
                    <>
                      <span>·</span>
                      <span>{propiedad.m2} m²</span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <BotonProximamente
                  variant="outline"
                  size="sm"
                  toastTitle="Editar propiedad"
                  toastMessage="Próximamente vas a poder editar dirección, ambientes y m² desde acá."
                >
                  <FileText className="h-4 w-4" />
                  Editar
                </BotonProximamente>
              </div>
            </div>

            {/* Stats inline */}
            <div className="grid grid-cols-2 gap-4 border-t pt-4 sm:grid-cols-4">
              <Stat
                label="Alquiler mensual"
                value={contrato ? formatMonto(contrato.monto, contrato.moneda) : '—'}
              />
              <Stat
                label="Próximo vencimiento"
                value={contrato ? formatFecha(contrato.proximoVencimiento) : '—'}
                hint={contrato ? `Estado: ${contrato.estadoPagoActual.toLowerCase()}` : undefined}
              />
              <Stat
                label="Vigencia contrato"
                value={contrato ? `Hasta ${formatFecha(contrato.fechaFin)}` : '—'}
              />
              <Stat
                label="Reclamos abiertos"
                value={reclamosAbiertos.toString()}
                hint={`${reclamos.length} total`}
                accent={reclamosAbiertos > 0 ? 'red' : 'muted'}
              />
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="resumen">
          <TabsList className="h-auto flex-wrap justify-start gap-1 p-1">
            <TabsTrigger value="resumen">Resumen</TabsTrigger>
            <TabsTrigger value="inquilino">Inquilino</TabsTrigger>
            <TabsTrigger value="propietarios">Propietarios</TabsTrigger>
            <TabsTrigger value="contrato">Contrato</TabsTrigger>
            <TabsTrigger value="reclamos">
              Reclamos
              {reclamosAbiertos > 0 && (
                <span className="ml-1.5 grid h-4 min-w-[1rem] place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                  {reclamosAbiertos}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="personas">Personas</TabsTrigger>
            <TabsTrigger value="documentos">Documentos</TabsTrigger>
          </TabsList>

          {/* RESUMEN */}
          <TabsContent value="resumen" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-center gap-2">
                    <UserRound className="h-4 w-4 text-primary" />
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Inquilino actual
                    </p>
                  </div>
                  {contrato ? (
                    <>
                      <p className="text-lg font-semibold">{contrato.inquilino}</p>
                      <p className="text-xs text-muted-foreground">
                        Vigencia: {formatFecha(contrato.fechaInicio)} → {formatFecha(contrato.fechaFin)}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm italic text-muted-foreground">
                      Propiedad sin inquilino actual.
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Propietario{propietarios.length > 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    {propietarios.map((o) => (
                      <p key={o.id} className="text-sm font-medium leading-tight">
                        {o.nombre} {o.apellido}
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          {o.comisionPct}% comisión
                        </span>
                      </p>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {reclamos.length > 0 && (
              <Card>
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Wrench className="h-4 w-4 text-primary" />
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Últimos reclamos
                      </p>
                    </div>
                  </div>
                  <ul className="space-y-2">
                    {reclamos.slice(0, 3).map((r) => {
                      const RIcon = categoriaIcono[r.categoria];
                      return (
                        <li key={r.id}>
                          <Link
                            href={`/reclamos/${r.id}`}
                            className="flex items-start gap-3 rounded-md border p-3 transition-colors hover:bg-muted/40"
                          >
                            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
                              <RIcon className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-sm font-medium">
                                  {categoriaLabel[r.categoria]}
                                </span>
                                <Badge variant={estadoConfig[r.estado].variant}>
                                  {estadoConfig[r.estado].label}
                                </Badge>
                              </div>
                              <p className="line-clamp-1 text-xs text-muted-foreground">
                                {r.descripcion}
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                {tiempoRelativo(r.createdAt)}
                              </p>
                            </div>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* INQUILINO */}
          <TabsContent value="inquilino" className="space-y-4">
            {contrato ? (
              <Card>
                <CardContent className="space-y-4 p-6">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {contrato.inquilino.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-lg font-semibold">{contrato.inquilino}</p>
                      <p className="text-xs text-muted-foreground">
                        Inquilino actual · contrato {contrato.id}
                      </p>
                    </div>
                  </div>

                  <Separator />

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Vigencia">
                      {formatFecha(contrato.fechaInicio)} → {formatFecha(contrato.fechaFin)}
                    </Field>
                    <Field label="Estado pago actual">
                      <Badge
                        variant={
                          contrato.estadoPagoActual === 'PAGADO'
                            ? 'success'
                            : contrato.estadoPagoActual === 'VENCIDO'
                              ? 'destructive'
                              : 'warning'
                        }
                      >
                        {contrato.estadoPagoActual}
                      </Badge>
                    </Field>
                    <Field label="Próximo vencimiento">
                      {formatFecha(contrato.proximoVencimiento)}
                    </Field>
                    <Field label="Alquiler">
                      {formatMonto(contrato.monto, contrato.moneda)}
                    </Field>
                  </div>

                  <Separator />

                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" asChild>
                      <a
                        href="https://wa.me/541145321100"
                        target="_blank"
                        rel="noreferrer"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        WhatsApp
                      </a>
                    </Button>
                    <Button size="sm" variant="ghost" asChild>
                      <a href="tel:+541145321100">
                        <Phone className="h-3.5 w-3.5" />
                        Llamar
                      </a>
                    </Button>
                    <Button size="sm" variant="ghost" asChild>
                      <a href="mailto:inquilino@example.com">
                        <Mail className="h-3.5 w-3.5" />
                        Email
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="space-y-3 p-10 text-center">
                  <UserRound className="mx-auto h-10 w-10 text-muted-foreground" />
                  <p className="font-medium">Propiedad sin inquilino actual</p>
                  <Button size="sm" asChild>
                    <Link href="/contratos/nuevo">
                      <Plus className="h-4 w-4" />
                      Cargar contrato
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* PROPIETARIOS */}
          <TabsContent value="propietarios" className="space-y-4">
            {propietarios.length === 0 ? (
              <Card>
                <CardContent className="space-y-3 p-10 text-center">
                  <Users className="mx-auto h-10 w-10 text-muted-foreground" />
                  <p className="font-medium">Sin propietarios cargados</p>
                  <Button size="sm" asChild>
                    <Link href="/propietarios">
                      <Plus className="h-4 w-4" />
                      Agregar propietario
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (() => {
              // Calculamos participaciones y monto que toca a cada uno
              const parts = participacionesDe(propiedad);
              const validacion = validarParticipaciones(parts);
              const contratoActual = contratosMock.find((c) => c.id === propiedad.contratoActualId);
              const montoMensual = contratoActual?.monto ?? 0;
              return (
                <>
                  {/* Resumen de participaciones */}
                  <Card>
                    <CardContent className="space-y-3 p-5">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                          Reparto de la propiedad
                        </h3>
                        {validacion.balanceado ? (
                          <Badge variant="success">Suma 100%</Badge>
                        ) : (
                          <Badge variant="warning">Suma {validacion.suma}% — falta ajustar</Badge>
                        )}
                      </div>
                      <div className="space-y-2">
                        {parts.map((p) => {
                          const dueño = propietarios.find((o) => o.id === p.propietarioId);
                          return (
                            <div key={p.propietarioId} className="space-y-1">
                              <div className="flex items-center justify-between text-sm">
                                <span className="font-medium">
                                  {dueño ? `${dueño.nombre} ${dueño.apellido}` : p.propietarioId}
                                </span>
                                <span className="font-semibold tabular-nums">{p.porcentaje}%</span>
                              </div>
                              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                                <div
                                  className="h-full bg-primary"
                                  style={{ width: `${Math.min(100, p.porcentaje)}%` }}
                                />
                              </div>
                              {montoMensual > 0 && (
                                <p className="text-[11px] text-muted-foreground">
                                  Le tocan {formatMonto(montoQueLeToca(propiedad, p.propietarioId, montoMensual), contratoActual?.moneda)} mensuales (bruto)
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>

                  <div className="grid gap-4 md:grid-cols-2">
                {propietarios.map((o) => (
                  <Card key={o.id}>
                    <CardContent className="space-y-3 p-5">
                      <div className="flex items-start gap-3">
                        <Avatar>
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {o.nombre[0]}
                            {o.apellido[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold leading-tight">
                            {o.nombre} {o.apellido}
                          </p>
                          <p className="text-xs text-muted-foreground">CUIT {o.cuit}</p>
                        </div>
                        <Badge variant="secondary">{o.comisionPct}% comisión</Badge>
                      </div>

                      <div className="space-y-1 text-xs">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Mail className="h-3 w-3 shrink-0" />
                          <span className="truncate">{o.email}</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Phone className="h-3 w-3 shrink-0" />
                          <span>{o.telefono}</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <IdCard className="h-3 w-3 shrink-0" />
                          <span>CBU/Alias: {o.cbuAlias ?? <em>falta</em>}</span>
                        </div>
                      </div>

                      {o.notas && (
                        <div className="rounded-md border bg-muted/40 p-2 text-xs text-muted-foreground">
                          {o.notas}
                        </div>
                      )}

                      <Button size="sm" variant="outline" className="w-full" asChild>
                        <a
                          href={`https://wa.me/${o.telefono.replace(/[^\d]/g, '')}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                          Mensaje
                        </a>
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
                </>
              );
            })()}
          </TabsContent>

          {/* CONTRATO */}
          <TabsContent value="contrato" className="space-y-4">
            {contrato ? (
              <Card>
                <CardContent className="space-y-4 p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                        Contrato {contrato.id}
                      </p>
                      <h3 className="mt-1 text-lg font-semibold">{contrato.inquilino}</h3>
                      <p className="text-xs text-muted-foreground">
                        {formatFecha(contrato.fechaInicio)} → {formatFecha(contrato.fechaFin)}
                      </p>
                    </div>
                    <Badge variant={contrato.estado === 'ACTIVO' ? 'success' : 'secondary'}>
                      {contrato.estado}
                    </Badge>
                  </div>

                  <Separator />

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Alquiler actual">
                      {formatMonto(contrato.monto, contrato.moneda)}
                    </Field>
                    <Field label="Índice de ajuste">ICL — BCRA</Field>
                    <Field label="Frecuencia ajuste">12 meses</Field>
                    <Field label="Próximo vencimiento">
                      {formatFecha(contrato.proximoVencimiento)}
                    </Field>
                  </div>

                  <Separator />

                  <Button asChild>
                    <Link href={`/contratos/${contrato.id}`}>
                      <FileText className="h-4 w-4" />
                      Ver contrato completo
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="space-y-3 p-10 text-center">
                  <FileText className="mx-auto h-10 w-10 text-muted-foreground" />
                  <p className="font-medium">Propiedad sin contrato activo</p>
                  <Button size="sm" asChild>
                    <Link href="/contratos/nuevo">
                      <Plus className="h-4 w-4" />
                      Cargar contrato
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* RECLAMOS */}
          <TabsContent value="reclamos" className="space-y-4">
            {reclamos.length === 0 ? (
              <Card>
                <CardContent className="space-y-2 p-10 text-center text-muted-foreground">
                  <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
                  <p className="font-medium text-foreground">Sin reclamos en esta propiedad</p>
                  <p className="text-sm">Cuando el inquilino reporte un problema aparece acá.</p>
                </CardContent>
              </Card>
            ) : (
              <Card className="divide-y">
                {reclamos.map((r) => {
                  const RIcon = categoriaIcono[r.categoria];
                  return (
                    <Link
                      key={r.id}
                      href={`/reclamos/${r.id}`}
                      className="flex items-start gap-3 p-4 transition-colors hover:bg-muted/40"
                    >
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                        <RIcon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{categoriaLabel[r.categoria]}</span>
                          <Badge variant={urgenciaConfig[r.urgencia].variant}>
                            {urgenciaConfig[r.urgencia].label}
                          </Badge>
                          <Badge variant={estadoConfig[r.estado].variant}>
                            {estadoConfig[r.estado].label}
                          </Badge>
                        </div>
                        <p className="line-clamp-2 text-sm text-muted-foreground">
                          {r.descripcion}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {tiempoRelativo(r.createdAt)}
                          {r.asignadoA && ` · ${r.asignadoA}`}
                        </p>
                      </div>
                      {(r.estado === 'ABIERTO' || r.estado === 'EN_CURSO') && (
                        <AlertTriangle className="mt-1 h-4 w-4 shrink-0 text-amber-500" />
                      )}
                    </Link>
                  );
                })}
              </Card>
            )}
          </TabsContent>

          {/* PERSONAS */}
          <TabsContent value="personas" className="space-y-4">
            <Card>
              <CardContent className="space-y-4 p-6">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Garante vigente
                  </h3>
                </div>
                <div className="grid gap-3 rounded-md border bg-muted/30 p-4 md:grid-cols-2">
                  <Field label="Proveedor">Cobertura SUMA</Field>
                  <Field label="N° de póliza">POL-2025-48721</Field>
                  <Field label="Tipo">Garantía digital</Field>
                  <Field label="Cobertura">$14.400.000</Field>
                  <Field label="Vigencia hasta">31/08/2028</Field>
                  <Field label="Contacto">+54 11 5288 9000</Field>
                </div>
                <p className="text-xs text-muted-foreground">
                  Los inquilinos pueden compartir un link público de sólo lectura con su garante
                  desde el lado del inquilino — desde acá controlás cuántos hay activos.
                </p>
              </CardContent>
            </Card>

            <CoInquilinosBlock contratoId={contrato?.id} />
          </TabsContent>


          {/* DOCUMENTOS */}
          <TabsContent value="documentos" className="space-y-4">
            <Card>
              <CardContent className="space-y-3 p-6">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Documentos
                </h3>
                <DocRow nombre="Contrato firmado.pdf" subtitulo="Subido al cargar el contrato" />
                <DocRow nombre="Escritura.pdf" subtitulo="Documento del propietario" />
                <DocRow nombre="Reglamento de copropiedad.pdf" subtitulo="Edificio" />
                <Button variant="outline" size="sm" className="mt-2" asChild>
                  <Link href={contrato ? `/contratos/${contrato.id}` : '/contratos'}>
                    <Plus className="h-4 w-4" />
                    Subir documento
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </>
  );
}

function Stat({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: 'red' | 'muted';
}) {
  const color = accent === 'red' ? 'text-destructive' : accent === 'muted' ? 'text-muted-foreground' : '';
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-0.5 text-lg font-semibold tabular-nums ${color}`}>{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-0.5 text-sm font-medium">{children}</div>
    </div>
  );
}

const permisoLabelAdmin: Record<CoInquilinoAdmin['permiso'], string> = {
  VER: 'Solo ver',
  PAGAR: 'Ver y pagar',
  COMPLETO: 'Todo',
};

function CoInquilinosBlock({ contratoId }: { contratoId: string | undefined }) {
  const cos = contratoId ? coInquilinosMock.filter((c) => c.contratoId === contratoId) : [];

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Co-inquilinos
            </h3>
          </div>
          {cos.length > 0 && <Badge variant="secondary">{cos.length}</Badge>}
        </div>

        {cos.length === 0 ? (
          <div className="rounded-md border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
            <Users className="mx-auto h-8 w-8 text-muted-foreground/40" />
            <p className="mt-2 font-medium">El inquilino no invitó a nadie todavía</p>
            <p className="mt-1 text-xs">
              Cuando comparta acceso con pareja o familia, los vas a ver acá con su nivel de
              permiso.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {cos.map((c) => (
              <div key={c.id} className="flex items-center gap-3 rounded-md border p-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  {c.nombre.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">{c.nombre}</p>
                    <Badge
                      variant={c.estado === 'ACEPTADO' ? 'success' : 'outline'}
                      className="text-[10px]"
                    >
                      {c.estado === 'ACEPTADO' ? 'Activo' : 'Pendiente'}
                    </Badge>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {c.relacion} · {c.email}
                  </p>
                </div>
                <Badge variant="outline" className="shrink-0 text-[10px]">
                  {permisoLabelAdmin[c.permiso]}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DocRow({ nombre, subtitulo }: { nombre: string; subtitulo: string }) {
  // En backend real éstos vendrían con su pdfUrl real. Para la demo lo
  // dejamos como anchor con download que apunta a un placeholder.
  const slug = encodeURIComponent(nombre);
  return (
    <div className="flex items-center justify-between rounded-md border p-3">
      <div className="flex items-center gap-3 min-w-0">
        <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{nombre}</p>
          <p className="text-xs text-muted-foreground">{subtitulo}</p>
        </div>
      </div>
      <Button variant="ghost" size="sm" asChild>
        <a
          href={`data:application/pdf,${slug}`}
          download={nombre}
          aria-label={`Descargar ${nombre}`}
        >
          <Download className="h-4 w-4" />
        </a>
      </Button>
    </div>
  );
}
