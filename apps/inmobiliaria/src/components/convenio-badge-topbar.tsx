'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Handshake } from 'lucide-react';
import { apiEnabled } from '@/lib/api/client';
import { leerCuponActivo, type CuponActivo } from '@/lib/cupones';

/**
 * Badge pequeño en la topbar que muestra el convenio activo de la
 * inmobiliaria (CUCICBA, CPI, Edifica, etc.). Crea sensación de
 * pertenencia y reciprocidad — la inmo siente que "trabaja con" el
 * colegio, no que paga un descuento.
 *
 * Si no hay cupón activo, no aparece. Si hay, linkea a /configuracion?
 * tab=convenios para que pueda gestionarlo.
 */
export function ConvenioBadgeTopbar() {
  const [hidratado, setHidratado] = useState(false);
  const [activo, setActivo] = useState<CuponActivo | null>(null);

  useEffect(() => {
    setActivo(leerCuponActivo());
    setHidratado(true);
  }, []);

  // En prod no hay convenio real (CUCICBA/CPI/etc.): el cupón se siembra
  // en localStorage por el flujo demo. No mostramos el badge mockeado.
  if (apiEnabled) return null;

  if (!hidratado || !activo) return null;

  const sigla = activo.cupon.sigla ?? activo.cupon.convenio.split(' ')[0] ?? '';

  return (
    <Link
      href="/configuracion#convenios"
      className="hidden items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50/60 px-2.5 py-1 text-[10px] font-medium text-emerald-800 transition-colors hover:bg-emerald-100 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-300 dark:hover:bg-emerald-900/40 md:inline-flex"
      title={`Convenio activo: ${activo.cupon.convenio} · ${activo.cupon.porcentaje}% off`}
    >
      <Handshake className="h-3 w-3" />
      <span className="font-semibold">{sigla}</span>
      <span className="hidden text-[9px] opacity-80 lg:inline">
        · −{activo.cupon.porcentaje}%
      </span>
    </Link>
  );
}
