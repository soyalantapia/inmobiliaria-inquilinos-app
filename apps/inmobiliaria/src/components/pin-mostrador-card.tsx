'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { KeyRound } from 'lucide-react';
import { Button } from '@llave/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@llave/ui/card';
import { toast } from '@llave/ui/use-toast';
import { apiEnabled, ApiError } from '@/lib/api/client';
import { useMe } from '@/lib/api/hooks';
import { definirPin } from '@/lib/api/use-conmutador';
import { PinInput } from './pin-input';

/**
 * Definir o cambiar el PIN propio (T-25).
 *
 * Sin esto el conmutador no sirve para nada: nadie puede ser destino hasta que define su PIN, y
 * **sólo esa persona puede definirlo, desde su propia sesión**. Un ADMIN puede borrar el PIN de
 * otro o desbloquearlo, pero nunca escribirlo — si pudiera, podría convertirse en la cajera sin
 * dejar un rastro distinguible de un cambio legítimo.
 */
export function PinMostradorCard() {
  const { me } = useMe();
  const qc = useQueryClient();
  const [editando, setEditando] = useState(false);
  const [pinActual, setPinActual] = useState('');
  const [pinNuevo, setPinNuevo] = useState('');
  const [guardando, setGuardando] = useState(false);

  if (!apiEnabled || !me) return null;
  const yaTiene = me.tienePin === true;

  const guardar = async () => {
    if (pinNuevo.length !== 5 || guardando) return;
    setGuardando(true);
    try {
      await definirPin(pinNuevo, yaTiene ? pinActual : undefined);
      toast({
        variant: 'success',
        title: yaTiene ? 'PIN actualizado' : 'PIN definido',
        description: 'Ya podés pasarle la máquina a alguien y volver con tu PIN.',
      });
      setEditando(false);
      setPinActual('');
      setPinNuevo('');
      // `tienePin` viene de /auth/me: hay que reconsultarlo para que la card deje de decir
      // "todavía no definiste el tuyo".
      void qc.invalidateQueries({ queryKey: ['me'] });
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'No se pudo guardar el PIN',
        description: e instanceof ApiError ? e.message : 'Probá de nuevo.',
      });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <KeyRound className="h-4 w-4" />
          PIN del mostrador
        </CardTitle>
        {!editando && (
          <Button size="sm" variant="outline" onClick={() => setEditando(true)}>
            {yaTiene ? 'Cambiar PIN' : 'Definir PIN'}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="max-w-prose text-sm text-muted-foreground">
          Cinco dígitos para volver a tu usuario cuando comparten la máquina, sin cerrar sesión ni
          esperar un código por mail.{' '}
          {yaTiene ? (
            <span className="font-medium text-foreground">Ya tenés uno definido.</span>
          ) : (
            <span className="font-medium text-foreground">
              Todavía no definiste el tuyo, así que nadie puede entrar como vos.
            </span>
          )}
        </p>

        {editando && (
          <div className="space-y-4 rounded-md border bg-muted/20 p-4">
            {yaTiene && (
              <div className="space-y-1.5">
                <p className="text-center text-xs font-medium">Tu PIN actual</p>
                <PinInput value={pinActual} onChange={setPinActual} disabled={guardando} autoFocus />
              </div>
            )}
            <div className="space-y-1.5">
              <p className="text-center text-xs font-medium">PIN nuevo</p>
              <PinInput
                value={pinNuevo}
                onChange={setPinNuevo}
                disabled={guardando}
                autoFocus={!yaTiene}
              />
            </div>
            {/* El server rechaza los triviales; decirlo ANTES evita el viaje de ida y vuelta. */}
            <p className="text-center text-[11px] text-muted-foreground">
              Evitá los repetidos (11111) y las secuencias (12345). Y no uses tu año de nacimiento:
              es lo primero que prueba alguien que te conoce.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditando(false);
                  setPinActual('');
                  setPinNuevo('');
                }}
                disabled={guardando}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={guardar}
                disabled={guardando || pinNuevo.length !== 5 || (yaTiene && pinActual.length !== 5)}
              >
                {guardando ? 'Guardando…' : 'Guardar'}
              </Button>
            </div>
          </div>
        )}

        <p className="text-[11px] text-muted-foreground">
          Si te olvidás el PIN o te bloqueás por errarle cinco veces, entrá con tu mail desde la
          pantalla de login: eso te lo destraba solo, sin depender de nadie.
        </p>
      </CardContent>
    </Card>
  );
}
