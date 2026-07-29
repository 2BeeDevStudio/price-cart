import { useCart, selectTotal, selectCount } from '../store/cart'
import { formatWon } from '../lib/format'

interface HeaderProps {
  onReset: () => void
}

export default function Header({ onReset }: HeaderProps) {
  const total = useCart(selectTotal)
  const count = useCart(selectCount)
  const hasItems = useCart((s) => s.items.length > 0)

  return (
    <header className="safe-top sticky top-0 z-10 bg-brand text-white shadow-md">
      <div className="mx-auto max-w-md px-5 pb-6 pt-5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-white/80">오늘 쇼핑</span>
          {hasItems && (
            <button
              onClick={onReset}
              className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white active:bg-white/25"
            >
              전체 비우기
            </button>
          )}
        </div>

        <div className="mt-3">
          <div className="text-xs font-medium text-white/70">총 예상 결제금액</div>
          <div className="mt-1 text-4xl font-bold tracking-tight tabular-nums">
            {formatWon(total)}
          </div>
          <div className="mt-1 text-sm text-white/70 tabular-nums">
            상품 {count}개
          </div>
        </div>
      </div>
    </header>
  )
}
