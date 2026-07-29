import Tesseract from 'tesseract.js'

export interface OcrResult {
  /** 가격 후보들 (큰 값 우선 정렬). 사용자가 고를 수 있게 여러 개 제공 */
  candidates: number[]
  /** 가장 유력한 후보 (없으면 null) */
  best: number | null
  /** OCR 원문 (디버그/표시용) */
  rawText: string
}

/**
 * 텍스트에서 가격 후보 숫자들을 뽑아낸다.
 *  - "1,980" / "1980" / "₩1,980" / "1,980원" 등에서 숫자만 추출
 *  - 쉼표 제거 후 정수로 변환
 *  - 큰 값이 앞으로 오도록 정렬 (가격표의 대표 가격이 보통 가장 큼)
 */
export function extractPriceCandidates(text: string): number[] {
  // 콤마가 들어간 숫자(1,980 / 12,800) 또는 연속 숫자(1980)
  const matches = text.match(/\d{1,3}(?:,\d{3})+|\d+/g) ?? []
  const nums = matches
    .map((m) => parseInt(m.replace(/,/g, ''), 10))
    // 0원, 지나치게 큰 값(바코드 등)은 제외
    .filter((n) => Number.isFinite(n) && n > 0 && n < 100_000_000)

  const uniq = Array.from(new Set(nums))
  uniq.sort((a, b) => b - a)
  return uniq
}

/**
 * 이미지에서 가격을 인식한다. (온디바이스, Tesseract.js)
 * @param image  File | Blob | dataURL(string) | HTMLCanvasElement 등
 * @param onProgress  0~1 진행률 콜백
 */
export async function recognizePrice(
  image: Tesseract.ImageLike,
  onProgress?: (progress: number) => void,
): Promise<OcrResult> {
  const { data } = await Tesseract.recognize(image, 'eng', {
    logger: (m) => {
      if (m.status === 'recognizing text' && onProgress) onProgress(m.progress)
    },
  })

  const rawText = data.text ?? ''
  const candidates = extractPriceCandidates(rawText)
  return {
    candidates,
    best: candidates[0] ?? null,
    rawText,
  }
}
