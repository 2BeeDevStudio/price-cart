import { useState } from 'react'
import type { Item, PromoType } from '../types'
import { formatWon } from '../lib/format'
import { PROMO_OPTIONS } from '../lib/promo'

interface ItemEditSheetProps {
  item: Item
  onSave: (patch: {
    name: string
    price: number
    promo: PromoType | null
    originalPrice: number | null
  }) => void
  onDelete?: () => void
  onClose: () => void
}

export default function ItemEditSheet({ item, onSave, onDelete, onClose }: ItemEditSheetProps) {
  const [name, setName] = useState(item.name ?? '')
  const [price, setPrice] = useState(String(item.price))
  const [promo, setPromo] = useState<PromoType | null>(item.promo ?? null)
  const [showDiscount, setShowDiscount] = useState(item.originalPrice != null)
  const [original, setOriginal] = useState(item.originalPrice != null ? String(item.originalPrice) : '')
  const [error, setError] = useState<string | null>(null)

  const parsed = parseInt(price.replace(/[^\d]/g, ''), 10)
  const preview = Number.isFinite(parsed) && parsed > 0 ? formatWon(parsed) : null

  const parsedOriginal = parseInt(original.replace(/[^\d]/g, ''), 10)
  const originalValid =
    showDiscount && Number.isFinite(parsedOriginal) && parsedOriginal > (parsed || 0)
  const discountSavings = originalValid ? parsedOriginal - parsed : 0

  function save() {
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError('올바른 가격을 입력해 주세요.')
      return
    }
    onSave({ name, price: parsed, promo, originalPrice: originalValid ? parsedOriginal : null })
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

          {/* 할인 (정가 입력) */}
          <button
            onClick={() => setShowDiscount((v) => !v)}
            className={`mt-4 inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold ${
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
              {discountSavings > 0 && (
                <div className="mt-1 text-right text-sm font-semibold text-brand tabular-nums">
                  {formatWon(discountSavings)} 절약
                </div>
              )}
            </div>
          )}

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

          {onDelete && (
            <button
              onClick={() => {
                onDelete()
                onClose()
              }}
              className="mt-3 w-full rounded-2xl py-3 text-sm font-semibold text-red-500 active:bg-red-50"
            >
              상품 삭제
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
