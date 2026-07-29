/* PriceCart service worker — 오프라인 지원 (수동 구성)
 * - 앱 셸: stale-while-revalidate (해시된 JS/CSS는 최초 방문 후 캐시)
 * - OCR CDN(wasm/언어데이터): cache-first (한 번 받으면 오프라인에서도 인식)
 * - 오프라인 내비게이션: 캐시된 index.html 폴백
 */
const VERSION = 'v1'
const SHELL_CACHE = `pricecart-shell-${VERSION}`
const OCR_CACHE = `pricecart-ocr-${VERSION}`

const PRECACHE = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/favicon.svg',
  '/apple-touch-icon.png',
  '/icon-192.png',
  '/icon-512.png',
]

const OCR_HOSTS = ['cdn.jsdelivr.net', 'unpkg.com', 'tessdata.projectnaptha.com']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== SHELL_CACHE && k !== OCR_CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // OCR 자산 (교차 출처 CDN): cache-first
  if (OCR_HOSTS.includes(url.hostname)) {
    event.respondWith(
      caches.open(OCR_CACHE).then(async (cache) => {
        const cached = await cache.match(request)
        if (cached) return cached
        const res = await fetch(request)
        // opaque(0) 응답도 캐시 (교차 출처)
        if (res && (res.status === 200 || res.status === 0)) cache.put(request, res.clone())
        return res
      }),
    )
    return
  }

  // 동일 출처만 처리
  if (url.origin !== self.location.origin) return

  // 내비게이션: 네트워크 우선 + 오프라인 시 캐시된 셸 폴백
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/index.html').then((r) => r || caches.match('/'))),
    )
    return
  }

  // 그 외 동일 출처 자산: stale-while-revalidate
  event.respondWith(
    caches.open(SHELL_CACHE).then(async (cache) => {
      const cached = await cache.match(request)
      const network = fetch(request)
        .then((res) => {
          if (res && res.status === 200) cache.put(request, res.clone())
          return res
        })
        .catch(() => cached)
      return cached || network
    }),
  )
})
