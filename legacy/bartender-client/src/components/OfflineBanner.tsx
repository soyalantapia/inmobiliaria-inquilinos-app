import { WifiOff } from 'lucide-react'
import { useOnline } from '@/lib/useOnline'

export function OfflineBanner() {
  const online = useOnline()
  if (online) return null
  return (
    <div
      role="status"
      aria-live="polite"
      className="animate-fade-in sticky top-0 z-40 flex items-center justify-center gap-2 bg-status-warning px-4 py-2 text-xs font-bold text-status-warning-fg shadow-card"
    >
      <WifiOff size={14} strokeWidth={2.5} />
      <span>Sin conexión — los retiros se sincronizarán cuando vuelva el wifi</span>
    </div>
  )
}
