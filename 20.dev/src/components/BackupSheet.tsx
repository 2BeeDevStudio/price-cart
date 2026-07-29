import { useRef, useState } from 'react'
import { useCart } from '../store/cart'

interface BackupSheetProps {
  onClose: () => void
}

export default function BackupSheet({ onClose }: BackupSheetProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const tripCount = useCart((s) => s.trips.length)

  function buildPayload() {
    const { items, storeName, trips } = useCart.getState()
    return {
      app: 'pricecart',
      version: 1,
      exportedAt: new Date().toISOString(),
      storeName,
      items,
      trips,
    }
  }

  async function handleExport() {
    setErr(null)
    setMsg(null)
    const json = JSON.stringify(buildPayload(), null, 2)
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const filename = `pricecart-backup-${stamp}.json`

    // iOS 등: 공유 시트로 '파일에 저장' 지원되면 우선 사용
    try {
      const file = new File([json], filename, { type: 'application/json' })
      const nav = navigator as Navigator & { canShare?: (d: unknown) => boolean }
      if (nav.canShare && nav.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'PriceCart 백업' })
        setMsg('내보내기 완료 (공유/파일에 저장)')
        return
      }
    } catch {
      // 공유 취소/실패 → 다운로드로 폴백
    }

    // 폴백: 파일 다운로드
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    setMsg('백업 파일을 저장했어요.')
  }

  async function handleImportFile(file: File) {
    setErr(null)
    setMsg(null)
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      if (!data || !Array.isArray(data.trips)) {
        setErr('올바른 백업 파일이 아니에요.')
        return
      }
      const added = useCart.getState().mergeImport({
        items: Array.isArray(data.items) ? data.items : undefined,
        storeName: typeof data.storeName === 'string' ? data.storeName : undefined,
        trips: data.trips,
      })
      setMsg(
        added > 0
          ? `${added}개 기록을 불러왔어요.`
          : '불러왔지만 새로 추가된 기록은 없어요 (이미 있는 기록).',
      )
    } catch {
      setErr('파일을 읽지 못했어요. JSON 백업 파일인지 확인해 주세요.')
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-black/60" onClick={onClose}>
      <div
        className="safe-bottom mt-auto max-h-[85dvh] w-full overflow-y-auto overscroll-contain rounded-t-3xl bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto max-w-md px-5 pb-6 pt-3">
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

          <div className="mb-1 text-lg font-bold text-slate-900">백업 / 복원</div>
          <p className="mb-4 text-sm text-slate-500">
            기록을 파일로 저장하거나 다른 곳(홈 화면 앱 등)으로 옮길 수 있어요. 저장된 기록{' '}
            <span className="font-semibold text-slate-700">{tripCount}개</span>.
          </p>

          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (f) void handleImportFile(f)
            }}
          />

          <button
            onClick={handleExport}
            className="mb-3 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-brand text-base font-bold text-white active:bg-brand-dark"
          >
            📤 기록 내보내기 (파일로 저장)
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 text-base font-semibold text-slate-700 active:bg-slate-50"
          >
            📥 기록 불러오기 (파일 선택)
          </button>

          {msg && (
            <div className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-700">
              {msg}
            </div>
          )}
          {err && (
            <div className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-600">
              {err}
            </div>
          )}

          <p className="mt-4 text-xs leading-relaxed text-slate-400">
            불러오기는 <b>병합</b>돼요 — 같은 기록은 중복되지 않고, 기존 기록은 지워지지 않아요.
            (아이폰: 내보내기 → "파일에 저장" → 홈 화면 앱에서 불러오기)
          </p>
        </div>
      </div>
    </div>
  )
}
