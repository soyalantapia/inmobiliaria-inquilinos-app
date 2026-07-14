'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, Menu, X } from 'lucide-react';
import { Isotipo } from '@/components/isotipo';
import { HAY_TESTIMONIOS } from './testimonios';

/**
 * Header FLOTANTE tipo cápsula (pill) — no es la barra pegada al borde de siempre.
 * Flota separado del tope, redondeado, con blur, y un segmented-control de tabs
 * que resalta la sección visible mientras scrolleás (scroll-spy por posición).
 * Los tabs son anclas suaves a cada sección de la landing. En mobile viven en un
 * menú desplegable dentro de la misma cápsula.
 */

const TABS = [
  { label: 'Producto', href: '#producto' },
  { label: 'Precios', href: '#precio' },
  { label: 'Testimonios', href: '#testimonios' },
  { label: 'Preguntas', href: '#preguntas' },
];

// Sin videos reales la sección Testimonios no se monta (ver testimonios.tsx):
// tampoco mostramos su tab, para no scrollear a una sección inexistente.
const TABS_VISIBLES = HAY_TESTIMONIOS ? TABS : TABS.filter((t) => t.href !== '#testimonios');

export function Header() {
  const [active, setActive] = useState('');
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Un solo handler de scroll: sombra al despegar del tope + scroll-spy por
  // posición (determinístico y fácil de testear). Activa = la última sección
  // cuyo tope ya cruzó la línea imaginaria debajo del header flotante.
  useEffect(() => {
    const ids = TABS_VISIBLES.map((t) => t.href.slice(1));
    const onScroll = () => {
      setScrolled(window.scrollY > 20);
      // Activa = la sección MÁS ABAJO cuyo tope ya cruzó la línea del header.
      // Se compara por offsetTop (no por orden del array): el orden visual de los
      // tabs no coincide con el orden en la página (Precios va antes que
      // Testimonios en el nav, pero Testimonios está más arriba en el scroll).
      const linea = window.scrollY + 140;
      let current = '';
      let mejorTop = -1;
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.offsetTop <= linea && el.offsetTop > mejorTop) {
          mejorTop = el.offsetTop;
          current = id;
        }
      }
      setActive(current);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  return (
    <header className="pointer-events-none fixed inset-x-0 top-3 z-50 px-4 md:top-4">
      <nav
        aria-label="Navegación de la landing"
        className={[
          'pointer-events-auto mx-auto flex max-w-3xl items-center justify-between gap-2 rounded-[1.75rem] border border-black/[0.06] py-2 pl-3 pr-2 transition-all duration-300',
          scrolled
            ? 'bg-[#faf8f5]/80 shadow-[0_14px_44px_-14px_rgba(80,40,160,0.3)] backdrop-blur-xl'
            : 'bg-[#faf8f5]/55 shadow-[0_8px_28px_-16px_rgba(80,40,160,0.22)] backdrop-blur-md',
        ].join(' ')}
      >
        <Link href="/inicio" className="flex shrink-0 items-center gap-2 pl-1 pr-1">
          <Isotipo size={30} />
          <span className="display text-[14px] font-bold tracking-tight">My Alquiler</span>
        </Link>

        {/* Tabs desktop — segmented control con highlight de la sección activa */}
        <div className="hidden items-center gap-0.5 rounded-full bg-black/[0.035] p-1 md:flex">
          {TABS_VISIBLES.map((t) => {
            const on = active === t.href.slice(1);
            return (
              <a
                key={t.href}
                href={t.href}
                aria-current={on ? 'page' : undefined}
                className={[
                  'rounded-full px-3.5 py-1.5 text-[13px] font-medium outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary/40',
                  on
                    ? 'bg-white text-primary shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                ].join(' ')}
              >
                {t.label}
              </a>
            );
          })}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Link
            href="/login"
            className="hidden rounded-full px-3.5 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
          >
            Entrar
          </Link>
          <Link
            href="/registro"
            className="inline-flex items-center gap-1 rounded-full bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            Empezá gratis
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          {/* Toggle del menú de tabs — sólo mobile */}
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={menuOpen}
            aria-controls="landing-menu-mobile"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-foreground/70 outline-none transition-colors hover:bg-black/[0.04] focus-visible:ring-2 focus-visible:ring-primary/40 md:hidden"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      {/* Menú desplegable de tabs (mobile) — flota bajo la cápsula */}
      {menuOpen && (
        <div id="landing-menu-mobile" className="pointer-events-auto mx-auto mt-2 max-w-3xl rounded-3xl border border-black/[0.06] bg-[#faf8f5]/90 p-2 shadow-[0_14px_44px_-14px_rgba(80,40,160,0.3)] backdrop-blur-xl md:hidden">
          {TABS_VISIBLES.map((t) => (
            <a
              key={t.href}
              href={t.href}
              onClick={() => setMenuOpen(false)}
              className={[
                'block rounded-2xl px-4 py-2.5 text-sm font-medium transition-colors',
                active === t.href.slice(1)
                  ? 'bg-primary/[0.08] text-primary'
                  : 'text-muted-foreground hover:bg-black/[0.03] hover:text-foreground',
              ].join(' ')}
            >
              {t.label}
            </a>
          ))}
        </div>
      )}
    </header>
  );
}
