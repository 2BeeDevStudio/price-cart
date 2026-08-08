import { useState } from 'react'
import { useCart } from '../store/cart'
import { formatWon, formatDateKo } from '../lib/format'
import { budgetStyle } from '../lib/budgetColor'
import { tileStyle, tileChar } from '../lib/tileColor'
import { linePaid, lineOriginal, lineSavings, promoBadgeClass } from '../lib/promo'
import type { Item, PromoType, ShoppingTrip } from '../types'
import StorePicker from './StorePicker'
import ItemEditSheet from './ItemEditSheet'
import BackupSheet from './BackupSheet'

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
  const [backupOpen, setBackupOpen] = useState(false)

  const storeEditTrip = trips.find((t) => t.id === storeEditId) ?? null

  const now = new Date()
  const month = trips.filter((t) => {
    const d = new Date(t.date)
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  })
  const monthSaved = month.reduce((s, t) => s + (t.savings ?? 0), 0)
  const monthSpent = month.reduce((s, t) => s + t.total, 0)

  function changeQty(trip: ShoppingTrip, itemId: string, delta: number) {
    const items = trip.items.map((it) =>
      it.id === itemId ? { ...it, quantity: Math.max(1, it.quantity + delta) } : it,
    )
    updateTripItems(trip.id, items)
  }

  function removeItem(trip: ShoppingTrip, itemId: string) {
    updateTripItems(trip.id, trip.items.filter((it) => it.id !== itemId))
  }

  function saveItem(
    tripId: string,
    itemId: string,
    patch: { name: string; price: number; promo: PromoType | null; originalPrice: number | null },
  ) {
    const trip = trips.find((t) => t.id === tripId)
    if (!trip) return
    const items = trip.items.map((it) => {
      if (it.id !== itemId) return it
      const p = Math.max(0, Math.round(patch.price))
      return {
        ...it,
        name: patch.name.trim() || undefined,
        price: p,
        promo: patch.promo ?? undefined,
        originalPrice:
          patch.originalPrice != null && patch.originalPrice > p ? Math.round(patch.originalPrice) : undefined,
      }
    })
    updateTripItems(tripId, items)
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-[#f5f1ec]">
      <header className="safe-top sticky top-0 z-10 bg-[#f5f1ec]/85 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center gap-3 px-5 py-3.5">
          <button
            onClick={onClose}
            aria-label="뒤로"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-600 shadow-card active:bg-slate-50"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
              <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <span className="text-lg font-bold text-slate-900">지난 쇼핑</span>
          <button
            onClick={() => setBackupOpen(true)}
            aria-label="백업/복원"
            className="ml-auto flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-600 shadow-card active:bg-slate-50"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
              <path d="M12 16V4M7 9l5-5 5 5M5 20h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 overflow-y-auto overscroll-contain px-4 pb-6">
        {/* 이번 달 요약 */}
        <div className="mb-3 mt-1 grid grid-cols-2 gap-3">
          <div className="rounded-2xl p-4" style={{ background: '#DCF3E4' }}>
            <div className="text-xs font-semibold" style={{ color: '#15803D' }}>이번 달 절약</div>
            <div className="mt-1 text-xl font-bold tabular-nums" style={{ color: '#15803D' }}>
              {formatWon(monthSaved)}
            </div>
          </div>
          <div className="rounded-2xl p-4" style={{ background: '#FDE4D8' }}>
            <div className="text-xs font-semibold" style={{ color: '#C2410C' }}>이번 달 지출</div>
            <div className="mt-1 text-xl font-bold tabular-nums" style={{ color: '#C2410C' }}>
              {formatWon(monthSpent)}
            </div>
          </div>
        </div>

        {trips.length === 0 ? (
          <div className="mt-4 flex flex-col items-center justify-center rounded-3xl bg-white px-8 py-16 text-center shadow-card">
            <div className="mb-4 text-5xl">🧾</div>
            <div className="text-base font-bold text-slate-600">저장된 쇼핑이 없어요</div>
            <p className="mt-1 text-sm text-slate-400">상품을 담고 "쇼핑 끝"을 누르면 여기에 기록돼요.</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {trips.map((trip) => {
              const open = expanded === trip.id
              const tile = tileStyle(trip.store || trip.id)
              const bs = trip.budget != null ? budgetStyle(trip.total, trip.budget) : null
              return (
                <li key={trip.id} className="overflow-hidden rounded-2xl bg-white shadow-card">
                  <button
                    onClick={() => setExpanded(open ? null : trip.id)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-slate-50"
                  >
                    <div
                      className="flex h-11 w-11 flex-none items-center justify-center rounded-2xl text-base font-bold"
                      style={{ background: tile.bg, color: tile.fg }}
                    >
                      {tileChar(trip.store) || '🛒'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate font-bold text-slate-900">{trip.store || '마트 없음'}</span>
                        {bs && (
                          <span
                            className="flex-none rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                            style={{ background: bs.soft, color: bs.softText }}
                          >
                            {bs.label}
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 text-xs text-slate-400 tabular-nums">
                        {formatDateKo(trip.date)} · 상품 {trip.itemCount}개
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-base font-bold text-slate-900 tabular-nums">{formatWon(trip.total)}</div>
                      {trip.savings != null && trip.savings > 0 && (
                        <div className="text-xs font-semibold text-emerald-600 tabular-nums">
                          −{formatWon(trip.savings)} 절약
                        </div>
                      )}
                    </div>
                  </button>

                  {open && (
                    <div className="border-t border-slate-100 px-4 py-3">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => setStoreEditId(trip.id)}
                          className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 active:bg-slate-200"
                        >
                          🏬 {trip.store || '마트 추가'}
                        </button>
                        {trip.budget != null && (
                          <span
                            className="rounded-full px-3 py-1.5 text-xs font-semibold tabular-nums"
                            style={{ background: bs!.soft, color: bs!.softText }}
                          >
                            예산 {formatWon(trip.budget)} ·{' '}
                            {trip.total <= trip.budget
                              ? `${formatWon(trip.budget - trip.total)} 남김`
                              : `${formatWon(trip.total - trip.budget)} 초과`}
                          </span>
                        )}
                      </div>

                      <ul className="divide-y divide-slate-50">
                        {trip.items.map((it) => {
                          const itile = tileStyle(it.name || it.id)
                          return (
                            <li key={it.id} className="flex items-center gap-2.5 py-2">
                              <button
                                onClick={() => setEditing({ tripId: trip.id, item: it })}
                                className="flex h-9 w-9 flex-none items-center justify-center rounded-xl text-sm font-bold active:opacity-70"
                                style={{ background: itile.bg, color: itile.fg }}
                              >
                                {tileChar(it.name) || '·'}
                              </button>
                              <button
                                onClick={() => setEditing({ tripId: trip.id, item: it })}
                                className="min-w-0 flex-1 text-left active:opacity-60"
                              >
                                <div className="flex items-center gap-1.5">
                                  {it.promo && (
                                    <span className={`rounded px-1 py-0.5 text-[10px] font-bold ${promoBadgeClass(it.promo)}`}>
                                      {it.promo}
                                    </span>
                                  )}
                                  {it.name && <span className="truncate text-xs text-slate-500">{it.name}</span>}
                                </div>
                                <div className="flex items-center gap-1.5 text-sm font-semibold tabular-nums text-slate-700">
                                  {formatWon(linePaid(it))}
                                  {lineSavings(it) > 0 && (
                                    <span className="text-xs font-normal text-slate-400 line-through">
                                      {formatWon(lineOriginal(it))}
                                    </span>
                                  )}
                                </div>
                              </button>
                              <div className="flex flex-none items-center rounded-full border border-slate-200">
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
                            </li>
                          )
                        })}
                        {trip.items.length === 0 && (
                          <li className="py-3 text-center text-sm text-slate-400">상품이 없습니다</li>
                        )}
                      </ul>

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
          onDelete={() => {
            const trip = trips.find((t) => t.id === editing.tripId)
            if (trip) removeItem(trip, editing.item.id)
          }}
          onClose={() => setEditing(null)}
        />
      )}
      {backupOpen && <BackupSheet onClose={() => setBackupOpen(false)} />}
    </div>
  )
}
