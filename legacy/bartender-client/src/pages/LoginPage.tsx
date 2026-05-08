import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, ScanLine, ArrowRight, Inbox, RefreshCw } from 'lucide-react'
import { savePendingMagicLink, readPendingMagicLink, useAuth } from '@/lib/auth'
import { useToast } from '@/components/Toast'

type Step = 'email' | 'sent'

export function LoginPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const { operator, ready } = useAuth()
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
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
    if (!trimmed) {
      toast.warning('Falta tu email', 'Necesitamos saber a quién mandarle el link.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast.error('Email inválido', 'Revisá el formato — algo así como vos@deenex.com.')
      return
    }
    const pending = savePendingMagicLink(trimmed)
    setToken(pending.token)
    setStep('sent')
    toast.success('Link enviado', `Revisá ${trimmed}`)
  }

  const resend = () => {
    const pending = savePendingMagicLink(email)
    setToken(pending.token)
    toast.info('Link reenviado', 'Si no aparece en unos segundos, revisá spam.')
  }

  return (
    <div className="bg-violet-mesh bg-grid-pattern grid min-h-[100svh] place-items-center bg-primary-50 px-4 py-10">
      <div className="animate-fade-up w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="grid h-16 w-16 place-items-center rounded-3xl bg-gradient-to-br from-accent-400 to-accent-600 text-white shadow-cta">
            <ScanLine size={28} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-accent-700">
              Bartender · Deenex
            </p>
            <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-neutral-900 sm:text-3xl">
              {step === 'email' ? 'Entrá a tu turno' : 'Revisá tu mail'}
            </h1>
          </div>
        </div>

        {step === 'email' ? (
          <form
            onSubmit={submit}
            className="flex flex-col gap-5 rounded-3xl bg-white p-6 shadow-card ring-1 ring-neutral-100 sm:p-7"
          >
            <p className="text-sm text-neutral-500">
              Te mandamos un link mágico al mail. Lo tocás y entrás —{' '}
              <span className="font-semibold text-neutral-700">sin contraseñas</span>.
            </p>

            <label className="flex flex-col gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                Tu email
              </span>
              <div className="relative">
                <Mail
                  size={18}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-accent-500"
                />
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="vos@deenex.com"
                  className="w-full rounded-2xl bg-primary-50 py-3.5 pl-11 pr-4 text-base text-neutral-900 ring-1 ring-transparent transition-all duration-200 placeholder:text-neutral-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-accent-400 focus:shadow-card"
                />
              </div>
            </label>

            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-br from-accent-400 to-accent-600 px-6 py-4 text-base font-semibold text-white shadow-cta transition-all duration-200 hover:-translate-y-0.5 hover:from-accent-500 hover:to-accent-700 hover:shadow-floating active:translate-y-0 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-accent-400 focus-visible:ring-offset-2"
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
            className="text-xs font-semibold text-neutral-400 transition-colors duration-150 hover:text-accent-700"
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
    <div className="animate-fade-up flex flex-col gap-5 rounded-3xl bg-white p-6 shadow-card ring-1 ring-neutral-100 sm:p-7">
      <div className="grid h-16 w-16 place-self-center place-items-center rounded-3xl bg-gradient-to-br from-status-success to-emerald-400 text-white shadow-cta-success">
        <Inbox size={28} />
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
        className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-br from-accent-400 to-accent-600 px-6 py-4 text-base font-semibold text-white shadow-cta transition-all duration-200 hover:-translate-y-0.5 hover:from-accent-500 hover:to-accent-700 hover:shadow-floating active:translate-y-0 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-accent-400 focus-visible:ring-offset-2"
      >
        Simular click en el link <ArrowRight size={18} />
      </button>

      <div className="rounded-2xl bg-accent-50 p-4 ring-1 ring-accent-100">
        <p className="text-[10px] font-bold uppercase tracking-widest text-accent-700">
          Demo · link generado
        </p>
        <p className="mt-1 break-all font-mono text-xs text-neutral-700">{link}</p>
      </div>

      <div className="flex items-center justify-between text-sm">
        <button
          type="button"
          onClick={onBack}
          className="rounded-full px-2 py-1 font-semibold text-neutral-500 transition-colors duration-150 hover:text-neutral-900 focus-visible:ring-2 focus-visible:ring-accent-400"
        >
          Cambiar email
        </button>
        <button
          type="button"
          onClick={onResend}
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 font-semibold text-neutral-500 transition-colors duration-150 hover:text-accent-700 focus-visible:ring-2 focus-visible:ring-accent-400"
        >
          <RefreshCw size={14} /> Reenviar
        </button>
      </div>
    </div>
  )
}
