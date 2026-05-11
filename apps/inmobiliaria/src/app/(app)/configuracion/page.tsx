'use client';

import { useMemo, useState } from 'react';
import {
  Building2,
  CheckCircle2,
  CreditCard,
  Download,
  FileText,
  GraduationCap,
  MapPin,
  Plus,
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
import { COSTO_PROPIEDAD_MENSUAL, calcularResumenPlan, facturasMock } from '@/lib/plan';
import { formatFecha, formatMonto, formatPeriodo } from '@/lib/format';

type Rol = 'ADMIN' | 'OPERADOR' | 'LECTURA';

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
];

const ROLES: Record<Rol, { label: string; descripcion: string; variant: 'default' | 'secondary' | 'success' }> = {
  ADMIN: {
    label: 'Admin',
    descripcion: 'Gestiona inmobiliaria, equipo, plan y facturación. Puede borrar.',
    variant: 'default',
  },
  OPERADOR: {
    label: 'Operador',
    descripcion: 'Gestiona contratos, reclamos y screening. No accede a plan ni equipo.',
    variant: 'success',
  },
  LECTURA: {
    label: 'Solo lectura',
    descripcion: 'Ve los datos pero no puede modificar nada.',
    variant: 'secondary',
  },
};

const PERMISOS = [
  { key: 'contratos.ver', label: 'Ver contratos', roles: ['ADMIN', 'OPERADOR', 'LECTURA'] as Rol[] },
  { key: 'contratos.crear', label: 'Crear / editar contratos', roles: ['ADMIN', 'OPERADOR'] as Rol[] },
  { key: 'pagos.ver', label: 'Ver pagos y rendiciones', roles: ['ADMIN', 'OPERADOR', 'LECTURA'] as Rol[] },
  { key: 'reclamos.gestion', label: 'Gestionar reclamos', roles: ['ADMIN', 'OPERADOR'] as Rol[] },
  { key: 'screening', label: 'Verificar inquilinos', roles: ['ADMIN', 'OPERADOR'] as Rol[] },
  { key: 'propiedades.crear', label: 'Cargar / eliminar propiedades', roles: ['ADMIN'] as Rol[] },
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
            <TabsTrigger value="equipo">
              <Users className="mr-1.5 h-3.5 w-3.5" />
              Equipo y permisos
            </TabsTrigger>
            <TabsTrigger value="plan">
              <CreditCard className="mr-1.5 h-3.5 w-3.5" />
              Plan y facturas
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
                  label="Matrícula del corredor"
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
                    × {formatMonto(plan.costoPorPropiedad)} c/u
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Importe mensual
                  </p>
                  <p className="mt-1 text-3xl font-bold tabular-nums text-primary">
                    {formatMonto(plan.costoMensualTotal)}
                  </p>
                  <p className="text-xs text-muted-foreground">+ IVA 21%</p>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">¿Cómo funciona el cobro?</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p className="text-muted-foreground">
                    Pagás{' '}
                    <strong className="text-foreground">
                      {formatMonto(COSTO_PROPIEDAD_MENSUAL)} ARS
                    </strong>{' '}
                    por propiedad activa por mes. Si subís o bajás propiedades durante el mes, se
                    prorratea automáticamente.
                  </p>
                  <p className="text-muted-foreground">
                    No hay cargos por inquilino, contratos ni verificaciones (los screenings están
                    incluidos en el plan Starter).
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Método de pago</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-center gap-3 rounded-md border p-3">
                    <CreditCard className="h-5 w-5 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">Visa terminada en 4242</p>
                      <p className="text-xs text-muted-foreground">Vence 12/27 · Roberto Tapia</p>
                    </div>
                    <Button variant="ghost" size="sm">
                      Cambiar
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    El cobro se debita el 1° de cada mes. Si necesitás cambiar a transferencia,
                    escribinos.
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle>Facturas mes a mes</CardTitle>
                  <CardDescription>
                    Histórico de las últimas {facturasMock.length} facturas emitidas por Llave.
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm">
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
                          <Button variant="ghost" size="sm">
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
                <Button variant="outline">Comparar planes</Button>
              </CardContent>
            </Card>
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

