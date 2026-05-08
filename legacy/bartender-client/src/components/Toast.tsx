import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
} from 'lucide-react'
import { cn } from '@/lib/cn'

export type ToastVariant = 'success' | 'warning' | 'error' | 'info'

export type Toast = {
  id: string
  variant: ToastVariant
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
  duration?: number
}

type ToastInput = Omit<Toast, 'id'>

type ToastContextValue = {
  toasts: Toast[]
  show: (toast: ToastInput) => string
  dismiss: (id: string) => void
  success: (title: string, description?: string) => string
  error: (title: string, description?: string) => string
  warning: (title: string, description?: string) => string
  info: (title: string, description?: string) => string
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const timers = useRef<Map<string, number>>(new Map())

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
  }, [])

  const show = useCallback(
    (input: ToastInput) => {
      const id = Math.random().toString(36).slice(2, 10)
      const duration = input.duration ?? (input.variant === 'error' ? 6000 : 4000)
      setToasts((prev) => [...prev, { id, ...input }])
      if (duration > 0) {
        const timer = window.setTimeout(() => dismiss(id), duration)
        timers.current.set(id, timer)
      }
      return id
    },
    [dismiss],
  )

  const success = useCallback(
    (title: string, description?: string) =>
      show({ variant: 'success', title, description }),
    [show],
  )
  const error = useCallback(
    (title: string, description?: string) =>
      show({ variant: 'error', title, description }),
    [show],
  )
  const warning = useCallback(
    (title: string, description?: string) =>
      show({ variant: 'warning', title, description }),
    [show],
  )
  const info = useCallback(
    (title: string, description?: string) =>
      show({ variant: 'info', title, description }),
    [show],
  )

  const value = useMemo(
    () => ({ toasts, show, dismiss, success, error, warning, info }),
    [toasts, show, dismiss, success, error, warning, info],
  )

  useEffect(() => {
    return () => {
      timers.current.forEach(clearTimeout)
      timers.current.clear()
    }
  }, [])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast fuera de <ToastProvider>')
  return ctx
}

const variantConfig: Record<
  ToastVariant,
  {
    Icon: typeof AlertCircle
    iconBg: string
    iconText: string
    barColor: string
    title: string
  }
> = {
  success: {
    Icon: CheckCircle2,
    iconBg: 'bg-status-success-bg',
    iconText: 'text-status-success',
    barColor: 'bg-status-success',
    title: 'text-neutral-900',
  },
  error: {
    Icon: AlertCircle,
    iconBg: 'bg-status-error-bg',
    iconText: 'text-status-error',
    barColor: 'bg-status-error',
    title: 'text-neutral-900',
  },
  warning: {
    Icon: AlertTriangle,
    iconBg: 'bg-status-warning-bg',
    iconText: 'text-status-warning',
    barColor: 'bg-status-warning',
    title: 'text-neutral-900',
  },
  info: {
    Icon: Info,
    iconBg: 'bg-accent-50',
    iconText: 'text-accent-500',
    barColor: 'bg-accent-500',
    title: 'text-neutral-900',
  },
}

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: Toast[]
  onDismiss: (id: string) => void
}) {
  return (
    <>
      {/* Desktop: top-right */}
      <div
        className="pointer-events-none fixed inset-x-0 top-4 z-50 flex flex-col items-center gap-2 px-4 sm:items-end sm:pr-6"
        role="region"
        aria-label="Notificaciones"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
        ))}
      </div>
    </>
  )
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast
  onDismiss: (id: string) => void
}) {
  const cfg = variantConfig[toast.variant]
  const Icon = cfg.Icon

  return (
    <div
      role={toast.variant === 'error' ? 'alert' : 'status'}
      className={cn(
        'pointer-events-auto relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-toast ring-1 ring-neutral-100',
        'animate-toast-in',
        toast.variant === 'error' && 'animate-shake',
      )}
    >
      {/* Color bar */}
      <div className={cn('absolute inset-y-0 left-0 w-1', cfg.barColor)} />

      <div className="flex items-start gap-3 p-4 pl-5">
        <div
          className={cn(
            'grid h-9 w-9 shrink-0 place-items-center rounded-xl',
            cfg.iconBg,
            cfg.iconText,
          )}
        >
          <Icon size={18} strokeWidth={2.5} />
        </div>

        <div className="min-w-0 flex-1 pt-0.5">
          <p className={cn('text-sm font-bold', cfg.title)}>{toast.title}</p>
          {toast.description && (
            <p className="mt-0.5 text-sm text-neutral-500">{toast.description}</p>
          )}
          {toast.action && (
            <button
              type="button"
              onClick={() => {
                toast.action?.onClick()
                onDismiss(toast.id)
              }}
              className="mt-2 inline-flex rounded-full px-2 py-1 text-xs font-bold text-accent-600 transition-colors hover:bg-accent-50 hover:text-accent-700 focus-visible:ring-2 focus-visible:ring-accent-400"
            >
              {toast.action.label}
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          aria-label="Cerrar"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-neutral-400 transition-colors hover:bg-primary-100 hover:text-neutral-700 focus-visible:ring-2 focus-visible:ring-accent-400"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
