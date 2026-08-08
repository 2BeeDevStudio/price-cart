import { useEffect, useState } from 'react'
import { useCart } from './store/cart'
import { formatDateKo } from './lib/format'
import type { PromoType } from './types'
import Header from './components/Header'
import ItemRow from './components/ItemRow'
import ScanModal from './components/ScanModal'
import ReceiptModal from './components/ReceiptModal'
import StorePicker from './components/StorePicker'
import BudgetSheet from './components/BudgetSheet'
import HistoryScreen from './components/HistoryScreen'

export default function App() {
  const items = useCart((s) => s.items)
  const storeName = useCart((s) => s.storeName)
  const addItem = useCart((s) => s.addItem)
  const clearAll = useCart((s) => s.clearAll)
  const setStore = useCart((s) => s.setStore)
  const budget = useCart((s) => s.budget)
  const setBudget = useCart((s) => s.setBudget)
  const finishShopping = useCart((s) => s.finishShopping)

  const [scanning, setScanning] = useState(false)
  const [receiptOpen, setReceiptOpen] = useState(false)
  const [pickingStore, setPickingStore] = useState(false)
  const [budgetOpen, setBudgetOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2500)
    return () => clearTimeout(t)
  }, [toast])

  function handleConfirm(
    price: number,
    name: string,
    promo: PromoType | null,
    originalPrice: number | null,
  ) {
    addItem(price, name, promo ?? undefined, originalPrice ?? undefined)
    setScanning(false)
  }

  function handleReset() {
    if (window.confirm('저장하지 않고 목록을 모두 비울까요?')) clearAll()
  }

  function handleFinish() {
    const label = `${formatDateKo(Date.now())}${storeName ? ` (${storeName})` : ''}`
    if (!window.confirm(`${label} 쇼핑을 기록에 저장할까요?`)) return
    const trip = finishShopping()
    if (trip) setToast('쇼핑이 저장됐어요 · 기록에서 확인')
  }

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col">
      <Header
        onReset={handleReset}
        onPickStore={() => setPickingStore(true)}
        onOpenHistory={() => setHistoryOpen(true)}
        onEditBudget={() => setBudgetOpen(true)}
      />

      <main className="flex-1 px-5 pb-44 pt-5">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl bg-white px-8 py-20 text-center shadow-card">
            <div className="mb-4 text-5xl">🛒</div>
            <div className="text-base font-bold text-slate-600">담은 상품이 없어요</div>
            <p className="mt-1 text-sm text-slate-400">
              아래 버튼을 눌러 가격표를 촬영해 보세요.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-3xl bg-white shadow-card">
            {items.map((item) => (
              <ItemRow key={item.id} item={item} />
            ))}
          </ul>
        )}
      </main>

      {/* 하단 고정 버튼 */}
      <div className="safe-bottom fixed inset-x-0 bottom-0 z-20">
        <div className="mx-auto max-w-md bg-gradient-to-t from-[#f5f1ec] via-[#f5f1ec] to-transparent px-5 pb-5 pt-10">
          {items.length > 0 && (
            <button
              onClick={handleFinish}
              className="mb-2.5 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white text-base font-bold text-slate-700 shadow-card active:bg-slate-50"
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-brand">
                <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              쇼핑 끝 · 기록 저장
            </button>
          )}
          <button
            onClick={() => setScanning(true)}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-brand text-lg font-bold text-white shadow-hero active:bg-brand-dark"
          >
            <span className="text-2xl leading-none">＋</span>
            상품 추가
          </button>
          <button
            onClick={() => setReceiptOpen(true)}
            className="mx-auto mt-2 flex items-center gap-1.5 text-sm font-semibold text-slate-500 active:text-slate-700"
          >
            🧾 영수증으로 기록 담기
          </button>
        </div>
      </div>

      {/* 토스트 */}
      {toast && (
        <div className="safe-bottom fixed inset-x-0 bottom-24 z-30 flex justify-center px-5">
          <div className="rounded-full bg-slate-900/90 px-4 py-2 text-sm font-medium text-white shadow-lg">
            {toast}
          </div>
        </div>
      )}

      {scanning && (
        <ScanModal onClose={() => setScanning(false)} onConfirm={handleConfirm} />
      )}
      {receiptOpen && (
        <ReceiptModal
          onClose={() => setReceiptOpen(false)}
          onSaved={(count) => {
            setReceiptOpen(false)
            setToast(`영수증 ${count}개 품목을 기록에 저장했어요`)
          }}
        />
      )}
      {pickingStore && (
        <StorePicker
          current={storeName}
          onSelect={setStore}
          onClose={() => setPickingStore(false)}
        />
      )}
      {budgetOpen && (
        <BudgetSheet
          current={budget}
          onSave={setBudget}
          onClose={() => setBudgetOpen(false)}
        />
      )}
      {historyOpen && <HistoryScreen onClose={() => setHistoryOpen(false)} />}
    </div>
  )
}
