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
import ReceiptIcon from './ReceiptIcon'
import { useList } from '../store/list'
import { useFamily, isMine, authorLabel } from '../store/family'

/** 가계부 사람별 색 (나 = 브랜드 주황) */
const ME_COLOR = '#061A4C'
const FAMILY_COLORS = ['#5B8DEF', '#22A06B', '#8B5CF6', '#E0559B', '#0EA5A4']

interface Person {
  key: string
  name: string
  color: string
}

interface HistoryScreenProps {
  onClose: () => void
  /** 영수증으로 기록 추가 열기 */
  onAddReceipt: () => void
}

export default function HistoryScreen({ onClose, onAddReceipt }: HistoryScreenProps) {
  const trips = useCart((s) => s.trips)
  const removeTrip = useCart((s) => s.removeTrip)
  const setTripStore = useCart((s) => s.setTripStore)
  const updateTripItems = useCart((s) => s.updateTripItems)

  const [expanded, setExpanded] = useState<string | null>(null)
  const [storeEditId, setStoreEditId] = useState<string | null>(null)
  const [editing, setEditing] = useState<{ tripId: string; item: Item } | null>(null)
  const [backupOpen, setBackupOpen] = useState(false)
  const [filter, setFilter] = useState<string>('all')

  const shareId = useList((s) => s.shareId)
  const shareLedger = useFamily((s) => s.shareLedger)
  const deviceId = useFamily((s) => s.deviceId)
  const myName = useFamily((s) => s.myName)
  const familyOn = !!shareId && shareLedger

  // 기록한 사람 목록 (나 먼저, 가족은 처음 나온 순서)
  const personKey = (t: ShoppingTrip) => (isMine(t, deviceId) ? deviceId : t.authorId!)
  const people: Person[] = [{ key: deviceId, name: myName || '나', color: ME_COLOR }]
  if (familyOn) {
    for (const t of trips) {
      const k = personKey(t)
      if (people.some((p) => p.key === k)) continue
      people.push({ key: k, name: t.authorName || '가족', color: FAMILY_COLORS[(people.length - 1) % FAMILY_COLORS.length] })
    }
  }
  const personOf = (t: ShoppingTrip) => people.find((p) => p.key === personKey(t)) ?? people[0]

  const shownTrips = familyOn && filter !== 'all' ? trips.filter((t) => personKey(t) === filter) : trips
  const storeEditTrip = trips.find((t) => t.id === storeEditId) ?? null

  const now = new Date()
  const month = trips.filter((t) => {
    const d = new Date(t.date)
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  })
  const monthSaved = month.reduce((s, t) => s + (t.savings ?? 0), 0)
  const monthSpent = month.reduce((s, t) => s + t.total, 0)
  const monthByPerson = people
    .map((p) => ({ ...p, spent: month.filter((t) => personKey(t) === p.key).reduce((s, t) => s + t.total, 0) }))
    .filter((p) => p.spent > 0)

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
    <div className="fixed inset-0 z-40 flex flex-col bg-[#F3F5F9]">
      <header className="safe-top sticky top-0 z-10 bg-[#F3F5F9]/85 backdrop-blur">
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
          <span className="text-lg font-bold text-slate-900">{familyOn ? '가족 가계부' : '지난 쇼핑'}</span>
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
        {familyOn ? (
          <div className="mb-3 mt-1 rounded-2xl bg-white p-4 shadow-card">
            <div className="text-xs font-semibold text-slate-400">{now.getMonth() + 1}월 가족 지출</div>
            <div className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{formatWon(monthSpent)}</div>
            {monthByPerson.length > 0 && (
              <>
                <div className="mt-3 flex h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  {monthByPerson.map((p) => (
                    <div key={p.key} style={{ width: `${(p.spent / monthSpent) * 100}%`, background: p.color }} />
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                  {monthByPerson.map((p) => (
                    <span key={p.key} className="inline-flex items-center gap-1.5 text-xs text-slate-500 tabular-nums">
                      <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
                      {p.name} {formatWon(p.spent)}
                    </span>
                  ))}
                </div>
              </>
            )}
            {monthSaved > 0 && (
              <div className="mt-2 text-xs font-semibold text-emerald-600 tabular-nums">
                이번 달 행사로 {formatWon(monthSaved)} 절약
              </div>
            )}
          </div>
        ) : (
        <div className="mb-3 mt-1 grid grid-cols-2 gap-3">
          <div className="rounded-2xl p-4" style={{ background: '#DCF3E4' }}>
            <div className="text-xs font-semibold" style={{ color: '#15803D' }}>이번 달 절약</div>
            <div className="mt-1 text-xl font-bold tabular-nums" style={{ color: '#15803D' }}>
              {formatWon(monthSaved)}
            </div>
          </div>
          <div className="rounded-2xl p-4" style={{ background: '#E6EAF3' }}>
            <div className="text-xs font-semibold" style={{ color: '#061A4C' }}>이번 달 지출</div>
            <div className="mt-1 text-xl font-bold tabular-nums" style={{ color: '#061A4C' }}>
              {formatWon(monthSpent)}
            </div>
          </div>
        </div>
        )}

        <button
          onClick={onAddReceipt}
          className="mb-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-3.5 text-sm font-bold text-slate-700 shadow-card active:bg-slate-50"
        >
          <ReceiptIcon className="h-5 w-5 text-brand" />
          영수증으로 기록 추가
        </button>

        {/* 사람별로 보기 */}
        {familyOn && people.length > 1 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {[{ key: 'all', name: '전체' }, ...people].map((p) => (
              <button
                key={p.key}
                onClick={() => setFilter(p.key)}
                className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${
                  filter === p.key ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 shadow-card active:bg-slate-50'
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
        )}

        {shownTrips.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl bg-white px-8 py-16 text-center shadow-card">
            <div className="mb-4 text-5xl">🧾</div>
            <div className="text-base font-bold text-slate-600">저장된 쇼핑이 없어요</div>
            <p className="mt-1 text-sm text-slate-400">
              "쇼핑 끝"을 누르거나 영수증을 찍으면 여기에 기록돼요.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {shownTrips.map((trip) => {
              const open = expanded === trip.id
              const tile = tileStyle(trip.store || trip.id)
              const bs = trip.budget != null ? budgetStyle(trip.total, trip.budget) : null
              const mine = isMine(trip, deviceId)
              const person = personOf(trip)
              const author = authorLabel(trip, deviceId, myName)
              // 같이 장본 기록이면 함께 담은 사람 모두
              const who = trip.shoppers && trip.shoppers.length > 1 ? trip.shoppers.join(' · ') : author
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
                        {familyOn && (
                          <span
                            className="flex h-5 w-5 flex-none items-center justify-center rounded-full text-[11px] font-bold text-white"
                            style={{ background: person.color }}
                            aria-label={`${author} 기록`}
                          >
                            {author.slice(0, 1)}
                          </span>
                        )}
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
                        {(familyOn || trip.shoppers) && `${who} · `}
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
                        {mine && (
                          <button
                            onClick={() => setStoreEditId(trip.id)}
                            className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 active:bg-slate-200"
                          >
                            🏬 {trip.store || '마트 추가'}
                          </button>
                        )}
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
                                onClick={() => mine && setEditing({ tripId: trip.id, item: it })}
                                disabled={!mine}
                                className="flex h-9 w-9 flex-none items-center justify-center rounded-xl text-sm font-bold active:opacity-70"
                                style={{ background: itile.bg, color: itile.fg }}
                              >
                                {tileChar(it.name) || '·'}
                              </button>
                              <button
                                onClick={() => mine && setEditing({ tripId: trip.id, item: it })}
                                disabled={!mine}
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
                              {!mine ? (
                                <span className="flex-none text-sm font-semibold tabular-nums text-slate-500">
                                  ×{it.quantity}
                                </span>
                              ) : (
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
                              )}
                            </li>
                          )
                        })}
                        {trip.items.length === 0 && (
                          <li className="py-3 text-center text-sm text-slate-400">상품이 없습니다</li>
                        )}
                      </ul>

                      {mine ? (
                        <button
                          onClick={() => {
                            const ask = familyOn
                              ? '이 쇼핑 기록을 삭제할까요?\n가족 가계부에서도 지워져요.'
                              : '이 쇼핑 기록을 삭제할까요?'
                            if (window.confirm(ask)) removeTrip(trip.id)
                          }}
                          className="mt-2 w-full rounded-xl py-2 text-sm font-medium text-red-500 active:bg-red-50"
                        >
                          기록 전체 삭제
                        </button>
                      ) : (
                        <div className="mt-2 flex items-center gap-1.5 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
                          <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5 flex-none" aria-hidden="true">
                            <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="2" />
                            <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="2" />
                          </svg>
                          {who}님이 남긴 기록이라 보기만 할 수 있어요
                        </div>
                      )}
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
