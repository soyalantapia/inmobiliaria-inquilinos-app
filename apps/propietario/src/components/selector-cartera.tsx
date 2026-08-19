'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronsUpDown, Loader2 } from 'lucide-react';
import { Button } from '@llave/ui/button';
import { Card } from '@llave/ui/card';
import { apiFetch, guardarSesion, leerSesion, type SesionPropietario } from '@/lib/api';

/**
 * Cambiar de cartera cuando la misma persona administra con más de una inmobiliaria.
 *
 * Sin esto, quien tiene dos carteras entraba a UNA —la que resolvió el OTP— y no tenía forma de
 * llegar a la otra ni de enterarse de que existía.
 *
 * Cada fila muestra el NOMBRE de la ficha además de la inmobiliaria: dos propietarios de la
 * MISMA inmobiliaria pueden compartir email legítimamente (un matrimonio, el contador de varios
 * dueños), y sin el nombre las dos filas eran idénticas.
 *
 * El cambio lo autoriza el server contra el email CONGELADO en el token, no contra la base: ver
 * la nota de `/auth/propietario/elegir`.
 */
export function SelectorCartera() {
  const qc = useQueryClient();
  const [sesion, setSesion] = useState<SesionPropietario | null>(() =>
    typeof window === 'undefined' ? null : leerSesion(),
  );
  const [abierto, setAbierto] = useState(false);
  const [cambiando, setCambiando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const carteras = sesion?.carteras ?? [];
  // Con una sola cartera el selector es ruido: no hay nada entre qué elegir.
  if (carteras.length < 2) return null;

  const cambiar = async (propietarioId: string) => {
    if (cambiando) return;
    setCambiando(propietarioId);
    setError(null);
    try {
      const res = await apiFetch<{ token: string; nombre: string; inmobiliaria: string }>(
        '/auth/propietario/elegir',
        { method: 'POST', body: JSON.stringify({ propietarioId }) },
      );
      const nueva: SesionPropietario = {
        nombre: res.nombre,
        inmobiliaria: res.inmobiliaria,
        // La lista de carteras no cambia (es la misma persona): la conservamos para no
        // perder el selector al cambiar.
        carteras: carteras.map((c) => ({ ...c, actual: c.propietarioId === propietarioId })),
      };
      guardarSesion(res.token, nueva);
      setSesion(nueva);
      setAbierto(false);
      // Todo lo cargado es de la cartera anterior: se tira entero, no se refresca.
      await qc.invalidateQueries();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos cambiar de cartera.');
    } finally {
      setCambiando(null);
    }
  };

  return (
    <div className="relative">
      <Button variant="outline" size="sm" onClick={() => setAbierto((v) => !v)} aria-expanded={abierto}>
        Cambiar de cartera
        <ChevronsUpDown className="h-4 w-4" />
      </Button>
      {abierto && (
        <Card className="absolute right-0 z-20 mt-1 w-72 overflow-hidden p-1 shadow-lg">
          {carteras.map((c) => (
            <button
              key={c.propietarioId}
              type="button"
              disabled={c.actual || cambiando !== null}
              onClick={() => cambiar(c.propietarioId)}
              className="flex w-full items-center justify-between gap-2 rounded px-3 py-2 text-left text-sm transition-colors hover:bg-muted disabled:cursor-default disabled:opacity-60"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">{c.nombre}</span>
                <span className="block truncate text-xs text-muted-foreground">{c.inmobiliaria}</span>
              </span>
              {cambiando === c.propietarioId ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
              ) : c.actual ? (
                <span className="shrink-0 text-[10px] uppercase text-muted-foreground">Actual</span>
              ) : null}
            </button>
          ))}
          {error && <p className="px-3 py-2 text-xs text-destructive">{error}</p>}
        </Card>
      )}
    </div>
  );
}
