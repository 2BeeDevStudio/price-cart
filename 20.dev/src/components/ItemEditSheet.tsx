import { useState } from 'react'
import type { Item, PromoType } from '../types'
import { formatWon } from '../lib/format'
import { PROMO_OPTIONS } from '../lib/promo'

interface ItemEditSheetProps {
  item: Item
  onSave: (patch: { name: string; price: number; promo: PromoType | null }) => void
  onClose: () => void
}

export default function ItemEditSheet({ item, onSave, onClose }: ItemEditSheetProps) {
  const [name, setName] = useState(item.name ?? '')
  const [price, setPrice] = useState(String(item.price))
  const [promo, setPromo] = useState<PromoType | null>(item.promo ?? null)
  const [error, setError] = useState<string | null>(null)

  const parsed = parseInt(price.replace(/[^\d]/g, ''), 10)
  const preview = Number.isFinite(parsed) && parsed > 0 ? formatWon(parsed) : null

  function save() {
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError('올바른 가격을 입력해 주세요.')
      return
    }
    onSave({ name, price: parsed, promo })
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

          <div className="mb-4 text-lg font-bold text-slate-900">상품 수정</div>

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

          <label className="mb-1 block text-sm font-medium text-slate-500">가격</label>
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
              className="w-full bg-transparent text-2xl font-bold tabular-nums text-slate-900 outline-none"
            />
            <span className="ml-2 text-xl font-bold text-slate-400">원</span>
          </div>
          {preview && (
            <div className="mt-1 text-right text-sm text-slate-400 tabular-nums">{preview}</div>
          )}
          {error && <div className="mt-2 text-sm text-red-500">{error}</div>}

          <label className="mb-1 mt-4 block text-sm font-medium text-slate-500">행사</label>
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

          <div className="mt-5 flex gap-3">
            <button
              onClick={onClose}
              className="h-14 flex-1 rounded-2xl border border-slate-200 text-base font-semibold text-slate-600 active:bg-slate-50"
            >
              취소
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
