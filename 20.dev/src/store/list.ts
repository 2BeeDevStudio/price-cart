import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** 장볼 목록 항목 (나중에 가족 공유 시 항목 단위로 동기화하려고 id·updatedAt 을 둔다) */
export interface ListItem {
  id: string
  text: string
  checked: boolean
  createdAt: number
  updatedAt: number
}

interface ListState {
  items: ListItem[]
  /** "우유, 계란" 처럼 쉼표/줄바꿈으로 여러 개 한 번에 추가. 추가된 개수 반환 */
  addMany: (raw: string) => number
  toggle: (id: string) => void
  setChecked: (id: string, checked: boolean) => void
  remove: (id: string) => void
  /** 체크된(산) 항목 지우기 */
  clearChecked: () => void
}

function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

const norm = (s: string) => s.toLowerCase().replace(/[\s()[\]·.,/_*-]/g, '')

/**
 * 상품명에 목록 단어가 들어있으면 그 항목을 찾는다 (예: 우유 ⊂ 서울우유 1L).
 * 한 글자 항목은 오매칭이 많아 제외, 여러 개 맞으면 더 긴(구체적인) 쪽.
 */
export function findListMatch(items: ListItem[], productName: string): ListItem | null {
  const p = norm(productName)
  if (!p) return null
  let best: ListItem | null = null
  for (const it of items) {
    if (it.checked) continue
    const t = norm(it.text)
    if (t.length < 2 || !p.includes(t)) continue
    if (!best || t.length > norm(best.text).length) best = it
  }
  return best
}

export const useList = create<ListState>()(
  persist(
    (set, get) => ({
      items: [],

      addMany: (raw) => {
        const existing = new Set(get().items.filter((i) => !i.checked).map((i) => norm(i.text)))
        const now = Date.now()
        const fresh: ListItem[] = []
        for (const part of raw.split(/[,\n]/)) {
          const text = part.trim()
          const key = norm(text)
          if (!text || existing.has(key)) continue
          existing.add(key)
          fresh.push({ id: makeId(), text: text.slice(0, 40), checked: false, createdAt: now, updatedAt: now })
        }
        if (fresh.length) set((s) => ({ items: [...s.items, ...fresh] }))
        return fresh.length
      },

      toggle: (id) =>
        set((s) => ({
          items: s.items.map((i) =>
            i.id === id ? { ...i, checked: !i.checked, updatedAt: Date.now() } : i,
          ),
        })),

      setChecked: (id, checked) =>
        set((s) => ({
          items: s.items.map((i) => (i.id === id ? { ...i, checked, updatedAt: Date.now() } : i)),
        })),

      remove: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),

      clearChecked: () => set((s) => ({ items: s.items.filter((i) => !i.checked) })),
    }),
    { name: 'pricecart-list-v1', version: 1 },
  ),
)
