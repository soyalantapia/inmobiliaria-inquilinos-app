'use client';

import { useState } from 'react';
import { Play } from 'lucide-react';
import { Reveal } from './reveal';
import { track } from './analytics';

/**
 * Testimonios en VIDEO de inmobiliarias reales.
 *
 * REGLA DEL PROYECTO: cero testimonios inventados. Nombres, caras y frases sólo
 * cuando son de una persona real que dio su OK. Mientras no haya videos
 * cargados, cada card muestra un estado neutro "video en camino" (sin nombre ni
 * cita fabricada) — la sección se ve intencional, no vacía.
 *
 * Para publicar los reales, completá TESTIMONIOS con:
 *   { nombre, rol, youtubeId | videoSrc, poster }
 *   - youtubeId: el id del video de YouTube (ej. 'dQw4w9WgXcQ')
 *   - videoSrc:  o un mp4 propio en /public (ej. '/testimonios/roberto.mp4')
 *   - poster:    imagen de portada en /public (ej. '/testimonios/roberto.jpg')
 */

type Testimonio = {
  nombre: string;
  rol: string; // ej. "Inmobiliaria · Córdoba"
  youtubeId?: string;
  videoSrc?: string;
  poster?: string;
};

const TESTIMONIOS: Testimonio[] = [
  { nombre: '', rol: '' },
  { nombre: '', rol: '' },
  { nombre: '', rol: '' },
];

/** ¿Hay al menos un video real cargado? Si no, ni la sección ni su tab en el
 *  header se montan — una sección de "testimonios" vacía lee como rota y daña
 *  más la confianza que no tenerla (audit P2). Se enciende sola al cargar el
 *  primer { youtubeId | videoSrc }. */
export const HAY_TESTIMONIOS = TESTIMONIOS.some((t) => t.youtubeId || t.videoSrc);

export function Testimonios() {
  if (!HAY_TESTIMONIOS) return null;
  return (
    <section id="testimonios" className="scroll-mt-28 border-y border-black/[0.06] bg-white/50">
      <div className="mx-auto max-w-6xl px-5 py-20 md:px-8 md:py-24">
        <Reveal>
          <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-primary">En sus palabras</p>
          <h2 className="mt-3 max-w-2xl text-[clamp(1.9rem,4vw,3rem)] font-bold leading-[1.08] tracking-[-0.015em]">
            Escuchalo de inmobiliarias como la tuya.
          </h2>
        </Reveal>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {TESTIMONIOS.map((t, i) => (
            <Reveal key={i} delay={i * 80}>
              <VideoCard t={t} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function VideoCard({ t }: { t: Testimonio }) {
  const [playing, setPlaying] = useState(false);
  const listo = !!(t.youtubeId || t.videoSrc);

  return (
    <article className="group overflow-hidden rounded-3xl border border-black/[0.07] bg-white shadow-[0_24px_60px_-44px_rgba(80,40,160,0.4)]">
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-[linear-gradient(135deg,#2a1758_0%,#16092e_100%)]">
        {listo && playing ? (
          t.youtubeId ? (
            <iframe
              className="absolute inset-0 h-full w-full"
              src={`https://www.youtube-nocookie.com/embed/${t.youtubeId}?autoplay=1&rel=0`}
              title={`Testimonio de ${t.nombre}`}
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <video
              className="absolute inset-0 h-full w-full object-cover"
              src={t.videoSrc}
              controls
              autoPlay
              playsInline
            />
          )
        ) : (
          <>
            {t.poster && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={t.poster}
                alt={t.nombre ? `Testimonio de ${t.nombre}` : 'Testimonio en video'}
                className="absolute inset-0 h-full w-full object-cover"
              />
            )}
            <div className="absolute inset-0 grid place-items-center">
              {listo ? (
                <button
                  type="button"
                  onClick={() => {
                    setPlaying(true);
                    track('testimonio_play', { nombre: t.nombre });
                  }}
                  aria-label={`Reproducir testimonio de ${t.nombre}`}
                  className="grid h-16 w-16 place-items-center rounded-full bg-white/95 text-primary shadow-lg transition-transform group-hover:scale-105"
                >
                  <Play className="ml-0.5 h-7 w-7 fill-current" />
                </button>
              ) : (
                <div className="flex flex-col items-center gap-2 text-center text-white/60">
                  <span className="grid h-14 w-14 place-items-center rounded-full bg-white/10">
                    <Play className="ml-0.5 h-6 w-6" />
                  </span>
                  <span className="text-[12px] font-medium uppercase tracking-wide">Video en camino</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>
      <div className="p-5">
        {t.nombre ? (
          <>
            <p className="font-bold">{t.nombre}</p>
            <p className="text-sm text-muted-foreground">{t.rol}</p>
          </>
        ) : (
          // Placeholder honesto: sin nombre inventado hasta tener el video real.
          <>
            <div className="h-4 w-2/3 rounded bg-black/[0.06]" />
            <div className="mt-2 h-3 w-1/2 rounded bg-black/[0.04]" />
          </>
        )}
      </div>
    </article>
  );
}
