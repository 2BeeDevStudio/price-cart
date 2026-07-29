import { useState } from 'react'
import { useCart } from '../store/cart'
import { formatWon, formatDateKo } from '../lib/format'
import type { Item, ShoppingTrip } from '../types'
import StorePicker from './StorePicker'
import ItemEditSheet from './ItemEditSheet'

interface HistoryScreenProps {
  onClose: () => void
}

export default function HistoryScreen({ onClose }: HistoryScreenProps) {
  const trips = useCart((s) => s.trips)
  const removeTrip = useCart((s) => s.removeTrip)
  const setTripStore = useCart((s) => s.setTripStore)
  const updateTripItems = useCart((s) => s.updateTripItems)

  const [expanded, setExpanded] = useState<string | null>(null)
  const [storeEditId, setStoreEditId] = useState<string | null>(null)
  const [editing, setEditing] = useState<{ tripId: string; item: Item } | null>(null)

  const storeEditTrip = trips.find((t) => t.id === storeEditId) ?? null

  function saveItem(tripId: string, itemId: string, patch: { name: string; price: number }) {
    const trip = trips.find((t) => t.id === tripId)
    if (!trip) return
    const items = trip.items.map((it) =>
      it.id === itemId
        ? { ...it, name: patch.name.trim() || undefined, price: Math.max(0, Math.round(patch.price)) }
        : it,
    )
    updateTripItems(tripId, items)
  }

  function changeQty(trip: ShoppingTrip, itemId: string, delta: number) {
    const items = trip.items.map((it) =>
      it.id === itemId ? { ...it, quantity: Math.max(1, it.quantity + delta) } : it,
    )
    updateTripItems(trip.id, items)
  }

  function removeItem(trip: ShoppingTrip, itemId: string) {
    const items: Item[] = trip.items.filter((it) => it.id !== itemId)
    updateTripItems(trip.id, items)
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-slate-100">
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
                        {trip.store ? (
                          <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">
                            {trip.store}
                          </span>
                        ) : (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-400">
                            마트 없음
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
                    <div className="border-t border-slate-100 px-4 py-3">
                      {/* 마트 수정 */}
                      <button
                        onClick={() => setStoreEditId(trip.id)}
                        className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-600 active:bg-slate-200"
                      >
                        🏬 {trip.store || '마트 추가'}
                        <span className="text-xs text-slate-400">수정</span>
                      </button>

                      {/* 상품 목록 (수량 ±, 삭제) */}
                      <ul className="divide-y divide-slate-50">
                        {trip.items.map((it) => (
                          <li key={it.id} className="flex items-center gap-2 py-2">
                            <button
                              onClick={() => setEditing({ tripId: trip.id, item: it })}
                              className="min-w-0 flex-1 text-left active:opacity-60"
                            >
                              {it.name && (
                                <div className="truncate text-xs text-slate-400">{it.name}</div>
                              )}
                              <div className="flex items-center gap-1 text-sm font-medium tabular-nums text-slate-700">
                                {formatWon(it.price * it.quantity)}
                                {it.quantity > 1 && (
                                  <span className="text-xs font-normal text-slate-400">
                                    ({formatWon(it.price)}×{it.quantity})
                                  </span>
                                )}
                                <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3 text-slate-300">
                                  <path d="M4 20h4L18 10l-4-4L4 16v4zM14 6l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              </div>
                            </button>
                            <div className="flex items-center rounded-full border border-slate-200">
                              <button
                                aria-label="수량 감소"
                                onClick={() => changeQty(trip, it.id, -1)}
                                disabled={it.quantity <= 1}
                                className="flex h-7 w-7 items-center justify-center rounded-full text-base font-bold text-slate-600 active:bg-slate-100 disabled:text-slate-300"
                              >
                                −
                              </button>
                              <span className="w-6 text-center text-sm font-semibold tabular-nums text-slate-800">
                                {it.quantity}
                              </span>
                              <button
                                aria-label="수량 증가"
                                onClick={() => changeQty(trip, it.id, 1)}
                                className="flex h-7 w-7 items-center justify-center rounded-full text-base font-bold text-brand active:bg-slate-100"
                              >
                                +
                              </button>
                            </div>
                            <button
                              aria-label="상품 삭제"
                              onClick={() => removeItem(trip, it.id)}
                              className="flex h-7 w-7 items-center justify-center rounded-full text-slate-300 active:bg-red-50 active:text-red-500"
                            >
                              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                                <path fillRule="evenodd" d="M8.75 1a1 1 0 0 0-.96.71L7.42 3H4a1 1 0 0 0 0 2h.09l.76 10.66A2.5 2.5 0 0 0 7.34 18h5.32a2.5 2.5 0 0 0 2.49-2.34L15.91 5H16a1 1 0 1 0 0-2h-3.42l-.37-1.29A1 1 0 0 0 11.25 1h-2.5Z" clipRule="evenodd" />
                              </svg>
                            </button>
                          </li>
                        ))}
                        {trip.items.length === 0 && (
                          <li className="py-3 text-center text-sm text-slate-400">
                            상품이 없습니다
                          </li>
                        )}
                      </ul>

                      <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2">
                        <span className="text-sm font-medium text-slate-500">합계</span>
                        <span className="text-base font-bold tabular-nums text-slate-900">
                          {formatWon(trip.total)}
                        </span>
                      </div>

                      <button
                        onClick={() => {
                          if (window.confirm('이 쇼핑 기록을 삭제할까요?')) removeTrip(trip.id)
                        }}
                        className="mt-2 w-full rounded-xl py-2 text-sm font-medium text-red-500 active:bg-red-50"
                      >
                        기록 전체 삭제
                      </button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </main>

      {storeEditTrip && (
        <StorePicker
          current={storeEditTrip.store ?? ''}
          onSelect={(name) => setTripStore(storeEditTrip.id, name)}
          onClose={() => setStoreEditId(null)}
        />
      )}

      {editing && (
        <ItemEditSheet
          item={editing.item}
          onSave={(patch) => saveItem(editing.tripId, editing.item.id, patch)}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
