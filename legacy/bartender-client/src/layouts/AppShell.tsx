import { Outlet, NavLink } from 'react-router-dom'
import { ScanLine, ListChecks } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useAuth } from '@/lib/auth'
import { OfflineBanner } from '@/components/OfflineBanner'
import { UserMenu } from '@/components/UserMenu'

const links = [
  { to: '/', label: 'Escanear', icon: ScanLine, end: true },
  { to: '/pedidos', label: 'Pedidos', icon: ListChecks, end: false },
]

export function AppShell() {
  const { operator } = useAuth()

  return (
    <div className="flex min-h-[100svh] flex-col bg-primary-50 text-neutral-900 md:flex-row">
      {/* Sidebar (md+) */}
      <aside className="hidden shrink-0 border-r border-neutral-100 bg-white md:flex md:w-60 md:flex-col lg:w-64">
        <div className="flex items-center gap-3 px-6 py-7">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-accent-400 to-accent-600 text-white shadow-cta">
            <ScanLine size={22} />
          </div>
          <div>
            <p className="text-base font-bold text-neutral-900">Bartender</p>
            <p className="text-xs font-medium text-neutral-400">por Deenex</p>
          </div>
        </div>
        <nav className="flex flex-col gap-1 px-3">
          {links.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition-all duration-200',
                  'focus-visible:ring-2 focus-visible:ring-accent-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
                  isActive
                    ? 'bg-accent-50 text-accent-700'
                    : 'text-neutral-500 hover:bg-primary-100/60 hover:text-neutral-800',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    size={18}
                    className={cn(
                      'transition-colors',
                      isActive
                        ? 'text-accent-500'
                        : 'text-neutral-400 group-hover:text-neutral-700',
                    )}
                  />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {operator && (
          <div className="mt-auto border-t border-neutral-100 p-3">
            <UserMenu variant="sidebar" />
          </div>
        )}
      </aside>

      {/* Mobile header */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-neutral-100 bg-white/85 px-4 py-3 backdrop-blur-md md:hidden">
        <div className="flex items-center gap-2.5">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-accent-400 to-accent-600 text-white shadow-cta">
            <ScanLine size={18} />
          </div>
          <div>
            <p className="text-sm font-bold leading-tight text-neutral-900">Bartender</p>
            <p className="text-[11px] font-medium leading-tight text-neutral-400">por Deenex</p>
          </div>
        </div>
        {operator && <UserMenu variant="header" />}
      </header>

      <main className="flex-1 overflow-x-hidden pb-32 md:pb-0">
        <OfflineBanner />
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      <nav
        className="fixed inset-x-3 bottom-3 z-30 rounded-3xl bg-white p-1.5 shadow-floating md:hidden"
        style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center justify-around">
          {links.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex flex-1 flex-col items-center gap-0.5 rounded-2xl py-2.5 text-[11px] font-semibold transition-all duration-200',
                  isActive
                    ? 'bg-gradient-to-br from-accent-400 to-accent-600 text-white shadow-cta'
                    : 'text-neutral-500',
                )
              }
            >
              <Icon size={20} />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
