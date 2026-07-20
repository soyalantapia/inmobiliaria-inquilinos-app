import { MobileBottomNav } from '@/components/mobile-bottom-nav';
import { OnboardingInmo } from '@/components/onboarding';
import { PilotoFab } from '@/components/piloto-fab';
import { ReportBugButton } from '@/components/report-bug-button';
import { Sidebar } from '@/components/sidebar';
import { AuthGuard } from '@/components/auth-guard';
import { TrialBanner } from '@/components/trial-banner';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
    {/* Barra superior full-width pre-lanzamiento — sólo cuentas piloto en prod
        (cableada a /auth/me real). Va arriba de todo para verse en cada pantalla. */}
    <TrialBanner />
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
        className="flex min-w-0 flex-1 flex-col outline-none pb-16 md:pb-0"
      >
        {children}
      </div>
      {/* Barra de navegación inferior tipo app — sólo mobile (en desktop manda
          la Sidebar). El pb-16 de arriba reserva su alto para que no tape el
          contenido. */}
      <MobileBottomNav />
      <OnboardingInmo />
      {/* FAB para clientes piloto — sólo aparece si la cuenta tiene
          el modo activo (los 9-10 beta testers). */}
      <PilotoFab />
      {/* FAB de Sonar: visible para todos los usuarios del panel.
          Manda el reporte con captura, breadcrumbs y contexto automático. */}
      <ReportBugButton />
    </div>
    </AuthGuard>
  );
}
