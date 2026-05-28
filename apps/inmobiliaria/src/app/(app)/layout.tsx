import { OnboardingInmo } from '@/components/onboarding';
import { PilotoFab } from '@/components/piloto-fab';
import { Sidebar } from '@/components/sidebar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      {/* Skip-nav: oculto visualmente pero accesible para usuarios de teclado /
          lectores de pantalla. Al enfocarse con Tab, aparece sobre todo lo demás
          y permite saltar la sidebar directamente al contenido (WCAG 2.4.1). */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:left-4 focus:top-4 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:shadow-md focus:ring-2 focus:ring-ring"
      >
        Saltar al contenido
      </a>
      <Sidebar />
      <div
        id="main-content"
        tabIndex={-1}
        className="flex min-w-0 flex-1 flex-col outline-none"
      >
        {children}
      </div>
      <OnboardingInmo />
      {/* FAB para clientes piloto — sólo aparece si la cuenta tiene
          el modo activo (los 9-10 beta testers). */}
      <PilotoFab />
    </div>
  );
}
