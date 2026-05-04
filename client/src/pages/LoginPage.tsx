import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, ScanLine, ArrowRight, Inbox, RefreshCw, AlertCircle } from 'lucide-react'
import { savePendingMagicLink, readPendingMagicLink, useAuth } from '@/lib/auth'

type Step = 'email' | 'sent'

export function LoginPage() {
  const navigate = useNavigate()
  const { operator, ready } = useAuth()
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [token, setToken] = useState('')

  useEffect(() => {
    if (ready && operator) navigate('/', { replace: true })
  }, [ready, operator, navigate])

  useEffect(() => {
    const pending = readPendingMagicLink()
    if (pending) {
      setEmail(pending.email)
      setToken(pending.token)
      setStep('sent')
    }
  }, [])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Ingresá un email válido.')
      return
    }
    setError(null)
    const pending = savePendingMagicLink(trimmed)
    setToken(pending.token)
    setStep('sent')
  }

  const resend = () => {
    const pending = savePendingMagicLink(email)
    setToken(pending.token)
  }

  return (
    <div className="grid min-h-[100svh] place-items-center bg-primary-50 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary-500 text-white shadow-sm">
            <ScanLine size={26} />
          </div>
          <div>
            <p className="text-sm font-semibold text-neutral-400">Bartender · Deenex</p>
            <h1 className="mt-1 text-2xl font-bold text-neutral-900 sm:text-3xl">
              {step === 'email' ? 'Entrá a tu turno' : 'Revisá tu mail'}
            </h1>
          </div>
        </div>

        {step === 'email' ? (
          <form
            onSubmit={submit}
            className="flex flex-col gap-5 rounded-3xl bg-white p-6 shadow-sm sm:p-7"
          >
            <p className="text-sm text-neutral-500">
              Te mandamos un link mágico al mail. Lo tocás y entrás —{' '}
              <span className="font-semibold text-neutral-700">sin contraseñas</span>.
            </p>

            <label className="flex flex-col gap-2">
              <span className="text-xs font-bold uppercase tracking-widest text-neutral-400">
                Tu email
              </span>
              <div className="relative">
                <Mail
                  size={18}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400"
                />
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoFocus
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    if (error) setError(null)
                  }}
                  placeholder="vos@deenex.com"
                  className="w-full rounded-2xl bg-primary-50 py-3.5 pl-11 pr-4 text-base text-neutral-900 ring-1 ring-transparent placeholder:text-neutral-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-400"
                />
              </div>
            </label>

            {error && (
              <div className="flex items-center gap-2 rounded-2xl bg-[#fff0f0] p-3 text-sm font-medium text-[#b13030]">
                <AlertCircle size={16} className="shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-primary-500 px-6 py-4 text-base font-semibold text-white shadow-sm transition-all duration-200 hover:bg-primary-600 active:scale-[0.99]"
            >
              Mandame el link <ArrowRight size={18} />
            </button>

            <p className="text-center text-xs text-neutral-400">
              Solo emails autorizados del equipo.
            </p>
          </form>
        ) : (
          <SentStep email={email} token={token} onResend={resend} onBack={() => setStep('email')} />
        )}

        <div className="mt-6 text-center">
          <Link
            to="/"
            className="text-xs font-semibold text-neutral-400 transition-colors hover:text-neutral-700"
          >
            Volver al inicio
          </Link>
        </div>
      </div>
    </div>
  )
}

function SentStep({
  email,
  token,
  onResend,
  onBack,
}: {
  email: string
  token: string
  onResend: () => void
  onBack: () => void
}) {
  const navigate = useNavigate()
  const link = `${window.location.origin}/auth/magic?token=${token}&email=${encodeURIComponent(email)}`

  return (
    <div className="flex flex-col gap-5 rounded-3xl bg-white p-6 shadow-sm sm:p-7">
      <div className="grid h-16 w-16 place-self-center rounded-3xl bg-secondary text-[#3f6a35]">
        <Inbox className="m-auto" size={28} />
      </div>

      <div className="text-center">
        <p className="text-base text-neutral-700">Te mandamos un link a</p>
        <p className="mt-1 break-all text-base font-bold text-neutral-900">{email}</p>
        <p className="mt-3 text-sm text-neutral-500">
          Abrí el correo y tocá el link para iniciar sesión. Caduca en 10 minutos.
        </p>
      </div>

      <button
        type="button"
        onClick={() => navigate(`/auth/magic?token=${token}&email=${encodeURIComponent(email)}`)}
        className="inline-flex items-center justify-center gap-2 rounded-full bg-primary-500 px-6 py-4 text-base font-semibold text-white shadow-sm transition-all duration-200 hover:bg-primary-600 active:scale-[0.99]"
      >
        Simular click en el link <ArrowRight size={18} />
      </button>

      <div className="rounded-2xl bg-primary-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
          Demo · link generado
        </p>
        <p className="mt-1 break-all font-mono text-xs text-neutral-600">{link}</p>
      </div>

      <div className="flex items-center justify-between text-sm">
        <button
          type="button"
          onClick={onBack}
          className="font-semibold text-neutral-500 hover:text-neutral-900"
        >
          Cambiar email
        </button>
        <button
          type="button"
          onClick={onResend}
          className="inline-flex items-center gap-1.5 font-semibold text-neutral-500 hover:text-neutral-900"
        >
          <RefreshCw size={14} /> Reenviar
        </button>
      </div>
    </div>
  )
}
