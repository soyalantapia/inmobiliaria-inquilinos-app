'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Trash2, UserPlus, Users } from 'lucide-react';
import { Button } from '@llave/ui/button';
import { Badge } from '@llave/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@llave/ui/card';
import { ConfirmDialog } from '@llave/ui/confirm-dialog';
import { useConmutables, desbloquearPin, borrarPin } from '@/lib/api/use-conmutador';
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
import { ApiError, varianteError } from '@/lib/api/client';
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
  // El estado del PIN sale del MISMO endpoint que usa el conmutador, en vez de agregarle el
  // dato a /usuarios: una sola fuente para "quién puede ser destino" evita que las dos
  // pantallas digan cosas distintas. Excluye al propio usuario, y está bien: tu PIN lo
  // gestionás en la card de arriba, no acá.
  const { usuarios: pines, refrescar: refrescarPines } = useConmutables(true);
  const [crearOpen, setCrearOpen] = useState(false);
  const [aQuitar, setAQuitar] = useState<MiembroEquipo | null>(null);
  const [procesando, setProcesando] = useState(false);

  const esAdmin = me?.rol === 'ADMIN';
  const refrescar = () => qc.invalidateQueries({ queryKey: ['equipo'] });

  const onError = (e: unknown) =>
    toast({
      variant: varianteError(e),
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
          Cada persona entra con su email y un código que le llega por mail (sin
          contraseñas). El rol define qué puede tocar.
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
              <EstadoPin miembro={m} esAdmin={esAdmin} onCambio={refrescarPines} />
              {esAdmin && !m.esVos && (
                <Button variant="ghost" size="icon" aria-label={`Quitar a ${m.nombre} ${m.apellido} del equipo`} className="h-8 w-8 text-destructive" onClick={() => setAQuitar(m)} disabled={procesando}>
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
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const reset = () => {
    setNombre('');
    setApellido('');
    setEmail('');
    setRol('OPERADOR');
    setError(null);
  };

  const guardar = async () => {
    setError(null);
    if (nombre.trim().length < 2 || apellido.trim().length < 1) return setError('Completá nombre y apellido.');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return setError('Email inválido.');
    setGuardando(true);
    try {
      // Sin contraseña: la persona entra con su email por OTP (código al mail).
      await crearUsuario({ nombre: nombre.trim(), apellido: apellido.trim(), email: email.trim(), rol });
      toast({ variant: 'success', title: '¡Sumado al equipo!', description: `Le mandamos un mail a ${email.trim()}. Entra con su email y el código.` });
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
              <Label htmlFor="eq-nombre" className="text-xs">Nombre</Label>
              <Input id="eq-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eq-apellido" className="text-xs">Apellido</Label>
              <Input id="eq-apellido" value={apellido} onChange={(e) => setApellido(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="eq-email" className="text-xs">Email (su usuario para entrar)</Label>
            <Input id="eq-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nombre@inmobiliaria.com" />
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
          <p className="rounded-md border bg-muted/30 p-2 text-[11px] text-muted-foreground">
            No hace falta contraseña: le mandamos un mail y entra con su email + un
            código de 6 dígitos (igual que vos).
          </p>
          {error && (
            <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">{error}</p>
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

/**
 * Estado del PIN de una persona, y las dos acciones que un ADMIN sí puede hacer sobre él.
 *
 * NO hay "definir el PIN de otro", y es a propósito: un ADMIN que pudiera escribir el PIN ajeno
 * podría convertirse en la cajera sin dejar un rastro distinguible de un cambio legítimo. Puede
 * BORRARLO (se olvidó, o se fue) y DESBLOQUEARLO (se equivocó cinco veces). Definirlo sólo puede
 * su dueño, desde su propia sesión.
 */
function EstadoPin({
  miembro,
  esAdmin,
  onCambio,
}: {
  miembro: MiembroEquipo;
  esAdmin: boolean;
  onCambio: () => void;
}) {
  const { usuarios } = useConmutables(true);
  const [procesando, setProcesando] = useState(false);
  // `esVos` no aparece en la lista del conmutador (excluye al propio usuario) y no es un hueco:
  // tu propio PIN se gestiona en la card "PIN del mostrador", no acá.
  if (miembro.esVos) return null;
  const info = usuarios.find((u) => u.id === miembro.id);
  if (!info) return null;

  const accion = async (fn: () => Promise<void>, titulo: string) => {
    if (procesando) return;
    setProcesando(true);
    try {
      await fn();
      onCambio();
      toast({ variant: 'success', title: titulo });
    } catch (e) {
      toast({
        variant: varianteError(e),
        title: 'No se pudo',
        description: e instanceof ApiError ? e.message : undefined,
      });
    } finally {
      setProcesando(false);
    }
  };

  if (!info.tienePin) {
    // "Sin PIN" NO es un error ni algo que el admin pueda resolver: es que esa persona todavía no
    // lo definió. Se dice para que se entienda por qué no aparece en el conmutador.
    return (
      <Badge variant="outline" className="text-[10px]" title="No puede recibir la sesión hasta que lo defina desde su cuenta">
        Sin PIN
      </Badge>
    );
  }

  return (
    <div className="flex items-center gap-1">
      {info.bloqueado ? (
        <Badge variant="warning" className="text-[10px]">
          PIN bloqueado
          {info.bloqueadoHasta
            ? ` hasta ${new Date(info.bloqueadoHasta).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`
            : ''}
        </Badge>
      ) : (
        <Badge variant="secondary" className="text-[10px]">
          PIN activo
        </Badge>
      )}
      {esAdmin && info.bloqueado && (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-[11px]"
          disabled={procesando}
          onClick={() => accion(() => desbloquearPin(miembro.id), `${miembro.nombre} puede volver a usar su PIN`)}
        >
          Desbloquear
        </Button>
      )}
      {esAdmin && (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-[11px] text-muted-foreground"
          disabled={procesando}
          onClick={() =>
            accion(() => borrarPin(miembro.id), `Se borró el PIN de ${miembro.nombre}. Lo redefine desde su cuenta.`)
          }
        >
          Borrar PIN
        </Button>
      )}
    </div>
  );
}
