'use client';

import { useEffect, useState } from 'react';
import { getHeroVariant } from './analytics';

/**
 * Headline del hero con experimento A/B. El SSR siempre rinde la variante A
 * (la ganadora del research, buena para SEO y sin flash). Si hay analítica
 * activa, después de montar puede cambiar a B y PostHog atribuye la conversión
 * a la variante (viaja como super-property `hero_variant`).
 */

const GRAD = 'bg-gradient-to-br from-primary to-violet-500 bg-clip-text text-transparent';

export function HeroHeadline() {
  const [variant, setVariant] = useState<'A' | 'B'>('A');

  useEffect(() => {
    const v = getHeroVariant();
    if (v === 'B') setVariant('B');
  }, []);

  return (
    <h1 className="mt-5 text-[clamp(2.5rem,6vw,4.25rem)] font-extrabold leading-[1.02] tracking-[-0.02em]">
      {variant === 'A' ? (
        <>
          Cobrá tus alquileres <span className={GRAD}>sin perseguir a nadie</span>.
        </>
      ) : (
        <>
          Tus inquilinos pagan solos. <span className={GRAD}>Vos no perseguís a nadie</span>.
        </>
      )}
    </h1>
  );
}
