import { recognizeCloud } from './ocrCloud'
import { recognizeLocal } from './ocrLocal'
import { guessProductName } from './priceParse'

export type OcrEngine = 'cloud' | 'local'

export interface OcrResult {
  /** 가격 후보들 (점수 높은 순) */
  candidates: number[]
  /** 가장 유력한 후보 */
  best: number | null
  /** 상품명 추측값 (없으면 '') */
  nameGuess: string
  /** OCR 원문 */
  rawText: string
  /** 실제 사용된 엔진 */
  engine: OcrEngine
  /** 클라우드가 실패해 폴백한 경우 그 이유 (진단용) */
  cloudError?: string
}

/**
 * 가격 인식 오케스트레이터.
 *  - 온라인이면 클라우드(Vision) 우선 → 정확도 ↑
 *  - 오프라인이거나 클라우드 실패 시 온디바이스(Tesseract) 폴백
 */
export async function recognizePrice(
  file: File | Blob,
  onProgress?: (progress: number) => void,
): Promise<OcrResult> {
  const online = typeof navigator === 'undefined' || navigator.onLine

  let cloudError: string | undefined
  if (online) {
    try {
      const r = await recognizeCloud(file)
      return { ...r, nameGuess: guessProductName(r.rawText), engine: 'cloud' }
    } catch (e) {
      cloudError = e instanceof Error ? e.message : String(e)
      console.warn('클라우드 OCR 실패 → 온디바이스로 대체:', e)
    }
  } else {
    cloudError = 'offline (navigator.onLine=false)'
  }

  const r = await recognizeLocal(file, onProgress)
  return { ...r, nameGuess: guessProductName(r.rawText), engine: 'local', cloudError }
}
