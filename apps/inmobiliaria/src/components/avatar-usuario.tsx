'use client';

import { useRef, useState } from 'react';
import { Camera, Trash2 } from 'lucide-react';
import { subirArchivo } from '@/lib/api/client';
import { useActualizarAvatar } from '@/lib/api/hooks';
import { toast } from '@llave/ui/use-toast';
import { cn } from '@llave/ui/cn';

/**
 * Foto de perfil del usuario logueado, con cambio in-place.
 *
 * `PUT /me/avatar` existía hace rato pero ningún lado del panel lo llamaba: la
 * cuenta mostraba iniciales y no había forma de subir una foto. Acá se cierra el
 * circuito — subir a /uploads, persistir la URL, refrescar /auth/me.
 *
 * Sin foto muestra las iniciales, que es también el fallback si la imagen no
 * carga (archivo borrado del Volume, URL vieja): sin esto quedaba el ícono de
 * imagen rota del navegador dentro del círculo.
 */
export function AvatarUsuario({
  imageUrl,
  iniciales,
  editable = false,
  className,
}: {
  imageUrl: string | null;
  iniciales: string;
  /** Habilita subir/quitar la foto. Solo en modo API (la demo no tiene uploads). */
  editable?: boolean;
  className?: string;
}) {
  const { guardar } = useActualizarAvatar();
  const [subiendo, setSubiendo] = useState(false);
  const [falloImagen, setFalloImagen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const mostrarFoto = !!imageUrl && !falloImagen;

  const elegir = async (file: File) => {
    // El backend valida tipo y tamaño, pero un rebote después de subir 8 MB por
    // datos móviles es una espera tirada a la basura: cortamos acá.
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Tiene que ser una imagen', variant: 'destructive' });
      return;
    }
    setSubiendo(true);
    try {
      const { url } = await subirArchivo(file);
      await guardar(url);
      setFalloImagen(false);
      toast({ title: 'Foto actualizada' });
    } catch (e) {
      toast({
        title: 'No se pudo subir la foto',
        description: e instanceof Error ? e.message : 'Probá de nuevo.',
        variant: 'destructive',
      });
    } finally {
      setSubiendo(false);
    }
  };

  const quitar = async () => {
    setSubiendo(true);
    try {
      await guardar(null);
      toast({ title: 'Foto quitada' });
    } catch (e) {
      toast({
        title: 'No se pudo quitar la foto',
        description: e instanceof Error ? e.message : 'Probá de nuevo.',
        variant: 'destructive',
      });
    } finally {
      setSubiendo(false);
    }
  };

  const circulo = (
    <span
      className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-[11px] font-semibold text-foreground',
        className,
      )}
    >
      {mostrarFoto ? (
        // eslint-disable-next-line @next/next/no-img-element -- /uploads no pasa por el optimizador de Next
        <img
          src={imageUrl}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setFalloImagen(true)}
        />
      ) : (
        iniciales
      )}
    </span>
  );

  if (!editable) return circulo;

  return (
    <span className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={subiendo}
        className="group relative rounded-full transition-opacity hover:opacity-80 disabled:opacity-50"
        aria-label={mostrarFoto ? 'Cambiar foto de perfil' : 'Subir foto de perfil'}
        title={mostrarFoto ? 'Cambiar foto' : 'Subir foto'}
      >
        {circulo}
        <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border border-background bg-muted-foreground text-background">
          <Camera className="h-2.5 w-2.5" />
        </span>
      </button>
      {mostrarFoto && (
        <button
          type="button"
          onClick={quitar}
          disabled={subiendo}
          className="text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
          aria-label="Quitar foto de perfil"
          title="Quitar foto"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        disabled={subiendo}
        onChange={(e) => {
          const file = e.target.files?.[0];
          // Reseteamos el value SIEMPRE: sin esto, elegir la misma foto dos veces
          // seguidas no dispara onChange (el value no cambió) y parece colgado.
          e.target.value = '';
          if (file) void elegir(file);
        }}
      />
    </span>
  );
}
