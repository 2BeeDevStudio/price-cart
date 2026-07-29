// Vercel Serverless Function: Google Vision OCR 프록시
// API 키(GOOGLE_VISION_API_KEY)를 서버에만 두고, 클라이언트에는 노출하지 않는다.
//
// 요청:  POST /api/ocr   { image: "<base64, prefix 없음>" }
// 응답:  Vision responses[0] 그대로 ({ textAnnotations, fullTextAnnotation, ... })
//
// (@vercel/node 런타임이 JSON 요청 본문을 req.body 로 파싱하고
//  res.status()/res.json() 헬퍼를 제공한다. 기본 본문 한도 4.5MB 로 충분.)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST only' })
    return
  }

  const key = process.env.GOOGLE_VISION_API_KEY
  if (!key) {
    res.status(500).json({ error: 'GOOGLE_VISION_API_KEY 환경변수가 설정되지 않았습니다.' })
    return
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    const image = body && body.image
    if (!image) {
      res.status(400).json({ error: 'image(base64)가 필요합니다.' })
      return
    }

    const visionRes = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [
            {
              image: { content: image },
              features: [{ type: 'TEXT_DETECTION' }],
              imageContext: { languageHints: ['ko', 'en'] },
            },
          ],
        }),
      },
    )

    const data = await visionRes.json()
    if (!visionRes.ok) {
      res.status(502).json({ error: 'Vision API 오류', detail: data })
      return
    }

    res.status(200).json(data.responses && data.responses[0] ? data.responses[0] : {})
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
}
