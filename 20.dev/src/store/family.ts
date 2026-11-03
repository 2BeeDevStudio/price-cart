import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ShoppingTrip } from '../types'

/**
 * 가족 공유 설정 (이 폰에만 저장)
 * - deviceId: 이 폰을 구분하는 무작위 id (가계부에서 "누가 기록했는지")
 * - shareLedger: 지난 쇼핑을 가족 가계부로 같이 볼지
 * - ledgerSeq: 서버에서 마지막으로 받은 가계부 변경 번호 (그 뒤 바뀐 것만 받음)
 * - ledgerPending: 서버로 보내야 하는 내 기록 id (지워진 건 삭제 표시로 보냄)
 * - ledgerExcluded: 가계부에 올리지 않기로 한 내 예전 기록 id
 */
interface FamilyState {
  deviceId: string
  myName: string
  shareLedger: boolean
  ledgerSeq: number
  ledgerPending: string[]
  ledgerExcluded: string[]
  setMyName: (name: string) => void
}

function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export const useFamily = create<FamilyState>()(
  persist(
    (set) => ({
      deviceId: makeId(),
      myName: '',
      shareLedger: false,
      ledgerSeq: 0,
      ledgerPending: [],
      ledgerExcluded: [],
      setMyName: (name) => set({ myName: name.trim().slice(0, 20) }),
    }),
    { name: 'pricecart-family-v1', version: 1 },
  ),
)

/** 이 폰에서 기록한 것인지 (가족이 남긴 건 보기만) */
export const isMine = (trip: ShoppingTrip, deviceId: string) =>
  !trip.authorId || trip.authorId === deviceId

/** 기록한 사람 표시 이름 */
export function authorLabel(trip: ShoppingTrip, deviceId: string, myName: string): string {
  if (isMine(trip, deviceId)) return myName || '나'
  return trip.authorName || '가족'
}
