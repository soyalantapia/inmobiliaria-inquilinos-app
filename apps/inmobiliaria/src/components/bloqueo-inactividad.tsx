'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Lock } from 'lucide-react';
import { Button } from '@llave/ui/button';
import { apiEnabled, ApiError, apiFetch, setToken } from '@/lib/api/client';
import { ensureApiSession } from '@/lib/api/session';
import { useMe } from '@/lib/api/hooks';
import { limpiarEstadoDeSesion } from '@/lib/sesion-limpieza';
import { PinInput } from './pin-input';

/**
 * Bloqueo por inactividad (T-25).
 *
 * POR QUÉ EXISTE, y por qué no alcanzaba con el conmutador. El modelo de amenazas puso como
 * riesgo **número uno** algo que el conmutador NO resuelve: la máquina que queda sola con la
 * sesión de Camila abierta. Ahí nadie necesita cambiar de usuario — ya está adentro. Y como
 * ninguna acción de plata pide PIN por decisión de producto, todo lo marcado `requierePin: true`
 * en la matriz de permisos es decorativo: confirmar un pago, revertir una conciliación, rendirle
 * a un propietario. Sin esto, T-25 le pone una cerradura a la puerta de una casa sin paredes.
 *
 * ⚠️ ES UNA CERRADURA DE PANTALLA, NO UN LÍMITE DE AUTORIZACIÓN. La sesión sigue viva y el
 * overlay es del cliente: alguien con las devtools lo saca. El límite real es el rol, que el
 * server resuelve contra la DB en cada request. Contra quien esto sí sirve es contra el
 * oportunista con acceso físico, que es exactamente el escenario del mostrador.
 *
 * NO se activa si el usuario todavía no definió su PIN: bloquearlo sin darle forma de volver
 * sería encerrarlo afuera de su propia sesión.
 */

/** Minutos sin actividad antes de cubrir la pantalla. */
const MINUTOS = 5;
const INACTIVIDAD_MS = MINUTOS * 60 * 1000;

export function BloqueoInactividad() {
  const { me } = useMe();
  const [bloqueado, setBloqueado] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activo = apiEnabled && me?.tienePin === true;

  const reiniciar = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    if (!activo || bloqueado) return;
    timer.current = setTimeout(() => setBloqueado(true), INACTIVIDAD_MS);
  }, [activo, bloqueado]);

  useEffect(() => {
    if (!activo) return;
    reiniciar();
    // `pointerdown` y no `mousemove`: mover el mouse sin querer al pasar por el escritorio no
    // debería contar como "está trabajando". `visibilitychange` cubre el caso de dejar la
    // pestaña de fondo, que es justo lo que pasa cuando alguien se va del mostrador.
    const eventos: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'scroll'];
    for (const ev of eventos) window.addEventListener(ev, reiniciar, { passive: true });
    return () => {
      for (const ev of eventos) window.removeEventListener(ev, reiniciar);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [activo, reiniciar]);

  const desbloquear = async (valor: string) => {
    if (valor.length !== 5 || enviando) return;
    setEnviando(true);
    setError(null);
    try {
      await ensureApiSession();
      await apiFetch('/auth/pantalla/desbloquear', {
        method: 'POST',
        body: JSON.stringify({ pin: valor }),
      });
      setBloqueado(false);
      setPin('');
      reiniciar();
    } catch (e) {
      setPin('');
      setError(e instanceof ApiError ? e.message : 'No pudimos verificar el PIN.');
    } finally {
      setEnviando(false);
    }
  };

  if (!activo || !bloqueado) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Pantalla bloqueada"
    >
      <div className="w-full max-w-xs space-y-4 rounded-lg border bg-card p-6 text-center shadow-lg">
        <div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-muted">
          <Lock className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <p className="font-semibold">Pantalla bloqueada</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Poné tu PIN para seguir como {me?.nombre}.
          </p>
        </div>
        <PinInput
          value={pin}
          onChange={(v) => {
            setPin(v);
            if (error) setError(null);
          }}
          onComplete={desbloquear}
          disabled={enviando}
          autoFocus
          aria-label="PIN para desbloquear"
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        {/* SALIDA SIEMPRE DISPONIBLE. Si te bloqueaste el PIN por errarle cinco veces, sin esto
            quedarías encerrado en tu propia pantalla sin forma de salir. Cerrar sesión y entrar
            por mail destraba el PIN (ver /auth/usuario/otp/verify). */}
        <button
          type="button"
          onClick={() => {
            setToken(null);
            limpiarEstadoDeSesion();
            window.location.assign('/login');
          }}
          className="text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          ¿Te olvidaste el PIN? Cerrá sesión y entrá con tu mail
        </button>
      </div>
    </div>
  );
}
