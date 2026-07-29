import { useState } from 'react'
import { formatWon, formatNumber } from '../lib/format'

interface BudgetSheetProps {
  current: number | null
  onSave: (budget: number | null) => void
  onClose: () => void
}

const PRESETS = [30000, 50000, 100000, 150000, 200000]

export default function BudgetSheet({ current, onSave, onClose }: BudgetSheetProps) {
  const [value, setValue] = useState(current != null ? String(current) : '')

  const parsed = parseInt(value.replace(/[^\d]/g, ''), 10)
  const valid = Number.isFinite(parsed) && parsed > 0
  const preview = valid ? formatWon(parsed) : null

  function save() {
    onSave(valid ? parsed : null)
    onClose()
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

          <div className="mb-1 text-lg font-bold text-slate-900">오늘 예산</div>
          <p className="mb-4 text-sm text-slate-500">이 금액 안에서 담아볼까요?</p>

          <div className="mb-4 flex flex-wrap gap-2">
            {PRESETS.map((amt) => {
              const active = parsed === amt
              return (
                <button
                  key={amt}
                  onClick={() => setValue(String(amt))}
                  className={`rounded-full px-4 py-2 text-sm font-semibold tabular-nums ${
                    active ? 'bg-brand text-white' : 'bg-slate-100 text-slate-700 active:bg-slate-200'
                  }`}
                >
                  {formatNumber(amt)}
                </button>
              )
            })}
          </div>

          <label className="mb-1 block text-sm font-medium text-slate-500">직접 입력</label>
          <div className="flex items-center rounded-2xl border-2 border-brand bg-white px-4 py-3">
            <input
              type="text"
              inputMode="numeric"
              value={value}
              onChange={(e) => setValue(e.target.value.replace(/[^\d,]/g, ''))}
              placeholder="0"
              className="w-full bg-transparent text-2xl font-bold tabular-nums text-slate-900 outline-none"
            />
            <span className="ml-2 text-xl font-bold text-slate-400">원</span>
          </div>
          {preview && (
            <div className="mt-1 text-right text-sm text-slate-400 tabular-nums">{preview}</div>
          )}

          <div className="mt-5 flex gap-3">
            <button
              onClick={() => {
                onSave(null)
                onClose()
              }}
              className="h-14 flex-1 rounded-2xl border border-slate-200 text-base font-semibold text-slate-600 active:bg-slate-50"
            >
              예산 해제
            </button>
            <button
              onClick={save}
              className="h-14 flex-[1.4] rounded-2xl bg-brand text-base font-bold text-white active:bg-brand-dark"
            >
              저장
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
