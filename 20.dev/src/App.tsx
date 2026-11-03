import { useEffect, useRef, useState } from 'react'
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
import ShoppingList from './components/ShoppingList'
import ReceiptIcon from './components/ReceiptIcon'
import { useList, visibleItems } from './store/list'
import { startListSync, parseShareInput, joinShare, errorText } from './lib/listSync'

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
  // 홈 버튼으로 바로 찍은 사진 (null이면 직접 입력)
  const [scanFile, setScanFile] = useState<File | null>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const [receiptOpen, setReceiptOpen] = useState(false)
  const [pickingStore, setPickingStore] = useState(false)
  const [budgetOpen, setBudgetOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  // 가족 공유 장볼 목록 동기화
  useEffect(() => startListSync(), [])

  // 공유 링크(?list=...)로 열면 참여
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const raw = params.get('list')
    if (!raw) return
    params.delete('list')
    const rest = params.toString()
    history.replaceState(null, '', location.pathname + (rest ? `?${rest}` : '') + location.hash)

    const id = parseShareInput(raw)
    if (!id) return setToast('올바른 공유 링크가 아니에요')
    const st = useList.getState()
    if (st.shareId === id) return setToast('이미 가족 목록에 연결돼 있어요')
    const n = visibleItems(st.items).length
    const ask = st.shareId
      ? '다른 가족 목록으로 바꿀까요?\n지금 공유 중인 목록과는 연결이 끊겨요.'
      : n > 0
        ? `가족 장볼 목록에 참여할까요?\n지금 내 목록 ${n}개도 함께 합쳐져요.`
        : null
    if (ask && !window.confirm(ask)) return
    joinShare(id)
      .then(() => setToast('가족과 연결됐어요 · 가계부는 장볼 목록의 공유 버튼에서 켜요'))
      .catch((e) => setToast(errorText(e)))
  }, [])

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
    checkedText?: string,
  ) {
    addItem(price, name, promo ?? undefined, originalPrice ?? undefined)
    closeScan()
    if (checkedText) setToast(`장볼 목록의 '${checkedText}' 체크했어요`)
  }

  function closeScan() {
    setScanning(false)
    setScanFile(null)
  }

  function onCameraPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // 같은 사진 다시 골라도 감지
    if (!file) return // 카메라에서 취소하면 아무 일 없음
    setScanFile(file)
    setScanning(true)
  }

  function openManual() {
    setScanFile(null)
    setScanning(true)
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
        <ShoppingList />
        {items.length === 0 ? (
          <>
            <div className="flex flex-col items-center justify-center rounded-3xl bg-white px-8 py-14 text-center shadow-card">
              <div className="mb-4 text-5xl">🛒</div>
              <div className="text-base font-bold text-slate-600">담은 상품이 없어요</div>
              <p className="mt-1 text-sm text-slate-400">
                아래 버튼을 눌러 가격표를 촬영해 보세요.
              </p>
            </div>
            {/* 장보고 온 뒤: 영수증으로 기록 남기기 (카트가 빌 때만) */}
            <button
              onClick={() => setReceiptOpen(true)}
              className="mt-3 flex w-full items-center gap-3 rounded-3xl bg-white px-5 py-4 text-left shadow-card active:bg-slate-50"
            >
              <span className="flex h-10 w-10 flex-none items-center justify-center rounded-2xl bg-brand/10 text-brand">
                <ReceiptIcon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-slate-800">이미 장보고 왔어요?</span>
                <span className="block text-xs text-slate-400">영수증 찍어서 기록 남기기</span>
              </span>
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 flex-none text-slate-300">
                <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </>
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
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={onCameraPicked}
          />
          <div className="flex gap-2">
            <button
              onClick={openManual}
              className="flex h-14 flex-none flex-col items-center justify-center rounded-2xl bg-white px-4 text-slate-700 shadow-card active:bg-slate-50"
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                <path d="M4 20h4L19 9l-4-4L4 16v4Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
              </svg>
              <span className="mt-0.5 text-xs font-semibold">직접 입력</span>
            </button>
            <button
              onClick={() => cameraRef.current?.click()}
              className="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-brand text-lg font-bold text-white shadow-hero active:bg-brand-dark"
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
                <path
                  d="M4 8a2 2 0 0 1 2-2h1l.6-1.2A1 1 0 0 1 8.5 4h7a1 1 0 0 1 .9.8L17 6h1a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8Z"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <circle cx="12" cy="12.5" r="3.2" stroke="currentColor" strokeWidth="2" />
              </svg>
              가격표 찍기
            </button>
          </div>
        </div>
      </div>

      {/* 토스트 */}
      {toast && (
        <div className="safe-bottom fixed inset-x-0 bottom-24 z-50 flex justify-center px-5">
          <div className="rounded-full bg-slate-900/90 px-4 py-2 text-sm font-medium text-white shadow-lg">
            {toast}
          </div>
        </div>
      )}

      {scanning && (
        <ScanModal initialFile={scanFile} onClose={closeScan} onConfirm={handleConfirm} />
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
      {historyOpen && (
        <HistoryScreen onClose={() => setHistoryOpen(false)} onAddReceipt={() => setReceiptOpen(true)} />
      )}
      {/* 기록 화면 위에서도 열 수 있게 기록 화면보다 뒤에 둔다 */}
      {receiptOpen && (
        <ReceiptModal
          onClose={() => setReceiptOpen(false)}
          onSaved={(count) => {
            setReceiptOpen(false)
            setToast(`영수증 ${count}개 품목을 기록에 저장했어요`)
          }}
        />
      )}
    </div>
  )
}
