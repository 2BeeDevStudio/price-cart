import { useState } from 'react'
import { STORE_PRESETS } from '../store/cart'

interface StorePickerProps {
  current: string
  onSelect: (name: string) => void
  onClose: () => void
}

export default function StorePicker({ current, onSelect, onClose }: StorePickerProps) {
  const [custom, setCustom] = useState(current)

  function choose(name: string) {
    onSelect(name)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-black/60" onClick={onClose}>
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

          <div className="mb-3 text-lg font-bold text-slate-900">어느 마트인가요?</div>

          <div className="mb-4 flex flex-wrap gap-2">
            {STORE_PRESETS.map((name) => {
              const active = current === name
              return (
                <button
                  key={name}
                  onClick={() => choose(name)}
                  className={`rounded-full px-4 py-2 text-sm font-medium ${
                    active
                      ? 'bg-brand text-white'
                      : 'bg-slate-100 text-slate-700 active:bg-slate-200'
                  }`}
                >
                  {name}
                </button>
              )
            })}
          </div>

          <label className="mb-1 block text-sm font-medium text-slate-500">직접 입력</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="마트 이름"
              className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 outline-none placeholder:text-slate-300 focus:border-brand"
            />
            <button
              onClick={() => choose(custom.trim())}
              disabled={!custom.trim()}
              className="rounded-2xl bg-brand px-5 text-sm font-bold text-white active:bg-brand-dark disabled:bg-slate-200 disabled:text-slate-400"
            >
              확인
            </button>
          </div>

          {current && (
            <button
              onClick={() => choose('')}
              className="mt-4 w-full text-center text-sm font-medium text-slate-400 active:text-slate-600"
            >
              마트 없이 진행
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
