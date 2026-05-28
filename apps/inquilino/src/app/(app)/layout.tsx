import { SideNav } from '@/components/nav-bar';
import { DesktopTopbar } from '@/components/desktop-topbar';
import { Onboarding } from '@/components/onboarding';
import { PullToRefresh } from '@/components/pull-to-refresh';
import { WhatsappFab } from '@/components/whatsapp-fab';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen md:flex-row">
      {/* Skip-nav: oculto visualmente pero accesible para usuarios de teclado /
          lectores de pantalla. Al enfocarse con Tab, aparece sobre todo lo demás
          y permite saltar la sidebar directamente al contenido (WCAG 2.4.1). */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:left-4 focus:top-4 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:shadow-md focus:ring-2 focus:ring-ring"
      >
        Saltar al contenido
      </a>
      <SideNav />
      <div className="flex min-w-0 flex-1 flex-col">
        <DesktopTopbar />
        <div
          id="main-content"
          tabIndex={-1}
          className="mx-auto flex w-full max-w-md flex-1 flex-col outline-none md:max-w-3xl"
        >
          {children}
        </div>
      </div>
      <PullToRefresh />
      <WhatsappFab />
      <Onboarding />
    </div>
  );
}
