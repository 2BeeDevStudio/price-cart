import { imageToBase64 } from './image'

export interface OcrWord {
  text: string
  /** 왼쪽 x (정렬용) */
  x: number
  /** 세로 중심 y (행 묶기용) */
  y: number
  /** 글자 높이 (행 간격 추정용) */
  h: number
}

interface Vertex {
  x?: number
  y?: number
}

/** 영수증 단어 목록 인식 (Vision DOCUMENT_TEXT_DETECTION, 단어별 좌표 포함) */
export async function recognizeReceipt(file: File | Blob): Promise<OcrWord[]> {
  const image = await imageToBase64(file, 2200, 0.85)
  const resp = await fetch('/api/ocr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image, mode: 'document' }),
  })
  if (!resp.ok) {
    let detail = ''
    try {
      detail = JSON.stringify(await resp.json())
    } catch {
      /* ignore */
    }
    throw new Error(`receipt OCR ${resp.status} ${detail}`)
  }
  const data = (await resp.json()) as {
    textAnnotations?: { description: string; boundingPoly?: { vertices?: Vertex[] } }[]
  }
  const anns = data.textAnnotations ?? []
  // anns[0] 은 전체 텍스트, anns[1..] 이 단어별
  return anns.slice(1).map((a) => {
    const vs = a.boundingPoly?.vertices ?? []
    const xs = vs.map((v) => v.x ?? 0)
    const ys = vs.map((v) => v.y ?? 0)
    const minY = ys.length ? Math.min(...ys) : 0
    const maxY = ys.length ? Math.max(...ys) : 0
    return {
      text: a.description,
      x: xs.length ? Math.min(...xs) : 0,
      y: (minY + maxY) / 2,
      h: maxY - minY,
    }
  })
}
