'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Megaphone } from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { Button } from '@llave/ui/button';
import { Card } from '@llave/ui/card';
import { fecha } from '@/lib/format';
import { apiFetch, type AnuncioPortal } from '@/lib/api';

/**
 * Los avisos que la inmobiliaria le mandó a sus propietarios.
 *
 * POR QUÉ EXISTE: cada anuncio del panel se crea con `canales: ['APP', 'EMAIL']` —el comentario
 * del código dice "decisión de producto: siempre ambos canales"— pero para el propietario el
 * canal APP no existía en ninguna pantalla. Le llegaba el mail y, si lo borraba o se le perdía
 * entre doscientos mensajes, no tenía dónde volver a leerlo. El sistema declaraba un canal que
 * no cumplía, que es el mismo patrón que venimos corrigiendo en todo el producto.
 *
 * Va en la pestaña de Pagos, arriba: es lo primero que el dueño abre y lo que puede cambiar
 * cómo lee el resto de la pantalla ("este mes se descontó el arreglo del techo").
 *
 * SI FALLA, NO SE MUESTRA NADA. Los avisos son contexto, no la plata: un cartel de error acá
 * ensuciaría la pantalla que el dueño vino a mirar. Queda el silencio, igual que antes.
 */
export function AvisosInmobiliaria() {
  const [todos, setTodos] = useState(false);
  const avisos = useQuery({
    queryKey: ['portal-anuncios'],
    queryFn: () => apiFetch<AnuncioPortal[]>('/portal/anuncios'),
    staleTime: 5 * 60_000,
  });

  if (avisos.isPending || avisos.isError || !avisos.data?.length) return null;

  const visibles = todos ? avisos.data : avisos.data.slice(0, 3);
  const restantes = avisos.data.length - visibles.length;

  return (
    <section className="space-y-2">
      <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Megaphone className="h-4 w-4" />
        Avisos de tu inmobiliaria
      </h2>
      <div className="space-y-2">
        {visibles.map((a) => (
          <Card key={a.id} className="space-y-1 p-3">
            <div className="flex flex-wrap items-center gap-2">
              {a.prioridad !== 'NORMAL' && (
                <Badge variant={a.prioridad === 'URGENTE' ? 'destructive' : 'warning'} className="text-[10px]">
                  {a.prioridad.toLowerCase()}
                </Badge>
              )}
              <span className="font-medium">{a.titulo}</span>
            </div>
            {/* El cuerpo lo escribe la inmobiliaria en un textarea: conserva sus saltos de
                línea. `whitespace-pre-line` y no `pre-wrap` para no arrastrar la sangría. */}
            <p className="whitespace-pre-line text-sm text-muted-foreground">{a.cuerpo}</p>
            <p className="text-xs text-muted-foreground">{fecha(a.enviadoAt)}</p>
          </Card>
        ))}
        {restantes > 0 && (
          <Button variant="outline" size="sm" className="w-full" onClick={() => setTodos(true)}>
            Ver los {restantes} avisos anteriores
          </Button>
        )}
      </div>
    </section>
  );
}
