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
  const hasSep = /\d,\d{2,3}/.test(text)
  const isNeg = /^[-–—]/.test(text)
  const digits = text.replace(/[^\d]/g, '')
  if (!digits) return null
  const value = parseInt(digits, 10)
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
