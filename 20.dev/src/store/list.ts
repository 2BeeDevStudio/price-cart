import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** 장볼 목록 항목. 가족 공유 시 항목 단위로 병합(updatedAt 이 더 큰 쪽이 이김) */
export interface ListItem {
  id: string
  text: string
  checked: boolean
  createdAt: number
  updatedAt: number
  /** 지운 항목 표시 — 공유 중 다른 폰에도 삭제를 전하려고 잠시 남겨둔다 */
  deleted?: boolean
}

interface ListState {
  items: ListItem[]
  /** 가족 공유 링크 id (공유 안 하면 null) */
  shareId: string | null
  /** "우유, 계란" 처럼 쉼표/줄바꿈으로 여러 개 한 번에 추가. 추가된 개수 반환 */
  addMany: (raw: string) => number
  toggle: (id: string) => void
  setChecked: (id: string, checked: boolean) => void
  remove: (id: string) => void
  /** 체크된(산) 항목 지우기 */
  clearChecked: () => void
  /** 서버에서 받은 목록을 항목별로 합친다 (더 최근에 고친 쪽이 이김) */
  applyRemote: (remote: ListItem[], opts?: { replace?: boolean }) => void
  setShareId: (id: string | null) => void
}

const TOMBSTONE_KEEP_MS = 30 * 24 * 60 * 60 * 1000

function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

const norm = (s: string) => s.toLowerCase().replace(/[\s()[\]·.,/_*-]/g, '')

/** 화면에 보이는 항목 (지운 것 제외) */
export const visibleItems = (items: ListItem[]) => items.filter((i) => !i.deleted)

/**
 * 상품명에 목록 단어가 들어있으면 그 항목을 찾는다 (예: 우유 ⊂ 서울우유 1L).
 * 한 글자 항목은 오매칭이 많아 제외, 여러 개 맞으면 더 긴(구체적인) 쪽.
 */
export function findListMatch(items: ListItem[], productName: string): ListItem | null {
  const p = norm(productName)
  if (!p) return null
  let best: ListItem | null = null
  for (const it of items) {
    if (it.checked || it.deleted) continue
    const t = norm(it.text)
    if (t.length < 2 || !p.includes(t)) continue
    if (!best || t.length > norm(best.text).length) best = it
  }
  return best
}

/** 오래된 삭제 표시는 버린다 */
const pruneTombstones = (items: ListItem[], now: number) =>
  items.filter((i) => !i.deleted || now - i.updatedAt < TOMBSTONE_KEEP_MS)

export const useList = create<ListState>()(
  persist(
    (set, get) => {
      /** 공유 중이면 삭제 표시를 남기고, 아니면 바로 지운다 */
      const removeWhere = (pred: (i: ListItem) => boolean) =>
        set((s) => {
          if (!s.shareId) return { items: s.items.filter((i) => !pred(i)) }
          const now = Date.now()
          return {
            items: s.items.map((i) =>
              !i.deleted && pred(i) ? { ...i, deleted: true, updatedAt: now } : i,
            ),
          }
        })

      return {
        items: [],
        shareId: null,

        addMany: (raw) => {
          const existing = new Set(
            get()
              .items.filter((i) => !i.checked && !i.deleted)
              .map((i) => norm(i.text)),
          )
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

        remove: (id) => removeWhere((i) => i.id === id),

        clearChecked: () => removeWhere((i) => i.checked),

        applyRemote: (remote, opts) =>
          set((s) => {
            const now = Date.now()
            const byId = new Map<string, ListItem>()
            if (!opts?.replace) for (const i of s.items) byId.set(i.id, i)
            for (const r of remote) {
              const cur = byId.get(r.id)
              if (!cur || r.updatedAt > cur.updatedAt) byId.set(r.id, r)
            }
            // 원래 순서(추가한 순서) 유지
            const merged = [...byId.values()].sort((a, b) => a.createdAt - b.createdAt)
            return { items: pruneTombstones(merged, now) }
          }),

        setShareId: (id) =>
          set((s) => ({
            shareId: id,
            // 공유를 끄면 삭제 표시는 더 필요 없음
            items: id ? s.items : s.items.filter((i) => !i.deleted),
          })),
      }
    },
    { name: 'pricecart-list-v1', version: 1 },
  ),
)
