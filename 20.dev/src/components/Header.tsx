import { useCart, selectTotal, selectCount, selectSavings } from '../store/cart'
import { formatWon } from '../lib/format'

interface HeaderProps {
  onReset: () => void
  onPickStore: () => void
  onOpenHistory: () => void
}

export default function Header({ onReset, onPickStore, onOpenHistory }: HeaderProps) {
  const total = useCart(selectTotal)
  const count = useCart(selectCount)
  const savings = useCart(selectSavings)
  const storeName = useCart((s) => s.storeName)
  const hasItems = useCart((s) => s.items.length > 0)

  return (
    <header className="safe-top sticky top-0 z-10 bg-brand text-white shadow-md">
      <div className="mx-auto max-w-md px-5 pb-6 pt-5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-white/80">오늘 쇼핑</span>
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenHistory}
              className="flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white active:bg-white/25"
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5">
                <path d="M4 5h16M4 12h16M4 19h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              기록
            </button>
            {hasItems && (
              <button
                onClick={onReset}
                className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white active:bg-white/25"
              >
                비우기
              </button>
            )}
          </div>
        </div>

        {/* 마트 선택 pill */}
        <button
          onClick={onPickStore}
          className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-sm font-medium text-white active:bg-white/25"
        >
          <span>🏬</span>
          <span>{storeName || '마트 선택'}</span>
          <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 opacity-80">
            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <div className="mt-3">
          <div className="text-xs font-medium text-white/70">총 예상 결제금액</div>
          <div className="mt-1 text-4xl font-bold tracking-tight tabular-nums">
            {formatWon(total)}
          </div>
          <div className="mt-1 flex items-center gap-2 text-sm text-white/70 tabular-nums">
            <span>상품 {count}개</span>
            {savings > 0 && (
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold text-white">
                🟢 {formatWon(savings)} 절약
              </span>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
