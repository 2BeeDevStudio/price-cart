import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Item, PromoType, ShoppingTrip } from '../types'
import { linePaid, lineSavings } from '../lib/promo'

/** 마트 프리셋 (칩) */
export const STORE_PRESETS = ['코스트코', '이마트', '홈플러스', '다이소', '롯데마트', '편의점']

interface CartState {
  items: Item[]
  /** 현재 쇼핑의 마트 이름 */
  storeName: string
  /** 현재 쇼핑의 예산 (null = 미설정) */
  budget: number | null
  /** '쇼핑 끝'으로 저장된 지난 기록들 (최신순) */
  trips: ShoppingTrip[]

  /** 가격(+선택 상품명·행사·정가)을 받아 상품을 추가 (수량 1) */
  addItem: (price: number, name?: string, promo?: PromoType, originalPrice?: number) => void
  /** 수량을 절대값으로 설정 (1 미만이면 무시하지 않고 1로 보정) */
  setQuantity: (id: string, quantity: number) => void
  /** 수량 +1 / -1 (1 미만으로는 내려가지 않음) */
  incQuantity: (id: string) => void
  decQuantity: (id: string) => void
  /** 상품명/가격/행사/정가 수정 (promo·originalPrice: null 이면 해제) */
  updateItem: (
    id: string,
    patch: {
      name?: string
      price?: number
      promo?: PromoType | null
      originalPrice?: number | null
    },
  ) => void
  /** 상품 삭제 */
  removeItem: (id: string) => void
  /** 전체 비우기 (저장 없이 버림) */
  clearAll: () => void

  /** 현재 쇼핑의 마트 이름 설정 */
  setStore: (name: string) => void
  /** 현재 쇼핑의 예산 설정 (null = 해제) */
  setBudget: (budget: number | null) => void
  /** 쇼핑 끝 — 현재 목록을 기록으로 저장하고 카트를 비운다. 저장된 기록 반환(비어있으면 null) */
  finishShopping: () => ShoppingTrip | null
  /** 영수증 등 외부 목록을 바로 새 기록으로 저장 (현재 카트는 건드리지 않음) */
  saveReceiptTrip: (data: { store?: string; items: Item[]; date?: number }) => ShoppingTrip
  /** 지난 기록 삭제 */
  removeTrip: (id: string) => void
  /** 모든 지난 기록 삭제 */
  clearTrips: () => void
  /** 지난 기록의 마트 이름 수정 */
  setTripStore: (id: string, store: string) => void
  /** 지난 기록의 상품 목록 수정 (합계/개수 자동 재계산) */
  updateTripItems: (id: string, items: Item[]) => void
  /** 백업 불러오기 — 기록 병합(중복 id 제외), 카트 비었으면 복원. 새로 추가된 기록 수 반환 */
  mergeImport: (payload: {
    items?: Item[]
    storeName?: string
    trips?: ShoppingTrip[]
  }) => number
}

function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      storeName: '',
      budget: null,
      trips: [],

      addItem: (price, name, promo, originalPrice) =>
        set((state) => {
          const p = Math.max(0, Math.round(price))
          const orig = originalPrice != null ? Math.round(originalPrice) : undefined
          return {
            items: [
              // 최신 항목이 위로 오도록 앞에 추가
              {
                id: makeId(),
                name: name?.trim() || undefined,
                price: p,
                originalPrice: orig && orig > p ? orig : undefined,
                quantity: 1,
                promo,
                createdAt: Date.now(),
              },
              ...state.items,
            ],
          }
        }),

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

      updateItem: (id, patch) =>
        set((state) => ({
          items: state.items.map((it) => {
            if (it.id !== id) return it
            const next = { ...it }
            if (patch.name !== undefined) next.name = patch.name.trim() || undefined
            if (patch.price !== undefined) next.price = Math.max(0, Math.round(patch.price))
            if (patch.promo !== undefined) next.promo = patch.promo ?? undefined
            if (patch.originalPrice !== undefined)
              next.originalPrice =
                patch.originalPrice != null && patch.originalPrice > next.price
                  ? Math.round(patch.originalPrice)
                  : undefined
            return next
          }),
        })),

      removeItem: (id) =>
        set((state) => ({ items: state.items.filter((it) => it.id !== id) })),

      clearAll: () => set({ items: [] }),

      setStore: (name) => set({ storeName: name }),

      setBudget: (budget) => set({ budget }),

      finishShopping: () => {
        const state = get()
        if (state.items.length === 0) return null
        const trip: ShoppingTrip = {
          id: makeId(),
          store: state.storeName.trim() || undefined,
          date: Date.now(),
          items: state.items,
          total: state.items.reduce((sum, it) => sum + linePaid(it), 0),
          budget: state.budget ?? undefined,
          savings: state.items.reduce((sum, it) => sum + lineSavings(it), 0),
          itemCount: state.items.reduce((sum, it) => sum + it.quantity, 0),
        }
        set({ items: [], storeName: '', budget: null, trips: [trip, ...state.trips] })
        return trip
      },

      saveReceiptTrip: (data) => {
        const items = data.items.map((it) => ({
          ...it,
          id: it.id || makeId(),
          quantity: Math.max(1, Math.round(it.quantity || 1)),
          price: Math.max(0, Math.round(it.price)),
        }))
        const trip: ShoppingTrip = {
          id: makeId(),
          store: data.store?.trim() || undefined,
          date: data.date ?? Date.now(),
          items,
          total: items.reduce((sum, it) => sum + linePaid(it), 0),
          savings: items.reduce((sum, it) => sum + lineSavings(it), 0),
          itemCount: items.reduce((sum, it) => sum + it.quantity, 0),
        }
        set((state) => ({ trips: [trip, ...state.trips] }))
        return trip
      },

      removeTrip: (id) => set((state) => ({ trips: state.trips.filter((t) => t.id !== id) })),

      clearTrips: () => set({ trips: [] }),

      setTripStore: (id, store) =>
        set((state) => ({
          trips: state.trips.map((t) =>
            t.id === id ? { ...t, store: store.trim() || undefined } : t,
          ),
        })),

      updateTripItems: (id, items) =>
        set((state) => ({
          trips: state.trips.map((t) =>
            t.id === id
              ? {
                  ...t,
                  items,
                  total: items.reduce((sum, it) => sum + linePaid(it), 0),
                  savings: items.reduce((sum, it) => sum + lineSavings(it), 0),
                  itemCount: items.reduce((sum, it) => sum + it.quantity, 0),
                }
              : t,
          ),
        })),

      mergeImport: (payload) => {
        let added = 0
        set((state) => {
          const existingIds = new Set(state.trips.map((t) => t.id))
          const incoming = (payload.trips ?? []).filter(
            (t) => t && typeof t.id === 'string' && !existingIds.has(t.id),
          )
          added = incoming.length
          const trips = [...state.trips, ...incoming].sort((a, b) => b.date - a.date)
          return {
            trips,
            // 현재 카트가 비어있을 때만 가져온 카트로 복원 (진행 중 카트 보호)
            items:
              state.items.length === 0 && Array.isArray(payload.items)
                ? payload.items
                : state.items,
            storeName: state.storeName || payload.storeName || '',
          }
        })
        return added
      },
    }),
    {
      name: 'pricecart-v1',
      version: 1,
    },
  ),
)

/** 총 결제 예상 금액 (행사 반영) — 셀렉터로 사용 */
export function selectTotal(state: CartState): number {
  return state.items.reduce((sum, it) => sum + linePaid(it), 0)
}

/** 행사로 아낀 총 금액 */
export function selectSavings(state: CartState): number {
  return state.items.reduce((sum, it) => sum + lineSavings(it), 0)
}

/** 총 상품 개수 (수량 합) */
export function selectCount(state: CartState): number {
  return state.items.reduce((sum, it) => sum + it.quantity, 0)
}
