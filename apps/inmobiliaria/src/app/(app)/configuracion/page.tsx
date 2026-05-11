'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Avatar, AvatarFallback } from '@llave/ui/avatar';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@llave/ui/card';
import { ConfirmDialog } from '@llave/ui/confirm-dialog';
import { Input } from '@llave/ui/input';
import { Label } from '@llave/ui/label';
import { Separator } from '@llave/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@llave/ui/tabs';
import { toast } from '@llave/ui/use-toast';
import { Topbar } from '@/components/topbar';

const equipoInicial = [
  { id: '1', nombre: 'Roberto Tapia', email: 'roberto@inmosol.com.ar', rol: 'Admin' },
  { id: '2', nombre: 'Luciana Vidal', email: 'luciana@inmosol.com.ar', rol: 'Operadora' },
  { id: '3', nombre: 'Sergio Almeida', email: 'sergio@inmosol.com.ar', rol: 'Operador' },
];

export default function ConfiguracionPage() {
  const [datos, setDatos] = useState({
    nombre: 'Inmobiliaria del Sol',
    cuit: '30-71234567-9',
    email: 'contacto@inmosol.com.ar',
    telefono: '+54 11 4532 1100',
  });
  const [equipo, setEquipo] = useState(equipoInicial);
  const [paraEliminar, setParaEliminar] = useState<typeof equipoInicial[number] | null>(null);

  const guardarDatos = () => {
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

  return (
    <>
      <Topbar titulo="Configuración" />
      <main className="flex-1 space-y-6 p-4 md:p-6">
        <Tabs defaultValue="empresa">
          <TabsList className="h-auto flex-wrap justify-start gap-1 p-1">
            <TabsTrigger value="empresa">Empresa</TabsTrigger>
            <TabsTrigger value="equipo">Equipo</TabsTrigger>
            <TabsTrigger value="plan">Plan</TabsTrigger>
            <TabsTrigger value="integraciones">Integraciones</TabsTrigger>
          </TabsList>

          <TabsContent value="empresa">
            <Card>
              <CardHeader>
                <CardTitle>Datos de la inmobiliaria</CardTitle>
                <CardDescription>Estos datos aparecen en los comprobantes que ven los inquilinos.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <Field label="Nombre comercial" value={datos.nombre} onChange={(v) => setDatos({ ...datos, nombre: v })} />
                <Field label="CUIT" value={datos.cuit} onChange={(v) => setDatos({ ...datos, cuit: v })} />
                <Field label="Email administrador" value={datos.email} onChange={(v) => setDatos({ ...datos, email: v })} />
                <Field label="Teléfono" value={datos.telefono} onChange={(v) => setDatos({ ...datos, telefono: v })} />
                <div className="md:col-span-2">
                  <Button onClick={guardarDatos}>Guardar cambios</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="equipo">
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <div>
                  <CardTitle>Equipo</CardTitle>
                  <CardDescription>Quiénes pueden usar el panel.</CardDescription>
                </div>
                <Button size="sm">
                  <Plus className="h-4 w-4" />
                  Invitar
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {equipo.map((p, i) => (
                  <div key={p.id}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {p.nombre.split(' ').map((n) => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium leading-tight">{p.nombre}</p>
                          <p className="text-xs text-muted-foreground">{p.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={p.rol === 'Admin' ? 'default' : 'secondary'}>{p.rol}</Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Eliminar a ${p.nombre}`}
                          disabled={p.rol === 'Admin'}
                          onClick={() => setParaEliminar(p)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {i < equipo.length - 1 && <Separator className="mt-3" />}
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="plan">
            <Card>
              <CardHeader>
                <CardTitle>Plan actual</CardTitle>
                <CardDescription>87 / 100 contratos usados este mes</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border bg-secondary p-5">
                  <Badge>Starter</Badge>
                  <p className="mt-2 text-2xl font-semibold">$48.000 ARS / mes</p>
                  <p className="text-sm text-muted-foreground">+ 0,8% por pago intermediado</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Button variant="outline">Ver plan PRO</Button>
                  <Button variant="ghost">Cancelar</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="integraciones">
            <Card>
              <CardHeader>
                <CardTitle>Integraciones</CardTitle>
                <CardDescription>Conectá tu cuenta de Mercado Pago, WhatsApp y más.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Integracion nombre="Mercado Pago" estado="Conectado" />
                <Integracion nombre="WhatsApp Business" estado="Conectado" />
                <Integracion nombre="Nosis" estado="Conectado" />
                <Integracion nombre="ARCA (factura electrónica)" estado="Pendiente" />
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
    </>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Integracion({ nombre, estado }: { nombre: string; estado: 'Conectado' | 'Pendiente' }) {
  return (
    <div className="flex items-center justify-between rounded-md border p-4">
      <div>
        <p className="font-medium">{nombre}</p>
        <p className="text-xs text-muted-foreground">{estado === 'Conectado' ? 'Listo para usar' : 'Falta autorizar'}</p>
      </div>
      <Badge variant={estado === 'Conectado' ? 'success' : 'warning'}>{estado}</Badge>
    </div>
  );
}
