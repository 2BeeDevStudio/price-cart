import type { PromoType } from '../types'

/**
 * 가격표 OCR 원문에서 할인·행사를 찾아 "할인 상품" 버튼을 미리 켜기 위한 추측.
 * 잘못 켜지면 오히려 귀찮으므로 확실한 신호가 있을 때만:
 *  1) "정상가 / 정가 / 기존가" 같은 라벨 옆(또는 다음 줄) 숫자 → 정가
 *  2) "-3,000원" 같은 할인액 → 판매가 + 할인액 = 정가
 *  3) 할인 표시(할인·세일·특가·20% 등) + 판매가보다 큰 가격 → 정가 (% 가 있으면 맞는 값 우선)
 * 단순히 더 큰 숫자만 있는 경우(100g당 단가 등)는 켜지 않는다.
 */
export interface DiscountGuess {
  /** 정가 (할인 전 가격). 확실치 않으면 null */
  original: number | null
  /** 1+1 / 2+1 행사 */
  promo: PromoType | null
}

const NUM_RE = /\d{1,3}(?:,\d{3})+|\d{3,7}/g
const ORIGINAL_KW = /정\s*상\s*가|정\s*가|기\s*존\s*가|소\s*비\s*자\s*가|이\s*전\s*가/
const SALE_KW = /할\s*인|세\s*일|sale|특\s*가|행\s*사\s*가|\d{1,2}\s*%|\boff\b|↓|→|▶|⇒/i
/** 단가 표시 줄 (100g당 1,234원 등) — 정가로 오인하지 않게 */
const UNIT_LINE = /당|\d\s*(?:k?g|m?l|L)\b|개입/i

const toNum = (s: string) => parseInt(s.replace(/,/g, ''), 10)
const numsIn = (line: string) => (line.match(NUM_RE) ?? []).map(toNum)
/** 정가로 그럴듯한가 (판매가보다 크고, 할인율 2~70%) */
const plausible = (orig: number, sale: number) => orig > sale && sale / orig >= 0.3 && sale / orig <= 0.98

export function detectDiscount(rawText: string, candidates: number[], best: number | null): DiscountGuess {
  const text = rawText || ''
  const promo: PromoType | null = /(^|[^\d])1\s*\+\s*1(?!\d)/.test(text)
    ? '1+1'
    : /(^|[^\d])2\s*\+\s*1(?!\d)/.test(text)
      ? '2+1'
      : null
  if (best == null || best <= 0) return { original: null, promo }

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  // 1) 정가 라벨 옆 숫자 (같은 줄에 숫자가 없으면 다음 줄)
  for (let i = 0; i < lines.length; i++) {
    if (!ORIGINAL_KW.test(lines[i])) continue
    const here = numsIn(lines[i])
    const near = here.length ? here : numsIn(lines[i + 1] ?? '')
    const hit = near.find((n) => plausible(n, best))
    if (hit) return { original: hit, promo }
  }

  // 2) 할인액 "-3,000원" (줄 맨앞/공백 뒤 마이너스, 쉼표 있거나 '원'이 붙은 숫자만 — 날짜 오인 방지)
  for (const l of lines) {
    const m = l.match(/(?:^|\s)[-–—]\s*(\d{1,3}(?:,\d{3})+|\d{3,6}(?=\s*원))/)
    if (!m) continue
    const orig = best + toNum(m[1])
    if (plausible(orig, best)) return { original: orig, promo }
  }

  // 3) 할인 표시 + 판매가보다 큰 가격
  if (!SALE_KW.test(text)) return { original: null, promo }
  const unitNums = new Set(lines.filter((l) => UNIT_LINE.test(l)).flatMap(numsIn))
  const bigger = candidates.filter((c) => plausible(c, best) && !unitNums.has(c))
  if (bigger.length === 0) return { original: null, promo }
  const pct = text.match(/(\d{1,2})\s*%/)
  if (pct) {
    const rate = 1 - Number(pct[1]) / 100
    const fit = bigger.find((c) => Math.abs(c * rate - best) <= Math.max(c * 0.03, 100))
    if (fit) return { original: fit, promo }
  }
  return { original: bigger[0], promo }
}
