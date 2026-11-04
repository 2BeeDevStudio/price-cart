import { useTogether, subj } from '../store/together'
import { useFamily } from '../store/family'
import { useList } from '../store/list'
import { formatWon } from '../lib/format'
import { dismissInvite, clearEnded } from '../lib/listSync'

export function UsersIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="9" cy="8" r="3.2" stroke="currentColor" strokeWidth="2" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M15.5 5.2a3.2 3.2 0 0 1 0 5.6M17.5 14.2A5.5 5.5 0 0 1 20.5 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
    <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
  </svg>
)

/** 가족이 시작한 같이 장보기 참여 권유 / 가족이 쇼핑을 마쳤다는 안내 */
export function TogetherBanner({ onJoin, onOpenHistory }: { onJoin: () => void; onOpenHistory: () => void }) {
  const invite = useTogether((s) => s.invite)
  const ended = useTogether((s) => s.ended)
  const ledger = useFamily((s) => s.shareLedger)

  if (ended) {
    return (
      <div className="mb-3 rounded-3xl bg-white px-4 py-3.5 shadow-card">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 flex-none items-center justify-center rounded-2xl bg-lime-soft text-lime-800">
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
              <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-slate-800">{subj(ended.name)} 쇼핑을 마쳤어요</div>
            <div className="text-xs tabular-nums text-slate-400">
              {ended.store ? `${ended.store} · ` : ''}
              {formatWon(ended.total)} · {ended.count}개
            </div>
          </div>
          <button
            onClick={clearEnded}
            aria-label="닫기"
            className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-slate-300 active:bg-slate-100"
          >
            <CloseIcon />
          </button>
        </div>
        {ledger && (
          <button
            onClick={() => {
              clearEnded()
              onOpenHistory()
            }}
            className="mt-3 h-10 w-full rounded-2xl bg-canvas text-sm font-bold text-brand active:bg-slate-200"
          >
            가계부에서 보기
          </button>
        )}
      </div>
    )
  }

  if (!invite) return null
  return (
    <div className="mb-3 flex items-center gap-2.5 rounded-3xl bg-brand px-4 py-3 text-white shadow-card">
      <UsersIcon className="h-5 w-5 flex-none text-lime" />
      <div className="min-w-0 flex-1 text-sm leading-snug">
        {subj(invite.name)}
        {invite.store ? ` ${invite.store}에서` : ''} 같이 장보기를 시작했어요
      </div>
      <button
        onClick={onJoin}
        className="flex-none rounded-full bg-lime px-3.5 py-1.5 text-sm font-bold text-brand active:bg-lime-dark"
      >
        참여
      </button>
      <button
        onClick={dismissInvite}
        aria-label="참여 안 함"
        className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-brand-light active:bg-white/10"
      >
        <CloseIcon />
      </button>
    </div>
  )
}

/** 장바구니가 빌 때: 가족 공유 중이면 같이 장보기 시작 카드 */
export function TogetherStartCard({ onStart }: { onStart: () => void }) {
  const shared = useList((s) => s.shareId != null)
  const sid = useTogether((s) => s.sid)
  const invite = useTogether((s) => s.invite)
  if (!shared || sid || invite) return null
  return (
    <div className="mt-3 rounded-3xl bg-white px-5 py-4 shadow-card ring-1 ring-brand/15">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-2xl bg-lime-soft text-brand">
          <UsersIcon />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-slate-800">같이 장보기</span>
          <span className="block text-xs text-slate-400">가족이 담은 상품도 합계에 같이</span>
        </span>
      </div>
      <button
        onClick={onStart}
        className="mt-3 h-11 w-full rounded-2xl bg-brand text-sm font-bold text-white active:bg-brand-dark"
      >
        시작하기
      </button>
    </div>
  )
}
