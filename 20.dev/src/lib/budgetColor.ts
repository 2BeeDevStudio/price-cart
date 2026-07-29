/* 예산 사용률(total/budget)에 따라 oklch의 hue만 이동시켜 색을 만든다.
 *  - 명도(L)·채도(C)는 고정 → 텍스트 대비 안정
 *  - 여유(그린) → 임박(앰버) → 경고(오렌지) → 초과(레드)
 *  - 하나의 hue로 큰 숫자·진행바·뱃지·글로우·남은금액을 모두 파생
 */

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function budgetRatio(total: number, budget: number): number {
  return budget > 0 ? total / budget : 0
}

/** 사용률 → hue(도). 그린 150 → 앰버 90 → 오렌지 55 → 레드 27 */
export function budgetHue(ratio: number): number {
  if (ratio <= 0.6) return 150
  if (ratio <= 0.85) return lerp(150, 90, (ratio - 0.6) / 0.25)
  if (ratio <= 1.0) return lerp(90, 55, (ratio - 0.85) / 0.15)
  return lerp(55, 27, Math.min(1, (ratio - 1.0) / 0.3))
}

export type BudgetLabel = '여유' | '임박' | '경고' | '초과'

export interface BudgetStyle {
  hue: number
  /** 큰 숫자·진행바·남은금액 텍스트 */
  strong: string
  /** 카드 배경 글로우 / 뱃지 배경 (아주 연함) */
  soft: string
  /** soft 위 텍스트 */
  softText: string
  label: BudgetLabel
}

export function budgetStyle(total: number, budget: number): BudgetStyle {
  const ratio = budgetRatio(total, budget)
  const h = budgetHue(ratio).toFixed(1)
  const label: BudgetLabel =
    ratio >= 1 ? '초과' : ratio >= 0.85 ? '경고' : ratio >= 0.6 ? '임박' : '여유'
  return {
    hue: Number(h),
    strong: `oklch(0.60 0.17 ${h})`,
    soft: `oklch(0.965 0.035 ${h})`,
    softText: `oklch(0.46 0.14 ${h})`,
    label,
  }
}
