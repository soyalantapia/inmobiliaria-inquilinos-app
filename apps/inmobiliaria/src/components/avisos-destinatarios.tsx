'use client';

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Mail } from 'lucide-react';
import { Button } from '@llave/ui/button';
import { Card, CardContent } from '@llave/ui/card';
import { Input } from '@llave/ui/input';
import { Label } from '@llave/ui/label';
import { toast } from '@llave/ui/use-toast';
import { ApiError } from '@/lib/api/client';
import {
  setDestinatarioAviso,
  useAvisosMiInmobiliaria,
  type AvisoConfigurable,
} from '@/lib/api/use-mi-inmobiliaria';

/**
 * A qué casilla llega cada tipo de aviso automático.
 *
 * Camila, con 220 propiedades: *"me va a llegar un mail por cada reclamo… y todos van a mi misma
 * casilla, no a la de la chica que los maneja. Habría que poder decir a quién le llega cada
 * cosa."* Su bandeja se llenaba de avisos que ella no iba a accionar y la persona que sí tenía
 * que accionarlos no se enteraba.
 *
 * Dejar el campo vacío NO apaga el aviso: lo devuelve a la casilla de la inmobiliaria. Se dice
 * explícito en pantalla, porque "vacío" se lee natural como "no me mandes nada".
 */
export function AvisosDestinatarios({ puedeEditar }: { puedeEditar: boolean }) {
  const { datos, cargando, isError } = useAvisosMiInmobiliaria();

  if (cargando) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" aria-label="Cargando" />
        </CardContent>
      </Card>
    );
  }
  if (isError || !datos) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          No pudimos cargar la configuración de avisos. Recargá la página.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div>
          <p className="text-sm font-semibold">¿A qué casilla llega cada aviso?</p>
          <p className="text-xs text-muted-foreground">
            Si dejás uno vacío, ese aviso va a{' '}
            <strong className="text-foreground">{datos.fallback || 'la casilla de la inmobiliaria'}</strong>.
          </p>
        </div>
        {datos.avisos.map((a) => (
          <FilaAviso key={a.tipo} aviso={a} fallback={datos.fallback} puedeEditar={puedeEditar} />
        ))}
      </CardContent>
    </Card>
  );
}

function FilaAviso({
  aviso,
  fallback,
  puedeEditar,
}: {
  aviso: AvisoConfigurable;
  fallback: string | null;
  puedeEditar: boolean;
}) {
  const qc = useQueryClient();
  const [valor, setValor] = useState(aviso.email ?? '');
  const [guardando, setGuardando] = useState(false);

  // Si la query se refresca (otra pestaña, un refetch), el input sigue al server —salvo que
  // haya algo escrito sin guardar, que no se pisa.
  useEffect(() => {
    setValor(aviso.email ?? '');
  }, [aviso.email]);

  const sucio = valor.trim() !== (aviso.email ?? '');

  const guardar = async () => {
    if (guardando || !sucio) return;
    setGuardando(true);
    try {
      await setDestinatarioAviso({ tipo: aviso.tipo, email: valor.trim() });
      await qc.invalidateQueries({ queryKey: ['mi-inmobiliaria-avisos'] });
      toast({
        variant: 'success',
        title: 'Listo',
        description: valor.trim()
          ? `“${aviso.label}” ahora le llega a ${valor.trim()}.`
          : `“${aviso.label}” vuelve a la casilla de la inmobiliaria.`,
      });
    } catch (e) {
      toast({
        variant: 'destructive',
        title: 'No se pudo guardar',
        description: e instanceof ApiError ? e.message : 'Probá de nuevo.',
      });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="space-y-1.5 border-t pt-4 first:border-t-0 first:pt-0">
      <Label htmlFor={`aviso-${aviso.tipo}`} className="text-sm font-medium">
        {aviso.label}
      </Label>
      <p className="text-xs text-muted-foreground">{aviso.descripcion}</p>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Mail className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            id={`aviso-${aviso.tipo}`}
            type="email"
            value={valor}
            disabled={!puedeEditar || guardando}
            onChange={(e) => setValor(e.target.value)}
            placeholder={fallback ?? 'sin casilla configurada'}
            className="pl-8"
          />
        </div>
        <Button onClick={guardar} disabled={!puedeEditar || !sucio || guardando}>
          {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Guardar
        </Button>
      </div>
      {/* El placeholder ya muestra a dónde va hoy; esto lo dice con palabras para que no
          dependa de notar que el texto gris del input es la casilla de la inmobiliaria. */}
      {!aviso.email && fallback && (
        <p className="text-[11px] text-muted-foreground">Hoy le llega a {fallback}.</p>
      )}
      {!puedeEditar && (
        <p className="text-[11px] text-muted-foreground">Sólo un Admin puede cambiar esto.</p>
      )}
    </div>
  );
}
