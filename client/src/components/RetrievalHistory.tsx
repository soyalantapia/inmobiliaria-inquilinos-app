import { Clock, MapPin, User } from 'lucide-react'
import type { RetrievalEvent } from '@/data/mockOrders'

type Props = {
  events: RetrievalEvent[]
}

export function RetrievalHistory({ events }: Props) {
  if (events.length === 0) return null

  return (
    <div className="rounded-3xl bg-white shadow-card">
      <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4 sm:px-6">
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-cat-bebida" />
          <h2 className="text-sm font-bold text-neutral-900">Historial de retiros</h2>
        </div>
        <span className="rounded-full bg-cat-bebida-bg px-2.5 py-0.5 text-[11px] font-bold text-cat-bebida">
          {events.length}
        </span>
      </div>

      <ol className="relative px-5 py-4 sm:px-6">
        {/* Vertical timeline line */}
        <span
          aria-hidden
          className="absolute bottom-6 left-[1.875rem] top-6 w-px bg-neutral-200 sm:left-[2.125rem]"
        />

        {events.map((ev, i) => {
          const totalItems = ev.items.reduce((s, x) => s + x.qty, 0)
          return (
            <li
              key={ev.id}
              className="relative flex gap-4 py-3 first:pt-0 last:pb-0"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent-50 ring-4 ring-white">
                <User size={16} className="text-accent-600" />
              </div>

              <div className="min-w-0 flex-1 pt-1.5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                  <p className="text-sm font-bold text-neutral-900">{ev.operator}</p>
                  <p className="font-mono text-xs font-semibold tabular-nums text-neutral-500">
                    {new Date(ev.at).toLocaleString('es-AR', {
                      hour: '2-digit',
                      minute: '2-digit',
                      day: '2-digit',
                      month: '2-digit',
                    })}
                  </p>
                </div>

                <div className="mt-1 flex items-center gap-2 text-xs text-neutral-500">
                  <MapPin size={12} className="text-cat-extra" /> {ev.point}
                </div>

                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {ev.items.map((it) => (
                    <li
                      key={it.productId}
                      className="inline-flex items-center gap-1 rounded-full bg-primary-100 px-2.5 py-1 text-[11px] font-semibold text-neutral-700"
                    >
                      <span className="font-bold text-accent-600 tabular-nums">×{it.qty}</span>{' '}
                      {it.productName}
                    </li>
                  ))}
                </ul>

                <p className="mt-2 text-[11px] font-medium text-neutral-400">
                  Entregó <span className="tabular-nums font-bold text-neutral-700">{totalItems}</span>{' '}
                  producto{totalItems === 1 ? '' : 's'}
                </p>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
