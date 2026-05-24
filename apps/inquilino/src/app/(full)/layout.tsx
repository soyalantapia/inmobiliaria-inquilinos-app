'use client';

import { usePathname } from 'next/navigation';

// Layout fullscreen — login y flujo de pago. Sin sidebar ni navbar.
// El login usa un split de 2 columnas en desktop y NO debe estar limitado a
// max-w-lg como el resto. Para todo lo demás (checkout, verificar, pago) sí
// queremos el contenido centrado y angosto para que no se vea pegado.

export default function FullLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const sinMaxAncho = pathname === '/login';

  return (
    <div
      className={
        sinMaxAncho
          ? 'flex min-h-screen w-full flex-col'
          : 'mx-auto flex min-h-screen w-full max-w-md flex-col md:max-w-lg'
      }
    >
      {children}
    </div>
  );
}
