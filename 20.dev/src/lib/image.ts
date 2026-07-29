/**
 * OCR 전처리: 사진을 Tesseract 가 읽기 쉬운 형태로 변환한다.
 *  1) 적당한 크기로 스케일 (너무 작으면 확대, 너무 크면 축소)
 *  2) 그레이스케일
 *  3) 퍼센타일 기반 대비 정규화 (조명 편차 보정)
 *
 * 반환: 전처리된 canvas (Tesseract 의 ImageLike 로 그대로 사용)
 */
export async function preprocessImage(file: File | Blob): Promise<HTMLCanvasElement> {
  const bitmap = await loadBitmap(file)
  const { width: sw, height: sh } = bitmap

  const maxDim = Math.max(sw, sh)
  let scale = 1
  if (maxDim > 2600) scale = 2600 / maxDim // 너무 크면 축소 (속도)
  else if (maxDim < 1400) scale = Math.min(1400 / maxDim, 3) // 작으면 확대 (최대 3배)

  const w = Math.round(sw * scale)
  const h = Math.round(sh * scale)

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, 0, 0, w, h)
  if ('close' in bitmap && typeof bitmap.close === 'function') bitmap.close()

  const img = ctx.getImageData(0, 0, w, h)
  const data = img.data
  const n = w * h

  // 1) 그레이스케일 값 계산 + 히스토그램
  const gray = new Uint8ClampedArray(n)
  const hist = new Uint32Array(256)
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    const g = (data[p] * 299 + data[p + 1] * 587 + data[p + 2] * 114) / 1000
    const gi = g | 0
    gray[i] = gi
    hist[gi]++
  }

  // 2) 2% / 98% 퍼센타일로 대비 스트레치 (극단값 무시)
  const lowCut = n * 0.02
  const highCut = n * 0.98
  let acc = 0
  let low = 0
  let high = 255
  for (let v = 0; v < 256; v++) {
    acc += hist[v]
    if (acc >= lowCut) {
      low = v
      break
    }
  }
  acc = 0
  for (let v = 0; v < 256; v++) {
    acc += hist[v]
    if (acc >= highCut) {
      high = v
      break
    }
  }
  const range = Math.max(1, high - low)

  // 3) 정규화된 그레이값으로 다시 쓰기
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    let v = ((gray[i] - low) / range) * 255
    v = v < 0 ? 0 : v > 255 ? 255 : v
    data[p] = data[p + 1] = data[p + 2] = v
  }
  ctx.putImageData(img, 0, 0)

  return canvas
}

/**
 * 클라우드 OCR 업로드용: 원본 색상 유지 + 다운스케일 + JPEG 압축 → base64(prefix 없음).
 * (Vision 은 원본 사진을 잘 처리하므로 흑백 전처리 없이 보낸다. 용량/지연만 줄임)
 */
export async function imageToBase64(
  file: File | Blob,
  maxDim = 1600,
  quality = 0.82,
): Promise<string> {
  const bitmap = await loadBitmap(file)
  const { width: sw, height: sh } = bitmap
  const scale = Math.min(1, maxDim / Math.max(sw, sh))
  const w = Math.max(1, Math.round(sw * scale))
  const h = Math.max(1, Math.round(sh * scale))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, 0, 0, w, h)
  if ('close' in bitmap && typeof bitmap.close === 'function') bitmap.close()

  const dataUrl = canvas.toDataURL('image/jpeg', quality)
  return dataUrl.replace(/^data:image\/[a-z]+;base64,/, '')
}

async function loadBitmap(file: File | Blob): Promise<ImageBitmap | HTMLImageElement> {
  // createImageBitmap 이 있으면 사용 (빠르고 EXIF 회전 처리)
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' })
    } catch {
      /* fallback below */
    }
  }
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.decoding = 'async'
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('이미지 로드 실패'))
      img.src = url
    })
    return img
  } finally {
    URL.revokeObjectURL(url)
  }
}
