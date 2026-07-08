'use client';

import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  Briefcase,
  CheckCircle2,
  Download,
  FileText,
  Home,
  IdCard,
  Loader2,
  Mail,
  MapPin,
  Landmark,
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
import { EditarPropiedadTrigger } from '@/components/editar-propiedad-trigger';
import { EditarPropietarioTrigger } from '@/components/editar-propietario-trigger';
import { EliminarPropiedadButton } from '@/components/eliminar-propiedad-button';
import {
  CargarInquilinoTrigger,
  ListaInvitadosPropiedad,
} from '@/components/cargar-inquilino-trigger';
import { InquilinoActualAcciones } from '@/components/inquilino-actual-acciones';
import { Card, CardContent } from '@llave/ui/card';
import { Separator } from '@llave/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@llave/ui/tabs';
import { BoletasInquilinoPanel } from '@/components/boletas-inquilino-panel';
import { ServiciosPublicosPanel } from '@/components/servicios-publicos-panel';
import { Topbar } from '@/components/topbar';
import {
  type CoInquilinoAdmin,
  coInquilinosMock,
  contactosCobranzaMock,
} from '@/lib/mock-data';
import {
  participacionesDe,
  validarParticipaciones,
  montoQueLeToca,
} from '@/lib/participaciones';
import { estadoPropiedadConfig, tipoPropiedadLabel } from '@/lib/propiedades-helpers';
import {
  categoriaIcono,
  categoriaLabel,
  estadoConfig,
  tiempoRelativo,
  urgenciaConfig,
} from '@/lib/reclamos-config';
import { diasHastaVencimiento, formatFechaCorta, formatMonto, formatRangoVigencia } from '@/lib/format';
import { apiEnabled, urlDeArchivo } from '@/lib/api/client';
import { usePropiedad } from '@/lib/api/use-propiedad';
import type { TipoPropiedad } from '@/lib/types';

const tipoIcono: Record<TipoPropiedad, React.ComponentType<{ className?: string }>> = {
  DEPARTAMENTO: Home,
  CASA: Home,
  LOCAL: Store,
  GALPON: Warehouse,
};

export default function DetallePropiedadPage({ params }: { params: { id: string } }) {
  // Datos desde el API real (GET /propiedades/:id) con fallback al mock +
  // overrides locales solo en build demo (!apiEnabled). El hook devuelve el
  // mismo shape enriquecido que consumía esta pantalla (propiedad + contrato
  // + propietarios + reclamos) más la sociedad gestora del hero.
  const { propiedad: detalle, cargando, deApi, noEncontrada } = usePropiedad(params.id);

  // En build demo el mock es síncrono: si no existe el id → 404 real de Next.
  if (!deApi && noEncontrada) notFound();

  // Cargando (solo en modo API).
  if (cargando) {
    return (
      <>
        <Topbar titulo="Propiedad" />
        <main className="flex flex-1 items-center justify-center p-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Cargando propiedad" />
        </main>
      </>
    );
  }

  // No encontrada / error del API: empty state legible (sin caer al mock en prod).
  if (!detalle) {
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
          <Card>
            <CardContent className="space-y-2 p-10 text-center text-muted-foreground">
              <Home className="mx-auto h-10 w-10" />
              <p className="font-medium text-foreground">No encontramos esta propiedad</p>
              <p className="text-sm">Puede haber sido dada de baja o el enlace no es válido.</p>
            </CardContent>
          </Card>
        </main>
      </>
    );
  }

  const { propiedad, contrato, contratosPasados, propietarios, reclamos, reclamosAbiertos, sociedad, inquilinoEmail } = detalle;

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
              {/* Con foto real, el hero de la propiedad; sin foto, el ícono del tipo. */}
              {propiedad.fotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={urlDeArchivo(propiedad.fotoUrl)}
                  alt={`Foto de ${propiedad.direccion}`}
                  className="h-16 w-24 shrink-0 rounded-xl border object-cover"
                />
              ) : (
                <div className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-8 w-8" />
                </div>
              )}
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
                      <span>
                        {propiedad.ambientes} ambiente
                        {propiedad.ambientes === 1 ? '' : 's'}
                      </span>
                    </>
                  )}
                  {propiedad.m2 !== null && (
                    <>
                      <span>·</span>
                      <span>{propiedad.m2} m²</span>
                    </>
                  )}
                </div>
                {/* Sociedad gestora: facturación + CBU se manejan bajo esta razón social. */}
                <p className="flex flex-wrap items-center gap-x-1.5 text-[11px] text-muted-foreground">
                  <Briefcase className="h-3 w-3" />
                  Gestionada por <strong className="text-foreground">{sociedad.nombreComercial}</strong>{' '}
                  <span className="whitespace-nowrap">· CUIT {sociedad.cuit}</span>
                </p>
              </div>
              <div className="flex gap-2">
                {/* La edición de propiedad escribe a overrides locales (sin
                    endpoint PATCH todavía). En modo API la deshabilitamos. */}
                {apiEnabled ? (
                  <Button variant="outline" size="sm" disabled title="Próximamente">
                    <FileText className="h-4 w-4" />
                    Editar
                  </Button>
                ) : (
                  <EditarPropiedadTrigger propiedad={propiedad} />
                )}
                {apiEnabled && propiedad.estado === 'DISPONIBLE' && (
                  <EliminarPropiedadButton propiedadId={propiedad.id} direccion={propiedad.direccion} />
                )}
              </div>
            </div>

            {/* Stats inline */}
            <div className="grid grid-cols-2 gap-4 border-t pt-4 sm:grid-cols-4">
              <Stat
                label="Alquiler mensual"
                value={contrato ? formatMonto(contrato.monto, contrato.moneda) : '—'}
              />
              {(() => {
                // Calculamos días al vencimiento para detectar "ya pasó" y
                // gritar visualmente. Antes mostrábamos solo "Estado:
                // pendiente" sin pintar rojo cuando el alquiler estaba
                // atrasado — eso hacía que el inmo no se diera cuenta.
                const dias = contrato ? diasHastaVencimiento(contrato.proximoVencimiento) : null;
                const vencido = dias !== null && dias < 0 && contrato?.estadoPagoActual !== 'PAGADO';
                const hint = !contrato
                  ? undefined
                  : vencido
                    ? `Vencido hace ${Math.abs(dias!)} día${Math.abs(dias!) === 1 ? '' : 's'}`
                    : `Estado: ${
                        contrato.estadoPagoActual.charAt(0) +
                        contrato.estadoPagoActual.slice(1).toLowerCase()
                      }`;
                return (
                  <Stat
                    label="Próximo vencimiento"
                    value={contrato ? formatFechaCorta(contrato.proximoVencimiento) : '—'}
                    hint={hint}
                    accent={vencido ? 'red' : undefined}
                  />
                );
              })()}
              <Stat
                label="Vigencia contrato"
                value={contrato ? formatRangoVigencia(contrato.fechaInicio, contrato.fechaFin) : '—'}
              />
              <Stat
                label="Reclamos abiertos"
                value={reclamosAbiertos.toString()}
                hint={`${reclamos.length} reclamo${reclamos.length === 1 ? '' : 's'} en total`}
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
            <TabsTrigger value="servicios">Servicios</TabsTrigger>
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
                        Vigencia: {formatRangoVigencia(contrato.fechaInicio, contrato.fechaFin)}
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
                  <ul role="list" className="space-y-2">
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
                      {formatRangoVigencia(contrato.fechaInicio, contrato.fechaFin)}
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
                      {formatFechaCorta(contrato.proximoVencimiento)}
                    </Field>
                    <Field label="Alquiler">
                      {formatMonto(contrato.monto, contrato.moneda)}
                    </Field>
                  </div>

                  <Separator />

                  {/* Resolvemos teléfono y email reales del inquilino por
                      contratoId — antes el botón WhatsApp / Llamar tenía
                      un número hardcoded (+54 11 4532 1100) idéntico para
                      todas las propiedades. */}
                  {(() => {
                    const contacto = apiEnabled
                      ? null
                      : contactosCobranzaMock.find((c) => c.contratoId === contrato.id);
                    const tel = contacto?.titular.telefono ?? null;
                    const telLimpio = tel?.replace(/[^\d]/g, '');
                    // En prod NO fabricamos email: usamos el real (inquilinoEmail)
                    // si el API lo trae; si no, el botón Email no se muestra. En
                    // demo seguimos con el contacto mock / fallback por nombre.
                    const email = apiEnabled
                      ? inquilinoEmail
                      : (contacto?.titular.email ?? emailDeNombre(contrato.inquilino));
                    return (
                      <div className="flex flex-wrap gap-2">
                        {telLimpio && (
                          <>
                            <Button size="sm" variant="outline" asChild>
                              <a
                                href={`https://wa.me/${telLimpio}`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <MessageCircle className="h-3.5 w-3.5" />
                                WhatsApp
                              </a>
                            </Button>
                            <Button size="sm" variant="ghost" asChild>
                              <a href={`tel:${telLimpio}`}>
                                <Phone className="h-3.5 w-3.5" />
                                Llamar
                              </a>
                            </Button>
                          </>
                        )}
                        {email ? (
                          <Button size="sm" variant="ghost" asChild>
                            <a href={`mailto:${email}`}>
                              <Mail className="h-3.5 w-3.5" />
                              Email
                            </a>
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="space-y-4 p-10 text-center">
                  <UserRound className="mx-auto h-10 w-10 text-muted-foreground" />
                  <p className="font-medium">Esta propiedad todavía no tiene inquilino</p>
                  <p className="text-sm text-muted-foreground">
                    Cargá los datos del inquilino, sus co-inquilinos y la documentación inicial.
                    Le mandamos un mail con el link para que active su cuenta en la app.
                  </p>
                  <div className="flex justify-center pt-2">
                    <CargarInquilinoTrigger
                      propiedadId={propiedad.id}
                      direccion={propiedad.direccion}
                      label="Cargar inquilino"
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Acciones sobre el inquilino actual: estado de cuenta, reenviar
                email de bienvenida, y gestión de co-inquilinos. */}
            {contrato && (
              <InquilinoActualAcciones
                inquilinoNombre={contrato.inquilino}
                // En prod usamos el email REAL del titular (o vacío si el API no
                // lo trae): nada de email fabricado por nombre. En demo seguimos
                // con el contacto mock / fallback por nombre.
                inquilinoEmail={
                  apiEnabled
                    ? (inquilinoEmail ?? '')
                    : (contactosCobranzaMock.find((x) => x.contratoId === contrato.id)
                        ?.titular.email ?? emailDeNombre(contrato.inquilino))
                }
                propiedadId={propiedad.id}
                contratoId={contrato.id}
                direccion={propiedad.direccion}
              />
            )}

            {/* Listado de inquilinos ya invitados, pendientes de activación */}
            <ListaInvitadosPropiedad
              propiedadId={propiedad.id}
              direccion={propiedad.direccion}
            />
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
              const contratoActual = contrato;
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

                      <div className="flex flex-wrap gap-2">
                        <EditarPropietarioTrigger propietario={o} variant="outline" size="sm" className="flex-1" />
                        {o.telefono.replace(/[^\d]/g, '') && (
                          <Button size="sm" variant="outline" className="flex-1" asChild>
                            <a
                              href={`https://wa.me/${o.telefono.replace(/[^\d]/g, '')}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                              Mensaje
                            </a>
                          </Button>
                        )}
                      </div>
                      {/* Ficha completa del propietario: rendición del mes, ARCA,
                          historial. Vive fuera del menú (Propietarios ya no es una
                          página top-level); se llega desde acá. */}
                      <Button size="sm" variant="secondary" className="w-full" asChild>
                        <Link href={`/propietarios/${o.id}`}>
                          <Landmark className="h-3.5 w-3.5" />
                          Ver ficha y rendir el mes
                        </Link>
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
                        {formatRangoVigencia(contrato.fechaInicio, contrato.fechaFin)}
                      </p>
                    </div>
                    <Badge variant={contrato.estado === 'ACTIVO' ? 'success' : 'secondary'}>
                      {contrato.estado.charAt(0) + contrato.estado.slice(1).toLowerCase()}
                    </Badge>
                  </div>

                  <Separator />

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Alquiler actual">
                      {formatMonto(contrato.monto, contrato.moneda)}
                    </Field>
                    <Field label="Índice de ajuste">{contrato.indiceAjuste ?? 'ICL — BCRA'}</Field>
                    <Field label="Frecuencia ajuste">
                      {contrato.frecuenciaAjusteMeses ? `${contrato.frecuenciaAjusteMeses} meses` : '12 meses'}
                    </Field>
                    <Field label="Próximo vencimiento">
                      {formatFechaCorta(contrato.proximoVencimiento)}
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
                    <Link href={`/contratos/nuevo?propiedad=${propiedad.id}`}>
                      <Plus className="h-4 w-4" />
                      Cargar contrato
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Contratos ANTERIORES: el historial de inquilinos que pasaron por esta
                propiedad. La "línea de corte" (separador + badge FINALIZADO/RESCINDIDO)
                marca que son de un inquilino pasado. El dato persiste entero en la DB. */}
            {contratosPasados.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-3 pt-2">
                  <Separator className="flex-1" />
                  <span className="shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Contratos anteriores · {contratosPasados.length}
                  </span>
                  <Separator className="flex-1" />
                </div>
                {contratosPasados.map((c) => (
                  <Card key={c.id} className="border-dashed">
                    <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{c.inquilino}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatRangoVigencia(c.fechaInicio, c.fechaFin)} · {formatMonto(c.monto, c.moneda)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge variant="secondary">
                          {c.estado.charAt(0) + c.estado.slice(1).toLowerCase()}
                        </Badge>
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/contratos/${c.id}`}>
                            <FileText className="h-4 w-4" />
                            Ver
                          </Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
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
                {/* Antes acá había 6 campos hardcoded ("Cobertura SUMA",
                    "POL-2025-48721", "$14.400.000", "31/08/2028",
                    "+54 11 5288 9000") IDÉNTICOS para todas las
                    propiedades. Ahora resolvemos el garante real del
                    contacto de cobranza por contratoId. */}
                {(() => {
                  // El garante real vive en la ficha del contrato; acá solo lo
                  // resolvemos en demo desde el mock. En prod queda null → empty-state
                  // (antes el mock no matcheaba y mostraba "Sin garante" engañoso).
                  const garante =
                    !apiEnabled && contrato
                      ? contactosCobranzaMock.find((x) => x.contratoId === contrato.id)?.garante ?? null
                      : null;
                  if (!garante) {
                    return (
                      <div className="rounded-md border border-dashed bg-background/40 p-4 text-xs text-muted-foreground">
                        {apiEnabled
                          ? 'Los datos del garante están en la ficha del contrato.'
                          : 'Sin garante registrado para este contrato.'}
                      </div>
                    );
                  }
                  return (
                    <div className="grid gap-3 rounded-md border bg-muted/30 p-4 md:grid-cols-2">
                      <Field label="Nombre / proveedor">{garante.nombre}</Field>
                      <Field label="Tipo">{garante.tipo}</Field>
                      <Field label="Contacto">{garante.telefono}</Field>
                    </div>
                  );
                })()}
                <p className="text-xs text-muted-foreground">
                  Los inquilinos pueden compartir un link público de sólo lectura con su garante
                  desde el lado del inquilino — desde acá controlás cuántos hay activos.
                </p>
              </CardContent>
            </Card>

            <CoInquilinosBlock contratoId={contrato?.id} />
          </TabsContent>


          {/* SERVICIOS */}
          <TabsContent value="servicios" className="space-y-4">
            <ServiciosPublicosPanel propiedadId={propiedad.id} />
            {contrato && <BoletasInquilinoPanel contratoId={contrato.id} />}
          </TabsContent>

          {/* DOCUMENTOS */}
          <TabsContent value="documentos" className="space-y-4">
            {/* Las filas son archivos hardcodeados del expediente sin endpoint
                todavía. En modo API no mostramos documentos fantasma: mismo
                patrón "Próximamente" que contratos/[id]. */}
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
            )}
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
  // Mock solo en demo: en prod no hay fuente real cableada en esta ficha → evita
  // listar/contar co-inquilinos del mock que no pertenecen a este tenant.
  const cos = !apiEnabled && contratoId ? coInquilinosMock.filter((c) => c.contratoId === contratoId) : [];

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

// Genera un email "placeholder" a partir del nombre completo del inquilino.
// Para el inquilino seed (Mariela Sosa) devolvemos el email real que usa
// el sistema de auth-otp en la app del inquilino, así el flujo se siente
// consistente. En backend real esto vendría del contrato/usuario.
function emailDeNombre(nombre: string): string {
  return `${nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .split(/\s+/)
    .join('.')}@gmail.com`;
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
