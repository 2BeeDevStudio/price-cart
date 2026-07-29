import Tesseract, { createWorker } from 'tesseract.js'
import { candidatesFromWords, extractPriceCandidates, type WordBox } from './priceParse'
import { preprocessImage } from './image'

export interface LocalOcrResult {
  candidates: number[]
  best: number | null
  rawText: string
}

/* Worker 싱글턴 재사용 — 최초 1회만 코어/언어데이터 로드 */
let workerPromise: Promise<Tesseract.Worker> | null = null
let progressCb: ((p: number) => void) | null = null

function getWorker(): Promise<Tesseract.Worker> {
  if (!workerPromise) {
    workerPromise = createWorker('eng', 1, {
      logger: (m) => {
        if (m.status === 'recognizing text' && progressCb) progressCb(m.progress)
      },
    }).then(async (worker) => {
      await worker.setParameters({ user_defined_dpi: '300' })
      return worker
    })
  }
  return workerPromise
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

/** 온디바이스(Tesseract) 가격 인식 — 오프라인 폴백용 */
export async function recognizeLocal(
  file: File | Blob,
  onProgress?: (progress: number) => void,
): Promise<LocalOcrResult> {
  progressCb = onProgress ?? null
  try {
    const prepared = await preprocessImage(file)
    const worker = await getWorker()
    const { data } = await worker.recognize(prepared, {}, { text: true, blocks: true })
    const rawText = data.text ?? ''

    const words = collectWords(data)
    const boxes: WordBox[] = words.map((w) => ({
      text: w.text,
      size: w.bbox ? w.bbox.y1 - w.bbox.y0 : 0,
      y: w.bbox ? w.bbox.y0 : 0,
    }))

    const candidates = boxes.length > 0 ? candidatesFromWords(boxes) : extractPriceCandidates(rawText)
    return { candidates, best: candidates[0] ?? null, rawText }
  } finally {
    progressCb = null
  }
}
