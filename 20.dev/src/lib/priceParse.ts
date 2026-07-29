/* 가격 후보 추출 + 점수화 (Tesseract / Google Vision 공용)
 *  - 글자 크기(bbox 높이): 대표 가격은 크게 인쇄됨 → 가장 강한 신호
 *  - 천단위 쉼표: 상품번호/바코드/날짜엔 없음
 *  - 세로 위치(아래): 최종 결제가일 확률 ↑
 *  - 상품번호(쉼표 없는 6자리+)/연도/할인액(-)/초소형 값 감점
 */

export interface WordBox {
  text: string
  /** 글자 높이(px). 없으면 0 */
  size: number
  /** 상단 y 좌표(px). 없으면 0 */
  y: number
}

interface Candidate {
  value: number
  hasSep: boolean
  isNeg: boolean
  size: number
  y: number
}

interface ParsedNum {
  value: number
  hasSep: boolean
  isNeg: boolean
}

/** 단어/문자열에서 가격 숫자 하나를 파싱 (날짜/소수는 제외) */
export function parseNumberToken(raw: string): ParsedNum | null {
  const text = raw.trim()
  // 날짜(2019/11/16 등)는 가격이 아님
  if (/\d\s*[/]\s*\d/.test(text)) return null

  const isNeg = /^[-–—]/.test(text)

  // 쉼표가 있으면 '엄격한 천단위 그룹(,다음 정확히 3자리)'에 맞는 부분만 취한다.
  // 예) "11,9708"(뒤 8이 오인식으로 붙음) → "11,970" → 11970
  const sepMatch = text.match(/\d{1,3}(?:,\d{3})+/)
  let value: number
  let hasSep: boolean
  if (sepMatch) {
    value = parseInt(sepMatch[0].replace(/,/g, ''), 10)
    hasSep = true
  } else {
    const digits = text.replace(/[^\d]/g, '')
    if (!digits) return null
    value = parseInt(digits, 10)
    hasSep = false
  }

  if (!Number.isFinite(value) || value <= 0 || value >= 100_000_000) return null
  return { value, hasSep, isNeg }
}

function scoreCandidate(c: Candidate, maxSize: number, maxY: number): number {
  let s = 0
  if (maxSize > 0) s += (c.size / maxSize) * 100 // 글자 크기 (dominant)
  if (c.hasSep) s += 45 // 천단위 쉼표 = 가격
  if (!c.hasSep && c.value >= 100_000) s -= 70 // 상품번호/바코드
  if (!c.hasSep && c.value >= 1900 && c.value <= 2099) s -= 30 // 연도
  if (c.isNeg) s -= 35 // 할인액
  if (c.value < 100) s -= 15 // 너무 작은 값
  if (c.value % 10 === 0) s += 6 // 한국 표시가는 대부분 10원 단위 (끝자리 0)
  if (maxY > 0) s += (c.y / maxY) * 12 // 아래쪽 = 최종가 (약한 신호)
  return s
}

/** Candidate 배열 → 중복 제거 + 점수순 정렬된 value 배열 */
function rankCandidates(cands: Candidate[]): number[] {
  if (cands.length === 0) return []
  const maxSize = Math.max(0, ...cands.map((c) => c.size))
  const maxY = Math.max(0, ...cands.map((c) => c.y))

  const bestByValue = new Map<number, number>() // value -> score
  for (const c of cands) {
    const score = scoreCandidate(c, maxSize, maxY)
    const prev = bestByValue.get(c.value)
    if (prev === undefined || score > prev) bestByValue.set(c.value, score)
  }
  return Array.from(bestByValue.entries())
    .sort((a, b) => b[1] - a[1] || b[0] - a[0])
    .map(([value]) => value)
}

/** 위치/크기 정보가 있는 단어들에서 가격 후보 뽑기 */
export function candidatesFromWords(words: WordBox[]): number[] {
  const cands: Candidate[] = []
  for (const w of words) {
    const p = parseNumberToken(w.text)
    if (p) cands.push({ ...p, size: w.size, y: w.y })
  }
  return rankCandidates(cands)
}

/**
 * OCR 원문에서 상품명을 추측한다 (가장 그럴듯한 한 줄).
 *  - 가격/날짜/행사/단위 줄은 제외
 *  - 한글이 많은 줄 우선, 그다음 글자 수가 많은 줄
 *  - 확실치 않으면 빈 문자열 (사용자가 직접 입력/수정)
 */
export function guessProductName(text: string): string {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length >= 2)

  const scored = lines
    .map((l) => ({
      l,
      hangul: (l.match(/[가-힣]/g) ?? []).length,
      letters: (l.match(/[A-Za-z]/g) ?? []).length,
      digits: (l.match(/\d/g) ?? []).length,
    }))
    .filter(
      (s) =>
        // 가격/날짜/행사/할인 줄 제외.
        // '원'은 "숫자 뒤 원"(=가격)일 때만 제외 — 상품명 속 원(원피스 등)은 유지
        !/\d[\d,]*\s*원|₩\s*\d|%|할인|행사|정가|판매가|\d{4}\s*[./]\s*\d/.test(s.l) &&
        // 글자(한글+영문)가 숫자보다 많아야 상품명일 확률 ↑
        s.hangul + s.letters > s.digits,
    )

  if (scored.length === 0) return ''
  scored.sort(
    (a, b) => b.hangul - a.hangul || b.letters + b.hangul - (a.letters + a.hangul),
  )
  // 앞뒤 기호(©, *, 따옴표 등) 정리
  return scored[0].l
    .replace(/^[^0-9A-Za-z가-힣]+/, '')
    .replace(/[^0-9A-Za-z가-힣)\]]+$/, '')
    .slice(0, 40)
}

/** 텍스트만 있을 때(위치정보 없음) 가격 후보 뽑기 — fallback */
export function extractPriceCandidates(text: string): number[] {
  const matches = text.match(/-?\d{1,3}(?:,\d{3})+|-?\d+/g) ?? []
  const cands: Candidate[] = []
  for (const m of matches) {
    const p = parseNumberToken(m)
    if (p) cands.push({ ...p, size: 0, y: 0 })
  }
  return rankCandidates(cands)
}
