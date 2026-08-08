import { useState } from 'react'
import { formatWon, formatNumber } from '../lib/format'
import { budgetStyle } from '../lib/budgetColor'

interface BudgetSheetProps {
  current: number | null
  onSave: (budget: number | null) => void
  onClose: () => void
}

const PRESETS = [30000, 50000, 100000, 150000, 200000]

export default function BudgetSheet({ current, onSave, onClose }: BudgetSheetProps) {
  const [value, setValue] = useState(current != null ? String(current) : '')
  const [manual, setManual] = useState(false)

  const parsed = parseInt(value.replace(/[^\d]/g, ''), 10)
  const valid = Number.isFinite(parsed) && parsed > 0

  // 미리보기용 4단계 색
  const dots = [0.3, 0.75, 0.92, 1.15].map((r) => budgetStyle(r, 1).strong)

  function save() {
    onSave(valid ? parsed : null)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-black/60" onClick={onClose}>
      <div
        className="safe-bottom mt-auto max-h-[90dvh] w-full overflow-y-auto overscroll-contain rounded-t-3xl bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto max-w-md px-5 pb-6 pt-3">
          <div className="relative mb-2 flex items-center justify-center pt-1">
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

          {/* 큰 숫자 */}
          <div className="py-4 text-center">
            <div className="text-sm font-medium text-slate-400">오늘의 예산</div>
            <div className="mt-1 text-4xl font-bold tabular-nums text-slate-900">
              {valid ? formatWon(parsed) : <span className="text-slate-300">0원</span>}
            </div>
            <div className="mt-1 text-xs text-slate-400">초과하면 카드가 빨갛게 물들어요</div>
          </div>

          {/* 빠르게 선택 */}
          <div className="mb-1 text-sm font-medium text-slate-500">빠르게 선택</div>
          <div className="grid grid-cols-3 gap-2">
            {PRESETS.map((amt) => {
              const active = !manual && parsed === amt
              return (
                <button
                  key={amt}
                  onClick={() => {
                    setManual(false)
                    setValue(String(amt))
                  }}
                  className={`rounded-2xl py-3 text-sm font-bold tabular-nums ${
                    active ? 'bg-brand text-white' : 'bg-slate-100 text-slate-700 active:bg-slate-200'
                  }`}
                >
                  {formatNumber(amt / 10000)}만원
                </button>
              )
            })}
            <button
              onClick={() => setManual(true)}
              className={`flex items-center justify-center gap-1 rounded-2xl py-3 text-sm font-bold ${
                manual ? 'bg-brand text-white' : 'bg-slate-100 text-slate-700 active:bg-slate-200'
              }`}
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
                <path d="M4 20h4L18 10l-4-4L4 16v4zM14 6l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              직접 입력
            </button>
          </div>

          {manual && (
            <div className="mt-2 flex items-center rounded-2xl border-2 border-brand bg-white px-4 py-3">
              <input
                type="text"
                inputMode="numeric"
                autoFocus
                value={value}
                onChange={(e) => setValue(e.target.value.replace(/[^\d,]/g, ''))}
                placeholder="0"
                className="w-full bg-transparent text-2xl font-bold tabular-nums text-slate-900 outline-none"
              />
              <span className="ml-2 text-xl font-bold text-slate-400">원</span>
            </div>
          )}

          {/* 미리보기 */}
          <div className="mt-5 rounded-2xl bg-slate-50 p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">사용률에 따라</span>
              <div className="flex gap-1.5">
                {dots.map((c, i) => (
                  <span key={i} className="h-3 w-3 rounded-full" style={{ background: c }} />
                ))}
              </div>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-black/5">
              <div className="h-full w-2/5 rounded-full" style={{ background: dots[0] }} />
            </div>
          </div>

          <button
            onClick={save}
            className="mt-5 h-14 w-full rounded-2xl bg-brand text-base font-bold text-white active:bg-brand-dark"
          >
            예산 저장하기
          </button>
          {current != null && (
            <button
              onClick={() => {
                onSave(null)
                onClose()
              }}
              className="mt-2 w-full py-2 text-sm font-medium text-slate-400 active:text-slate-600"
            >
              예산 해제
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
