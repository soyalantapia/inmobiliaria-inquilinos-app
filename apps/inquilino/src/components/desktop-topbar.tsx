import { UserMenu } from './user-menu';

// Topbar visible solo en desktop. En mobile cada página tiene su propio header
// (porque el max-w-md y el flujo vertical mobile difiere por pantalla).
export function DesktopTopbar() {
  return (
    <header className="hidden h-16 items-center justify-end border-b bg-background/95 px-6 backdrop-blur md:flex">
      <UserMenu />
    </header>
  );
}
