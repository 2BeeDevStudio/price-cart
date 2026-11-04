import { useState } from 'react'
import { useCart } from '../store/cart'
import { useFamily } from '../store/family'
import { useTogether, peopleSummary, subj } from '../store/together'
import { formatWon } from '../lib/format'
import { startTogether, leaveTogether, renameMe, errorText } from '../lib/listSync'
import { UsersIcon } from './TogetherBits'

interface TogetherSheetProps {
  onClose: () => void
  onToast: (text: string) => void
}

/** 같이 장보기: 시작·참여 / 진행 중이면 사람별 합계와 나가기 */
export default function TogetherSheet({ onClose, onToast }: TogetherSheetProps) {
  const sid = useTogether((s) => s.sid)
  const invite = useTogether((s) => s.invite)
  const items = useCart((s) => s.items)
  const deviceId = useFamily((s) => s.deviceId)
  const myName = useFamily((s) => s.myName)
  const [name, setName] = useState(myName)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function start() {
    if (!name.trim()) {
      setError('가족에게 보일 이름을 적어 주세요')
      return
    }
    renameMe(name)
    setBusy(true)
    setError(null)
    try {
      const r = await startTogether()
      onToast(r === 'joined' ? '가족이 시작한 같이 장보기에 참여했어요' : '같이 장보기를 시작했어요')
      onClose()
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  function leave() {
    if (!window.confirm('같이 장보기에서 나갈까요?\n내 장바구니는 비워지고, 담았던 상품은 가족 장바구니에 남아요.')) return
    leaveTogether()
    onToast('같이 장보기에서 나왔어요')
    onClose()
  }

  const people = peopleSummary(items, deviceId)

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-black/60" onClick={onClose}>
      <div
        className="safe-bottom mt-auto max-h-[90dvh] w-full overflow-y-auto overscroll-contain rounded-t-3xl bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto max-w-md px-5 pb-6 pt-3">
          <div className="relative mb-2 flex items-center justify-center pt-1">
            <div className="h-1.5 w-10 rounded-full bg-slate-200" />
            <button
              onClick={onClose}
              aria-label="닫기"
              className="absolute right-0 top-0 flex h-9 w-9 items-center justify-center rounded-full text-slate-400 active:bg-slate-100"
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <div className="flex flex-col items-center pb-4 pt-3 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-lime-soft text-brand">
              <UsersIcon className="h-6 w-6" />
            </span>
            <div className="mt-3 text-lg font-bold text-slate-900">
              {sid ? '같이 장보는 중' : '같이 장보기'}
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {sid
                ? '누가 담든 합계와 예산이 같이 움직여요.'
                : '이번 장보기 동안 가족과 장바구니 하나를 같이 써요. 누가 담든 합계에 바로 더해져요.'}
            </p>
          </div>

          {sid ? (
            <>
              <ul className="divide-y divide-slate-100 rounded-2xl bg-slate-50">
                {people.length === 0 && (
                  <li className="px-4 py-3 text-sm text-slate-400">아직 담은 상품이 없어요</li>
                )}
                {people.map((p) => (
                  <li key={p.key} className="flex items-center justify-between px-4 py-3 text-sm">
                    <span className="flex items-center gap-2">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${
                          p.mine ? 'bg-lime-soft text-lime-800' : 'bg-brand/10 text-brand'
                        }`}
                      >
                        {p.label}
                      </span>
                      <span className="text-slate-500">{p.count}개</span>
                    </span>
                    <span className="font-bold tabular-nums text-slate-800">{formatWon(p.total)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs leading-relaxed text-slate-400">
                한 명이 "쇼핑 끝"을 누르면 기록 하나로 저장되고, 모두의 장바구니가 비워져요.
              </p>
              <button
                onClick={leave}
                className="mt-4 h-12 w-full rounded-2xl bg-slate-100 text-sm font-bold text-slate-600 active:bg-slate-200"
              >
                같이 장보기에서 나가기
              </button>
            </>
          ) : (
            <>
              {invite && (
                <div className="mb-3 rounded-2xl bg-brand/5 px-4 py-3 text-sm text-brand">
                  {subj(invite.name)}
                  {invite.store ? ` ${invite.store}에서` : ''} 시작한 같이 장보기가 있어요. 지금 담은 상품도 함께 합쳐져요.
                </div>
              )}
              <label className="mb-1 block text-sm font-medium text-slate-500">가족에게 보일 내 이름</label>
              <input
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  setError(null)
                }}
                maxLength={20}
                placeholder="예: 엄마"
                className="h-12 w-full rounded-2xl border border-slate-200 px-4 text-base outline-none focus:border-brand"
              />
              {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
              <button
                onClick={start}
                disabled={busy}
                className="mt-4 h-12 w-full rounded-2xl bg-brand text-base font-bold text-white active:bg-brand-dark disabled:opacity-60"
              >
                {busy ? '연결하는 중…' : invite ? '참여하기' : '같이 장보기 시작'}
              </button>
              <p className="mt-3 text-center text-xs text-slate-400">
                가족이 앱을 열면 참여하라는 안내가 떠요
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
