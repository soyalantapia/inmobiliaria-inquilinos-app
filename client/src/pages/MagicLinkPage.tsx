import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { clearPendingMagicLink, readPendingMagicLink, useAuth } from '@/lib/auth'

type State = 'verifying' | 'ok' | 'invalid'

export function MagicLinkPage() {
  const navigate = useNavigate()
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
      return
    }

    signIn(email)
    clearPendingMagicLink()
    setState('ok')
  }, [ready, params, signIn, operator])

  useEffect(() => {
    if (state !== 'ok') return
    const t = setTimeout(() => navigate('/', { replace: true }), 800)
    return () => clearTimeout(t)
  }, [state, navigate])

  return (
    <div className="grid min-h-[100svh] place-items-center bg-primary-50 px-4 py-10">
      <div className="flex w-full max-w-md flex-col items-center gap-5 rounded-3xl bg-white p-8 text-center shadow-sm">
        {state === 'verifying' && (
          <>
            <div className="grid h-16 w-16 place-items-center rounded-3xl bg-primary-100 text-primary-700">
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
            <div className="grid h-16 w-16 place-items-center rounded-3xl bg-secondary text-[#3f6a35]">
              <CheckCircle2 size={32} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-neutral-900">¡Listo!</h1>
              <p className="mt-1 text-sm text-neutral-500">Te llevamos al panel.</p>
            </div>
          </>
        )}

        {state === 'invalid' && (
          <>
            <div className="grid h-16 w-16 place-items-center rounded-3xl bg-[#fff0f0] text-[#b13030]">
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
              className="rounded-full bg-primary-500 px-6 py-3 text-sm font-semibold text-white hover:bg-primary-600"
            >
              Volver al login
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
