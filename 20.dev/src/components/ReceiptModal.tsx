import { useRef, useState } from 'react'
import { useCart } from '../store/cart'
import { recognizeReceipt } from '../lib/receiptOcr'
import { parseReceiptItems, parseReceiptDate } from '../lib/receiptParse'
import { formatWon } from '../lib/format'
import type { Item } from '../types'

interface Row {
  id: string
  name: string
  price: string
  qty: number
}

interface ReceiptModalProps {
  onClose: () => void
  onSaved: (count: number) => void
}

let rowSeq = 0
const newRow = (name = '', price = '', qty = 1): Row => ({ id: `r${rowSeq++}`, name, price, qty })

const pad = (n: number) => String(n).padStart(2, '0')
const toDateInput = (ms: number): string => {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

type Phase = 'capture' | 'processing' | 'review'

export default function ReceiptModal({ onClose, onSaved }: ReceiptModalProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const saveReceiptTrip = useCart((s) => s.saveReceiptTrip)

  const [phase, setPhase] = useState<Phase>('capture')
  const [store, setStore] = useState('')
  const [date, setDate] = useState('') // YYYY-MM-DD
  const [rows, setRows] = useState<Row[]>([])
  const [note, setNote] = useState<string | null>(null)

  async function handleFile(file: File) {
    setPhase('processing')
    setNote(null)
    try {
      const words = await recognizeReceipt(file)
      const parsed = parseReceiptItems(words)
      const dms = parseReceiptDate(words)
      if (dms) setDate(toDateInput(dms))
      if (parsed.length === 0) {
        setRows([newRow()])
        setNote('품목을 자동으로 못 찾았어요. 직접 추가해 주세요.')
      } else {
        setRows(parsed.map((p) => newRow(p.name, String(p.price), p.quantity)))
      }
      setPhase('review')
    } catch (e) {
      console.error(e)
      setRows([newRow()])
      setNote('영수증 인식에 실패했어요 (인터넷 확인). 직접 입력할 수 있어요.')
      setPhase('review')
    }
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (f) void handleFile(f)
  }

  function updateRow(id: string, patch: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }
  function changeQty(id: string, delta: number) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, qty: Math.max(1, r.qty + delta) } : r)))
  }
  function removeRow(id: string) {
    setRows((rs) => rs.filter((r) => r.id !== id))
  }

  const parsedRows = rows
    .map((r) => ({
      name: r.name.trim(),
      price: parseInt(r.price.replace(/[^\d]/g, ''), 10),
      qty: r.qty,
    }))
    .filter((r) => Number.isFinite(r.price) && r.price > 0)
  const total = parsedRows.reduce((s, r) => s + r.price * r.qty, 0)

  function save() {
    if (parsedRows.length === 0) {
      setNote('가격이 있는 품목이 없어요.')
      return
    }
    const items: Item[] = parsedRows.map((r) => ({
      id: '',
      name: r.name || undefined,
      price: r.price,
      quantity: r.qty,
      createdAt: Date.now(),
    }))
    const dateMs = date ? new Date(`${date}T12:00:00`).getTime() : undefined
    saveReceiptTrip({ store, items, date: dateMs })
    onSaved(items.length)
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-[#f5f1ec]">
      <header className="safe-top sticky top-0 z-10 bg-[#f5f1ec]/85 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-between px-5 py-3.5">
          <button
            onClick={onClose}
            aria-label="닫기"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-600 shadow-card active:bg-slate-50"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <span className="text-lg font-bold text-slate-900">영수증 담기</span>
          {phase === 'review' ? (
            <button
              onClick={() => fileRef.current?.click()}
              className="rounded-full bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 shadow-card active:bg-slate-50"
            >
              다시 촬영
            </button>
          ) : (
            <span className="w-10" />
          )}
        </div>
      </header>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onInputChange}
      />

      <main className="mx-auto w-full max-w-md flex-1 overflow-y-auto overscroll-contain px-5 pb-28">
        {phase === 'capture' && (
          <div className="mt-8 flex flex-col items-center rounded-3xl bg-white px-6 py-12 text-center shadow-card">
            <div className="mb-3 text-5xl">🧾</div>
            <div className="mb-1 text-lg font-bold text-slate-800">영수증을 촬영하세요</div>
            <p className="mb-6 text-sm text-slate-500">
              품목과 금액이 잘 보이게, 구겨지지 않게 펴서 찍어주세요.
            </p>
            <button
              onClick={() => fileRef.current?.click()}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-brand text-lg font-bold text-white active:bg-brand-dark"
            >
              카메라 열기
            </button>
          </div>
        )}

        {phase === 'processing' && (
          <div className="mt-16 flex flex-col items-center text-center">
            <div className="text-base font-semibold text-slate-700">영수증 읽는 중…</div>
            <div className="mt-3 h-2 w-48 overflow-hidden rounded-full bg-black/5">
              <div className="h-full w-2/5 rounded-full bg-brand animate-indeterminate" />
            </div>
          </div>
        )}

        {phase === 'review' && (
          <div className="pt-4">
            <div className="mb-4 flex gap-2">
              <div className="min-w-0 flex-1">
                <label className="mb-1 block text-sm font-medium text-slate-500">마트 이름 (선택)</label>
                <input
                  type="text"
                  value={store}
                  onChange={(e) => setStore(e.target.value)}
                  placeholder="예: 우리동네마트"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 outline-none placeholder:text-slate-300 focus:border-brand"
                />
              </div>
              <div className="flex-none">
                <label className="mb-1 block text-sm font-medium text-slate-500">구매일</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-base text-slate-900 outline-none focus:border-brand"
                />
              </div>
            </div>

            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-slate-500">
                인식된 품목 {parsedRows.length}개
              </span>
              <span className="text-sm font-bold tabular-nums text-slate-800">
                합계 {formatWon(total)}
              </span>
            </div>

            {note && (
              <div className="mb-3 rounded-xl bg-amber-50 p-3 text-sm font-medium text-amber-700">
                {note}
              </div>
            )}

            <ul className="flex flex-col gap-2">
              {rows.map((r) => (
                <li key={r.id} className="rounded-2xl bg-white p-3 shadow-card">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={r.name}
                      onChange={(e) => updateRow(r.id, { name: e.target.value })}
                      placeholder="상품명"
                      className="min-w-0 flex-1 bg-transparent text-sm font-medium text-slate-800 outline-none placeholder:text-slate-300"
                    />
                    <button
                      onClick={() => removeRow(r.id)}
                      aria-label="삭제"
                      className="flex h-7 w-7 flex-none items-center justify-center rounded-full text-slate-300 active:bg-red-50 active:text-red-500"
                    >
                      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
                        <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="flex flex-none items-center rounded-full border border-slate-200">
                      <button
                        aria-label="수량 감소"
                        onClick={() => changeQty(r.id, -1)}
                        disabled={r.qty <= 1}
                        className="flex h-7 w-7 items-center justify-center rounded-full text-base font-bold text-slate-600 active:bg-slate-100 disabled:text-slate-300"
                      >
                        −
                      </button>
                      <span className="w-6 text-center text-sm font-semibold tabular-nums text-slate-800">
                        {r.qty}
                      </span>
                      <button
                        aria-label="수량 증가"
                        onClick={() => changeQty(r.id, 1)}
                        className="flex h-7 w-7 items-center justify-center rounded-full text-base font-bold text-brand active:bg-slate-100"
                      >
                        +
                      </button>
                    </div>
                    <div className="flex min-w-0 items-baseline gap-1">
                      <span className="text-xs text-slate-400">단가</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={r.price}
                        onChange={(e) => updateRow(r.id, { price: e.target.value.replace(/[^\d,]/g, '') })}
                        placeholder="0"
                        className="w-16 bg-transparent text-right text-sm font-semibold tabular-nums text-slate-600 outline-none placeholder:text-slate-300"
                      />
                      {r.qty > 1 ? (
                        <span className="whitespace-nowrap text-base font-bold tabular-nums text-slate-900">
                          ×{r.qty} = {formatWon((parseInt(r.price.replace(/[^\d]/g, ''), 10) || 0) * r.qty)}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">원</span>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <button
              onClick={() => setRows((rs) => [...rs, newRow()])}
              className="mt-3 flex w-full items-center justify-center gap-1 rounded-2xl border border-dashed border-slate-300 py-3 text-sm font-semibold text-slate-500 active:bg-white"
            >
              <span className="text-lg leading-none">＋</span> 항목 추가
            </button>
          </div>
        )}
      </main>

      {phase === 'review' && (
        <div className="safe-bottom sticky bottom-0 bg-gradient-to-t from-[#f5f1ec] via-[#f5f1ec] to-transparent px-5 pb-5 pt-6">
          <button
            onClick={save}
            className="mx-auto flex h-14 w-full max-w-md items-center justify-center gap-1 rounded-2xl bg-brand text-base font-bold text-white active:bg-brand-dark"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
              <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            기록으로 저장
          </button>
        </div>
      )}
    </div>
  )
}
