import type { ProductStatus } from '@/data/mockOrders'
import { cn } from '@/lib/cn'

const labels: Record<ProductStatus, string> = {
  pending: 'Pendiente',
  partial: 'En curso',
  completed: 'Completado',
}

const styles: Record<ProductStatus, string> = {
  pending: 'bg-status-warning-bg text-status-warning-fg before:bg-status-warning',
  partial: 'bg-status-info-bg text-status-info-fg before:bg-status-info',
  completed: 'bg-status-success-bg text-status-success-fg before:bg-status-success',
}

export function StatusBadge({ status, className }: { status: ProductStatus; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold',
        'before:h-1.5 before:w-1.5 before:shrink-0 before:rounded-full before:content-[""]',
        styles[status],
        className,
      )}
    >
      {labels[status]}
    </span>
  )
}
