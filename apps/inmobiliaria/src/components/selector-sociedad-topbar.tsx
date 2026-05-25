'use client';

import { useEffect, useRef, useState } from 'react';
import { Briefcase, Check, ChevronDown, Globe } from 'lucide-react';
import { Badge } from '@llave/ui/badge';
import { listarSociedades, type Sociedad } from '@/lib/sociedades-storage';
import {
  TODAS_LAS_SOCIEDADES,
  leerSociedadActiva,
  setSociedadActiva,
  type SociedadActivaId,
} from '@/lib/sociedad-seleccionada';

/**
 * Switcher en la topbar para filtrar todo el panel por sociedad.
 * Resuelve el caso de Camila: una sola inmo administra varias razones
 * sociales en distintas provincias y necesita ver una a la vez.
 *
 * Compacto: chip que muestra la sociedad activa + dropdown con la
 * lista completa. Si solo hay 1 sociedad activa, no aparece el
 * switcher (no tiene sentido).
 */
export function SelectorSociedadTopbar() {
  const [hidratado, setHidratado] = useState(false);
  const [activa, setActiva] = useState<SociedadActivaId>(TODAS_LAS_SOCIEDADES);
  const [sociedades, setSociedades] = useState<Sociedad[]>([]);
  const [abierto, setAbierto] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSociedades(listarSociedades());
    setActiva(leerSociedadActiva());
    setHidratado(true);
  }, []);

  // Cerrar dropdown al click fuera
  useEffect(() => {
    if (!abierto) return;
    const onClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setAbierto(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [abierto]);

  if (!hidratado || sociedades.length <= 1) return null;

  const elegir = (id: SociedadActivaId) => {
    setActiva(id);
    setSociedadActiva(id);
    setAbierto(false);
  };

  const sociedadActiva =
    activa === TODAS_LAS_SOCIEDADES ? null : sociedades.find((s) => s.id === activa);

  const label =
    activa === TODAS_LAS_SOCIEDADES
      ? `Todas (${sociedades.length})`
      : sociedadActiva?.nombreComercial ?? 'Sociedad';

  const Icon = activa === TODAS_LAS_SOCIEDADES ? Globe : Briefcase;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="flex items-center gap-2 rounded-full border bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted/40"
        aria-label="Cambiar sociedad activa"
        aria-expanded={abierto}
      >
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="hidden max-w-[140px] truncate sm:inline">{label}</span>
        <span className="sm:hidden">
          {activa === TODAS_LAS_SOCIEDADES ? 'Todas' : sociedadActiva?.nombreComercial.split(' ')[0]}
        </span>
        <ChevronDown
          className={`h-3 w-3 text-muted-foreground transition-transform ${
            abierto ? 'rotate-180' : ''
          }`}
        />
      </button>

      {abierto && (
        <div className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-lg border bg-popover shadow-lg">
          <div className="border-b bg-muted/40 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Ver datos de
            </p>
            <p className="text-[11px] text-muted-foreground">
              El panel completo se filtra por la sociedad que elijas.
            </p>
          </div>
          <div className="max-h-[60vh] overflow-y-auto py-1">
            {/* Opción "Todas" */}
            <button
              type="button"
              onClick={() => elegir(TODAS_LAS_SOCIEDADES)}
              className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/40 ${
                activa === TODAS_LAS_SOCIEDADES ? 'bg-primary/5' : ''
              }`}
            >
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
                <Globe className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Todas las sociedades</p>
                <p className="text-[11px] text-muted-foreground">
                  Vista consolidada de los {sociedades.length} negocio{sociedades.length === 1 ? '' : 's'}
                </p>
              </div>
              {activa === TODAS_LAS_SOCIEDADES && (
                <Check className="h-4 w-4 shrink-0 text-primary" />
              )}
            </button>

            <div className="my-1 border-t" />

            {sociedades.map((s) => {
              const seleccionada = activa === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => elegir(s.id)}
                  className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/40 ${
                    seleccionada ? 'bg-primary/5' : ''
                  }`}
                >
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary/10 text-[10px] font-bold text-primary">
                    {(s.nombreComercial.match(/\b\w/g) ?? [])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-sm font-medium">{s.nombreComercial}</p>
                      {s.esPrincipal && (
                        <Badge className="shrink-0 bg-primary/15 text-[9px] text-primary">
                          Principal
                        </Badge>
                      )}
                    </div>
                    <p className="truncate text-[11px] text-muted-foreground">
                      CUIT {s.cuit}
                    </p>
                  </div>
                  {seleccionada && (
                    <Check className="h-4 w-4 shrink-0 text-primary" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
