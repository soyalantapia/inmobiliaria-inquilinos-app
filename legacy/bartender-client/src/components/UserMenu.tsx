import { useEffect, useRef, useState } from 'react'
import { LogOut, Mail, Sparkles } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { cn } from '@/lib/cn'

type Props = {
  variant: 'sidebar' | 'header'
}

export function UserMenu({ variant }: Props) {
  const { operator, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (!ref.current) return
      if (!ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!operator) return null

  const initials = operator.name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div ref={ref} className="relative">
      {variant === 'sidebar' ? (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={open}
          className="flex w-full items-center gap-3 rounded-2xl bg-gradient-to-br from-primary-100 to-primary-50 p-3 ring-1 ring-neutral-100 transition-all duration-150 hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 focus-visible:ring-offset-2"
        >
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-accent-400 to-accent-600 text-sm font-bold text-white ring-2 ring-white">
            {initials}
          </div>
          <div className="min-w-0 flex-1 text-left">
            <p className="truncate text-sm font-semibold text-neutral-900">{operator.name}</p>
            <p className="truncate text-xs text-neutral-500">{operator.email}</p>
          </div>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label="Abrir menú de usuario"
          className="flex h-11 items-center gap-2 rounded-full bg-primary-100 py-1.5 pl-1.5 pr-3 text-xs font-semibold text-neutral-700 transition-all duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400"
        >
          <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-accent-400 to-accent-600 text-[11px] font-bold text-white ring-2 ring-white">
            {initials}
          </span>
        </button>
      )}

      {open && (
        <div
          role="menu"
          className={cn(
            'animate-toast-in absolute z-30 w-64 overflow-hidden rounded-2xl bg-white shadow-floating ring-1 ring-neutral-100',
            variant === 'sidebar' ? 'bottom-[calc(100%+0.5rem)] left-0' : 'right-0 top-[calc(100%+0.5rem)]',
          )}
        >
          {/* Header */}
          <div className="bg-violet-mesh border-b border-neutral-100 p-4">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-accent-400 to-accent-600 text-sm font-bold text-white ring-2 ring-white">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-neutral-900">{operator.name}</p>
                <p className="mt-0.5 inline-flex items-center gap-1 truncate text-[11px] font-medium text-neutral-500">
                  <Mail size={11} className="shrink-0 text-accent-500" />
                  {operator.email}
                </p>
              </div>
            </div>
          </div>

          {/* Info */}
          <div className="px-4 py-3 text-[11px]">
            <p className="text-neutral-400">
              <span className="font-bold text-neutral-700">Sesión iniciada</span>{' '}
              {new Date(operator.loggedAt).toLocaleString('es-AR', {
                hour: '2-digit',
                minute: '2-digit',
                day: '2-digit',
                month: '2-digit',
              })}
            </p>
          </div>

          {/* Tip */}
          <div className="mx-4 mb-3 rounded-xl bg-accent-50 p-3 text-[11px] text-accent-800 ring-1 ring-accent-100">
            <p className="inline-flex items-center gap-1.5 font-semibold">
              <Sparkles size={11} className="text-accent-500" />
              Bartender · Deenex
            </p>
            <p className="mt-1 text-[11px] font-medium text-accent-700">
              Versión demo — datos guardados localmente.
            </p>
          </div>

          {/* Logout */}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              setConfirmOpen(true)
            }}
            className="flex w-full items-center gap-2 border-t border-neutral-100 px-4 py-3 text-sm font-semibold text-status-error-fg transition-colors hover:bg-status-error-bg focus-visible:bg-status-error-bg focus-visible:outline-none"
          >
            <LogOut size={16} className="text-status-error" />
            Cerrar sesión
          </button>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        variant="danger"
        title="¿Cerrar sesión?"
        description={
          <span>
            Vas a salir de la cuenta{' '}
            <span className="font-bold text-neutral-700">{operator.email}</span>. Vas a tener que pedir un nuevo link mágico para volver a entrar.
          </span>
        }
        confirmLabel="Sí, salir"
        cancelLabel="Quedarme"
        onConfirm={() => {
          setConfirmOpen(false)
          signOut()
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  )
}
