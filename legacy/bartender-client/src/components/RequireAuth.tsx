import { Navigate, useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import type { ReactNode } from 'react'

export function RequireAuth({ children }: { children: ReactNode }) {
  const { operator, ready } = useAuth()
  const location = useLocation()

  if (!ready) {
    return (
      <div className="grid min-h-[100svh] place-items-center bg-primary-50 text-neutral-400">
        <Loader2 size={20} className="animate-spin" />
      </div>
    )
  }

  if (!operator) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <>{children}</>
}
