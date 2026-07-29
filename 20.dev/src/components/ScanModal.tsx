import { useEffect, useRef, useState } from 'react'
import { recognizePrice, type OcrEngine } from '../lib/ocr'
import { formatWon, formatNumber } from '../lib/format'

type Phase = 'capture' | 'processing' | 'review'

interface ScanModalProps {
  onClose: () => void
  onConfirm: (price: number) => void
}

export default function ScanModal({ onClose, onConfirm }: ScanModalProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [phase, setPhase] = useState<Phase>('capture')
  const [progress, setProgress] = useState(0)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [candidates, setCandidates] = useState<number[]>([])
  const [price, setPrice] = useState('')
  const [engine, setEngine] = useState<OcrEngine | null>(null)
  const [rawText, setRawText] = useState('')
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
    setEngine(null)
    setRawText('')
    setError(null)
    fileRef.current?.click()
  }

  function confirm() {
    const n = parseInt(price.replace(/[^\d]/g, ''), 10)
    if (!Number.isFinite(n) || n <= 0) {
      setError('올바른 가격을 입력해 주세요.')
      return
    }
    onConfirm(n)
  }

  const parsedPreview = (() => {
    const n = parseInt(price.replace(/[^\d]/g, ''), 10)
    return Number.isFinite(n) && n > 0 ? formatWon(n) : null
  })()

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-black/60" onClick={onClose}>
      <div
        className="safe-bottom mt-auto w-full rounded-t-3xl bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto max-w-md px-5 pb-6 pt-3">
          {/* grabber */}
          <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-slate-200" />

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
                <img
                  src={previewUrl}
                  alt="촬영한 가격표"
                  className="mx-auto mb-4 max-h-36 rounded-xl object-contain"
                />
              )}

              <div className="mb-1 flex items-center justify-between">
                <label className="text-sm font-medium text-slate-500">인식된 가격</label>
                {engine === 'local' && (
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-600">
                    오프라인 · 기기 인식
                  </span>
                )}
              </div>
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

              {error && <div className="mt-3 text-sm text-red-500">{error}</div>}

              <div className="mt-5 flex gap-3">
                <button
                  onClick={retake}
                  className="h-14 flex-1 rounded-2xl border border-slate-200 text-base font-semibold text-slate-600 active:bg-slate-50"
                >
                  다시 촬영
                </button>
                <button
                  onClick={confirm}
                  className="h-14 flex-[1.4] rounded-2xl bg-brand text-base font-bold text-white active:bg-brand-dark"
                >
                  확인
                </button>
              </div>

              {rawText.trim() && (
                <details className="mt-4">
                  <summary className="cursor-pointer text-xs text-slate-300">
                    인식 원문 보기 (디버그)
                  </summary>
                  <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-2 text-[11px] leading-tight text-slate-500">
                    {rawText}
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
