import { candidatesFromWords, extractPriceCandidates, type WordBox } from './priceParse'
import { imageToBase64 } from './image'

export interface CloudOcrResult {
  candidates: number[]
  best: number | null
  rawText: string
}

interface VisionVertex {
  x?: number
  y?: number
}
interface VisionAnnotation {
  description: string
  boundingPoly?: { vertices?: VisionVertex[] }
}

/** Google Vision(서버리스 프록시 /api/ocr) 가격 인식 */
export async function recognizeCloud(file: File | Blob): Promise<CloudOcrResult> {
  const image = await imageToBase64(file)

  const resp = await fetch('/api/ocr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image }),
  })

  if (!resp.ok) {
    let detail = ''
    try {
      detail = JSON.stringify(await resp.json())
    } catch {
      /* ignore */
    }
    throw new Error(`cloud OCR ${resp.status} ${detail}`)
  }

  const data = (await resp.json()) as {
    textAnnotations?: VisionAnnotation[]
    fullTextAnnotation?: { text?: string }
  }

  const anns = data.textAnnotations ?? []
  const rawText = data.fullTextAnnotation?.text ?? anns[0]?.description ?? ''

  // anns[0] 은 전체 텍스트, anns[1..] 이 단어별
  const boxes: WordBox[] = anns.slice(1).map((a) => {
    const ys = (a.boundingPoly?.vertices ?? []).map((v) => v.y ?? 0)
    const top = ys.length ? Math.min(...ys) : 0
    const bot = ys.length ? Math.max(...ys) : 0
    return { text: a.description, size: bot - top, y: top }
  })

  const candidates = boxes.length > 0 ? candidatesFromWords(boxes) : extractPriceCandidates(rawText)
  return { candidates, best: candidates[0] ?? null, rawText }
}
