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
    <div className="safe-top px-5 pt-5">
      {/* 상단 라벨 + 액션 */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
            오늘 쇼핑
          </div>
          <button
            onClick={onPickStore}
            className="mt-1 inline-flex items-center gap-1.5 text-2xl font-bold tracking-tight text-slate-900 active:opacity-60"
          >
            <span>{storeName || '마트 선택'}</span>
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-slate-300">
              <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        <div className="flex items-center gap-2">
          {hasItems && (
            <button
              onClick={onReset}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-400 shadow-card active:bg-slate-50"
              aria-label="비우기"
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                <path d="M6 7h12M9 7V5h6v2M8 7l1 12h6l1-12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
          <button
            onClick={onOpenHistory}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-600 shadow-card active:bg-slate-50"
            aria-label="지난 기록"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
              <path d="M4 6h12M4 12h16M4 18h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* 다크 히어로 카드 */}
      <div className="relative mt-4 overflow-hidden rounded-[28px] bg-ink px-6 py-6 text-white shadow-hero">
        <div className="pointer-events-none absolute -right-10 -top-12 h-44 w-44 rounded-full bg-brand/40 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-brand/10 blur-3xl" />
        <div className="relative">
          <div className="text-[11px] font-bold uppercase tracking-widest text-white/45">
            총 예상 결제금액
          </div>
          <div className="mt-2 text-[40px] font-bold leading-none tracking-tight tabular-nums">
            {formatWon(total)}
          </div>
          <div className="mt-4 flex items-center gap-2">
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/80 tabular-nums">
              상품 {count}개
            </span>
            {savings > 0 && (
              <span className="rounded-full bg-brand/25 px-3 py-1 text-xs font-semibold text-brand-light tabular-nums">
                {formatWon(savings)} 절약
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
