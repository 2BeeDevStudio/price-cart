import { useState } from 'react'
import type { Item } from '../types'
import { useCart } from '../store/cart'
import { formatWon } from '../lib/format'
import { linePaid, lineOriginal, lineSavings, freeUnits, promoBadgeClass } from '../lib/promo'
import { tileStyle, tileChar } from '../lib/tileColor'
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
  const tile = tileStyle(item.name || item.id)
  const initial = tileChar(item.name)

  return (
    <li className="flex items-center gap-3 bg-white px-3.5 py-3">
      {/* 아이콘 타일 (탭하면 편집) */}
      <button
        onClick={() => setEditing(true)}
        className="flex h-11 w-11 flex-none items-center justify-center rounded-2xl text-base font-bold active:opacity-70"
        style={{ background: tile.bg, color: tile.fg }}
        aria-label="상품 수정"
      >
        {initial || (
          <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
            <path d="M12 3l8 8-8 8-8-8V3h8z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
            <circle cx="9" cy="8" r="1.3" fill="currentColor" />
          </svg>
        )}
      </button>

      {/* 정보 (탭하면 편집) */}
      <button onClick={() => setEditing(true)} className="min-w-0 flex-1 text-left active:opacity-60">
        <div className="flex items-center gap-1.5">
          {item.promo && (
            <span className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${promoBadgeClass(item.promo)}`}>
              {item.promo}
            </span>
          )}
          {item.name && (
            <span className="truncate text-sm font-semibold text-slate-700">{item.name}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-base font-bold text-slate-900 tabular-nums">
          {formatWon(paid)}
          {savings > 0 && (
            <span className="text-xs font-normal text-slate-400 line-through">
              {formatWon(lineOriginal(item))}
            </span>
          )}
        </div>
        {(item.quantity > 1 || free > 0 || savings > 0) && (
          <div className="text-xs tabular-nums text-slate-400">
            {item.quantity > 1 && <span>{formatWon(item.price)} × {item.quantity}</span>}
            {free > 0 && <span className="text-brand"> · {free}개 무료</span>}
            {savings > 0 && free === 0 && <span className="text-brand"> · {formatWon(savings)} 절약</span>}
          </div>
        )}
      </button>

      {/* 수량 스텝퍼 */}
      <div className="flex flex-none items-center rounded-full border border-slate-200">
        <button
          aria-label="수량 감소"
          onClick={() => dec(item.id)}
          disabled={item.quantity <= 1}
          className="flex h-8 w-8 items-center justify-center rounded-full text-lg font-bold text-slate-600 active:bg-slate-100 disabled:text-slate-300"
        >
          −
        </button>
        <span className="w-6 text-center text-base font-semibold tabular-nums text-slate-800">
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

      {editing && (
        <ItemEditSheet
          item={item}
          onSave={(patch) => updateItem(item.id, patch)}
          onDelete={() => remove(item.id)}
          onClose={() => setEditing(false)}
        />
      )}
    </li>
  )
}
