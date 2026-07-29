import type { Item, PromoType } from '../types'

/** 행사 선택 옵션 (일반 = null) */
export const PROMO_OPTIONS: { value: PromoType | null; label: string }[] = [
  { value: null, label: '일반' },
  { value: '1+1', label: '1+1' },
  { value: '2+1', label: '2+1' },
]

/**
 * 실제 결제해야 하는 개수 (무료분 제외).
 *  - 1+1: 2개당 1개 무료 → 결제 = 수량 − ⌊수량/2⌋
 *  - 2+1: 3개당 1개 무료 → 결제 = 수량 − ⌊수량/3⌋
 */
export function paidUnits(quantity: number, promo?: PromoType): number {
  if (promo === '1+1') return quantity - Math.floor(quantity / 2)
  if (promo === '2+1') return quantity - Math.floor(quantity / 3)
  return quantity
}

/** 무료로 받는 개수 */
export function freeUnits(quantity: number, promo?: PromoType): number {
  return quantity - paidUnits(quantity, promo)
}

/** 할인 전 금액 (단가 × 수량) */
export function lineOriginal(item: Pick<Item, 'price' | 'quantity'>): number {
  return item.price * item.quantity
}

/** 실제 결제 금액 (행사 반영) */
export function linePaid(item: Pick<Item, 'price' | 'quantity' | 'promo'>): number {
  return item.price * paidUnits(item.quantity, item.promo)
}

/** 이 상품에서 아낀 금액 */
export function lineSavings(item: Pick<Item, 'price' | 'quantity' | 'promo'>): number {
  return lineOriginal(item) - linePaid(item)
}

/** 배지 색상 (1+1=초록, 2+1=파랑) */
export function promoBadgeClass(promo: PromoType): string {
  return promo === '1+1' ? 'bg-emerald-100 text-emerald-700' : 'bg-sky-100 text-sky-700'
}
