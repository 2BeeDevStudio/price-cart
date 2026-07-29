import { useState } from 'react'
import type { Item } from '../types'
import { useCart } from '../store/cart'
import { formatWon, formatNumber } from '../lib/format'
import { linePaid, lineOriginal, lineSavings, freeUnits, promoBadgeClass } from '../lib/promo'
import ItemEditSheet from './ItemEditSheet'

interface ItemRowProps {
  item: Item
}

export default function ItemRow({ item }: ItemRowProps) {
  const inc = useCart((s) => s.incQuantity)
  const dec = useCart((s) => s.decQuantity)
  const remove = useCart((s) => s.removeItem)
  const updateItem = useCart((s) => s.updateItem)
  const [editing, setEditing] = useState(false)

  const paid = linePaid(item)
  const savings = lineSavings(item)
  const free = freeUnits(item.quantity, item.promo)

  return (
    <li className="flex items-center gap-3 bg-white px-4 py-3">
      {/* 탭하면 상품명/가격/행사 수정 */}
      <button
        onClick={() => setEditing(true)}
        className="min-w-0 flex-1 text-left active:opacity-60"
      >
        <div className="flex items-center gap-1.5">
          {item.name && (
            <span className="truncate text-sm font-medium text-slate-500">{item.name}</span>
          )}
          {item.promo && (
            <span className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${promoBadgeClass(item.promo)}`}>
              {item.promo}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-lg font-semibold text-slate-900 tabular-nums">
          {formatWon(paid)}
          {savings > 0 && (
            <span className="text-sm font-normal text-slate-400 line-through">
              {formatWon(lineOriginal(item))}
            </span>
          )}
          <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5 text-slate-300">
            <path d="M4 20h4L18 10l-4-4L4 16v4zM14 6l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="text-xs tabular-nums text-slate-400">
          {item.quantity > 1 && <span>{formatNumber(item.price)} × {item.quantity}</span>}
          {free > 0 && <span className="text-emerald-600"> · {free}개 무료</span>}
          {savings > 0 && <span className="text-emerald-600"> · {formatWon(savings)} 절약</span>}
        </div>
      </button>

      {/* 수량 스텝퍼 */}
      <div className="flex items-center rounded-full border border-slate-200">
        <button
          aria-label="수량 감소"
          onClick={() => dec(item.id)}
          disabled={item.quantity <= 1}
          className="flex h-8 w-8 items-center justify-center rounded-full text-lg font-bold text-slate-600 active:bg-slate-100 disabled:text-slate-300"
        >
          −
        </button>
        <span className="w-7 text-center text-base font-semibold tabular-nums text-slate-800">
          {item.quantity}
        </span>
        <button
          aria-label="수량 증가"
          onClick={() => inc(item.id)}
          className="flex h-8 w-8 items-center justify-center rounded-full text-lg font-bold text-brand active:bg-slate-100"
        >
          +
        </button>
      </div>

      {/* 삭제 */}
      <button
        aria-label="삭제"
        onClick={() => remove(item.id)}
        className="flex h-8 w-8 items-center justify-center rounded-full text-slate-300 active:bg-red-50 active:text-red-500"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
          <path
            fillRule="evenodd"
            d="M8.75 1a1 1 0 0 0-.96.71L7.42 3H4a1 1 0 0 0 0 2h.09l.76 10.66A2.5 2.5 0 0 0 7.34 18h5.32a2.5 2.5 0 0 0 2.49-2.34L15.91 5H16a1 1 0 1 0 0-2h-3.42l-.37-1.29A1 1 0 0 0 11.25 1h-2.5ZM9 7a.75.75 0 0 1 .75.75v5a.75.75 0 0 1-1.5 0v-5A.75.75 0 0 1 9 7Zm3 .75a.75.75 0 0 0-1.5 0v5a.75.75 0 0 0 1.5 0v-5Z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {editing && (
        <ItemEditSheet
          item={item}
          onSave={(patch) => updateItem(item.id, patch)}
          onClose={() => setEditing(false)}
        />
      )}
    </li>
  )
}
