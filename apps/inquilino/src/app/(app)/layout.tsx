import { SideNav } from '@/components/nav-bar';
import { CommandPalette } from '@/components/command-palette';
import { DesktopTopbar } from '@/components/desktop-topbar';
import { Onboarding } from '@/components/onboarding';
import { PullToRefresh } from '@/components/pull-to-refresh';
import { WhatsappFab } from '@/components/whatsapp-fab';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen md:flex-row">
      <SideNav />
      <div className="flex min-w-0 flex-1 flex-col">
        <DesktopTopbar />
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col md:max-w-3xl">
          {children}
        </div>
      </div>
      <PullToRefresh />
      <WhatsappFab />
      <Onboarding />
      <CommandPalette />
    </div>
  );
}
