import { useState } from 'react'
import { useList, visibleItems } from '../store/list'
import { useCart } from '../store/cart'
import { useFamily, isMine } from '../store/family'
import {
  useSync,
  shareUrl,
  parseShareInput,
  createShare,
  joinShare,
  reissueShare,
  stopShare,
  enableLedger,
  disableLedger,
  renameMe,
  errorText,
} from '../lib/listSync'

interface ShareSheetProps {
  onClose: () => void
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    try {
      document.execCommand('copy')
    } catch {
      /* ignore */
    }
    document.body.removeChild(ta)
  }
}

/** 공유 시트(카톡 등)로 보내고, 안 되면 복사. 결과 문구 반환 */
async function sendLink(id: string): Promise<string | null> {
  const url = shareUrl(id)
  if (navigator.share) {
    try {
      await navigator.share({ title: '장볼 목록', text: '우리집 장볼 목록이에요. 열어서 같이 체크해요.', url })
      return null
    } catch (e) {
      if ((e as Error).name === 'AbortError') return null
    }
  }
  await copyText(url)
  return '링크를 복사했어요. 가족에게 붙여넣어 보내주세요.'
}

function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      className={`relative h-7 w-12 flex-none rounded-full transition-colors ${on ? 'bg-brand' : 'bg-slate-300'}`}
    >
      <span
        className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`}
      />
    </button>
  )
}

export default function ShareSheet({ onClose }: ShareSheetProps) {
  const shareId = useList((s) => s.shareId)
  const count = useList((s) => visibleItems(s.items).length)
  const status = useSync((s) => s.status)
  const myName = useFamily((s) => s.myName)
  const shareLedger = useFamily((s) => s.shareLedger)
  const deviceId = useFamily((s) => s.deviceId)
  const myTripCount = useCart((s) => s.trips.filter((t) => isMine(t, deviceId)).length)

  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [joinText, setJoinText] = useState('')
  const [name, setName] = useState(myName)
  // 공유 전: 가계부도 같이 켤지 / 내 예전 기록도 올릴지
  const [wantLedger, setWantLedger] = useState(true)
  const [includePast, setIncludePast] = useState(true)
  const ledgerChecked = shareId ? shareLedger : wantLedger

  /** 가계부를 쓰려면 이름이 필요 (가족 화면에 "누가 썼는지" 표시) */
  function needName(): boolean {
    if (name.trim()) return false
    setErr('가족에게 보일 내 이름을 먼저 적어주세요.')
    return true
  }

  /** 공유를 시작/참여한 직후: 이름 저장 + 원하면 가계부 켜기 */
  function afterConnect() {
    renameMe(name)
    if (wantLedger && !useFamily.getState().shareLedger) enableLedger(includePast)
  }

  function onToggleLedger() {
    setErr(null)
    setMsg(null)
    if (!shareId) {
      setWantLedger((v) => !v)
      return
    }
    if (shareLedger) {
      if (
        !window.confirm(
          '가족 가계부를 끌까요?\n가족 기록은 이 폰에서 사라지고, 이미 올린 내 기록은 가족에게 남아요.',
        )
      )
        return
      disableLedger()
      return
    }
    if (needName()) return
    renameMe(name)
    enableLedger(includePast)
    setMsg('가족 가계부를 켰어요. 가족 기록이 곧 보여요.')
  }

  async function run(fn: () => Promise<string | null | void>) {
    setBusy(true)
    setErr(null)
    setMsg(null)
    try {
      const m = await fn()
      if (m) setMsg(m)
    } catch (e) {
      setErr(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  // 아이폰은 탭 직후에만 공유창을 열어줘서, 링크를 만든 뒤 "링크 보내기"를 한 번 더 누르게 한다
  const onCreate = () => {
    if (wantLedger && needName()) return
    void run(async () => {
      await createShare()
      afterConnect()
      return '링크를 만들었어요. "링크 보내기"로 가족에게 보내주세요.'
    })
  }

  const onJoin = () => {
    const id = parseShareInput(joinText)
    if (!id) {
      setErr('받은 링크를 그대로 붙여넣어 주세요.')
      return
    }
    if (wantLedger && needName()) return
    if (count > 0 && !window.confirm(`가족 목록에 참여할까요?\n지금 내 목록 ${count}개도 함께 합쳐져요.`)) return
    void run(async () => {
      await joinShare(id)
      afterConnect()
      setJoinText('')
      return '가족과 연결됐어요.'
    })
  }

  const onReissue = () => {
    if (
      !window.confirm(
        '링크를 새로 만들까요?\n예전 링크로 연결된 가족은 끊기고, 새 링크를 다시 보내야 해요.',
      )
    )
      return
    void run(async () => {
      await reissueShare()
      return '새 링크를 만들었어요. "링크 보내기"로 가족에게 다시 보내주세요.'
    })
  }

  const onStop = () => {
    if (
      !window.confirm(
        '이 폰에서 공유를 끌까요?\n내 목록과 기록은 이 폰에 남고, 가족 기록은 이 폰에서 사라져요.',
      )
    )
      return
    stopShare()
    setMsg(null)
  }

  const statusText =
    status === 'ok' ? '가족과 맞춰져 있어요' : status === 'syncing' ? '맞추는 중…' : '연결 안 됨 · 인터넷이 되면 다시 맞춰요'
  const dot = status === 'ok' ? 'bg-emerald-500' : status === 'syncing' ? 'bg-amber-400' : 'bg-slate-300'

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

          <div className="py-3 text-center">
            <div className="text-lg font-bold text-slate-900">가족과 같이 보기</div>
            <p className="mt-1 text-sm text-slate-500">
              링크 하나로 장볼 목록과 가계부를 함께 봐요.
              <br />
              로그인은 필요 없어요.
            </p>
          </div>

          {/* 내 이름 + 같이 볼 것 */}
          <div className="mb-4 rounded-2xl bg-slate-50 p-4">
            <label className="mb-1 block text-xs font-medium text-slate-500">가족에게 보일 내 이름</label>
            <input
              type="text"
              value={name}
              maxLength={20}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => name.trim() && renameMe(name)}
              placeholder="예: 엄마"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base text-slate-900 outline-none placeholder:text-slate-300 focus:border-brand"
            />
            <div className="mb-1 mt-4 text-xs font-medium text-slate-500">같이 볼 것</div>
            <div className="flex items-center justify-between py-2 text-sm text-slate-700">
              <span>장볼 목록</span>
              <span className="text-xs text-slate-400">항상 같이 봐요</span>
            </div>
            <div className="flex items-center justify-between gap-3 py-2 text-sm text-slate-700">
              <span>
                지난 쇼핑 <span className="text-slate-400">(가족 가계부)</span>
              </span>
              <Toggle on={ledgerChecked} onClick={onToggleLedger} label="가족 가계부" />
            </div>
            {!shareLedger && myTripCount > 0 && (
              <label className="mt-1 flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={includePast}
                  onChange={(e) => setIncludePast(e.target.checked)}
                  className="h-4 w-4 accent-[#EA6A3E]"
                />
                내 지난 기록 {myTripCount}개도 같이 올리기
              </label>
            )}
            <p className="mt-2 text-xs text-slate-400">예산은 각자 폰에만 있어요.</p>
          </div>

          {msg && <div className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm font-medium text-emerald-700">{msg}</div>}
          {err && <div className="mb-4 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-600">{err}</div>}

          {shareId ? (
            <>
              <div className="mb-3 flex items-center justify-center gap-2 text-sm font-medium text-slate-600">
                <span className={`h-2 w-2 rounded-full ${dot}`} />
                {statusText}
              </div>
              <div className="mb-3 truncate rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
                {shareUrl(shareId)}
              </div>
              <div className="flex gap-2">
                <button
                  disabled={busy}
                  onClick={() => run(() => sendLink(shareId))}
                  className="h-12 flex-1 rounded-2xl bg-brand text-base font-bold text-white active:bg-brand-dark disabled:opacity-50"
                >
                  링크 보내기
                </button>
                <button
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await copyText(shareUrl(shareId))
                      return '링크를 복사했어요.'
                    })
                  }
                  className="h-12 rounded-2xl bg-slate-100 px-5 text-sm font-bold text-slate-700 active:bg-slate-200 disabled:opacity-50"
                >
                  복사
                </button>
              </div>
              <p className="mt-3 rounded-2xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">
                가족이 홈 화면에 추가한 앱을 쓴다면, 링크를 복사해서 앱의 <b>장볼 목록 → 공유 → 받은 링크로 참여</b>에
                붙여넣으면 돼요. (링크를 누르면 사파리로 열려서 앱과 따로 저장돼요)
              </p>
              <div className="mt-4 flex justify-between">
                <button
                  disabled={busy}
                  onClick={onReissue}
                  className="py-2 text-sm font-medium text-slate-400 active:text-slate-600"
                >
                  링크 새로 만들기
                </button>
                <button
                  disabled={busy}
                  onClick={onStop}
                  className="py-2 text-sm font-medium text-slate-400 active:text-red-500"
                >
                  이 폰에서 공유 끄기
                </button>
              </div>
            </>
          ) : (
            <>
              <button
                disabled={busy}
                onClick={onCreate}
                className="h-14 w-full rounded-2xl bg-brand text-base font-bold text-white active:bg-brand-dark disabled:opacity-50"
              >
                {busy ? '만드는 중…' : '공유 링크 만들기'}
              </button>
              <p className="mt-2 text-center text-xs text-slate-400">
                링크를 가진 사람은 누구나 목록과 가계부를 볼 수 있어요. 가족에게만 보내주세요.
              </p>

              <div className="mt-6 border-t border-slate-100 pt-4">
                <div className="mb-2 text-sm font-medium text-slate-500">받은 링크로 참여</div>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={joinText}
                    onChange={(e) => setJoinText(e.target.value)}
                    placeholder="받은 링크 붙여넣기"
                    className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-base text-slate-900 outline-none placeholder:text-slate-300 focus:border-brand"
                  />
                  <button
                    disabled={busy || !joinText.trim()}
                    onClick={onJoin}
                    className="rounded-2xl bg-slate-800 px-4 text-sm font-bold text-white active:bg-slate-900 disabled:bg-slate-100 disabled:text-slate-300"
                  >
                    참여
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
