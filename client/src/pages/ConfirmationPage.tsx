import { Link, useParams, useSearchParams } from 'react-router-dom'
import { CheckCircle2, ScanLine, ArrowLeft, PartyPopper } from 'lucide-react'

const confettiColors = [
  '#f59e0b',
  '#10b981',
  '#0ea5e9',
  '#a855f7',
  '#f43f5e',
  '#ffd148',
]

export function ConfirmationPage() {
  const { token = '' } = useParams()
  const [params] = useSearchParams()
  const items = Number(params.get('items') ?? 0)
  const isDone = params.get('done') === '1'

  return (
    <div className="bg-emerald-mesh relative flex min-h-[80svh] w-full overflow-hidden">
      {/* Confetti only when fully done */}
      {isDone && (
        <div className="pointer-events-none absolute inset-0">
          {Array.from({ length: 18 }).map((_, i) => (
            <span
              key={i}
              className="animate-confetti absolute h-2 w-2 rounded-sm"
              style={{
                left: `${(i * 5.5 + 8) % 100}%`,
                top: `${30 + ((i * 13) % 30)}%`,
                background: confettiColors[i % confettiColors.length],
                animationDelay: `${(i * 80) % 1200}ms`,
                transform: `rotate(${i * 23}deg)`,
              }}
            />
          ))}
        </div>
      )}

      <div className="animate-fade-up relative z-10 mx-auto flex w-full max-w-xl flex-col items-center justify-center gap-7 px-4 py-10 text-center">
        <div className="relative grid h-28 w-28 place-items-center rounded-full bg-gradient-to-br from-status-success to-emerald-400 text-white shadow-floating">
          <div className="absolute inset-0 animate-pulse-soft rounded-full bg-status-success/40" />
          <div className="relative">
            {isDone ? <PartyPopper size={52} strokeWidth={2} /> : <CheckCircle2 size={52} strokeWidth={2} />}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
            {isDone ? '¡Pedido completo!' : 'Entrega confirmada'}
          </h1>
          <p className="max-w-sm text-base text-neutral-500">
            {isDone ? (
              <>
                Entregaste los últimos{' '}
                <span className="font-bold text-neutral-800">
                  {items} producto{items === 1 ? '' : 's'}
                </span>{' '}
                del pedido.
              </>
            ) : (
              <>
                Entregaste{' '}
                <span className="font-bold text-neutral-800">
                  {items} producto{items === 1 ? '' : 's'}
                </span>{' '}
                del pedido{' '}
                <span className="font-mono font-bold tracking-widest text-accent-700">
                  {token}
                </span>
                .
              </>
            )}
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-br from-accent-400 to-accent-600 px-8 py-4 text-base font-semibold text-white shadow-cta transition-all duration-200 hover:-translate-y-0.5 hover:from-accent-500 hover:to-accent-700 hover:shadow-floating active:translate-y-0 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-accent-400 focus-visible:ring-offset-2"
          >
            <ScanLine size={20} /> Escanear otro
          </Link>
          {!isDone && (
            <Link
              to={`/pedidos/${encodeURIComponent(token)}`}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-8 py-4 text-base font-semibold text-neutral-800 shadow-card ring-1 ring-neutral-100 transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary-50 hover:shadow-card-hover active:translate-y-0 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-accent-400 focus-visible:ring-offset-2"
            >
              <ArrowLeft size={20} /> Volver al pedido
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
