'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Briefcase,
  Building2,
  CheckCircle2,
  CreditCard,
  Download,
  FileText,
  Gift,
  Globe2,
  GraduationCap,
  Handshake,
  MapPin,
  Plus,
  ScrollText,
  Trash2,
  Users,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@llave/ui/avatar';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@llave/ui/card';
import { ConfirmDialog } from '@llave/ui/confirm-dialog';
import { Input } from '@llave/ui/input';
import { Label } from '@llave/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@llave/ui/select';
import { Separator } from '@llave/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@llave/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@llave/ui/tabs';
import { Textarea } from '@llave/ui/textarea';
import { toast } from '@llave/ui/use-toast';
import { apiEnabled } from '@/lib/api/client';
import { CompararPlanesDialog } from '@/components/comparar-planes-dialog';
import { descargarCsv } from '@/lib/csv-export';
import { abrirReporteImprimible } from '@/lib/reportes-pdf';
import { sociedadPrincipal } from '@/lib/sociedades-storage';
import { MatrizPermisosCard } from '@/components/matriz-permisos-card';
import { PinSeguridadCard } from '@/components/pin-seguridad-card';
import { relanzarOnboardingInmo } from '@/components/onboarding';
import { Topbar } from '@/components/topbar';
import { TRAMOS_PLAN, calcularResumenPlan, facturasMock } from '@/lib/plan';
import { BannerMigracion } from '@/components/banner-migracion';
import { ConfiguracionPais } from '@/components/configuracion-pais';
import { ConveniosBrowser } from '@/components/convenios-browser';
import { CuponInput } from '@/components/cupon-input';
import { EstadoCuentaCard } from '@/components/estado-cuenta-card';
import { FormaPagoSelector } from '@/components/forma-pago-selector';
import { PlanConsorciosCard } from '@/components/plan-consorcios-card';
import { ReferidosManager } from '@/components/referidos-manager';
import { SociedadesManager } from '@/components/sociedades-manager';
import { TrialCardDemo } from '@/components/trial-card-demo';
import { formatFechaCorta, formatMonto, formatPeriodo } from '@/lib/format';
import {
  listarAuditoria,
  moduloDeTipo,
  tipoEventoLabel,
  MODULO_LABEL,
  type EventoAuditoria,
  type ModuloAuditoria,
  type TipoEventoAuditoria,
} from '@/lib/auditoria-storage';
import { validarCuit } from '@/lib/cuit';
import {
  DATOS_EMPRESA_DEFAULT,
  guardarDatosEmpresa,
  leerDatosEmpresa,
  validarDatosEmpresa,
  type DatosEmpresa,
} from '@/lib/empresa-storage';

type Rol = 'ADMIN' | 'OPERADOR' | 'CARGA' | 'LECTURA';

interface Miembro {
  id: string;
  nombre: string;
  email: string;
  rol: Rol;
  ultimoAcceso: string;
}

const equipoInicial: Miembro[] = [
  {
    id: '1',
    nombre: 'Roberto Tapia',
    email: 'roberto@inmosol.com.ar',
    rol: 'ADMIN',
    ultimoAcceso: '2026-05-11T10:14:00-03:00',
  },
  {
    id: '2',
    nombre: 'Luciana Vidal',
    email: 'luciana@inmosol.com.ar',
    rol: 'OPERADOR',
    ultimoAcceso: '2026-05-10T18:42:00-03:00',
  },
  {
    id: '3',
    nombre: 'Sergio Almeida',
    email: 'sergio@inmosol.com.ar',
    rol: 'OPERADOR',
    ultimoAcceso: '2026-05-11T09:05:00-03:00',
  },
  {
    id: '4',
    // I2-08: "Contador externo" era un rol, no un nombre. El resto del equipo
    // tiene nombres reales; usamos uno coherente con el email (martin.contador).
    // El rol "Solo lectura" ya comunica que es un externo de consulta.
    nombre: 'Martín Herrera',
    email: 'martin.contador@gmail.com',
    rol: 'LECTURA',
    ultimoAcceso: '2026-05-08T11:20:00-03:00',
  },
  {
    id: '5',
    nombre: 'Camila Acosta (admin. asistente)',
    email: 'camila.acosta@inmosol.com.ar',
    rol: 'CARGA',
    ultimoAcceso: '2026-05-11T16:30:00-03:00',
  },
];

const ROLES: Record<Rol, { label: string; descripcion: string; variant: 'default' | 'secondary' | 'success' | 'warning' }> = {
  ADMIN: {
    label: 'Admin',
    descripcion: 'Gestiona inmobiliaria, equipo, plan y facturación. Puede borrar.',
    variant: 'default',
  },
  OPERADOR: {
    label: 'Operador',
    descripcion: 'Gestiona contratos, pagos, reclamos y screening. No accede a plan ni equipo.',
    variant: 'success',
  },
  CARGA: {
    label: 'Carga limitada',
    descripcion: 'Sólo carga contratos y propiedades. No ve pagos, reclamos ni screening.',
    variant: 'warning',
  },
  LECTURA: {
    label: 'Solo lectura',
    descripcion: 'Ve los datos pero no puede modificar nada.',
    variant: 'secondary',
  },
};


const estadoFacturaConfig: Record<
  'PAGADA' | 'PENDIENTE' | 'VENCIDA',
  { label: string; variant: 'success' | 'warning' | 'destructive' }
> = {
  PAGADA: { label: 'Pagada', variant: 'success' },
  PENDIENTE: { label: 'Pendiente', variant: 'warning' },
  VENCIDA: { label: 'Vencida', variant: 'destructive' },
};

export default function ConfiguracionPage() {
  // Empresa — hidratado desde localStorage en el primer mount para que
  // sobreviva al refresh. El default replica al mock anterior para
  // primera carga.
  const [datos, setDatos] = useState<DatosEmpresa>(DATOS_EMPRESA_DEFAULT);
  const [erroresEmpresa, setErroresEmpresa] = useState<
    Partial<Record<keyof DatosEmpresa, string>>
  >({});
  useEffect(() => {
    setDatos(leerDatosEmpresa());
  }, []);

  // Equipo
  const [equipo, setEquipo] = useState<Miembro[]>(equipoInicial);
  const [paraEliminar, setParaEliminar] = useState<Miembro | null>(null);
  const [showInvitar, setShowInvitar] = useState(false);
  const [nuevoEmail, setNuevoEmail] = useState('');
  const [nuevoRol, setNuevoRol] = useState<Rol>('OPERADOR');
  const [compararPlanesOpen, setCompararPlanesOpen] = useState(false);

  // Deep-linking: la tab activa se controla por el hash de la URL.
  // Esto permite enlazar a /configuracion#convenios desde otros lugares
  // del panel (ej. badge co-branding de la topbar) y abrir directamente
  // en esa tab.
  const TABS_VALIDAS = [
    'empresa',
    'sociedades',
    'equipo',
    'plan',
    'convenios',
    'referidos',
    'mercado',
    'auditoria',
  ] as const;
  type TabConfig = (typeof TABS_VALIDAS)[number];

  const [tabActiva, setTabActiva] = useState<TabConfig>('empresa');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sincronizarDesdeHash = () => {
      const hash = window.location.hash.replace('#', '');
      if ((TABS_VALIDAS as readonly string[]).includes(hash)) {
        setTabActiva(hash as TabConfig);
      }
    };
    sincronizarDesdeHash();
    window.addEventListener('hashchange', sincronizarDesdeHash);
    return () => window.removeEventListener('hashchange', sincronizarDesdeHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cambiarTab = (v: string) => {
    setTabActiva(v as TabConfig);
    if (typeof window !== 'undefined') {
      // replaceState para no apilar entradas en el historial cada vez que
      // se cambia de tab.
      const url = `${window.location.pathname}#${v}`;
      window.history.replaceState(null, '', url);
    }
  };

  const plan = useMemo(() => calcularResumenPlan(), []);

  const guardarEmpresa = () => {
    const validacionBase = validarDatosEmpresa(datos);
    const errores = { ...validacionBase.errores };
    // CUIT: además del required, validamos el dígito verificador con el
    // algoritmo AFIP (`lib/cuit.ts`).
    if (!errores.cuit) {
      const v = validarCuit(datos.cuit);
      if (!v.valido) errores.cuit = v.motivo ?? 'CUIT inválido';
    }
    if (Object.keys(errores).length > 0) {
      setErroresEmpresa(errores);
      toast({
        variant: 'destructive',
        title: 'Revisá los campos marcados',
        description:
          Object.values(errores)[0] ?? 'Hay datos obligatorios sin completar.',
      });
      return;
    }
    setErroresEmpresa({});
    guardarDatosEmpresa(datos);
    toast({
      variant: 'success',
      title: 'Cambios guardados',
      description: 'Actualizamos los datos de la inmobiliaria.',
    });
  };

  const eliminarMiembro = () => {
    if (!paraEliminar) return;
    setEquipo((prev) => prev.filter((m) => m.id !== paraEliminar.id));
    toast({
      title: 'Acceso revocado',
      description: `${paraEliminar.nombre} ya no puede entrar al panel.`,
    });
    setParaEliminar(null);
  };

  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const emailInvitarValido = EMAIL_REGEX.test(nuevoEmail.trim());

  const invitar = () => {
    // El botón ya viene deshabilitado si el email no es válido (ver
    // `confirmDisabled` abajo). Este guard es la red de seguridad.
    if (!emailInvitarValido) {
      toast({ title: 'Email inválido', variant: 'destructive' });
      return;
    }
    const nuevo: Miembro = {
      id: Math.random().toString(36).slice(2),
      nombre: nuevoEmail.split('@')[0] ?? 'Nuevo',
      email: nuevoEmail,
      rol: nuevoRol,
      ultimoAcceso: '',
    };
    setEquipo((prev) => [...prev, nuevo]);
    setShowInvitar(false);
    setNuevoEmail('');
    setNuevoRol('OPERADOR');
    toast({
      title: 'Invitación enviada',
      description: `${nuevoEmail} recibe un email para activar su cuenta.`,
    });
  };

  // En producción (apiEnabled) ninguna de las secciones de esta página tiene
  // endpoint en el API: empresa, sociedades, equipo, plan, convenios y
  // auditoría escriben todo a localStorage (empresa-storage, sociedades-storage,
  // auditoria-storage, etc.). "Guardar" acá no persistiría nada del lado del
  // servidor y mostraría datos mock, así que gateamos la pantalla completa con
  // un estado "disponible pronto". En build demo (!apiEnabled) la config queda
  // intacta.
  if (apiEnabled) {
    return (
      <>
        <Topbar titulo="Configuración" />
        <main className="flex-1 p-4 md:p-6">
          <Card className="mx-auto max-w-md">
            <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
                <Building2 className="h-7 w-7" />
              </div>
              <div className="space-y-1.5">
                <h1 className="text-lg font-semibold">Configuración</h1>
                <p className="text-sm text-muted-foreground">
                  Estamos terminando de conectar los datos de tu inmobiliaria,
                  sociedades, equipo y facturación. Esta sección va a estar
                  disponible pronto.
                </p>
              </div>
              <Badge variant="secondary">Disponible pronto</Badge>
            </CardContent>
          </Card>
        </main>
      </>
    );
  }

  return (
    <>
      <Topbar titulo="Configuración" />
      <main className="flex-1 space-y-6 p-4 md:p-6">
        {/* Banner del tutorial */}
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex flex-wrap items-center gap-3 p-4">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Tutorial guiado</p>
              <p className="text-xs text-muted-foreground">
                Repasá las funciones principales del panel en menos de 1 minuto.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={relanzarOnboardingInmo}>
              Ver tutorial
            </Button>
          </CardContent>
        </Card>

        <Tabs value={tabActiva} onValueChange={cambiarTab}>
          <TabsList className="h-auto flex-wrap justify-start gap-1 p-1">
            <TabsTrigger value="empresa">
              <Building2 className="mr-1.5 h-3.5 w-3.5" />
              Empresa
            </TabsTrigger>
            <TabsTrigger value="sociedades">
              <Briefcase className="mr-1.5 h-3.5 w-3.5" />
              Sociedades
            </TabsTrigger>
            <TabsTrigger value="equipo">
              <Users className="mr-1.5 h-3.5 w-3.5" />
              Equipo y permisos
            </TabsTrigger>
            <TabsTrigger value="plan">
              <CreditCard className="mr-1.5 h-3.5 w-3.5" />
              Plan y facturas
            </TabsTrigger>
            <TabsTrigger value="convenios">
              <Handshake className="mr-1.5 h-3.5 w-3.5" />
              Convenios
            </TabsTrigger>
            <TabsTrigger value="referidos">
              <Gift className="mr-1.5 h-3.5 w-3.5" />
              Invitar colegas
            </TabsTrigger>
            <TabsTrigger value="mercado">
              <Globe2 className="mr-1.5 h-3.5 w-3.5" />
              Mercado
            </TabsTrigger>
            <TabsTrigger value="auditoria">
              <ScrollText className="mr-1.5 h-3.5 w-3.5" />
              Auditoría
            </TabsTrigger>
          </TabsList>

          {/* EMPRESA */}
          <TabsContent value="empresa" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Datos de la inmobiliaria</CardTitle>
                <CardDescription>
                  Estos datos aparecen en los contratos y comprobantes que ven los inquilinos y propietarios.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <Field
                  label="Nombre comercial"
                  required
                  error={erroresEmpresa.nombre}
                  value={datos.nombre}
                  onChange={(v) => {
                    setDatos({ ...datos, nombre: v });
                    if (erroresEmpresa.nombre) {
                      setErroresEmpresa({ ...erroresEmpresa, nombre: undefined });
                    }
                  }}
                />
                <Field
                  label="CUIT"
                  required
                  error={erroresEmpresa.cuit}
                  value={datos.cuit}
                  onChange={(v) => {
                    setDatos({ ...datos, cuit: v });
                    if (erroresEmpresa.cuit) {
                      setErroresEmpresa({ ...erroresEmpresa, cuit: undefined });
                    }
                  }}
                />
                <Field
                  label="Email administrador"
                  required
                  type="email"
                  autoComplete="email"
                  error={erroresEmpresa.email}
                  value={datos.email}
                  onChange={(v) => {
                    setDatos({ ...datos, email: v });
                    if (erroresEmpresa.email) {
                      setErroresEmpresa({ ...erroresEmpresa, email: undefined });
                    }
                  }}
                />
                <Field
                  label="Teléfono"
                  type="tel"
                  autoComplete="tel"
                  value={datos.telefono}
                  onChange={(v) => setDatos({ ...datos, telefono: v })}
                />
                <Field
                  label="Matrícula profesional"
                  value={datos.matricula}
                  onChange={(v) => setDatos({ ...datos, matricula: v })}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  Dirección comercial
                </CardTitle>
                <CardDescription>Dónde se encuentra físicamente tu inmobiliaria.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-3">
                <div className="md:col-span-2">
                  <Field
                    label="Calle"
                    value={datos.direccionCalle}
                    onChange={(v) => setDatos({ ...datos, direccionCalle: v })}
                  />
                </div>
                <Field
                  label="Altura"
                  value={datos.direccionAltura}
                  onChange={(v) => setDatos({ ...datos, direccionAltura: v })}
                />
                <Field
                  label="Piso / Dto"
                  value={datos.direccionPiso}
                  onChange={(v) => setDatos({ ...datos, direccionPiso: v })}
                />
                <Field
                  label="Ciudad"
                  value={datos.direccionCiudad}
                  onChange={(v) => setDatos({ ...datos, direccionCiudad: v })}
                />
                <Field
                  label="Provincia"
                  value={datos.direccionProvincia}
                  onChange={(v) => setDatos({ ...datos, direccionProvincia: v })}
                />
                <div className="md:col-span-3">
                  <Field
                    label="Código postal"
                    value={datos.direccionCp}
                    onChange={(v) => setDatos({ ...datos, direccionCp: v })}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Datos fiscales (opcionales)</CardTitle>
                <CardDescription>
                  Información que aparece al pie de las facturas que emitís a propietarios.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  aria-label="Datos fiscales"
                  placeholder="Ej: IVA Responsable Inscripto · IIBB Convenio Multilateral 901-234-567"
                  value={datos.notasFiscales}
                  onChange={(e) => setDatos({ ...datos, notasFiscales: e.target.value })}
                  rows={3}
                />
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button onClick={guardarEmpresa} size="lg">
                <CheckCircle2 className="h-4 w-4" />
                Guardar cambios
              </Button>
            </div>
          </TabsContent>

          {/* SOCIEDADES */}
          <TabsContent value="sociedades" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Sociedades que gestionás</CardTitle>
                <CardDescription>
                  Si tu inmobiliaria opera bajo varias razones sociales (S.R.L.,
                  S.A., fideicomisos), administralas desde acá. Cada una factura
                  con su propio CUIT y recibe los pagos en su cuenta.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SociedadesManager />
              </CardContent>
            </Card>
          </TabsContent>

          {/* EQUIPO Y PERMISOS */}
          <TabsContent value="equipo" className="space-y-4">
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle>Equipo</CardTitle>
                  <CardDescription>{equipo.length} {equipo.length === 1 ? 'persona' : 'personas'} con acceso al panel.</CardDescription>
                </div>
                <Button size="sm" onClick={() => setShowInvitar(true)}>
                  <Plus className="h-4 w-4" />
                  Invitar
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {equipo.map((p) => (
                  <div
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar>
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {p.nombre
                            .split(' ')
                            .map((n) => n[0])
                            .join('')
                            .slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium leading-tight">{p.nombre}</p>
                        <p className="truncate text-xs text-muted-foreground">{p.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Select
                        value={p.rol}
                        onValueChange={(v) =>
                          setEquipo((prev) =>
                            prev.map((m) => (m.id === p.id ? { ...m, rol: v as Rol } : m)),
                          )
                        }
                        disabled={p.id === '1'} // Admin principal no se cambia
                      >
                        <SelectTrigger className="w-36">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(ROLES).map(([k, v]) => (
                            <SelectItem key={k} value={k}>
                              {v.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Eliminar a ${p.nombre}`}
                        disabled={p.rol === 'ADMIN' && p.id === '1'}
                        onClick={() => setParaEliminar(p)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <PinSeguridadCard />

            <MatrizPermisosCard />
          </TabsContent>

          {/* PLAN Y FACTURAS */}
          <TabsContent value="plan" className="space-y-4">
            {/* Banner pro-activo: si la inmo viene de la competencia,
                aplicamos cupón MIGRACION25 con un click. Se
                auto-dismissa una vez que el usuario elige o cierra. */}
            <BannerMigracion />

            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="grid gap-6 p-6 md:grid-cols-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Plan actual
                  </p>
                  <p className="mt-1 text-3xl font-bold text-primary">{plan.plan}</p>
                  <p className="text-xs text-muted-foreground">
                    Próxima factura: {formatFechaCorta(plan.proximaFacturacion)}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Propiedades activas
                  </p>
                  <p className="mt-1 text-3xl font-bold tabular-nums">{plan.propiedadesActivas}</p>
                  <p className="text-xs text-muted-foreground">
                    {plan.topePlan !== null
                      ? `de ${plan.topePlan} incluidas en el plan`
                      : 'sin tope · plan Enterprise'}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Importe mensual
                  </p>
                  <p className="mt-1 text-3xl font-bold tabular-nums text-primary">
                    {formatMonto(plan.costoMensualTotal)}
                  </p>
                  <p className="text-xs text-muted-foreground">+ IVA 21% · fijo</p>
                </div>
              </CardContent>
            </Card>

            {/* Tabla comparativa de tramos */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Planes disponibles</CardTitle>
                <CardDescription>
                  El precio es fijo por mes según el tope de propiedades. Subís de plan
                  automáticamente al pasarte del tope.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {TRAMOS_PLAN.map((t) => {
                    const esActual = t.key === plan.key;
                    // Costo efectivo por propiedad asumiendo que el cliente
                    // está exactamente en el TOPE del tramo (lo más eficiente).
                    // Para Enterprise (sin tope) asumimos 250 props.
                    const propsRef = t.hasta ?? 250;
                    const costoPorPropTope = Math.round(t.precio / Math.max(propsRef, 1));
                    return (
                      <div
                        key={t.key}
                        className={`rounded-lg border p-4 ${
                          esActual
                            ? 'border-primary bg-primary/5'
                            : 'border-border bg-card'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold">{t.nombre}</p>
                          {esActual && (
                            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                              Tu plan
                            </span>
                          )}
                        </div>
                        <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">
                          {formatMonto(t.precio)}
                          <span className="text-xs font-normal text-muted-foreground"> / mes</span>
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">{t.rango}</p>
                        <div className="mt-2 border-t pt-2">
                          <p className="text-[9px] uppercase tracking-wide text-muted-foreground">
                            Si llenás el tramo
                          </p>
                          <p className="text-sm font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
                            ≈ {formatMonto(costoPorPropTope)}
                            <span className="text-[10px] font-normal text-muted-foreground">
                              {' '}/ propiedad
                            </span>
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Insight: costo efectivo según TU cartera actual + comparación
                    con el costo "lleno". Le saca el reclamo de Juanpi de que el
                    cliente no ve el beneficio de escala. */}
                <div className="mt-4 grid gap-3 sm:grid-cols-3 rounded-lg border-2 border-emerald-200 bg-emerald-50/40 p-4 dark:border-emerald-900/40 dark:bg-emerald-900/10">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Tu cartera hoy
                    </p>
                    <p className="text-lg font-bold tabular-nums">
                      {plan.propiedadesActivas} propiedad{plan.propiedadesActivas === 1 ? '' : 'es'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Costo efectivo actual
                    </p>
                    <p className="text-lg font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                      {formatMonto(
                        Math.round(plan.costoMensualTotal / Math.max(plan.propiedadesActivas, 1)),
                      )}
                      <span className="text-[10px] font-normal text-muted-foreground">
                        {' '}/ propiedad
                      </span>
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {plan.proximoTramo ? 'Si llenás tu tramo' : 'Tope del tramo'}
                    </p>
                    {plan.topePlan ? (
                      <p className="text-lg font-bold tabular-nums">
                        {formatMonto(Math.round(plan.costoMensualTotal / plan.topePlan))}
                        <span className="text-[10px] font-normal text-muted-foreground">
                          {' '}/ propiedad
                        </span>
                      </p>
                    ) : (
                      <p className="text-lg font-bold tabular-nums">
                        Sin tope
                      </p>
                    )}
                    <p className="text-[10px] text-muted-foreground">
                      {plan.propiedadesParaProximo !== null && plan.propiedadesParaProximo > 0
                        ? `Sumá ${plan.propiedadesParaProximo} más para llenarlo`
                        : 'Ya estás aprovechando todo el tramo'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">¿Cómo funciona el cobro?</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="text-muted-foreground">
                  Pagás un <strong className="text-foreground">precio fijo mensual</strong> según
                  el tramo en el que estés. Si superás el tope de propiedades del plan, se ajusta
                  automáticamente al siguiente tramo en la próxima facturación.
                </p>
                <p className="text-muted-foreground">
                  No hay cargos por inquilino, contratos ni verificaciones — los screenings y todas
                  las features del producto están incluidos.
                </p>
              </CardContent>
            </Card>

            <TrialCardDemo />

            <EstadoCuentaCard />

            <CuponInput />

            <FormaPagoSelector />

            {/* Plan Consorcios: aparece sólo si la inmo administra al
                menos un edificio bajo propiedad horizontal. */}
            <PlanConsorciosCard />

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle>Facturas mes a mes</CardTitle>
                  <CardDescription>
                    Histórico de las últimas {facturasMock.length} factura{facturasMock.length === 1 ? '' : 's'} emitida{facturasMock.length === 1 ? '' : 's'} por My Alquiler.
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    descargarCsv({
                      filename: `facturas-my-alquiler-${new Date().toISOString().slice(0, 10)}`,
                      headers: [
                        'Período',
                        'Fecha emisión',
                        'Propiedades en plan',
                        'Importe total',
                        'Estado',
                        'Fecha pago',
                        'Método pago',
                      ],
                      rows: facturasMock.map((f) => [
                        formatPeriodo(f.periodo),
                        f.fechaEmision,
                        f.propiedadesEnPlan,
                        f.importeTotal,
                        estadoFacturaConfig[f.estado].label,
                        f.fechaPago ?? '—',
                        f.metodoPago ?? '—',
                      ]),
                    });
                    toast({
                      variant: 'success',
                      title: 'CSV descargado',
                      description: `${facturasMock.length} factura${facturasMock.length === 1 ? '' : 's'} exportada${facturasMock.length === 1 ? '' : 's'}. Abrilo en Excel o Sheets.`,
                    });
                  }}
                >
                  <Download className="h-4 w-4" />
                  Exportar CSV
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Período</TableHead>
                      <TableHead>Emitida</TableHead>
                      <TableHead className="text-right">Propiedades</TableHead>
                      <TableHead className="text-right">Importe</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Pagada</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {facturasMock.map((f) => (
                      <TableRow key={f.id}>
                        <TableCell className="font-medium">{formatPeriodo(f.periodo)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatFechaCorta(f.fechaEmision)}
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums">
                          {f.propiedadesEnPlan}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatMonto(f.importeTotal)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={estadoFacturaConfig[f.estado].variant}>
                            {estadoFacturaConfig[f.estado].label}
                          </Badge>
                        </TableCell>
                        <TableCell
                          className="max-w-[180px] truncate text-xs text-muted-foreground"
                          title={
                            f.fechaPago
                              ? `${formatFechaCorta(f.fechaPago)}${
                                  f.metodoPago ? ` · ${f.metodoPago.toLowerCase()}` : ''
                                }`
                              : undefined
                          }
                        >
                          {f.fechaPago ? (
                            <>
                              {formatFechaCorta(f.fechaPago)}
                              {f.metodoPago && (
                                <span className="ml-1 opacity-60">· {f.metodoPago.toLowerCase()}</span>
                              )}
                            </>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              abrirReporteImprimible({
                                titulo: `Factura ${formatPeriodo(f.periodo)}`,
                                subtitulo: `My Alquiler · servicio de gestión inmobiliaria`,
                                inmobiliaria: sociedadPrincipal().razonSocial,
                                columnas: [
                                  { header: 'Concepto', width: '60%' },
                                  { header: 'Cantidad', width: '15%', align: 'right' },
                                  { header: 'Subtotal', width: '25%', align: 'right' },
                                ],
                                filas: [
                                  [
                                    `Plan ${plan.plan} · ${formatPeriodo(f.periodo)}`,
                                    `${f.propiedadesEnPlan} prop.`,
                                    formatMonto(f.importeTotal),
                                  ],
                                ],
                                totales: [
                                  { label: 'Total facturado', valor: formatMonto(f.importeTotal) },
                                  {
                                    label: 'Estado',
                                    valor: estadoFacturaConfig[f.estado].label,
                                  },
                                ],
                                notaFinal: f.fechaPago
                                  ? `Pagada el ${f.fechaPago} vía ${f.metodoPago ?? 'transferencia'}.`
                                  : 'Pendiente de pago. Vence en los próximos días.',
                              });
                            }}
                          >
                            <FileText className="h-3.5 w-3.5" />
                            PDF
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="border-dashed">
              <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
                <div>
                  <p className="font-medium">¿Querés cambiar de plan?</p>
                  <p className="text-sm text-muted-foreground">
                    Tenemos Pro (con marca blanca + sub-cuentas) y Enterprise (custom).
                  </p>
                </div>
                <Button variant="outline" onClick={() => setCompararPlanesOpen(true)}>
                  Comparar planes
                </Button>
                <CompararPlanesDialog
                  open={compararPlanesOpen}
                  onOpenChange={setCompararPlanesOpen}
                  planActual={plan.plan}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* CONVENIOS */}
          <TabsContent value="convenios" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Convenios con colegios y cámaras</CardTitle>
                <CardDescription>
                  Si pertenecés a algún colegio o cámara que tenga convenio
                  con My Alquiler, activá el beneficio acá para acceder a un
                  descuento permanente sobre tu plan.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ConveniosBrowser />
              </CardContent>
            </Card>
          </TabsContent>

          {/* REFERIDOS */}
          <TabsContent value="referidos" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Invitá colegas y sumá meses gratis</CardTitle>
                <CardDescription>
                  Por cada colega que se sume con tu código, ambos ganan 1 mes
                  gratis. Acá tenés todo lo que necesitás para invitarlos.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ReferidosManager />
              </CardContent>
            </Card>
          </TabsContent>

          {/* MERCADO */}
          <TabsContent value="mercado" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Mercado y país de operación</CardTitle>
                <CardDescription>
                  Si operás fuera de Argentina, configurá país, moneda e índice
                  de ajuste. El producto adapta los formatos y los validadores
                  legales en consecuencia.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ConfiguracionPais />
              </CardContent>
            </Card>
          </TabsContent>

          {/* AUDITORÍA */}
          <TabsContent value="auditoria" className="space-y-4">
            <AuditoriaTab />
          </TabsContent>

        </Tabs>
      </main>

      <ConfirmDialog
        open={paraEliminar !== null}
        onOpenChange={(open) => !open && setParaEliminar(null)}
        title={`¿Sacar a ${paraEliminar?.nombre} del equipo?`}
        description="Pierde el acceso al panel inmediatamente. Podés volver a invitarlo cuando quieras."
        confirmLabel="Sí, sacarlo"
        variant="destructive"
        onConfirm={eliminarMiembro}
      />

      <ConfirmDialog
        open={showInvitar}
        onOpenChange={(open) => {
          setShowInvitar(open);
          if (!open) setNuevoEmail('');
        }}
        title="Invitar al equipo"
        description={
          <div className="space-y-3 pt-2">
            <p className="text-sm text-muted-foreground">
              Le mandamos un email para que active su cuenta y entre al panel.
            </p>
            <div className="space-y-2">
              <Label htmlFor="invite-email" className="flex items-center gap-1">
                Email
                <span aria-hidden="true" className="text-destructive">*</span>
              </Label>
              <Input
                id="invite-email"
                type="email"
                autoComplete="email"
                value={nuevoEmail}
                onChange={(e) => setNuevoEmail(e.target.value)}
                placeholder="persona@inmosol.com.ar"
                required
                aria-required="true"
                aria-invalid={
                  nuevoEmail.length > 0 && !emailInvitarValido ? true : undefined
                }
                aria-describedby={
                  nuevoEmail.length > 0 && !emailInvitarValido
                    ? 'invite-email-error'
                    : undefined
                }
                className={
                  nuevoEmail.length > 0 && !emailInvitarValido
                    ? 'border-destructive focus-visible:ring-destructive'
                    : undefined
                }
              />
              {nuevoEmail.length > 0 && !emailInvitarValido && (
                <p
                  id="invite-email-error"
                  role="alert"
                  className="text-xs text-destructive"
                >
                  Formato inválido (ej: persona@inmo.com.ar)
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-rol">Rol</Label>
              <Select value={nuevoRol} onValueChange={(v) => setNuevoRol(v as Rol)}>
                <SelectTrigger id="invite-rol">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ROLES).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v.label} — {v.descripcion}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        }
        confirmLabel="Enviar invitación"
        confirmDisabled={!emailInvitarValido}
        onConfirm={invitar}
      />
    </>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
  error,
  type,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  error?: string;
  type?: string;
  autoComplete?: string;
}) {
  const id = `cfg-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="flex items-center gap-1">
        {label}
        {required && (
          <span aria-hidden="true" className="text-destructive">
            *
          </span>
        )}
      </Label>
      <Input
        id={id}
        type={type}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        className={error ? 'border-destructive focus-visible:ring-destructive' : undefined}
      />
      {error && (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

// ============================================================
// TAB DE AUDITORÍA
// ============================================================

const PAGINA_TAMANIO = 50;

function AuditoriaTab() {
  const [eventos, setEventos] = useState<EventoAuditoria[]>(() => listarAuditoria());
  const [filtroTipo, setFiltroTipo] = useState<'todos' | TipoEventoAuditoria>('todos');
  const [filtroAutor, setFiltroAutor] = useState<string>('todos');
  const [filtroModulo, setFiltroModulo] = useState<'todos' | ModuloAuditoria>('todos');
  const [busqueda, setBusqueda] = useState('');
  const [pagina, setPagina] = useState(0);
  const [rangoDias, setRangoDias] = useState<'todos' | '7' | '30' | '90'>('todos');

  function refrescar() {
    setEventos(listarAuditoria());
    setPagina(0);
  }

  const autores = useMemo(() => {
    const set = new Set<string>();
    eventos.forEach((e) => set.add(e.autor));
    return Array.from(set).sort();
  }, [eventos]);

  const filtrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    const limiteTs =
      rangoDias === 'todos'
        ? null
        : Date.now() - parseInt(rangoDias, 10) * 86400_000;
    return eventos.filter((e) => {
      if (filtroTipo !== 'todos' && e.tipo !== filtroTipo) return false;
      if (filtroAutor !== 'todos' && e.autor !== filtroAutor) return false;
      if (filtroModulo !== 'todos' && moduloDeTipo[e.tipo] !== filtroModulo) return false;
      if (limiteTs !== null && Date.parse(e.fecha) < limiteTs) return false;
      if (termino) {
        const hay =
          e.autor.toLowerCase().includes(termino) ||
          e.entidadDescripcion.toLowerCase().includes(termino) ||
          (e.detalle?.toLowerCase().includes(termino) ?? false) ||
          tipoEventoLabel[e.tipo].toLowerCase().includes(termino);
        if (!hay) return false;
      }
      return true;
    });
  }, [eventos, filtroTipo, filtroAutor, filtroModulo, rangoDias, busqueda]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / PAGINA_TAMANIO));
  const paginaSegura = Math.min(pagina, totalPaginas - 1);
  const visibles = useMemo(() => {
    const desde = paginaSegura * PAGINA_TAMANIO;
    return filtrados.slice(desde, desde + PAGINA_TAMANIO);
  }, [filtrados, paginaSegura]);

  // Agrupar la página actual por día para timeline
  const porDia = useMemo(() => {
    const map = new Map<string, EventoAuditoria[]>();
    visibles.forEach((e) => {
      const dia = e.fecha.slice(0, 10);
      const lista = map.get(dia) ?? [];
      lista.push(e);
      map.set(dia, lista);
    });
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [visibles]);

  useEffect(() => {
    setPagina(0);
  }, [filtroTipo, filtroAutor, filtroModulo, rangoDias, busqueda]);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ScrollText className="h-5 w-5" />
            Auditoría de acciones
          </CardTitle>
          <CardDescription>
            Registro de cada acción sensible (pagos, contratos, caja, equipo). Sirve para
            auditar qué hizo cada usuario y tener trazabilidad legal.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            aria-label="Buscar en historial de cambios"
            placeholder="Buscar por inquilino, dirección, monto, motivo…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="aud-modulo" className="text-xs">Módulo</Label>
              <Select value={filtroModulo} onValueChange={(v) => setFiltroModulo(v as typeof filtroModulo)}>
                <SelectTrigger id="aud-modulo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los módulos</SelectItem>
                  {(Object.keys(MODULO_LABEL) as ModuloAuditoria[]).map((m) => (
                    <SelectItem key={m} value={m}>
                      {MODULO_LABEL[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="aud-tipo" className="text-xs">Tipo de evento</Label>
              <Select value={filtroTipo} onValueChange={(v) => setFiltroTipo(v as typeof filtroTipo)}>
                <SelectTrigger id="aud-tipo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los tipos</SelectItem>
                  {(Object.keys(tipoEventoLabel) as TipoEventoAuditoria[]).map((t) => (
                    <SelectItem key={t} value={t}>
                      {tipoEventoLabel[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="aud-usuario" className="text-xs">Usuario</Label>
              <Select value={filtroAutor} onValueChange={setFiltroAutor}>
                <SelectTrigger id="aud-usuario">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los usuarios</SelectItem>
                  {autores.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="aud-rango" className="text-xs">Rango</Label>
              <Select value={rangoDias} onValueChange={(v) => setRangoDias(v as typeof rangoDias)}>
                <SelectTrigger id="aud-rango">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todo el historial</SelectItem>
                  <SelectItem value="7">Últimos 7 días</SelectItem>
                  <SelectItem value="30">Últimos 30 días</SelectItem>
                  <SelectItem value="90">Últimos 90 días</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              Mostrando <strong className="text-foreground">{visibles.length}</strong> de{' '}
              <strong className="text-foreground">{filtrados.length}</strong> filtrado
              {filtrados.length === 1 ? '' : 's'} ·{' '}
              {eventos.length} evento{eventos.length === 1 ? '' : 's'} en total
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={refrescar}>
                Refrescar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {porDia.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No hay eventos para los filtros seleccionados.
          </CardContent>
        </Card>
      ) : (
        porDia.map(([dia, eventosDia]) => (
          <Card key={dia}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-muted-foreground">
                {formatFechaCorta(`${dia}T12:00:00-03:00`)}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {eventosDia.map((evento) => (
                <EventoRow key={evento.id} evento={evento} />
              ))}
            </CardContent>
          </Card>
        ))
      )}

      {totalPaginas > 1 && (
        <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3 text-xs">
          <Button
            variant="outline"
            size="sm"
            disabled={paginaSegura === 0}
            onClick={() => setPagina((p) => Math.max(0, p - 1))}
          >
            ← Anterior
          </Button>
          <span className="text-muted-foreground">
            Página <strong className="text-foreground">{paginaSegura + 1}</strong> de{' '}
            {totalPaginas}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={paginaSegura >= totalPaginas - 1}
            onClick={() => setPagina((p) => p + 1)}
          >
            Siguiente →
          </Button>
        </div>
      )}
    </>
  );
}

function EventoRow({ evento }: { evento: EventoAuditoria }) {
  const hora = new Date(evento.fecha).toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const iniciales = evento.autor
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();

  return (
    <div className="flex items-start gap-3 border-l-2 border-muted pl-3">
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback className="text-xs">{iniciales}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span className="font-medium">{evento.autor}</span>
          <Badge variant="outline" className="text-[10px]">
            {evento.rolAutor.charAt(0) + evento.rolAutor.slice(1).toLowerCase()}
          </Badge>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">{tipoEventoLabel[evento.tipo]}</span>
        </div>
        <div className="text-sm font-medium">{evento.entidadDescripcion}</div>
        {evento.detalle && (
          <div className="text-xs text-muted-foreground">{evento.detalle}</div>
        )}
      </div>
      <div className="shrink-0 text-xs text-muted-foreground">{hora}</div>
    </div>
  );
}

