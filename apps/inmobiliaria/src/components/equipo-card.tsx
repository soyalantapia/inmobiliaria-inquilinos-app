'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Trash2, UserPlus, Users } from 'lucide-react';
import { Button } from '@llave/ui/button';
import { Badge } from '@llave/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@llave/ui/card';
import { ConfirmDialog } from '@llave/ui/confirm-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@llave/ui/dialog';
import { Input } from '@llave/ui/input';
import { Label } from '@llave/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@llave/ui/select';
import { toast } from '@llave/ui/use-toast';
import { ApiError } from '@/lib/api/client';
import {
  cambiarUsuario,
  crearUsuario,
  eliminarUsuario,
  useEquipo,
  useMe,
  type MiembroEquipo,
  type RolEquipo,
} from '@/lib/api/hooks';
import { ROL_DESCRIPCION, ROL_LABEL, ROLES_ORDEN } from '@/lib/permisos';

/**
 * Equipo y permisos en prod (ConfiguracionProd). Persiste en la tabla Usuario
 * (GET/POST/PUT/DELETE /usuarios). Solo un Admin puede sumar, cambiar rol o
 * quitar gente; el backend además impide quedarse sin ningún Admin activo.
 */
export function EquipoCard() {
  const qc = useQueryClient();
  const { me } = useMe();
  const { equipo, cargando } = useEquipo();
  const [crearOpen, setCrearOpen] = useState(false);
  const [aQuitar, setAQuitar] = useState<MiembroEquipo | null>(null);
  const [procesando, setProcesando] = useState(false);

  const esAdmin = me?.rol === 'ADMIN';
  const refrescar = () => qc.invalidateQueries({ queryKey: ['equipo'] });

  const onError = (e: unknown) =>
    toast({
      variant: 'destructive',
      title: 'No se pudo guardar',
      description: e instanceof ApiError ? e.message : 'Probá de nuevo en un momento.',
    });

  const cambiarRol = async (m: MiembroEquipo, rol: RolEquipo) => {
    if (procesando || rol === m.rol) return;
    setProcesando(true);
    try {
      await cambiarUsuario(m.id, { rol });
      await refrescar();
      toast({ variant: 'success', title: `${m.nombre} ahora es ${ROL_LABEL[rol]}` });
    } catch (e) {
      onError(e);
    } finally {
      setProcesando(false);
    }
  };

  const quitar = async () => {
    if (!aQuitar || procesando) return;
    setProcesando(true);
    try {
      await eliminarUsuario(aQuitar.id);
      await refrescar();
      toast({ title: `${aQuitar.nombre} fue dado de baja del equipo` });
      setAQuitar(null);
    } catch (e) {
      onError(e);
    } finally {
      setProcesando(false);
    }
  };

  if (cargando) return null;

  const activos = equipo.filter((m) => m.activo);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-5 w-5 text-primary" />
          Equipo y permisos
        </CardTitle>
        {esAdmin && (
          <Button size="sm" onClick={() => setCrearOpen(true)}>
            <UserPlus className="h-4 w-4" />
            Sumar
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Cada persona entra con su email y contraseña. El rol define qué puede tocar.
          {!esAdmin && ' Para sumar o cambiar gente necesitás permiso de Admin.'}
        </p>
        <div className="divide-y rounded-md border">
          {activos.map((m) => (
            <div key={m.id} className="flex flex-wrap items-center gap-3 p-3">
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium">
                  {m.nombre} {m.apellido}
                  {m.esVos && <span className="ml-1 text-xs text-muted-foreground">(vos)</span>}
                </p>
                <p className="truncate text-xs text-muted-foreground">{m.email}</p>
              </div>
              {esAdmin && !m.esVos ? (
                <Select value={m.rol} onValueChange={(v) => cambiarRol(m, v as RolEquipo)} disabled={procesando}>
                  <SelectTrigger className="h-8 w-[150px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES_ORDEN.map((r) => (
                      <SelectItem key={r} value={r} className="text-xs">
                        {ROL_LABEL[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Badge variant="secondary">{ROL_LABEL[m.rol]}</Badge>
              )}
              {esAdmin && !m.esVos && (
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setAQuitar(m)} disabled={procesando}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </CardContent>

      {esAdmin && (
        <CrearMiembroDialog
          open={crearOpen}
          onOpenChange={setCrearOpen}
          onCreado={() => {
            void refrescar();
            setCrearOpen(false);
          }}
        />
      )}

      <ConfirmDialog
        open={!!aQuitar}
        onOpenChange={(o) => !o && setAQuitar(null)}
        title={`¿Quitar a ${aQuitar?.nombre ?? ''}?`}
        description="Deja de tener acceso al panel. Sus acciones pasadas quedan en el historial."
        confirmLabel="Quitar del equipo"
        variant="destructive"
        onConfirm={quitar}
      />
    </Card>
  );
}

function CrearMiembroDialog({
  open,
  onOpenChange,
  onCreado,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreado: () => void;
}) {
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [email, setEmail] = useState('');
  const [rol, setRol] = useState<RolEquipo>('OPERADOR');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const reset = () => {
    setNombre('');
    setApellido('');
    setEmail('');
    setRol('OPERADOR');
    setPassword('');
    setError(null);
  };

  const guardar = async () => {
    setError(null);
    if (nombre.trim().length < 2 || apellido.trim().length < 1) return setError('Completá nombre y apellido.');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return setError('Email inválido.');
    if (password.length < 6) return setError('La contraseña tiene que tener al menos 6 caracteres.');
    setGuardando(true);
    try {
      await crearUsuario({ nombre: nombre.trim(), apellido: apellido.trim(), email: email.trim(), rol, password });
      toast({ variant: 'success', title: '¡Sumado al equipo!', description: `${nombre} ya puede entrar con su email.` });
      reset();
      onCreado();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'No se pudo crear. Probá de nuevo.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Sumar al equipo
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Nombre</Label>
              <Input value={nombre} onChange={(e) => setNombre(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Apellido</Label>
              <Input value={apellido} onChange={(e) => setApellido(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Email (su usuario para entrar)</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nombre@inmobiliaria.com" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Rol</Label>
            <Select value={rol} onValueChange={(v) => setRol(v as RolEquipo)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES_ORDEN.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROL_LABEL[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">{ROL_DESCRIPCION[rol]}</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Contraseña inicial</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" placeholder="Mínimo 6 caracteres" />
            <p className="text-[11px] text-muted-foreground">Se la pasás a la persona; después puede cambiarla.</p>
          </div>
          {error && (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">{error}</p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={guardando}>
              Cancelar
            </Button>
            <Button onClick={guardar} disabled={guardando}>
              {guardando ? 'Sumando…' : 'Sumar al equipo'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
