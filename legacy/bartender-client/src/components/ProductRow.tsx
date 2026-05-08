import { Beer, Coffee, UtensilsCrossed, Check } from 'lucide-react'
import type { OrderProduct } from '@/data/mockOrders'
import { QuantityStepper } from './QuantityStepper'
import { cn } from '@/lib/cn'

const categoryConfig = {
  bebida: {
    Icon: Beer,
    iconBg: 'bg-cat-bebida-bg',
    iconText: 'text-cat-bebida',
    ringSelected: 'ring-cat-bebida/50',
    label: 'Bebida',
  },
  comida: {
    Icon: UtensilsCrossed,
    iconBg: 'bg-cat-comida-bg',
    iconText: 'text-cat-comida',
    ringSelected: 'ring-cat-comida/50',
    label: 'Comida',
  },
  extra: {
    Icon: Coffee,
    iconBg: 'bg-cat-extra-bg',
    iconText: 'text-cat-extra',
    ringSelected: 'ring-cat-extra/40',
    label: 'Extra',
  },
} as const

type Props = {
  product: OrderProduct
  selected: number
  onChange: (qty: number) => void
}

export function ProductRow({ product, selected, onChange }: Props) {
  const remaining = product.total - product.retrieved
  const cfg = categoryConfig[product.category] ?? categoryConfig.extra
  const Icon = cfg.Icon
  const isFull = remaining === 0
  const hasSelection = selected > 0

  return (
    <div
      className={cn(
        'flex flex-col gap-4 rounded-3xl bg-white p-4 transition-all duration-300 ease-out sm:flex-row sm:items-center sm:justify-between sm:p-5',
        isFull && 'opacity-80',
        !isFull && hasSelection && cn('shadow-card-hover ring-2', cfg.ringSelected),
        !isFull && !hasSelection && 'shadow-card hover:-translate-y-0.5 hover:shadow-card-hover',
      )}
    >
      <div className="flex min-w-0 items-center gap-4">
        <div
          className={cn(
            'grid h-12 w-12 shrink-0 place-items-center rounded-2xl transition-all duration-300',
            isFull ? 'bg-status-success-bg text-status-success' : cn(cfg.iconBg, cfg.iconText),
          )}
        >
          {isFull ? <Check size={22} strokeWidth={2.5} /> : <Icon size={22} />}
        </div>
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <h3 className="truncate text-base font-bold text-neutral-900 sm:text-lg">
              {product.name}
            </h3>
            <span className="text-xs font-semibold text-neutral-400">×{product.total}</span>
          </div>
          {product.description && (
            <p className="truncate text-sm text-neutral-500">{product.description}</p>
          )}
          <p className="mt-1 text-xs font-medium text-neutral-400">
            Entregados <span className="text-neutral-700">{product.retrieved}</span> · Faltan{' '}
            <span className={cn(isFull ? 'text-status-success' : cfg.iconText)}>{remaining}</span>
          </p>
        </div>
      </div>

      <div className="flex items-center justify-end">
        {isFull ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-status-success-bg px-3 py-1.5 text-xs font-bold text-status-success-fg">
            <Check size={14} strokeWidth={3} /> Entregado
          </span>
        ) : (
          <QuantityStepper value={selected} max={remaining} onChange={onChange} />
        )}
      </div>
    </div>
  )
}
