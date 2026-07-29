import { useState } from 'react'
import { useCart } from '../store/cart'
import { formatWon, formatDateKo } from '../lib/format'

interface HistoryScreenProps {
  onClose: () => void
}

export default function HistoryScreen({ onClose }: HistoryScreenProps) {
  const trips = useCart((s) => s.trips)
  const removeTrip = useCart((s) => s.removeTrip)
  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-slate-100">
      {/* 헤더 */}
      <header className="safe-top sticky top-0 z-10 bg-brand text-white shadow-md">
        <div className="mx-auto flex max-w-md items-center gap-2 px-4 py-4">
          <button
            onClick={onClose}
            aria-label="뒤로"
            className="flex h-9 w-9 items-center justify-center rounded-full active:bg-white/15"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
              <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <span className="text-lg font-bold">지난 쇼핑 기록</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 overflow-y-auto overscroll-contain p-4">
        {trips.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="mb-4 text-5xl">🧾</div>
            <div className="text-base font-semibold text-slate-500">저장된 쇼핑이 없어요</div>
            <p className="mt-1 text-sm text-slate-400">
              상품을 담고 "쇼핑 끝"을 누르면 여기에 기록돼요.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {trips.map((trip) => {
              const open = expanded === trip.id
              return (
                <li key={trip.id} className="overflow-hidden rounded-2xl bg-white shadow-sm">
                  <button
                    onClick={() => setExpanded(open ? null : trip.id)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-slate-50"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">
                          {formatDateKo(trip.date)}
                        </span>
                        {trip.store && (
                          <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">
                            {trip.store}
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 text-xs text-slate-400 tabular-nums">
                        상품 {trip.itemCount}개
                      </div>
                    </div>
                    <div className="text-lg font-bold text-slate-900 tabular-nums">
                      {formatWon(trip.total)}
                    </div>
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      className={`h-5 w-5 text-slate-300 transition-transform ${open ? 'rotate-180' : ''}`}
                    >
                      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>

                  {open && (
                    <div className="border-t border-slate-100 px-4 py-2">
                      <ul className="divide-y divide-slate-50">
                        {trip.items.map((it) => (
                          <li key={it.id} className="flex items-center justify-between py-2 text-sm">
                            <span className="min-w-0 flex-1 truncate text-slate-600">
                              {it.name || '상품'}
                              {it.quantity > 1 && (
                                <span className="text-slate-400"> × {it.quantity}</span>
                              )}
                            </span>
                            <span className="ml-3 font-medium tabular-nums text-slate-700">
                              {formatWon(it.price * it.quantity)}
                            </span>
                          </li>
                        ))}
                      </ul>
                      <button
                        onClick={() => {
                          if (window.confirm('이 쇼핑 기록을 삭제할까요?')) removeTrip(trip.id)
                        }}
                        className="mt-2 w-full rounded-xl py-2 text-sm font-medium text-red-500 active:bg-red-50"
                      >
                        기록 삭제
                      </button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </main>
    </div>
  )
}
