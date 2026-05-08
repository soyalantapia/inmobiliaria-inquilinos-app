import { useEffect, useRef, type ReactNode } from 'react'
import { AlertTriangle, AlertCircle, Info } from 'lucide-react'
import { cn } from '@/lib/cn'

export type ConfirmVariant = 'warning' | 'danger' | 'info'

const variantConfig: Record<
  ConfirmVariant,
  { Icon: typeof AlertTriangle; iconBg: string; iconText: string; cta: string }
> = {
  warning: {
    Icon: AlertTriangle,
    iconBg: 'bg-status-warning-bg',
    iconText: 'text-status-warning',
    cta: 'bg-gradient-to-br from-status-warning to-amber-600 hover:brightness-105 shadow-cta-neutral',
  },
  danger: {
    Icon: AlertCircle,
    iconBg: 'bg-status-error-bg',
    iconText: 'text-status-error',
    cta: 'bg-gradient-to-br from-status-error to-rose-600 hover:brightness-105 shadow-cta-neutral',
  },
  info: {
    Icon: Info,
    iconBg: 'bg-accent-50',
    iconText: 'text-accent-500',
    cta: 'bg-gradient-to-br from-accent-400 to-accent-600 hover:from-accent-500 hover:to-accent-700 shadow-cta',
  },
}

type Props = {
  open: boolean
  variant?: ConfirmVariant
  title: string
  description?: ReactNode
  confirmLabel: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  variant = 'warning',
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancelar',
  onConfirm,
  onCancel,
}: Props) {
  const cfg = variantConfig[variant]
  const Icon = cfg.Icon
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancel()
      } else if (e.key === 'Enter') {
        e.preventDefault()
        onConfirm()
      }
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    // Focus confirm button for keyboard users (but Enter requires deliberate press)
    const t = window.setTimeout(() => confirmRef.current?.focus(), 50)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      window.clearTimeout(t)
    }
  }, [open, onCancel, onConfirm])

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      className="fixed inset-0 z-[100] grid place-items-center px-4 py-10"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onCancel}
        className="animate-fade-in absolute inset-0 bg-neutral-950/50 backdrop-blur-sm"
      />

      {/* Dialog */}
      <div className="animate-toast-in relative w-full max-w-sm rounded-3xl bg-white p-6 shadow-toast ring-1 ring-neutral-100 sm:max-w-md sm:p-7">
        <div className="flex flex-col items-center gap-4 text-center">
          <div
            className={cn(
              'grid h-16 w-16 place-items-center rounded-3xl',
              cfg.iconBg,
              cfg.iconText,
            )}
          >
            <Icon size={32} strokeWidth={2.2} />
          </div>

          <div>
            <h2 id="confirm-title" className="text-xl font-bold text-neutral-900">
              {title}
            </h2>
            {description && (
              <div className="mt-2 text-sm text-neutral-500">{description}</div>
            )}
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            className={cn(
              'flex-1 rounded-full px-5 py-3.5 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-accent-400 focus-visible:ring-offset-2',
              cfg.cta,
            )}
          >
            {confirmLabel}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-full bg-primary-100 px-5 py-3.5 text-sm font-semibold text-neutral-700 transition-colors hover:bg-primary-200 focus-visible:ring-2 focus-visible:ring-accent-400 focus-visible:ring-offset-2"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
