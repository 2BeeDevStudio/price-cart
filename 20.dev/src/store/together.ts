import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Item } from '../types'
import { linePaid } from '../lib/promo'

/** 같이 장보기 정보 (서버와 같은 모양) */
export interface TogetherMeta {
  store?: string
  budget?: number
  startedBy?: string
  startedByName?: string
  /** 쇼핑 완료 정보 */
  endedBy?: string
  endedByName?: string
  tripId?: string
  total?: number
  count?: number
  /** 완료할 때 기록에 들어간 상품 id (이것만 다른 폰에서 치운다) */
  ids?: string[]
}

/** 서버로 보내는 같이 장보기 상품 (지운 건 삭제 표시만) */
export type CartItemOut = (Item & { updatedAt: number }) | { id: string; updatedAt: number; deleted: true }

/**
 * 같이 장보기 상태
 * - sid: 지금 참여 중인 같이 장보기 (없으면 혼자 장보기)
 * - meta·metaTs: 마트·예산·시작한 사람 (metaTs 가 더 큰 쪽이 이김)
 * - tomb: 같이 장보는 중에 지운 상품 id → 지운 시각 (다른 폰에도 지우라고 보낸다)
 * - pendingEnd: 아직 서버에 못 알린 "쇼핑 완료"
 * - dismissed: 참여 안 하기로 한(또는 나온) 같이 장보기 — 다시 권하지 않는다
 * - invite·ended: 화면 안내용 (저장 안 함)
 */
interface TogetherState {
  sid: string | null
  metaTs: number
  meta: TogetherMeta
  tomb: Record<string, number>
  pendingEnd: { sid: string; metaTs: number; meta: TogetherMeta; items: CartItemOut[] } | null
  dismissed: string | null
  invite: { sid: string; name: string; store?: string } | null
  ended: { name: string; store?: string; total: number; count: number } | null
}

export const useTogether = create<TogetherState>()(
  persist(
    (): TogetherState => ({
      sid: null,
      metaTs: 0,
      meta: {},
      tomb: {},
      pendingEnd: null,
      dismissed: null,
      invite: null,
      ended: null,
    }),
    {
      name: 'pricecart-together-v1',
      version: 1,
      partialize: ({ invite: _i, ended: _e, ...rest }) => rest,
    },
  ),
)

/** 이 폰에서 담은 상품인지 */
export const addedByMe = (item: Item, deviceId: string) => !item.by || item.by === deviceId

/** 상품을 담은 사람 표시 이름 */
export const adderLabel = (item: Item, deviceId: string) =>
  addedByMe(item, deviceId) ? '나' : item.byName || '가족'

/** 이름 + 주격 조사 (아빠가 / 동생이) */
export function subj(name: string): string {
  const c = name.charCodeAt(name.length - 1)
  if (c >= 0xac00 && c <= 0xd7a3) return name + ((c - 0xac00) % 28 ? '이' : '가')
  return `${name}이(가)`
}

export interface PersonSum {
  key: string
  label: string
  mine: boolean
  count: number
  total: number
}

/** 사람별로 담은 개수·금액 (먼저 담은 사람부터) */
export function peopleSummary(items: Item[], deviceId: string): PersonSum[] {
  const map = new Map<string, PersonSum>()
  for (const it of [...items].sort((a, b) => a.createdAt - b.createdAt)) {
    const mine = addedByMe(it, deviceId)
    const key = mine ? deviceId : it.by!
    const p = map.get(key) ?? { key, label: adderLabel(it, deviceId), mine, count: 0, total: 0 }
    p.count += it.quantity
    p.total += linePaid(it)
    map.set(key, p)
  }
  return [...map.values()]
}
