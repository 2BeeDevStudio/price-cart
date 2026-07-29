import type { Item } from '../types'
import { useCart } from '../store/cart'
import { formatWon, formatNumber } from '../lib/format'

interface ItemRowProps {
  item: Item
}

export default function ItemRow({ item }: ItemRowProps) {
  const inc = useCart((s) => s.incQuantity)
  const dec = useCart((s) => s.decQuantity)
  const remove = useCart((s) => s.removeItem)

  const lineTotal = item.price * item.quantity

  return (
    <li className="flex items-center gap-3 bg-white px-4 py-3">
      <div className="min-w-0 flex-1">
        {item.name && (
          <div className="truncate text-sm font-medium text-slate-500">{item.name}</div>
        )}
        <div className="text-lg font-semibold text-slate-900 tabular-nums">
          {formatWon(item.price)}
        </div>
        {item.quantity > 1 && (
          <div className="text-xs text-slate-400 tabular-nums">
            {formatNumber(item.price)} × {item.quantity} = {formatWon(lineTotal)}
          </div>
        )}
      </div>

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
    </li>
  )
}
