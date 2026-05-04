import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type Operator = {
  email: string
  name: string
  loggedAt: string
}

type AuthContextValue = {
  operator: Operator | null
  ready: boolean
  signIn: (email: string) => Operator
  signOut: () => void
}

const STORAGE_KEY = 'bartender.session'
const PENDING_KEY = 'bartender.pendingMagicLink'

const AuthContext = createContext<AuthContextValue | null>(null)

function deriveName(email: string): string {
  const local = email.split('@')[0] ?? ''
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ') || 'Operador'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [operator, setOperator] = useState<Operator | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setOperator(JSON.parse(raw) as Operator)
    } catch {
      /* ignore */
    }
    setReady(true)
  }, [])

  const signIn = (email: string): Operator => {
    const op: Operator = {
      email: email.toLowerCase().trim(),
      name: deriveName(email),
      loggedAt: new Date().toISOString(),
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(op))
    setOperator(op)
    return op
  }

  const signOut = () => {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(PENDING_KEY)
    setOperator(null)
  }

  return (
    <AuthContext.Provider value={{ operator, ready, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth fuera de <AuthProvider>')
  return ctx
}

export type PendingMagicLink = {
  email: string
  token: string
  requestedAt: string
}

export function savePendingMagicLink(email: string): PendingMagicLink {
  const pending: PendingMagicLink = {
    email: email.toLowerCase().trim(),
    token: cryptoToken(),
    requestedAt: new Date().toISOString(),
  }
  localStorage.setItem(PENDING_KEY, JSON.stringify(pending))
  return pending
}

export function readPendingMagicLink(): PendingMagicLink | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY)
    return raw ? (JSON.parse(raw) as PendingMagicLink) : null
  } catch {
    return null
  }
}

export function clearPendingMagicLink() {
  localStorage.removeItem(PENDING_KEY)
}

function cryptoToken(): string {
  const arr = new Uint8Array(16)
  crypto.getRandomValues(arr)
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('')
}
