import { useCart, selectTotal, selectCount, selectSavings } from '../store/cart'
import { formatWon } from '../lib/format'
import { budgetStyle, budgetRatio } from '../lib/budgetColor'
import { useList } from '../store/list'
import { useFamily } from '../store/family'
import { useTogether, peopleSummary } from '../store/together'
import { UsersIcon } from './TogetherBits'

interface HeaderProps {
  onReset: () => void
  onPickStore: () => void
  onOpenHistory: () => void
  onEditBudget: () => void
  onOpenTogether: () => void
}

export default function Header({ onReset, onPickStore, onOpenHistory, onEditBudget, onOpenTogether }: HeaderProps) {
  const shared = useList((s) => s.shareId != null)
  const together = useTogether((s) => s.sid != null)
  const deviceId = useFamily((s) => s.deviceId)
  const items = useCart((s) => s.items)
  const people = together ? peopleSummary(items, deviceId) : []
  const total = useCart(selectTotal)
  const count = useCart(selectCount)
  const savings = useCart(selectSavings)
  const budget = useCart((s) => s.budget)
  const storeName = useCart((s) => s.storeName)
  const hasItems = useCart((s) => s.items.length > 0)

  const bs = budget != null ? budgetStyle(total, budget) : null
  const remaining = budget != null ? budget - total : 0
  const over = remaining < 0
  const pct =
    budget != null && budget > 0 ? Math.min(100, Math.round(budgetRatio(total, budget) * 100)) : 0

  return (
    <div className="safe-top px-5 pt-5">
      {/* 상단: 마트 + 액션 */}
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
            오늘 쇼핑
          </div>
          <button
            onClick={onPickStore}
            className="mt-1 inline-flex max-w-full items-center gap-1.5 text-2xl font-bold tracking-tight text-slate-900 active:opacity-60"
          >
            <span className="truncate">{storeName || '마트 선택'}</span>
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 flex-none text-slate-300">
              <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        <div className="flex flex-none items-center gap-2">
          {hasItems && (
            <button
              onClick={onReset}
              aria-label="비우기"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-400 shadow-card active:bg-slate-50"
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                <path d="M6 7h12M9 7V5h6v2M8 7l1 12h6l1-12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
          {shared && (
            <button
              onClick={onOpenTogether}
              aria-label="같이 장보기"
              className={`flex h-10 w-10 items-center justify-center rounded-full shadow-card ${
                together ? 'bg-lime text-brand active:bg-lime-dark' : 'bg-white text-slate-600 active:bg-slate-50'
              }`}
            >
              <UsersIcon />
            </button>
          )}
          <button
            onClick={onOpenHistory}
            aria-label="지난 기록"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-600 shadow-card active:bg-slate-50"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
              <path d="M4 6h12M4 12h16M4 18h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* 히어로 카드 */}
      {/* 남색 카드: 금액은 흰색, 예산 상태는 진행바·뱃지 색으로 (여유=라임 → 임박·초과=앰버·레드) */}
      <div className="mt-4 rounded-[28px] bg-brand p-6 text-white shadow-hero">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-widest text-brand-light">
                총 예상 결제금액
              </span>
              {together && (
                <button
                  onClick={onOpenTogether}
                  className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-bold text-lime active:bg-white/20"
                >
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-lime" />
                  같이 장보는 중
                </button>
              )}
            </div>
            <div className="mt-1.5 text-[40px] font-bold leading-none tracking-tight tabular-nums">
              {formatWon(total)}
            </div>
          </div>
          {bs && (
            <span
              className="flex flex-none items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-xs font-bold transition-colors duration-500"
              style={{ color: bs.onDark }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: bs.onDark }} />
              {bs.label}
            </span>
          )}
        </div>

        <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-brand-light tabular-nums">
          <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
            <path d="M5 7h15l-1.5 8.5a2 2 0 0 1-2 1.5H8.5a2 2 0 0 1-2-1.6L5 5H3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>상품 {count}개</span>
          {people.length > 1 && (
            <span className="truncate">· {people.map((p) => `${p.label} ${p.count}`).join(' · ')}</span>
          )}
          {savings > 0 && <span className="flex-none text-lime">· {formatWon(savings)} 절약</span>}
        </div>

        {/* 예산 */}
        {bs ? (
          <>
            <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, background: bs.onDark }}
              />
            </div>
            <button
              onClick={onEditBudget}
              className="mt-2 flex w-full items-center justify-between text-xs tabular-nums active:opacity-60"
            >
              <span className="inline-flex items-center gap-1 font-semibold text-brand-light">
                예산 {formatWon(budget!)}
                <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3">
                  <path d="M4 20h4L18 10l-4-4L4 16v4zM14 6l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span className="font-bold transition-colors duration-500" style={{ color: bs.onDark }}>
                {over ? `${formatWon(-remaining)} 초과` : `앞으로 ${formatWon(remaining)}`}
              </span>
            </button>
          </>
        ) : (
          <button
            onClick={onEditBudget}
            className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-lime px-4 py-2 text-sm font-bold text-brand active:bg-lime-dark"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
              <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2" />
              <circle cx="12" cy="12" r="3" fill="currentColor" />
            </svg>
            예산 설정하기
          </button>
        )}
      </div>
    </div>
  )
}
