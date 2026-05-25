'use client';

import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { esClientePiloto } from '@/lib/piloto-storage';

/**
 * Badge "Cliente piloto" en la topbar. Identifica a los 9-10 clientes
 * de la beta cerrada. Para ellos es un símbolo de status (acceso
 * temprano + canal directo con founders); para el equipo es un
 * recordatorio visual de que toca pulir lo que falle.
 */
export function PilotoBadgeTopbar() {
  const [hidratado, setHidratado] = useState(false);
  const [esPiloto, setEsPiloto] = useState(false);

  useEffect(() => {
    setEsPiloto(esClientePiloto());
    setHidratado(true);
  }, []);

  if (!hidratado || !esPiloto) return null;

  return (
    <span
      className="hidden items-center gap-1 rounded-full bg-gradient-to-r from-violet-600 to-violet-500 px-2.5 py-1 text-[10px] font-semibold text-white shadow-md shadow-violet-500/20 md:inline-flex"
      title="Cliente piloto de My Alquiler · acceso temprano + canal directo con el equipo"
    >
      <Sparkles className="h-3 w-3" />
      Cliente piloto
    </span>
  );
}
