'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, MapPin } from 'lucide-react';
import { Input } from '@llave/ui/input';

/**
 * Autocompletado de direcciones SIN API key, usando Nominatim (OpenStreetMap).
 * CORS abierto + gratis. Al elegir una opción, completa calle/altura/ciudad/
 * provincia/CP en el form; el usuario puede ajustar después. Debounce 500ms para
 * respetar el rate-limit de Nominatim (~1 req/s).
 */
export interface DireccionElegida {
  calle: string;
  altura: string;
  ciudad: string;
  provincia: string;
  codigoPostal: string;
}

interface Sugerencia {
  display_name: string;
  address?: Record<string, string>;
}

export function AutocompleteDireccion({
  onElegir,
}: {
  onElegir: (d: DireccionElegida) => void;
}) {
  const [q, setQ] = useState('');
  const [sugs, setSugs] = useState<Sugerencia[]>([]);
  const [cargando, setCargando] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 4) {
      setSugs([]);
      return;
    }
    timer.current = setTimeout(async () => {
      setCargando(true);
      try {
        const url =
          'https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=6&accept-language=es' +
          '&countrycodes=ar,uy,cl,py,bo,pe,co,ec,ve,mx,br,cr,pa,do,gt,hn,sv,ni' +
          `&q=${encodeURIComponent(q)}`;
        const res = await fetch(url, { headers: { Accept: 'application/json' } });
        const data = (await res.json()) as Sugerencia[];
        setSugs(Array.isArray(data) ? data : []);
        setAbierto(true);
      } catch {
        setSugs([]);
      } finally {
        setCargando(false);
      }
    }, 500);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [q]);

  // Cerrar el dropdown al clickear afuera.
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const elegir = (s: Sugerencia) => {
    const a = s.address ?? {};
    onElegir({
      calle: a.road ?? a.pedestrian ?? a.residential ?? a.neighbourhood ?? '',
      altura: a.house_number ?? '',
      ciudad: a.city ?? a.town ?? a.village ?? a.suburb ?? a.municipality ?? a.county ?? '',
      provincia: a.state ?? a.region ?? a.province ?? '',
      codigoPostal: a.postcode ?? '',
    });
    setQ(s.display_name);
    setAbierto(false);
  };

  return (
    <div className="relative" ref={boxRef}>
      <div className="relative">
        <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => sugs.length > 0 && setAbierto(true)}
          placeholder="Buscá la dirección (calle y número, ciudad)…"
          className="pl-9"
          autoComplete="off"
        />
        {cargando && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>
      {abierto && sugs.length > 0 && (
        <ul className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-md border bg-popover shadow-md">
          {sugs.map((s, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => elegir(s)}
                className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
              >
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="line-clamp-2">{s.display_name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-1 text-[11px] text-muted-foreground">
        Autocompletado con OpenStreetMap. Elegí una opción para completar los campos de abajo;
        después podés ajustarlos.
      </p>
    </div>
  );
}
