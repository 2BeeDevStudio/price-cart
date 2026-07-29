import Tesseract, { createWorker } from 'tesseract.js'

export interface OcrResult {
  /** 가격 후보들 (점수 높은 순). 사용자가 칩으로 골라 수정 가능 */
  candidates: number[]
  /** 가장 유력한 후보 (없으면 null) */
  best: number | null
  /** OCR 원문 (디버그/표시용) */
  rawText: string
}

/* ------------------------------------------------------------------ *
 * Worker (싱글턴 재사용)
 *  - 최초 1회만 코어/언어데이터 로드 → 이후 스캔이 빠름
 *  - blocks:true 로 단어별 bbox(위치·크기) 확보
 * ------------------------------------------------------------------ */
let workerPromise: Promise<Tesseract.Worker> | null = null
let progressCb: ((p: number) => void) | null = null

function getWorker(): Promise<Tesseract.Worker> {
  if (!workerPromise) {
    workerPromise = createWorker('eng', 1, {
      logger: (m) => {
        if (m.status === 'recognizing text' && progressCb) progressCb(m.progress)
      },
    })
  }
  return workerPromise
}

/* ------------------------------------------------------------------ *
 * 후보 추출 + 점수화
 * ------------------------------------------------------------------ */
interface Candidate {
  value: number
  hasSep: boolean // 천단위 구분(쉼표) 포함 → 가격일 확률 높음
  isNeg: boolean // 앞에 '-' → 할인액
  size: number // 글자 높이(bbox) → 클수록 대표 가격
  y: number // 세로 위치(위=작음) → 아래쪽일수록 최종가일 확률
}

interface ParsedNum {
  value: number
  hasSep: boolean
  isNeg: boolean
}

/** 단어/문자열에서 가격 숫자 하나를 파싱 (날짜/소수는 제외) */
function parseNumberToken(raw: string): ParsedNum | null {
  const text = raw.trim()
  // 날짜(2019/11/16, 11-16 등)는 가격이 아님
  if (/\d\s*[/]\s*\d/.test(text)) return null
  const hasSep = /\d,\d{3}(?:\D|$)/.test(text) || /\d,\d{2,3}/.test(text)
  const isNeg = /^[-–—]/.test(text)
  const digits = text.replace(/[^\d]/g, '')
  if (!digits) return null
  const value = parseInt(digits, 10)
  if (!Number.isFinite(value) || value <= 0 || value >= 100_000_000) return null
  return { value, hasSep, isNeg }
}

function scoreCandidate(c: Candidate, maxSize: number, maxY: number): number {
  let s = 0
  // 1) 글자 크기: 가장 강한 신호 (대표 가격은 크게 인쇄됨)
  if (maxSize > 0) s += (c.size / maxSize) * 100
  // 2) 천단위 쉼표: 상품번호/바코드/날짜에는 없음
  if (c.hasSep) s += 45
  // 3) 쉼표 없는 6자리 이상: 상품번호/바코드로 강한 감점
  if (!c.hasSep && c.value >= 100_000) s -= 70
  // 4) 연도(1900~2099)로 보이는 값 감점
  if (!c.hasSep && c.value >= 1900 && c.value <= 2099) s -= 30
  // 5) 할인액(-) 감점
  if (c.isNeg) s -= 35
  // 6) 너무 작은 값(수량/사이즈코드) 약간 감점
  if (c.value < 100) s -= 15
  // 7) 아래쪽에 위치할수록 최종 결제가일 확률 ↑ (약한 신호)
  if (maxY > 0) s += (c.y / maxY) * 12
  return s
}

/** blocks 트리에서 단어 전부 수집 (버전차 대비 fallback 포함) */
function collectWords(data: Tesseract.Page): Tesseract.Word[] {
  const out: Tesseract.Word[] = []
  for (const b of data.blocks ?? []) {
    for (const p of b.paragraphs ?? []) {
      for (const l of p.lines ?? []) {
        for (const w of l.words ?? []) out.push(w)
      }
    }
  }
  if (out.length === 0 && Array.isArray(data.words)) return data.words
  return out
}

/**
 * 텍스트에서 가격 후보 숫자만 뽑는다 (bbox 없는 fallback 경로용).
 * 쉼표 유무만 반영해 점수화한다.
 */
export function extractPriceCandidates(text: string): number[] {
  const matches = text.match(/-?\d{1,3}(?:,\d{3})+|-?\d+/g) ?? []
  const cands: Candidate[] = []
  for (const m of matches) {
    const p = parseNumberToken(m)
    if (p) cands.push({ ...p, size: 0, y: 0 })
  }
  return rankCandidates(cands)
}

/** 후보 배열 → 중복 제거 + 점수순 정렬된 value 배열 */
function rankCandidates(cands: Candidate[]): number[] {
  if (cands.length === 0) return []
  const maxSize = Math.max(0, ...cands.map((c) => c.size))
  const maxY = Math.max(0, ...cands.map((c) => c.y))

  // 같은 value 는 점수 높은 것만 남김
  const bestByValue = new Map<number, { value: number; score: number }>()
  for (const c of cands) {
    const score = scoreCandidate(c, maxSize, maxY)
    const prev = bestByValue.get(c.value)
    if (!prev || score > prev.score) bestByValue.set(c.value, { value: c.value, score })
  }
  return Array.from(bestByValue.values())
    .sort((a, b) => b.score - a.score || b.value - a.value)
    .map((x) => x.value)
}

/**
 * 이미지에서 가격을 인식한다. (온디바이스, Tesseract.js)
 * @param image  File | Blob | dataURL 등
 * @param onProgress  0~1 진행률 콜백
 */
export async function recognizePrice(
  image: Tesseract.ImageLike,
  onProgress?: (progress: number) => void,
): Promise<OcrResult> {
  progressCb = onProgress ?? null
  try {
    const worker = await getWorker()
    const { data } = await worker.recognize(image, {}, { text: true, blocks: true })
    const rawText = data.text ?? ''

    const words = collectWords(data)
    let candidates: number[]

    if (words.length > 0) {
      const parsed: Candidate[] = []
      for (const w of words) {
        const p = parseNumberToken(w.text)
        if (!p) continue
        const h = w.bbox ? w.bbox.y1 - w.bbox.y0 : 0
        parsed.push({ ...p, size: h, y: w.bbox ? w.bbox.y0 : 0 })
      }
      candidates = parsed.length > 0 ? rankCandidates(parsed) : extractPriceCandidates(rawText)
    } else {
      // bbox 를 못 얻은 경우: 텍스트 기반 fallback
      candidates = extractPriceCandidates(rawText)
    }

    return { candidates, best: candidates[0] ?? null, rawText }
  } finally {
    progressCb = null
  }
}
