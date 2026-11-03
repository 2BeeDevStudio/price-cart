import { useState } from 'react'
import { useList, visibleItems } from '../store/list'
import { useSync, clearNotice } from '../lib/listSync'
import ShareSheet from './ShareSheet'

export default function ShoppingList() {
  const allItems = useList((s) => s.items)
  const shareId = useList((s) => s.shareId)
  const addMany = useList((s) => s.addMany)
  const toggle = useList((s) => s.toggle)
  const remove = useList((s) => s.remove)
  const clearChecked = useList((s) => s.clearChecked)
  const status = useSync((s) => s.status)
  const notice = useSync((s) => s.notice)

  const [open, setOpen] = useState(true)
  const [text, setText] = useState('')
  const [shareOpen, setShareOpen] = useState(false)

  const items = visibleItems(allItems)
  const unchecked = items.filter((i) => !i.checked)
  const checked = items.filter((i) => i.checked)
  const dot = status === 'ok' ? 'bg-emerald-500' : status === 'syncing' ? 'bg-amber-400' : 'bg-slate-300'

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (addMany(text) > 0) setText('')
  }

  return (
    <section className="mb-4 overflow-hidden rounded-3xl bg-white shadow-card">
      <div className="flex items-center pr-3">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex min-w-0 flex-1 items-center gap-2 py-4 pl-5 pr-2 text-left active:bg-slate-50"
        >
          <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
            장볼 목록
          </span>
          {items.length > 0 && (
            <span className="rounded-full bg-lime px-2 py-0.5 text-xs font-bold tabular-nums text-brand">
              {checked.length}/{items.length}
            </span>
          )}
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className={`ml-auto h-5 w-5 flex-none text-slate-300 transition-transform ${open ? 'rotate-180' : ''}`}
          >
            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          onClick={() => setShareOpen(true)}
          className={`flex flex-none items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${
            shareId ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
          } active:opacity-70`}
        >
          {shareId ? (
            <span className={`h-2 w-2 rounded-full ${dot}`} />
          ) : (
            <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5">
              <path
                d="M16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM8 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2 20c0-2.8 2.7-5 6-5 1.3 0 2.5.3 3.4.9M12 20c0-2.8 1.8-5 4-5s4 2.2 4 5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          )}
          {shareId ? '가족 공유 중' : '공유'}
        </button>
      </div>

      {notice && (
        <div className="mx-5 mb-3 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
          <span className="flex-1">{notice}</span>
          <button onClick={clearNotice} aria-label="닫기" className="flex-none text-amber-500">
            ✕
          </button>
        </div>
      )}

      {shareOpen && <ShareSheet onClose={() => setShareOpen(false)} />}

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
                      it.checked ? 'border-lime bg-lime text-brand' : 'border-slate-300 bg-white'
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
