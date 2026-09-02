'use client';

import { useState } from 'react';
import { Lock, LogIn, Users } from 'lucide-react';
import { Button } from '@llave/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@llave/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@llave/ui/dropdown-menu';
import { toast } from '@llave/ui/use-toast';
import { apiEnabled, ApiError } from '@/lib/api/client';
import { useMe } from '@/lib/api/hooks';
import { ROL_LABEL, type Rol } from '@/lib/permisos';
import { conmutarUsuario, useConmutables, type UsuarioConmutable } from '@/lib/api/use-conmutador';
import { PinInput } from './pin-input';

/**
 * Cambiar de persona en la máquina del mostrador (T-25).
 *
 * Camila lo pidió dos veces, la segunda con un video: *"yo aprieto un botoncito arriba y cambio
 * el usuario a la otra, y se va poniendo la cajera, el administrador, todo, y entra con un
 * usuario y contraseña que son cinco dígitos"*. Hoy la única forma es cerrar sesión y esperar un
 * código por mail — inviable con gente esperando del otro lado del mostrador.
 */
export function ConmutadorUsuario() {
  const { me } = useMe();
  // El dropdown de este design system NO es controlado, así que no hay un `open` del que
  // colgarse. `pedido` se prende con el primer click del trigger y ya no se apaga: alcanza para
  // que la lista se cargue perezosamente en vez de en cada render del topbar —que está en TODAS
  // las pantallas—, y a partir de ahí react-query la mantiene fresca sola.
  const [pedido, setPedido] = useState(false);
  const [destino, setDestino] = useState<UsuarioConmutable | null>(null);
  const { usuarios, cargando } = useConmutables(pedido);

  // Sólo prod: los endpoints piden sesión real. En demo no se muestra en vez de ofrecer un botón
  // que no puede funcionar.
  if (!apiEnabled || !me) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="gap-2"
            aria-label="Cambiar de usuario"
            onClick={() => setPedido(true)}
          >
            <Users className="h-4 w-4" />
            <span className="hidden max-w-[12ch] truncate lg:inline">{me.nombre}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <div className="px-2 py-1.5">
            <p className="text-sm font-medium">{me.nombre}</p>
            <p className="text-xs text-muted-foreground">{ROL_LABEL[me.rol as Rol]} · sesión actual</p>
          </div>
          <DropdownMenuSeparator />
          {cargando && <p className="px-2 py-3 text-xs text-muted-foreground">Cargando…</p>}
          {!cargando && usuarios.length === 0 && (
            <p className="px-2 py-3 text-xs text-muted-foreground">
              No hay nadie más en el equipo todavía.
            </p>
          )}
          {usuarios.map((u) => {
            // Sin PIN no es "no puede", es "todavía no lo definió" — y sólo puede definirlo esa
            // persona desde su propia sesión, así que el botón no lleva a ningún lado.
            const trabado = !u.tienePin || u.bloqueado;
            return (
              <DropdownMenuItem
                key={u.id}
                disabled={trabado}
                onClick={() => setDestino(u)}
                className="flex items-start gap-2"
              >
                {u.bloqueado ? (
                  <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
                ) : (
                  <LogIn className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                )}
                <span className="min-w-0">
                  <span className="block truncate text-sm">{u.nombre}</span>
                  <span className="block text-[11px] text-muted-foreground">
                    {ROL_LABEL[u.rol]}
                    {u.bloqueado
                      ? ' · bloqueado por intentos fallidos'
                      : !u.tienePin
                        ? ' · todavía no definió su PIN'
                        : ''}
                  </span>
                </span>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      {destino && <DialogPin destino={destino} onClose={() => setDestino(null)} />}
    </>
  );
}

function DialogPin({ destino, onClose }: { destino: UsuarioConmutable; onClose: () => void }) {
  const [pin, setPin] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const entrar = async (valor: string) => {
    if (valor.length !== 5 || enviando) return;
    setEnviando(true);
    setError(null);
    try {
      // No hay `onClose` ni toast de éxito: conmutarUsuario termina en un hard nav y la
      // confirmación es el propio topbar, que después de recargar muestra el nombre nuevo.
      await conmutarUsuario(destino.id, valor);
    } catch (e) {
      setEnviando(false);
      setPin('');
      if (e instanceof ApiError) {
        // El server NUNCA manda 401 por un PIN mal (eso deslogearía). 403 = incorrecto,
        // 423 = bloqueado, 409 = sin PIN.
        setError(e.message);
        if (e.status === 423) {
          toast({
            variant: 'destructive',
            title: 'Usuario bloqueado',
            description:
              'Puede entrar con su mail desde /login y eso le destraba el PIN, o pedirle a un admin que lo desbloquee.',
          });
        }
      } else {
        setError('No pudimos cambiar de usuario. Probá de nuevo.');
      }
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && !enviando && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Entrar como {destino.nombre}</DialogTitle>
          <DialogDescription>
            {ROL_LABEL[destino.rol]} · poné su PIN de 5 dígitos.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <PinInput
            value={pin}
            onChange={(v) => {
              setPin(v);
              if (error) setError(null);
            }}
            onComplete={entrar}
            disabled={enviando}
            autoFocus
            aria-label={`PIN de ${destino.nombre}`}
          />
          {error && <p className="text-center text-sm text-destructive">{error}</p>}
          <p className="text-center text-[11px] text-muted-foreground">
            Queda registrado en el historial quién cambió a quién.
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={enviando}>
            Cancelar
          </Button>
          <Button onClick={() => entrar(pin)} disabled={enviando || pin.length !== 5}>
            {enviando ? 'Entrando…' : 'Entrar'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
