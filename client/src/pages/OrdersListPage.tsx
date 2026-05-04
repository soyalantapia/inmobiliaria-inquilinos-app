import { Link } from 'react-router-dom'
import { ChevronRight, Clock, MapPin, ListChecks } from 'lucide-react'
import { mockOrders, type ProductStatus } from '@/data/mockOrders'
import { StatusBadge } from '@/components/StatusBadge'
import { cn } from '@/lib/cn'

const avatarStyles: Record<ProductStatus, string> = {
  pending: 'bg-status-warning-bg text-status-warning-fg group-hover:bg-status-warning group-hover:text-white',
  partial: 'bg-status-info-bg text-status-info-fg group-hover:bg-status-info group-hover:text-white',
  completed: 'bg-status-success-bg text-status-success-fg group-hover:bg-status-success group-hover:text-white',
}

export function OrdersListPage() {
  const counts = {
    pending: mockOrders.filter((o) => o.status === 'pending').length,
    partial: mockOrders.filter((o) => o.status === 'partial').length,
    completed: mockOrders.filter((o) => o.status === 'completed').length,
  }

  return (
    <div className="animate-fade-up mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6 sm:px-6 sm:py-10">
      <div className="flex flex-col gap-1.5">
        <div className="inline-flex w-fit items-center gap-1.5 rounded-full bg-cat-bebida-bg px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-cat-bebida">
          <ListChecks size={12} /> Operación en vivo
        </div>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
          Pedidos
        </h1>
        <p className="text-base text-neutral-500">Acceso rápido a los pedidos en demo.</p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <StatCard label="Pendientes" value={counts.pending} variant="pending" />
        <StatCard label="En curso" value={counts.partial} variant="partial" />
        <StatCard label="Completos" value={counts.completed} variant="completed" />
      </div>

      <div className="flex flex-col gap-3">
        {mockOrders.map((o, i) => {
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
    </div>
  )
}

function StatCard({
  label,
  value,
  variant,
}: {
  label: string
  value: number
  variant: ProductStatus
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

  return (
    <div
      className={cn(
        'flex flex-col gap-1 rounded-2xl bg-gradient-to-br p-3 ring-1 transition-all duration-200 hover:-translate-y-0.5 sm:p-4',
        styles[variant],
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
    </div>
  )
}
