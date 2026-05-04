import { Outlet, NavLink } from 'react-router-dom'
import { ScanLine, ListChecks, LogOut } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useAuth } from '@/lib/auth'

const links = [
  { to: '/', label: 'Escanear', icon: ScanLine, end: true },
  { to: '/pedidos', label: 'Pedidos', icon: ListChecks, end: false },
]

export function AppShell() {
  const { operator, signOut } = useAuth()
  const initials = operator
    ? operator.name
        .split(' ')
        .map((p) => p[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : ''

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
                      isActive ? 'text-accent-500' : 'text-neutral-400 group-hover:text-neutral-700',
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
            <div className="flex items-center gap-3 rounded-2xl bg-gradient-to-br from-primary-100 to-primary-50 p-3 ring-1 ring-neutral-100">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-accent-400 to-accent-600 text-sm font-bold text-white ring-2 ring-white">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-neutral-900">{operator.name}</p>
                <p className="truncate text-xs text-neutral-500">{operator.email}</p>
              </div>
              <button
                type="button"
                onClick={signOut}
                aria-label="Cerrar sesión"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-neutral-500 transition-all duration-200 hover:bg-white hover:text-status-error focus-visible:ring-2 focus-visible:ring-accent-400 focus-visible:ring-offset-2"
              >
                <LogOut size={16} />
              </button>
            </div>
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
        {operator && (
          <button
            type="button"
            onClick={signOut}
            aria-label="Cerrar sesión"
            className="flex h-11 items-center gap-2 rounded-full bg-primary-100 py-1.5 pl-1.5 pr-3 text-xs font-semibold text-neutral-700 transition-all duration-150 active:scale-95 focus-visible:ring-2 focus-visible:ring-accent-400"
          >
            <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-accent-400 to-accent-600 text-[11px] font-bold text-white ring-2 ring-white">
              {initials}
            </span>
            <LogOut size={14} className="text-neutral-500" />
          </button>
        )}
      </header>

      <main className="flex-1 overflow-x-hidden pb-32 md:pb-0">
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
