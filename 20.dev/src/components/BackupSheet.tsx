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
  const clearTrips = useCart((s) => s.clearTrips)

  function buildPayload() {
    const { items, storeName, trips } = useCart.getState()
    return { app: 'pricecart', version: 1, exportedAt: new Date().toISOString(), storeName, items, trips }
  }

  async function handleExport() {
    setErr(null)
    setMsg(null)
    const json = JSON.stringify(buildPayload(), null, 2)
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const filename = `pricecart-backup-${stamp}.json`
    try {
      const file = new File([json], filename, { type: 'application/json' })
      const nav = navigator as Navigator & { canShare?: (d: unknown) => boolean }
      if (nav.canShare && nav.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'PriceCart 백업' })
        setMsg('내보내기 완료 (공유/파일에 저장)')
        return
      }
    } catch {
      /* 공유 취소/실패 → 다운로드 폴백 */
    }
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
      const data = JSON.parse(await file.text())
      if (!data || !Array.isArray(data.trips)) {
        setErr('올바른 백업 파일이 아니에요.')
        return
      }
      const added = useCart.getState().mergeImport({
        items: Array.isArray(data.items) ? data.items : undefined,
        storeName: typeof data.storeName === 'string' ? data.storeName : undefined,
        trips: data.trips,
      })
      setMsg(added > 0 ? `${added}개 기록을 불러왔어요.` : '이미 있는 기록이라 추가된 건 없어요.')
    } catch {
      setErr('파일을 읽지 못했어요. JSON 백업 파일인지 확인해 주세요.')
    }
  }

  function handleClear() {
    if (tripCount === 0) return
    if (window.confirm(`저장된 쇼핑 기록 ${tripCount}개를 모두 삭제할까요? 되돌릴 수 없어요.`)) {
      clearTrips()
      setMsg('모든 기록을 삭제했어요.')
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-black/60" onClick={onClose}>
      <div
        className="safe-bottom mt-auto max-h-[88dvh] w-full overflow-y-auto overscroll-contain rounded-t-3xl bg-white"
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

          <div className="mb-4 text-lg font-bold text-slate-900">백업 / 복원</div>

          {/* 데이터 카드 */}
          <div className="mb-4 rounded-2xl p-4" style={{ background: '#FDE4D8' }}>
            <div className="text-xs font-semibold" style={{ color: '#C2410C' }}>저장된 데이터</div>
            <div className="mt-1 text-2xl font-bold tabular-nums" style={{ color: '#C2410C' }}>
              {tripCount}건의 쇼핑 기록
            </div>
          </div>

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
            className="mb-2.5 flex w-full items-center gap-3 rounded-2xl bg-white px-4 py-3.5 text-left shadow-card active:bg-slate-50"
          >
            <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl" style={{ background: '#FDE4D8', color: '#C2410C' }}>
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                <path d="M12 16V4M7 9l5-5 5 5M5 20h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="flex-1">
              <span className="block font-bold text-slate-900">기록 내보내기</span>
              <span className="block text-xs text-slate-400">백업 파일(.json)로 저장해요</span>
            </span>
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-slate-300">
              <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <button
            onClick={() => fileRef.current?.click()}
            className="flex w-full items-center gap-3 rounded-2xl bg-white px-4 py-3.5 text-left shadow-card active:bg-slate-50"
          >
            <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl" style={{ background: '#E0ECFF', color: '#2563EB' }}>
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                <path d="M12 4v12M7 11l5 5 5-5M5 20h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="flex-1">
              <span className="block font-bold text-slate-900">기록 불러오기</span>
              <span className="block text-xs text-slate-400">중복 없이 병합됩니다</span>
            </span>
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-slate-300">
              <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {msg && (
            <div className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-700">{msg}</div>
          )}
          {err && <div className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-600">{err}</div>}

          <p className="mt-4 text-xs leading-relaxed text-slate-400">
            모든 데이터는 내 기기에만 저장돼요. 서버로 보내지 않고, 회원가입도 없어요. 기기를 바꿀 때
            파일로 옮기면 안전하게 이어갈 수 있어요.
          </p>

          <button
            onClick={handleClear}
            className="mt-5 w-full py-3 text-center text-sm font-semibold text-red-500 active:text-red-600"
          >
            모든 기록 삭제
          </button>
        </div>
      </div>
    </div>
  )
}
