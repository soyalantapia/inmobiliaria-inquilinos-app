import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Clock, MapPin, ListChecks, Search, X, Inbox } from 'lucide-react'
import { type ProductStatus } from '@/data/mockOrders'
import { useOrders, useOrderStats } from '@/lib/ordersStore'
import { StatusBadge } from '@/components/StatusBadge'
import { cn } from '@/lib/cn'

const avatarStyles: Record<ProductStatus, string> = {
  pending:
    'bg-status-warning-bg text-status-warning-fg group-hover:bg-status-warning group-hover:text-white',
  partial:
    'bg-status-info-bg text-status-info-fg group-hover:bg-status-info group-hover:text-white',
  completed:
    'bg-status-success-bg text-status-success-fg group-hover:bg-status-success group-hover:text-white',
}

type Filter = 'all' | ProductStatus

export function OrdersListPage() {
  const orders = useOrders()
  const stats = useOrderStats()
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return orders.filter((o) => {
      if (filter !== 'all' && o.status !== filter) return false
      if (!q) return true
      return (
        o.customerName.toLowerCase().includes(q) ||
        o.token.toLowerCase().includes(q) ||
        (o.pickupPoint ?? '').toLowerCase().includes(q)
      )
    })
  }, [orders, filter, query])

  return (
    <div className="animate-fade-up mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6 sm:px-6 sm:py-10">
      <div className="flex flex-col gap-1.5">
        <div className="inline-flex w-fit items-center gap-1.5 rounded-full bg-cat-bebida-bg px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-cat-bebida">
          <ListChecks size={12} /> Operación en vivo
        </div>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
          Pedidos
        </h1>
        <p className="text-base text-neutral-500">
          {stats.total === 0
            ? 'Aún no hay pedidos.'
            : `${stats.total} pedido${stats.total === 1 ? '' : 's'} en total`}
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search
          size={18}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400"
        />
        <input
          type="search"
          inputMode="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nombre, código o punto"
          className="h-12 w-full rounded-2xl bg-white pl-11 pr-12 text-sm text-neutral-900 shadow-card ring-1 ring-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-accent-400"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="Limpiar búsqueda"
            className="absolute right-3 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full bg-primary-100 text-neutral-500 transition-colors hover:bg-primary-200 hover:text-neutral-800 focus-visible:ring-2 focus-visible:ring-accent-400"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Stats / filters */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <StatCard
          label="Pendientes"
          value={stats.pending}
          variant="pending"
          active={filter === 'pending'}
          onClick={() => setFilter((f) => (f === 'pending' ? 'all' : 'pending'))}
        />
        <StatCard
          label="En curso"
          value={stats.partial}
          variant="partial"
          active={filter === 'partial'}
          onClick={() => setFilter((f) => (f === 'partial' ? 'all' : 'partial'))}
        />
        <StatCard
          label="Completos"
          value={stats.completed}
          variant="completed"
          active={filter === 'completed'}
          onClick={() => setFilter((f) => (f === 'completed' ? 'all' : 'completed'))}
        />
      </div>

      {filter !== 'all' && (
        <button
          type="button"
          onClick={() => setFilter('all')}
          className="inline-flex w-fit items-center gap-1.5 rounded-full bg-accent-50 px-3 py-1.5 text-xs font-bold text-accent-700 ring-1 ring-accent-100 hover:bg-accent-100"
        >
          <X size={12} /> Quitar filtro
        </button>
      )}

      {/* List */}
      {filtered.length === 0 ? (
        <EmptyState query={query} filter={filter} />
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((o, i) => {
            const total = o.products.reduce((s, p) => s + p.total, 0)
            const retrieved = o.products.reduce((s, p) => s + p.retrieved, 0)
            return (
              <Link
                key={o.id}
                to={`/pedidos/${o.token}`}
                style={{ animationDelay: `${i * 60}ms` }}
                className="animate-fade-up group flex items-center gap-4 rounded-3xl bg-white p-4 shadow-card transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-card-hover focus-visible:ring-2 focus-visible:ring-accent-400 focus-visible:ring-offset-2 sm:p-5"
              >
                <div
                  className={cn(
                    'grid h-14 w-14 shrink-0 place-items-center rounded-2xl font-mono text-xs font-bold tracking-widest transition-all duration-300',
                    avatarStyles[o.status],
                  )}
                >
                  {o.token.slice(-3)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-bold text-neutral-900">{o.customerName}</p>
                    <StatusBadge status={o.status} />
                  </div>
                  <p className="mt-0.5 font-mono text-xs font-semibold tracking-widest text-neutral-400">
                    {o.token}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium text-neutral-500">
                    {o.pickupPoint && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin size={12} className="text-cat-extra" /> {o.pickupPoint}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1">
                      <Clock size={12} className="text-cat-bebida" />
                      {new Date(o.createdAt).toLocaleString('es-AR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <span className="tabular-nums font-semibold text-neutral-700">
                      {retrieved}/{total} entregados
                    </span>
                  </div>
                </div>
                <ChevronRight
                  size={20}
                  className="shrink-0 text-neutral-300 transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-accent-500"
                />
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  variant,
  active,
  onClick,
}: {
  label: string
  value: number
  variant: ProductStatus
  active: boolean
  onClick: () => void
}) {
  const styles: Record<ProductStatus, string> = {
    pending: 'from-status-warning-bg to-amber-50 ring-status-warning/20',
    partial: 'from-status-info-bg to-sky-50 ring-status-info/20',
    completed: 'from-status-success-bg to-emerald-50 ring-status-success/20',
  }
  const dotColors: Record<ProductStatus, string> = {
    pending: 'bg-status-warning',
    partial: 'bg-status-info',
    completed: 'bg-status-success',
  }
  const valueColors: Record<ProductStatus, string> = {
    pending: 'text-status-warning-fg',
    partial: 'text-status-info-fg',
    completed: 'text-status-success-fg',
  }
  const activeRing: Record<ProductStatus, string> = {
    pending: 'ring-2 ring-status-warning',
    partial: 'ring-2 ring-status-info',
    completed: 'ring-2 ring-status-success',
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'group flex flex-col gap-1 rounded-2xl bg-gradient-to-br p-3 ring-1 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 focus-visible:ring-offset-2 sm:p-4',
        styles[variant],
        active && activeRing[variant],
      )}
    >
      <div className="flex items-center gap-1.5">
        <span className={cn('h-1.5 w-1.5 rounded-full', dotColors[variant])} />
        <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 sm:text-[11px]">
          {label}
        </p>
      </div>
      <p className={cn('text-2xl font-bold tabular-nums sm:text-3xl', valueColors[variant])}>
        {value}
      </p>
    </button>
  )
}

function EmptyState({ query, filter }: { query: string; filter: Filter }) {
  const isFiltered = query.trim() !== '' || filter !== 'all'
  return (
    <div className="animate-fade-in mx-auto flex max-w-md flex-col items-center gap-3 rounded-3xl bg-white px-6 py-12 text-center shadow-card">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary-100 text-neutral-500">
        <Inbox size={26} />
      </div>
      <div>
        <h3 className="text-base font-bold text-neutral-900">
          {isFiltered ? 'Sin resultados' : 'Sin pedidos'}
        </h3>
        <p className="mt-1 text-sm text-neutral-500">
          {isFiltered
            ? 'Probá con otro término o quitá los filtros.'
            : 'Cuando lleguen pedidos van a aparecer acá.'}
        </p>
      </div>
    </div>
  )
}
