import { imageToBase64 } from './image'

/** 영수증 전체 텍스트 인식 (Vision DOCUMENT_TEXT_DETECTION) */
export async function recognizeReceipt(file: File | Blob): Promise<string> {
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
    fullTextAnnotation?: { text?: string }
    textAnnotations?: { description: string }[]
  }
  return data.fullTextAnnotation?.text ?? data.textAnnotations?.[0]?.description ?? ''
}
