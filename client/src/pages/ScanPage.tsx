import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Html5Qrcode } from 'html5-qrcode'
import {
  Camera,
  Keyboard,
  ScanLine,
  Sparkles,
  ShieldAlert,
  RefreshCcw,
} from 'lucide-react'
import { useOrders, ordersStore } from '@/lib/ordersStore'
import { cn } from '@/lib/cn'
import { useToast } from '@/components/Toast'

type Mode = 'idle' | 'camera' | 'manual'

export function ScanPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const orders = useOrders()
  const [mode, setMode] = useState<Mode>('idle')
  const [manualToken, setManualToken] = useState('')
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const containerId = 'qr-reader'

  useEffect(() => {
    if (mode !== 'camera') return
    let active = true
    const scanner = new Html5Qrcode(containerId, false)
    scannerRef.current = scanner
    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decoded) => {
          if (!active) return
          active = false
          scanner.stop().catch(() => {})
          navigate(`/pedidos/${encodeURIComponent(decoded.trim())}`)
        },
        () => {},
      )
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'No pudimos acceder a la cámara.'
        toast.error('Cámara bloqueada', msg + ' Probá ingresando el código a mano.')
        setMode('idle')
      })
    return () => {
      active = false
      void Promise.resolve(scanner.stop()).catch(() => {}).finally(() => { void Promise.resolve(scanner.clear()).catch(() => {}) })
    }
  }, [mode, navigate, toast])

  const submitManual = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = manualToken.trim()
    if (!trimmed) {
      toast.warning('Falta el código', 'Ingresá el token del pedido para continuar.')
      return
    }
    if (trimmed.length < 4) {
      toast.warning('Código muy corto', 'Revisá el código del cliente.')
      return
    }
    navigate(`/pedidos/${encodeURIComponent(trimmed)}`)
  }

  const resetDemo = () => {
    ordersStore.resetToDemo()
    toast.success('Demo reseteada', 'Los pedidos volvieron al estado inicial.')
  }

  return (
    <div className="animate-fade-up mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
      <div className="flex flex-col gap-1.5">
        <div className="inline-flex w-fit items-center gap-1.5 rounded-full bg-accent-50 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-accent-700">
          <Sparkles size={12} /> Listo para vender
        </div>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl">
          Escaneá un QR
        </h1>
        <p className="text-base text-neutral-500">
          Pediles el código a tu cliente y entregá los productos en segundos.
        </p>
      </div>

      <div className="bg-violet-mesh relative aspect-square w-full overflow-hidden rounded-3xl bg-gradient-to-br from-accent-50 via-white to-cat-extra-bg/50 sm:aspect-[4/3]">
        {mode === 'camera' ? (
          <>
            <div id={containerId} className="absolute inset-0" />
            <div className="pointer-events-none absolute inset-x-0 top-1/4 h-1/2">
              <div className="animate-scan-line mx-auto h-px w-1/2 bg-status-success shadow-[0_0_12px_3px_#10b981]" />
            </div>
          </>
        ) : (
          <div className="absolute inset-0 grid place-items-center">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="animate-glow-pulse grid h-20 w-20 place-items-center rounded-3xl bg-gradient-to-br from-accent-400 to-accent-600 text-white shadow-floating">
                <ScanLine size={40} />
              </div>
              <div>
                <p className="text-base font-bold text-neutral-800">Listo para escanear</p>
                <p className="mt-1 max-w-xs text-sm text-neutral-500">
                  Activá la cámara o cargá el código a mano.
                </p>
              </div>
            </div>
          </div>
        )}
        <CornerBrackets />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setMode((m) => (m === 'camera' ? 'idle' : 'camera'))}
          className={cn(
            'flex items-center justify-center gap-2 rounded-full px-6 py-4 text-base font-semibold transition-all duration-200',
            'focus-visible:ring-2 focus-visible:ring-offset-2',
            'active:scale-[0.98] active:translate-y-0',
            mode === 'camera'
              ? 'bg-status-error text-white hover:brightness-95 hover:-translate-y-0.5 focus-visible:ring-status-error'
              : 'bg-gradient-to-br from-accent-400 to-accent-600 text-white shadow-cta hover:from-accent-500 hover:to-accent-700 hover:-translate-y-0.5 hover:shadow-floating focus-visible:ring-accent-400',
          )}
        >
          <Camera size={20} />
          {mode === 'camera' ? 'Detener cámara' : 'Activar cámara'}
        </button>

        <button
          type="button"
          onClick={() => setMode((m) => (m === 'manual' ? 'idle' : 'manual'))}
          className="flex items-center justify-center gap-2 rounded-full bg-white px-6 py-4 text-base font-semibold text-neutral-800 shadow-card ring-1 ring-neutral-100 transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary-50 hover:shadow-card-hover active:translate-y-0 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-accent-400 focus-visible:ring-offset-2"
        >
          <Keyboard size={20} />
          Cargar código
        </button>
      </div>

      {mode === 'manual' && (
        <form
          onSubmit={submitManual}
          className="animate-fade-up flex flex-col gap-3 sm:flex-row"
        >
          <input
            autoFocus
            value={manualToken}
            onChange={(e) => setManualToken(e.target.value.toUpperCase())}
            placeholder="DNX-XXXXXX"
            className="flex-1 rounded-2xl bg-white px-5 py-4 text-base font-semibold tracking-widest text-neutral-900 shadow-card ring-1 ring-neutral-100 placeholder:font-medium placeholder:tracking-widest placeholder:text-neutral-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-accent-400"
          />
          <button
            type="submit"
            className="rounded-full bg-gradient-to-br from-accent-400 to-accent-600 px-6 py-4 text-base font-semibold text-white shadow-cta transition-all duration-200 hover:-translate-y-0.5 hover:shadow-floating active:translate-y-0 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-accent-400 focus-visible:ring-offset-2"
          >
            Buscar pedido
          </button>
        </form>
      )}

      <div className="flex items-start gap-3 rounded-2xl bg-accent-50 p-4 text-accent-800 ring-1 ring-accent-100">
        <ShieldAlert size={18} className="mt-0.5 shrink-0 text-accent-500" />
        <p className="text-xs font-medium">
          <span className="font-bold">Tip:</span> el QR vence cuando el pedido se completa.
          Si no escanea, probá pedirle al cliente que aumente el brillo de la pantalla.
        </p>
      </div>

      <div className="rounded-3xl bg-white p-5 shadow-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-accent-500" />
            <p className="text-sm font-bold text-neutral-800">Pedidos de prueba</p>
          </div>
          <button
            type="button"
            onClick={resetDemo}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-neutral-400 transition-colors hover:bg-primary-100 hover:text-accent-700 focus-visible:ring-2 focus-visible:ring-accent-400"
            aria-label="Resetear datos de demo"
          >
            <RefreshCcw size={11} /> Reset
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {orders.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => navigate(`/pedidos/${o.token}`)}
              className="inline-flex h-11 items-center rounded-full bg-primary-100 px-4 text-xs font-bold tracking-widest text-neutral-700 transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent-100 hover:text-accent-700 active:translate-y-0 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-accent-400 focus-visible:ring-offset-2"
            >
              {o.token}
            </button>
          ))}
          <button
            type="button"
            onClick={() => navigate('/pedidos/DNX-EXPIRED')}
            className="inline-flex h-11 items-center rounded-full bg-status-error-bg px-4 text-xs font-bold tracking-widest text-status-error-fg transition-all duration-200 hover:-translate-y-0.5 hover:brightness-95 active:translate-y-0 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-status-error focus-visible:ring-offset-2"
          >
            DNX-EXPIRED
          </button>
        </div>
      </div>
    </div>
  )
}

function CornerBrackets() {
  const base = 'pointer-events-none absolute h-8 w-8 border-accent-500/60'
  return (
    <>
      <div className={cn(base, 'left-5 top-5 rounded-tl-2xl border-l-2 border-t-2')} />
      <div className={cn(base, 'right-5 top-5 rounded-tr-2xl border-r-2 border-t-2')} />
      <div className={cn(base, 'bottom-5 left-5 rounded-bl-2xl border-b-2 border-l-2')} />
      <div className={cn(base, 'bottom-5 right-5 rounded-br-2xl border-b-2 border-r-2')} />
    </>
  )
}
