'use client';

import { useMemo, useState } from 'react';
import {
  Briefcase,
  Building2,
  CheckCircle2,
  CreditCard,
  Download,
  FileText,
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
import { relanzarOnboardingInmo } from '@/components/onboarding';
import { Topbar } from '@/components/topbar';
import { TRAMOS_PLAN, calcularResumenPlan, facturasMock } from '@/lib/plan';
import { ConveniosBrowser } from '@/components/convenios-browser';
import { CuponInput } from '@/components/cupon-input';
import { EstadoCuentaCard } from '@/components/estado-cuenta-card';
import { FormaPagoSelector } from '@/components/forma-pago-selector';
import { SociedadesManager } from '@/components/sociedades-manager';
import { TrialBanner } from '@/components/trial-banner';
import { formatFecha, formatMonto, formatPeriodo } from '@/lib/format';
import {
  listarAuditoria,
  tipoEventoLabel,
  type EventoAuditoria,
  type TipoEventoAuditoria,
} from '@/lib/auditoria-storage';

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
    nombre: 'Contador externo',
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

const PERMISOS = [
  { key: 'contratos.ver', label: 'Ver contratos', roles: ['ADMIN', 'OPERADOR', 'CARGA', 'LECTURA'] as Rol[] },
  { key: 'contratos.crear', label: 'Crear / editar contratos', roles: ['ADMIN', 'OPERADOR', 'CARGA'] as Rol[] },
  { key: 'pagos.ver', label: 'Ver pagos y rendiciones', roles: ['ADMIN', 'OPERADOR', 'LECTURA'] as Rol[] },
  { key: 'pagos.conciliar', label: 'Conciliar pagos', roles: ['ADMIN', 'OPERADOR'] as Rol[] },
  { key: 'reclamos.gestion', label: 'Gestionar reclamos', roles: ['ADMIN', 'OPERADOR'] as Rol[] },
  { key: 'caja.cargar', label: 'Cargar gastos de caja', roles: ['ADMIN', 'OPERADOR'] as Rol[] },
  { key: 'screening', label: 'Verificar inquilinos', roles: ['ADMIN', 'OPERADOR'] as Rol[] },
  { key: 'propiedades.crear', label: 'Cargar propiedades', roles: ['ADMIN', 'OPERADOR', 'CARGA'] as Rol[] },
  { key: 'propiedades.borrar', label: 'Eliminar propiedades', roles: ['ADMIN'] as Rol[] },
  { key: 'equipo', label: 'Gestionar equipo', roles: ['ADMIN'] as Rol[] },
  { key: 'plan', label: 'Gestionar plan y facturación', roles: ['ADMIN'] as Rol[] },
] as const;

const estadoFacturaConfig: Record<
  'PAGADA' | 'PENDIENTE' | 'VENCIDA',
  { label: string; variant: 'success' | 'warning' | 'destructive' }
> = {
  PAGADA: { label: 'Pagada', variant: 'success' },
  PENDIENTE: { label: 'Pendiente', variant: 'warning' },
  VENCIDA: { label: 'Vencida', variant: 'destructive' },
};

export default function ConfiguracionPage() {
  // Empresa
  const [datos, setDatos] = useState({
    nombre: 'Inmobiliaria del Sol',
    cuit: '30-71234567-9',
    email: 'contacto@inmosol.com.ar',
    telefono: '+54 11 4532 1100',
    matricula: 'CUCICBA 5872',
    direccionCalle: 'Av. Santa Fe',
    direccionAltura: '2890',
    direccionPiso: '5°B',
    direccionCiudad: 'CABA',
    direccionProvincia: 'Buenos Aires',
    direccionCp: '1425',
    notasFiscales: '',
  });

  // Equipo
  const [equipo, setEquipo] = useState<Miembro[]>(equipoInicial);
  const [paraEliminar, setParaEliminar] = useState<Miembro | null>(null);
  const [showInvitar, setShowInvitar] = useState(false);
  const [nuevoEmail, setNuevoEmail] = useState('');
  const [nuevoRol, setNuevoRol] = useState<Rol>('OPERADOR');

  const plan = useMemo(() => calcularResumenPlan(), []);

  const guardarEmpresa = () => {
    toast({ title: 'Cambios guardados', description: 'Actualizamos los datos de la inmobiliaria.' });
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

  const invitar = () => {
    if (!nuevoEmail.includes('@')) {
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

        <Tabs defaultValue="empresa">
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
                  value={datos.nombre}
                  onChange={(v) => setDatos({ ...datos, nombre: v })}
                />
                <Field
                  label="CUIT"
                  value={datos.cuit}
                  onChange={(v) => setDatos({ ...datos, cuit: v })}
                />
                <Field
                  label="Email administrador"
                  value={datos.email}
                  onChange={(v) => setDatos({ ...datos, email: v })}
                />
                <Field
                  label="Teléfono"
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
                  <CardDescription>{equipo.length} personas con acceso al panel.</CardDescription>
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

            <Card>
              <CardHeader>
                <CardTitle>Qué puede hacer cada rol</CardTitle>
                <CardDescription>
                  Matriz de permisos por rol. Los administradores ven todo y manejan plan y equipo.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(Object.keys(ROLES) as Rol[]).map((rol) => (
                    <div key={rol} className="rounded-lg border p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Badge variant={ROLES[rol].variant}>{ROLES[rol].label}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {equipo.filter((m) => m.rol === rol).length} persona
                            {equipo.filter((m) => m.rol === rol).length === 1 ? '' : 's'}
                          </span>
                        </div>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">{ROLES[rol].descripcion}</p>
                      <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
                        {PERMISOS.map((p) => {
                          const tiene = p.roles.includes(rol);
                          return (
                            <li
                              key={p.key}
                              className={`flex items-center gap-2 text-xs ${
                                tiene ? '' : 'text-muted-foreground line-through opacity-60'
                              }`}
                            >
                              {tiene ? (
                                <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-500" />
                              ) : (
                                <span className="h-3 w-3 shrink-0" />
                              )}
                              {p.label}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* PLAN Y FACTURAS */}
          <TabsContent value="plan" className="space-y-4">
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="grid gap-6 p-6 md:grid-cols-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Plan actual
                  </p>
                  <p className="mt-1 text-3xl font-bold text-primary">{plan.plan}</p>
                  <p className="text-xs text-muted-foreground">
                    Próxima factura: {formatFecha(plan.proximaFacturacion)}
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
                      </div>
                    );
                  })}
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

            <TrialBanner />

            <EstadoCuentaCard />

            <CuponInput />

            <FormaPagoSelector />

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle>Facturas mes a mes</CardTitle>
                  <CardDescription>
                    Histórico de las últimas {facturasMock.length} facturas emitidas por My Alquiler.
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    toast({
                      title: 'Generando CSV…',
                      description: 'Te lo enviamos por mail en unos segundos.',
                    })
                  }
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
                          {formatFecha(f.fechaEmision)}
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
                        <TableCell className="text-xs text-muted-foreground">
                          {f.fechaPago ? (
                            <>
                              {formatFecha(f.fechaPago)}
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
                            onClick={() =>
                              toast({
                                title: 'Preparando factura…',
                                description: `Factura de ${formatPeriodo(f.periodo)} · te llega al mail.`,
                              })
                            }
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
                <Button
                  variant="outline"
                  onClick={() =>
                    toast({
                      title: 'Próximamente',
                      description: 'Pronto vas a poder comparar planes desde acá.',
                    })
                  }
                >
                  Comparar planes
                </Button>
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
        onOpenChange={setShowInvitar}
        title="Invitar al equipo"
        description={
          <div className="space-y-3 pt-2">
            <p className="text-sm text-muted-foreground">
              Le mandamos un email para que active su cuenta y entre al panel.
            </p>
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                value={nuevoEmail}
                onChange={(e) => setNuevoEmail(e.target.value)}
                placeholder="persona@inmosol.com.ar"
              />
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
        onConfirm={invitar}
      />
    </>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

// ============================================================
// TAB DE AUDITORÍA
// ============================================================

function AuditoriaTab() {
  const [eventos, setEventos] = useState<EventoAuditoria[]>(() => listarAuditoria());
  const [filtroTipo, setFiltroTipo] = useState<'todos' | TipoEventoAuditoria>('todos');
  const [filtroAutor, setFiltroAutor] = useState<string>('todos');

  // Refrescar al volver a la tab (por si se registró algo en otra ventana/acción)
  function refrescar() {
    setEventos(listarAuditoria());
  }

  const autores = useMemo(() => {
    const set = new Set<string>();
    eventos.forEach((e) => set.add(e.autor));
    return Array.from(set).sort();
  }, [eventos]);

  const filtrados = useMemo(() => {
    return eventos.filter((e) => {
      if (filtroTipo !== 'todos' && e.tipo !== filtroTipo) return false;
      if (filtroAutor !== 'todos' && e.autor !== filtroAutor) return false;
      return true;
    });
  }, [eventos, filtroTipo, filtroAutor]);

  // Agrupar por día para timeline
  const porDia = useMemo(() => {
    const map = new Map<string, EventoAuditoria[]>();
    filtrados.forEach((e) => {
      const dia = e.fecha.slice(0, 10);
      const lista = map.get(dia) ?? [];
      lista.push(e);
      map.set(dia, lista);
    });
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtrados]);

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
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo de evento</Label>
              <Select value={filtroTipo} onValueChange={(v) => setFiltroTipo(v as typeof filtroTipo)}>
                <SelectTrigger>
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
              <Label className="text-xs">Usuario</Label>
              <Select value={filtroAutor} onValueChange={setFiltroAutor}>
                <SelectTrigger>
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
            <div className="flex items-end">
              <Button variant="outline" size="sm" onClick={refrescar}>
                Refrescar
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Mostrando <strong className="text-foreground">{filtrados.length}</strong> de{' '}
              {eventos.length} eventos
            </span>
            <span>Se guardan los últimos 500 eventos</span>
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
                {formatFecha(`${dia}T12:00:00-03:00`)}
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
            {evento.rolAutor}
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

