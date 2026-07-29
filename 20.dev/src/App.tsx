import { useState } from 'react'
import { useCart } from './store/cart'
import Header from './components/Header'
import ItemRow from './components/ItemRow'
import ScanModal from './components/ScanModal'

export default function App() {
  const items = useCart((s) => s.items)
  const addItem = useCart((s) => s.addItem)
  const clearAll = useCart((s) => s.clearAll)
  const [scanning, setScanning] = useState(false)

  function handleConfirm(price: number, name: string) {
    addItem(price, name)
    setScanning(false)
  }

  function handleReset() {
    if (window.confirm('오늘 쇼핑 목록을 모두 비울까요?')) {
      clearAll()
    }
  }

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col">
      <Header onReset={handleReset} />

      <main className="flex-1 pb-28">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-8 py-24 text-center">
            <div className="mb-4 text-5xl">🛒</div>
            <div className="text-base font-semibold text-slate-500">
              담은 상품이 없어요
            </div>
            <p className="mt-1 text-sm text-slate-400">
              아래 버튼을 눌러 가격표를 촬영해 보세요.
            </p>
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100 overflow-hidden">
            {items.map((item) => (
              <ItemRow key={item.id} item={item} />
            ))}
          </ul>
        )}
      </main>

      {/* 하단 고정 상품 추가 버튼 */}
      <div className="safe-bottom fixed inset-x-0 bottom-0 z-20">
        <div className="mx-auto max-w-md bg-gradient-to-t from-slate-100 via-slate-100 to-transparent px-5 pb-4 pt-6">
          <button
            onClick={() => setScanning(true)}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-brand text-lg font-bold text-white shadow-lg shadow-brand/30 active:bg-brand-dark"
          >
            <span className="text-2xl leading-none">＋</span>
            상품 추가
          </button>
        </div>
      </div>

      {scanning && (
        <ScanModal onClose={() => setScanning(false)} onConfirm={handleConfirm} />
      )}
    </div>
  )
}
