'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, MapPin } from 'lucide-react';
import { Input } from '@llave/ui/input';

/**
 * Autocompletado de direcciones SIN API key, usando Nominatim (OpenStreetMap).
 * CORS abierto + gratis. Al elegir una opción, completa calle/altura/ciudad/
 * provincia/CP en el form; el usuario puede ajustar después. Debounce 500ms para
 * respetar el rate-limit de Nominatim (~1 req/s).
 *
 * Acotado al PAÍS de la inmobiliaria (config Mercado; default AR): buscar en
 * toda LatAm devolvía "Rivadavia" de México o Brasil antes que la de acá.
 */
export interface DireccionElegida {
  calle: string;
  altura: string;
  ciudad: string;
  provincia: string;
  codigoPostal: string;
  /**
   * Tipo de propiedad DEDUCIDO del edificio en OSM (building=house/apartments/
   * retail/warehouse…). null cuando OSM solo tiene el punto de dirección (no
   * sabe qué edificio es) — el form NO debe pisar una elección del usuario.
   */
  tipoSugerido: 'DEPARTAMENTO' | 'CASA' | 'LOCAL' | 'GALPON' | null;
  /** true si la opción elegida NO trajo el número de calle (queda por completar). */
  alturaFaltante: boolean;
}

interface Sugerencia {
  display_name: string;
  address?: Record<string, string>;
  // jsonv2 llama `category` a lo que la API vieja llamaba `class`.
  category?: string;
  class?: string;
  type?: string;
}

// building=* de OSM → nuestro TipoPropiedad. CONSERVADOR a propósito: los
// resultados category='place' type='house' son solo "punto de dirección" (no
// dicen qué edificio hay) → null, no sugerimos nada.
const TIPO_POR_BUILDING: Record<string, DireccionElegida['tipoSugerido']> = {
  apartments: 'DEPARTAMENTO',
  flats: 'DEPARTAMENTO',
  residential: 'DEPARTAMENTO',
  house: 'CASA',
  detached: 'CASA',
  semidetached_house: 'CASA',
  bungalow: 'CASA',
  terrace: 'CASA',
  retail: 'LOCAL',
  commercial: 'LOCAL',
  kiosk: 'LOCAL',
  supermarket: 'LOCAL',
  warehouse: 'GALPON',
  industrial: 'GALPON',
  hangar: 'GALPON',
  barn: 'GALPON',
};

function tipoDesdeOsm(s: Sugerencia): DireccionElegida['tipoSugerido'] {
  const categoria = s.category ?? s.class ?? '';
  const t = s.type ?? '';
  if (categoria === 'building') return TIPO_POR_BUILDING[t] ?? null;
  if (categoria === 'shop') return 'LOCAL';
  if (categoria === 'industrial' || t === 'warehouse') return 'GALPON';
  return null;
}

export function AutocompleteDireccion({
  onElegir,
  paisCodigo = 'AR',
}: {
  onElegir: (d: DireccionElegida) => void;
  /** ISO-3166 alpha-2 del país donde busca (config Mercado de la inmobiliaria). */
  paisCodigo?: string;
}) {
  const [q, setQ] = useState('');
  const [sugs, setSugs] = useState<Sugerencia[]>([]);
  const [cargando, setCargando] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  // Versión de la elección: si el usuario elige OTRA sugerencia mientras el
  // fallback de CP de la anterior sigue en vuelo, la vieja NO debe pisar los
  // campos al llegar tarde.
  const eleccionRef = useRef(0);

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
          `&countrycodes=${encodeURIComponent(paisCodigo.toLowerCase())}` +
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
  }, [q, paisCodigo]);

  // Cerrar el dropdown al clickear afuera.
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const elegir = async (s: Sugerencia) => {
    const miEleccion = ++eleccionRef.current;
    const a = s.address ?? {};
    const ciudad = a.city ?? a.town ?? a.village ?? a.suburb ?? a.municipality ?? a.county ?? '';
    const provincia = a.state ?? a.region ?? a.province ?? '';
    let codigoPostal = a.postcode ?? '';
    setQ(s.display_name);
    setAbierto(false);

    // CP FALLBACK: muchas direcciones argentinas en OSM no tienen postcode a
    // nivel calle, pero el centroide de la LOCALIDAD casi siempre sí (el CP
    // base de 4 dígitos). Segunda consulta puntual solo cuando faltó.
    if (!codigoPostal && ciudad) {
      setCargando(true);
      try {
        const url =
          'https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=1&accept-language=es' +
          `&countrycodes=${encodeURIComponent(paisCodigo.toLowerCase())}` +
          `&city=${encodeURIComponent(ciudad)}` +
          (provincia ? `&state=${encodeURIComponent(provincia)}` : '');
        const res = await fetch(url, { headers: { Accept: 'application/json' } });
        const data = (await res.json()) as Sugerencia[];
        codigoPostal = data?.[0]?.address?.postcode ?? '';
      } catch {
        // sin CP: el usuario lo completa a mano, no rompemos la elección
      } finally {
        setCargando(false);
      }
    }

    // Llegó tarde: el usuario ya eligió otra sugerencia → descartamos esta.
    if (miEleccion !== eleccionRef.current) return;

    onElegir({
      calle: a.road ?? a.pedestrian ?? a.residential ?? a.neighbourhood ?? '',
      altura: a.house_number ?? '',
      ciudad,
      provincia,
      codigoPostal,
      tipoSugerido: tipoDesdeOsm(s),
      alturaFaltante: !a.house_number,
    });
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
