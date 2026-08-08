import { useEffect, useRef, useState } from 'react'
import { recognizePrice, type OcrEngine } from '../lib/ocr'
import { formatWon, formatNumber } from '../lib/format'
import { PROMO_OPTIONS } from '../lib/promo'
import type { PromoType } from '../types'

type Phase = 'capture' | 'processing' | 'review'

interface ScanModalProps {
  onClose: () => void
  onConfirm: (
    price: number,
    name: string,
    promo: PromoType | null,
    originalPrice: number | null,
  ) => void
}

export default function ScanModal({ onClose, onConfirm }: ScanModalProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [phase, setPhase] = useState<Phase>('capture')
  const [progress, setProgress] = useState(0)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [candidates, setCandidates] = useState<number[]>([])
  const [price, setPrice] = useState('')
  const [name, setName] = useState('')
  const [promo, setPromo] = useState<PromoType | null>(null)
  const [showDiscount, setShowDiscount] = useState(false)
  const [original, setOriginal] = useState('')
  const [engine, setEngine] = useState<OcrEngine | null>(null)
  const [rawText, setRawText] = useState('')
  const [cloudError, setCloudError] = useState<string | undefined>(undefined)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 미리보기 objectURL 정리
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  async function handleFile(file: File) {
    setError(null)
    const url = URL.createObjectURL(file)
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return url
    })
    setPhase('processing')
    setProgress(0)
    try {
      // 온라인: 클라우드(Vision), 오프라인/실패: 온디바이스 자동 폴백
      const result = await recognizePrice(file, setProgress)
      setEngine(result.engine)
      setRawText(result.rawText)
      setCloudError(result.cloudError)
      setName(result.nameGuess)
      setCandidates(result.candidates.slice(0, 6))
      setPrice(result.best != null ? String(result.best) : '')
      setPhase('review')
    } catch (e) {
      console.error(e)
      setError('가격 인식에 실패했어요. 다시 촬영하거나 직접 입력해 주세요.')
      setCandidates([])
      setPrice('')
      setPhase('review')
    }
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    // 같은 파일 재선택도 감지되도록 초기화
    e.target.value = ''
    if (file) void handleFile(file)
  }

  function retake() {
    setPhase('capture')
    setCandidates([])
    setPrice('')
    setName('')
    setPromo(null)
    setShowDiscount(false)
    setOriginal('')
    setEngine(null)
    setRawText('')
    setCloudError(undefined)
    setCopied(false)
    setError(null)
    fileRef.current?.click()
  }

  function toggleDiscount() {
    setShowDiscount((v) => {
      const next = !v
      // 켤 때 정가가 비어있으면 '가장 큰 후보(>판매가)'로 자동 프리필
      if (next && !original.trim()) {
        const p = parseInt(price.replace(/[^\d]/g, ''), 10)
        const bigger = candidates.filter((c) => c > (p || 0))
        if (bigger.length) setOriginal(String(Math.max(...bigger)))
      }
      return next
    })
  }

  function confirm() {
    const n = parseInt(price.replace(/[^\d]/g, ''), 10)
    if (!Number.isFinite(n) || n <= 0) {
      setError('올바른 가격을 입력해 주세요.')
      return
    }
    const o = parseInt(original.replace(/[^\d]/g, ''), 10)
    const originalPrice = showDiscount && Number.isFinite(o) && o > n ? o : null
    onConfirm(n, name, promo, originalPrice)
  }

  const parsedPreview = (() => {
    const n = parseInt(price.replace(/[^\d]/g, ''), 10)
    return Number.isFinite(n) && n > 0 ? formatWon(n) : null
  })()

  function debugText() {
    return [
      `engine: ${engine ?? '-'}`,
      cloudError ? `cloudError: ${cloudError}` : 'cloudError: (none)',
      `candidates: ${candidates.join(', ')}`,
      `nameGuess: ${name}`,
      '--- rawText ---',
      rawText,
    ].join('\n')
  }

  async function copyDebug() {
    const text = debugText()
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // clipboard API 실패 시 fallback
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      try {
        document.execCommand('copy')
      } catch {
        /* ignore */
      }
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-black/60" onClick={onClose}>
      <div
        className="safe-bottom mt-auto max-h-[90dvh] w-full overflow-y-auto overscroll-contain rounded-t-3xl bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto max-w-md px-5 pb-6 pt-3">
          {/* 헤더 */}
          {phase === 'review' ? (
            <div className="mb-4 flex items-center justify-between pt-1">
              <button
                onClick={onClose}
                aria-label="닫기"
                className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 active:bg-slate-100"
              >
                <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                  <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
              <span className="text-base font-bold text-slate-900">가격 확인</span>
              <button
                onClick={retake}
                className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 active:bg-slate-200"
              >
                <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5">
                  <path d="M4 8a2 2 0 0 1 2-2h1l.6-1.2A1 1 0 0 1 8.5 4h7a1 1 0 0 1 .9.8L17 6h1a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8Z" stroke="currentColor" strokeWidth="1.6" />
                  <circle cx="12" cy="12.5" r="3" stroke="currentColor" strokeWidth="1.6" />
                </svg>
                다시
              </button>
            </div>
          ) : (
            <div className="relative mb-4 flex items-center justify-center pt-1">
              <div className="h-1.5 w-10 rounded-full bg-slate-200" />
              <button
                onClick={onClose}
                aria-label="닫기"
                className="absolute right-0 top-0 flex h-9 w-9 items-center justify-center rounded-full text-slate-400 active:bg-slate-100"
              >
                <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                  <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          )}

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={onInputChange}
          />

          {phase === 'capture' && (
            <div className="flex flex-col items-center py-6 text-center">
              <div className="mb-2 text-lg font-bold text-slate-900">가격표 촬영</div>
              <p className="mb-6 text-sm text-slate-500">
                가격표의 숫자가 잘 보이게 찍어주세요.
              </p>
              <button
                onClick={() => fileRef.current?.click()}
                className="flex h-16 w-full items-center justify-center gap-2 rounded-2xl bg-brand text-lg font-bold text-white active:bg-brand-dark"
              >
                <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
                  <path
                    d="M4 8a2 2 0 0 1 2-2h1l.6-1.2A1 1 0 0 1 8.5 4h7a1 1 0 0 1 .9.8L17 6h1a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8Z"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <circle cx="12" cy="12.5" r="3.2" stroke="currentColor" strokeWidth="2" />
                </svg>
                카메라 열기
              </button>
              <button
                onClick={() => {
                  setPhase('review')
                  setCandidates([])
                  setPrice('')
                }}
                className="mt-3 text-sm font-medium text-slate-400 active:text-slate-600"
              >
                직접 입력하기
              </button>
            </div>
          )}

          {phase === 'processing' && (
            <div className="flex flex-col items-center py-10 text-center">
              {previewUrl && (
                <img
                  src={previewUrl}
                  alt="촬영한 가격표"
                  className="mb-5 max-h-40 rounded-xl object-contain"
                />
              )}
              <div className="text-base font-semibold text-slate-800">가격 인식 중…</div>
              <div className="mt-3 h-2 w-48 overflow-hidden rounded-full bg-slate-100">
                {progress > 0 ? (
                  <div
                    className="h-full rounded-full bg-brand transition-all"
                    style={{ width: `${Math.round(progress * 100)}%` }}
                  />
                ) : (
                  <div className="h-full w-2/5 rounded-full bg-brand animate-indeterminate" />
                )}
              </div>
            </div>
          )}

          {phase === 'review' && (
            <div className="py-2">
              {previewUrl && (
                <div className="relative mb-4">
                  <img
                    src={previewUrl}
                    alt="촬영한 가격표"
                    className="mx-auto max-h-36 rounded-xl object-contain"
                  />
                  <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-slate-900/80 px-2 py-1 text-[11px] font-bold text-white">
                    <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3">
                      <path d="M12 3l1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8L12 3z" fill="currentColor" />
                    </svg>
                    {engine === 'cloud' ? 'AI 인식됨' : engine === 'local' ? '기기 인식' : '인식됨'}
                  </span>
                </div>
              )}

              {/* 상품명 (선택) */}
              <label className="mb-1 block text-sm font-medium text-slate-500">
                상품명 <span className="text-slate-300">(선택)</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="상품명 (없으면 비워두세요)"
                className="mb-4 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 outline-none placeholder:text-slate-300 focus:border-brand"
              />

              <label className="mb-1 block text-sm font-medium text-slate-500">인식된 가격</label>
              <div className="flex items-center rounded-2xl border-2 border-brand bg-white px-4 py-3">
                <input
                  type="text"
                  inputMode="numeric"
                  value={price}
                  onChange={(e) => {
                    setError(null)
                    setPrice(e.target.value.replace(/[^\d,]/g, ''))
                  }}
                  placeholder="0"
                  autoFocus={candidates.length === 0}
                  className="w-full bg-transparent text-3xl font-bold tabular-nums text-slate-900 outline-none"
                />
                <span className="ml-2 text-2xl font-bold text-slate-400">원</span>
              </div>
              {parsedPreview && (
                <div className="mt-1 text-right text-sm text-slate-400 tabular-nums">
                  {parsedPreview}
                </div>
              )}

              {candidates.length > 1 && (
                <div className="mt-3">
                  <div className="mb-1.5 text-xs text-slate-400">다른 숫자로 인식됐나요?</div>
                  <div className="flex flex-wrap gap-2">
                    {candidates.map((c) => (
                      <button
                        key={c}
                        onClick={() => {
                          setError(null)
                          setPrice(String(c))
                        }}
                        className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium tabular-nums text-slate-700 active:bg-slate-200"
                      >
                        {formatNumber(c)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 행사 선택 */}
              <div className="mt-4">
                <div className="mb-1.5 text-sm font-medium text-slate-500">행사</div>
                <div className="flex gap-2">
                  {PROMO_OPTIONS.map((opt) => {
                    const active = promo === opt.value
                    return (
                      <button
                        key={opt.label}
                        onClick={() => setPromo(opt.value)}
                        className={`flex-1 rounded-2xl py-2.5 text-sm font-semibold ${
                          active ? 'bg-brand text-white' : 'bg-slate-100 text-slate-600 active:bg-slate-200'
                        }`}
                      >
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* 할인 (정가 입력) */}
              <div className="mt-4">
                <button
                  onClick={toggleDiscount}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold ${
                    showDiscount ? 'bg-brand text-white' : 'bg-slate-100 text-slate-600 active:bg-slate-200'
                  }`}
                >
                  <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
                    <path d="M9 15l6-6M9.5 9.5h.01M14.5 14.5h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.6" />
                  </svg>
                  할인 상품 (정가 입력)
                </button>
                {showDiscount && (
                  <div className="mt-2">
                    <div className="flex items-center rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={original}
                        onChange={(e) => setOriginal(e.target.value.replace(/[^\d,]/g, ''))}
                        placeholder="정가 (할인 전 가격)"
                        className="w-full bg-transparent text-lg font-bold tabular-nums text-slate-900 outline-none placeholder:text-base placeholder:font-normal placeholder:text-slate-300"
                      />
                      <span className="ml-2 text-base font-bold text-slate-400">원</span>
                    </div>
                    {candidates.length > 1 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {candidates.map((c) => (
                          <button
                            key={c}
                            onClick={() => setOriginal(String(c))}
                            className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium tabular-nums text-slate-700 active:bg-slate-200"
                          >
                            {formatNumber(c)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {error && <div className="mt-3 text-sm text-red-500">{error}</div>}

              <button
                onClick={confirm}
                className="mt-5 flex h-14 w-full items-center justify-center gap-1 rounded-2xl bg-brand text-base font-bold text-white active:bg-brand-dark"
              >
                <span className="text-xl leading-none">＋</span> 카트에 담기
              </button>

              {(rawText.trim() || cloudError) && (
                <details className="mt-4">
                  <summary className="cursor-pointer text-xs text-slate-300">
                    인식 원문 보기 (디버그)
                  </summary>

                  <div className="mt-2 flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        engine === 'cloud'
                          ? 'bg-emerald-50 text-emerald-600'
                          : 'bg-amber-50 text-amber-600'
                      }`}
                    >
                      엔진: {engine === 'cloud' ? 'Vision(클라우드)' : '기기(Tesseract)'}
                    </span>
                    <button
                      onClick={copyDebug}
                      className="ml-auto rounded-lg bg-slate-800 px-3 py-1 text-[11px] font-semibold text-white active:bg-slate-700"
                    >
                      {copied ? '복사됨 ✓' : '전체 복사'}
                    </button>
                  </div>

                  {cloudError && (
                    <div className="mt-2 rounded-lg bg-red-50 p-2 text-[11px] leading-tight text-red-500">
                      클라우드 실패 사유: {cloudError}
                    </div>
                  )}

                  <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-2 text-[11px] leading-tight text-slate-500">
                    {debugText()}
                  </pre>
                </details>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
