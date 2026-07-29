import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Item } from '../types'

interface CartState {
  items: Item[]
  /** 가격을 받아 상품을 추가 (수량 1) */
  addItem: (price: number) => void
  /** 수량을 절대값으로 설정 (1 미만이면 무시하지 않고 1로 보정) */
  setQuantity: (id: string, quantity: number) => void
  /** 수량 +1 / -1 (1 미만으로는 내려가지 않음) */
  incQuantity: (id: string) => void
  decQuantity: (id: string) => void
  /** 상품 삭제 */
  removeItem: (id: string) => void
  /** 전체 비우기 (새 쇼핑 시작) */
  clearAll: () => void
}

function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],

      addItem: (price) =>
        set((state) => ({
          items: [
            // 최신 항목이 위로 오도록 앞에 추가
            {
              id: makeId(),
              price: Math.max(0, Math.round(price)),
              quantity: 1,
              createdAt: Date.now(),
            },
            ...state.items,
          ],
        })),

      setQuantity: (id, quantity) =>
        set((state) => ({
          items: state.items.map((it) =>
            it.id === id ? { ...it, quantity: Math.max(1, Math.round(quantity)) } : it,
          ),
        })),

      incQuantity: (id) =>
        set((state) => ({
          items: state.items.map((it) =>
            it.id === id ? { ...it, quantity: it.quantity + 1 } : it,
          ),
        })),

      decQuantity: (id) =>
        set((state) => ({
          items: state.items.map((it) =>
            it.id === id ? { ...it, quantity: Math.max(1, it.quantity - 1) } : it,
          ),
        })),

      removeItem: (id) =>
        set((state) => ({ items: state.items.filter((it) => it.id !== id) })),

      clearAll: () => set({ items: [] }),
    }),
    {
      name: 'pricecart-v1',
      version: 1,
    },
  ),
)

/** 총 결제 예상 금액 (가격 × 수량 합) — 셀렉터로 사용 */
export function selectTotal(state: CartState): number {
  return state.items.reduce((sum, it) => sum + it.price * it.quantity, 0)
}

/** 총 상품 개수 (수량 합) */
export function selectCount(state: CartState): number {
  return state.items.reduce((sum, it) => sum + it.quantity, 0)
}
