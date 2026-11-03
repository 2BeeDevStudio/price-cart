import { useState } from 'react'
import { useList } from '../store/list'

export default function ShoppingList() {
  const items = useList((s) => s.items)
  const addMany = useList((s) => s.addMany)
  const toggle = useList((s) => s.toggle)
  const remove = useList((s) => s.remove)
  const clearChecked = useList((s) => s.clearChecked)

  const [open, setOpen] = useState(true)
  const [text, setText] = useState('')

  const unchecked = items.filter((i) => !i.checked)
  const checked = items.filter((i) => i.checked)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (addMany(text) > 0) setText('')
  }

  return (
    <section className="mb-4 overflow-hidden rounded-3xl bg-white shadow-card">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-5 py-4 active:bg-slate-50"
      >
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
            장볼 목록
          </span>
          {items.length > 0 && (
            <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-bold tabular-nums text-brand">
              {checked.length}/{items.length}
            </span>
          )}
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
        <div className="border-t border-slate-100 px-5 pb-4 pt-3">
          <form onSubmit={submit} className="flex gap-2">
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="우유, 계란처럼 적어두세요"
              enterKeyHint="done"
              className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-base text-slate-900 outline-none placeholder:text-slate-300 focus:border-brand"
            />
            <button
              type="submit"
              disabled={!text.trim()}
              className="rounded-2xl bg-brand px-4 text-sm font-bold text-white active:bg-brand-dark disabled:bg-slate-100 disabled:text-slate-300"
            >
              추가
            </button>
          </form>

          {items.length > 0 && (
            <ul className="mt-2">
              {[...unchecked, ...checked].map((it) => (
                <li key={it.id} className="flex items-center gap-3 py-2">
                  <button
                    onClick={() => toggle(it.id)}
                    aria-label={it.checked ? '체크 해제' : '체크'}
                    className={`flex h-6 w-6 flex-none items-center justify-center rounded-lg border-2 ${
                      it.checked ? 'border-brand bg-brand text-white' : 'border-slate-300 bg-white'
                    }`}
                  >
                    {it.checked && (
                      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
                        <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                  <button
                    onClick={() => toggle(it.id)}
                    className={`min-w-0 flex-1 truncate text-left text-base ${
                      it.checked ? 'text-slate-300 line-through' : 'text-slate-800'
                    }`}
                  >
                    {it.text}
                  </button>
                  <button
                    onClick={() => remove(it.id)}
                    aria-label="삭제"
                    className="flex h-7 w-7 flex-none items-center justify-center rounded-full text-slate-300 active:bg-red-50 active:text-red-500"
                  >
                    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
                      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {checked.length > 0 && (
            <button
              onClick={() => {
                if (window.confirm(`산 것 ${checked.length}개를 목록에서 지울까요?`)) clearChecked()
              }}
              className="mt-1 text-sm font-semibold text-slate-400 active:text-slate-600"
            >
              산 것 지우기
            </button>
          )}
        </div>
      )}
    </section>
  )
}
