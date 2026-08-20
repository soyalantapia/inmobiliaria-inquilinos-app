'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { NavPropietario, SideNavPropietario } from '@/components/nav-propietario';
import { apiFetch, leerSesion, leerToken, type MiCartera } from '@/lib/api';

/**
 * El caparazón de las cuatro pestañas: guard de sesión + navegación + encabezado.
 *
 * El chequeo de sesión vive ACÁ y no en cada página. Antes estaba dentro de la única pantalla
 * que había; repetirlo cuatro veces sería la forma más rápida de que una pestaña nueva se
 * olvide de pedirlo y quede accesible sin token.
 */
export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [listo, setListo] = useState(false);
  const sesion = typeof window !== 'undefined' ? leerSesion() : null;

  // En un effect: leer localStorage durante el render rompe la hidratación (el server no lo
  // tiene) y hacía parpadear el portal antes de redirigir.
  useEffect(() => {
    if (!leerToken()) router.replace('/login');
    else setListo(true);
  }, [router]);

  const cartera = useQuery({
    queryKey: ['mi-cartera'],
    queryFn: () => apiFetch<MiCartera>('/portal/mi-cartera'),
    enabled: listo,
  });

  // Cualquier 401 (sesión vencida o revocada) manda al login: apiFetch ya limpió el storage.
  useEffect(() => {
    if (cartera.isError) router.replace('/login');
  }, [cartera.isError, router]);

  if (!listo || cartera.isPending) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Cargando" />
      </main>
    );
  }

  return (
    <div className="flex min-h-screen">
      <SideNavPropietario />
      <div className="flex min-w-0 flex-1 flex-col">
        {/* El nombre del dueño y quién le administra van en el marco, no en cada pestaña: es
            lo que no cambia al navegar. El resto de sus datos vive en Mi perfil. */}
        <header className="border-b px-4 py-3 md:px-6">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Tus propiedades</p>
          <h1 className="truncate text-xl font-semibold md:text-2xl">
            {cartera.data?.nombre ?? sesion?.nombre}
          </h1>
          <p className="text-sm text-muted-foreground">
            Administra {cartera.data?.inmobiliaria.nombre ?? sesion?.inmobiliaria}
          </p>
        </header>
        <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 p-4 md:p-6">{children}</main>
        <NavPropietario />
      </div>
    </div>
  );
}
