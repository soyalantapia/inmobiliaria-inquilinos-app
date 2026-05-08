import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { clearPendingMagicLink, readPendingMagicLink, useAuth } from '@/lib/auth'
import { useToast } from '@/components/Toast'

type State = 'verifying' | 'ok' | 'invalid'

export function MagicLinkPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [params] = useSearchParams()
  const { signIn, operator, ready } = useAuth()
  const [state, setState] = useState<State>('verifying')

  useEffect(() => {
    if (!ready) return

    if (operator) {
      setState('ok')
      return
    }

    const token = params.get('token')
    const email = params.get('email')
    const pending = readPendingMagicLink()

    if (!token || !email || !pending || pending.token !== token || pending.email !== email) {
      setState('invalid')
      toast.error('Link inválido o vencido', 'Pediles un nuevo link desde el login.')
      return
    }

    signIn(email)
    clearPendingMagicLink()
    setState('ok')
    toast.success('Sesión iniciada', `Bienvenido a tu turno.`)
  }, [ready, params, signIn, operator, toast])

  useEffect(() => {
    if (state !== 'ok') return
    const t = setTimeout(() => navigate('/', { replace: true }), 800)
    return () => clearTimeout(t)
  }, [state, navigate])

  return (
    <div className="bg-violet-mesh bg-grid-pattern grid min-h-[100svh] place-items-center bg-primary-50 px-4 py-10">
      <div className="animate-fade-up flex w-full max-w-md flex-col items-center gap-5 rounded-3xl bg-white p-8 text-center shadow-card ring-1 ring-neutral-100">
        {state === 'verifying' && (
          <>
            <div className="grid h-16 w-16 place-items-center rounded-3xl bg-accent-50 text-accent-700">
              <Loader2 size={28} className="animate-spin" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-neutral-900">Verificando tu link…</h1>
              <p className="mt-1 text-sm text-neutral-500">Un toque y entrás.</p>
            </div>
          </>
        )}

        {state === 'ok' && (
          <>
            <div className="relative grid h-16 w-16 place-items-center rounded-3xl bg-gradient-to-br from-status-success to-emerald-400 text-white shadow-cta-success">
              <div className="absolute inset-0 animate-pulse-soft rounded-3xl bg-status-success/40" />
              <CheckCircle2 size={32} className="relative" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-neutral-900">¡Listo!</h1>
              <p className="mt-1 text-sm text-neutral-500">Te llevamos al panel.</p>
            </div>
          </>
        )}

        {state === 'invalid' && (
          <>
            <div className="grid h-16 w-16 place-items-center rounded-3xl bg-status-error-bg text-status-error">
              <AlertCircle size={32} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-neutral-900">Link inválido o vencido</h1>
              <p className="mt-1 text-sm text-neutral-500">
                Pediles un nuevo link desde el login.
              </p>
            </div>
            <Link
              to="/login"
              className="rounded-full bg-gradient-to-br from-accent-400 to-accent-600 px-6 py-3 text-sm font-semibold text-white shadow-cta transition-all duration-200 hover:-translate-y-0.5 hover:from-accent-500 hover:to-accent-700 hover:shadow-floating focus-visible:ring-2 focus-visible:ring-accent-400 focus-visible:ring-offset-2"
            >
              Volver al login
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
