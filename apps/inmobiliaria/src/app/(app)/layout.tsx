import { OnboardingInmo } from '@/components/onboarding';
import { PilotoFab } from '@/components/piloto-fab';
import { Sidebar } from '@/components/sidebar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      <OnboardingInmo />
      {/* FAB para clientes piloto — sólo aparece si la cuenta tiene
          el modo activo (los 9-10 beta testers). */}
      <PilotoFab />
    </div>
  );
}
