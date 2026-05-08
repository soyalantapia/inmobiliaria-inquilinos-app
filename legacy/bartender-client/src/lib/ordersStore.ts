import { useSyncExternalStore } from 'react'
import {
  computeOrderStatus,
  mockOrders,
  type FindResult,
  type Order,
  type RetrievalEvent,
} from '@/data/mockOrders'

const STORAGE_KEY = 'bartender.orders.v1'
const expiredTokens = new Set(['DNX-EXPIRED', 'DNX-EXP'])

type Listener = () => void

class OrdersStore {
  private orders: Order[]
  private listeners = new Set<Listener>()
  private snapshotRef: { orders: Order[] }

  constructor() {
    this.orders = this.load()
    this.snapshotRef = { orders: this.orders }
  }

  private load(): Order[] {
    if (typeof window === 'undefined') return clone(mockOrders)
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return clone(mockOrders)
      const parsed = JSON.parse(raw) as Order[]
      if (!Array.isArray(parsed) || parsed.length === 0) return clone(mockOrders)
      return parsed
    } catch {
      return clone(mockOrders)
    }
  }

  private persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.orders))
    } catch {
      /* noop */
    }
  }

  private emit() {
    this.snapshotRef = { orders: this.orders }
    this.listeners.forEach((l) => l())
  }

  subscribe = (l: Listener) => {
    this.listeners.add(l)
    return () => {
      this.listeners.delete(l)
    }
  }

  getSnapshot = () => this.snapshotRef

  // --- Selectors ---

  getAll(): Order[] {
    return this.orders
  }

  findByToken(token: string): FindResult {
    const cleaned = token.trim().toUpperCase()
    if (expiredTokens.has(cleaned)) return { ok: false, error: 'expired' }
    const order = this.orders.find((o) => o.token.toUpperCase() === cleaned)
    if (!order) return { ok: false, error: 'not-found' }
    return { ok: true, order }
  }

  // --- Mutations ---

  retrieveProducts(args: {
    token: string
    operator: string
    point: string
    selection: Record<string, number> // productId → qty
  }): { ok: true; event: RetrievalEvent } | { ok: false; reason: string } {
    const cleaned = args.token.trim().toUpperCase()
    const idx = this.orders.findIndex((o) => o.token.toUpperCase() === cleaned)
    if (idx === -1) return { ok: false, reason: 'Pedido no encontrado' }

    const order = this.orders[idx]
    if (order.status === 'completed') {
      return { ok: false, reason: 'Pedido ya completado' }
    }

    // Build event items, validating no over-retrieval
    const items: RetrievalEvent['items'] = []
    const updatedProducts = order.products.map((p) => {
      const qty = args.selection[p.id] ?? 0
      if (qty <= 0) return p
      const remaining = p.total - p.retrieved
      const safeQty = Math.min(qty, remaining)
      if (safeQty === 0) return p
      items.push({ productId: p.id, productName: p.name, qty: safeQty })
      return { ...p, retrieved: p.retrieved + safeQty }
    })

    if (items.length === 0) {
      return { ok: false, reason: 'No hay productos seleccionados' }
    }

    const event: RetrievalEvent = {
      id: `r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      at: new Date().toISOString(),
      operator: args.operator,
      point: args.point,
      items,
    }

    const nextOrder: Order = {
      ...order,
      products: updatedProducts,
      status: computeOrderStatus(updatedProducts),
      history: [...order.history, event],
    }

    this.orders = [
      ...this.orders.slice(0, idx),
      nextOrder,
      ...this.orders.slice(idx + 1),
    ]
    this.persist()
    this.emit()

    return { ok: true, event }
  }

  resetToDemo() {
    this.orders = clone(mockOrders)
    this.persist()
    this.emit()
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export const ordersStore = new OrdersStore()

export function useOrders(): Order[] {
  const snap = useSyncExternalStore(
    ordersStore.subscribe,
    ordersStore.getSnapshot,
    ordersStore.getSnapshot,
  )
  return snap.orders
}

export function useOrder(token: string | undefined): FindResult {
  const orders = useOrders()
  if (!token) return { ok: false, error: 'not-found' }
  const cleaned = token.trim().toUpperCase()
  if (expiredTokens.has(cleaned)) return { ok: false, error: 'expired' }
  const order = orders.find((o) => o.token.toUpperCase() === cleaned)
  if (!order) return { ok: false, error: 'not-found' }
  return { ok: true, order }
}

export function useOrderStats() {
  const orders = useOrders()
  return {
    pending: orders.filter((o) => o.status === 'pending').length,
    partial: orders.filter((o) => o.status === 'partial').length,
    completed: orders.filter((o) => o.status === 'completed').length,
    total: orders.length,
  }
}
