import { create } from 'zustand'
import { useList, visibleItems, type ListItem } from '../store/list'

/**
 * 가족 공유 장볼 목록 동기화
 * - 내가 고치면 0.4초 뒤 서버로 보내고(병합 결과를 받아 반영)
 * - 공유 중 + 화면이 보일 때만 4초마다 서버 목록을 가져온다
 * - 오프라인이면 조용히 기다렸다가 다시 연결되면 이어서 보낸다
 */

const API = '/api/list'
const POLL_MS = 4000
const PUSH_DELAY_MS = 400

export type SyncStatus = 'off' | 'syncing' | 'ok' | 'offline'

interface SyncState {
  status: SyncStatus
  lastOkAt: number | null
  /** 공유가 끊겼을 때 안내 문구 */
  notice: string | null
}

export const useSync = create<SyncState>()(() => ({ status: 'off', lastOkAt: null, notice: null }))

export class ApiError extends Error {
  constructor(public status: number) {
    super(`api ${status}`)
  }
}

/** 사용자에게 보여줄 오류 문구 */
export function errorText(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 404) return '링크를 찾을 수 없어요. 링크를 다시 확인해 주세요.'
    if (e.status === 410) return '더 이상 쓰지 않는 링크예요. 새 링크를 받아주세요.'
    if (e.status === 400) return '올바른 공유 링크가 아니에요.'
  }
  return '연결에 실패했어요. 인터넷을 확인하고 다시 시도해 주세요.'
}

async function call(body: object): Promise<{ items: ListItem[] }> {
  const r = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  if (!r.ok) throw new ApiError(r.status)
  return r.json()
}

// ── 공유 링크 ────────────────────────────────────────────

/** 추측할 수 없는 링크 id (128비트) */
function newShareId(): string {
  const b = new Uint8Array(16)
  crypto.getRandomValues(b)
  return btoa(String.fromCharCode(...b))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

const SHARE_ID_RE = /^[A-Za-z0-9_-]{20,40}$/

export function shareUrl(id: string): string {
  return `${location.origin}/?list=${id}`
}

/** 붙여넣은 링크(또는 id만)에서 공유 id 를 꺼낸다 */
export function parseShareInput(text: string): string | null {
  const t = text.trim()
  const m = t.match(/[?&]list=([A-Za-z0-9_-]+)/)
  const id = m ? m[1] : t
  return SHARE_ID_RE.test(id) ? id : null
}

// ── 동기화 엔진 ──────────────────────────────────────────

let dirty = false
let applying = false
let inflight = false
/** 공유 만들기·참여·재발급 중에는 자동 동기화를 멈춘다 */
let locked = false
let pushTimer: ReturnType<typeof setTimeout> | null = null
let pollTimer: ReturnType<typeof setInterval> | null = null

function applyRemote(items: ListItem[], replace = false) {
  applying = true
  try {
    useList.getState().applyRemote(items, { replace })
  } finally {
    applying = false
  }
}

function markOk() {
  useSync.setState({ status: 'ok', lastOkAt: Date.now() })
}

/** 링크가 끊겼거나 만료됨 → 공유를 끄고 안내 (목록은 이 폰에 그대로 남음) */
function handleGone(code: number) {
  useList.getState().setShareId(null)
  dirty = false
  useSync.setState({
    status: 'off',
    notice:
      code === 410
        ? '공유 링크가 새로 바뀌었어요. 가족에게 새 링크를 받아 다시 연결해 주세요.'
        : '공유 목록을 찾을 수 없어요 (오래 안 써서 지워졌을 수 있어요).',
  })
}

function handleError(e: unknown) {
  if (e instanceof ApiError && (e.status === 404 || e.status === 410)) handleGone(e.status)
  else useSync.setState({ status: 'offline' })
}

/** 서버 한도(300개) 안에서 최근에 고친 것부터 보낸다 */
const outgoing = () =>
  [...useList.getState().items].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 300)

async function push() {
  const id = useList.getState().shareId
  if (!id || inflight || locked) return
  inflight = true
  dirty = false
  useSync.setState({ status: 'syncing' })
  try {
    const { items } = await call({ op: 'merge', id, items: outgoing() })
    if (useList.getState().shareId === id && !locked) applyRemote(items)
    markOk()
  } catch (e) {
    dirty = true
    handleError(e)
  } finally {
    inflight = false
  }
  if (dirty) schedulePush()
}

async function pull() {
  const id = useList.getState().shareId
  if (!id || inflight || locked || document.visibilityState !== 'visible') return
  if (dirty) return void push()
  inflight = true
  try {
    const { items } = await call({ op: 'get', id })
    if (useList.getState().shareId === id && !locked) applyRemote(items)
    markOk()
  } catch (e) {
    handleError(e)
  } finally {
    inflight = false
  }
  if (dirty) schedulePush()
}

function schedulePush() {
  if (pushTimer) clearTimeout(pushTimer)
  pushTimer = setTimeout(() => {
    pushTimer = null
    void push()
  }, PUSH_DELAY_MS)
}

/** 앱 시작 시 한 번 호출. 정리 함수를 돌려준다 */
export function startListSync(): () => void {
  // 내 수정만 서버로 (서버에서 받은 반영은 제외)
  const unsub = useList.subscribe((s, prev) => {
    if (s.shareId !== prev.shareId) {
      useSync.setState({ status: s.shareId ? 'syncing' : 'off' })
      return
    }
    if (applying || !s.shareId || s.items === prev.items) return
    dirty = true
    schedulePush()
  })

  const onVisible = () => {
    if (document.visibilityState === 'visible') void pull()
  }
  document.addEventListener('visibilitychange', onVisible)
  window.addEventListener('online', onVisible)
  pollTimer = setInterval(() => void pull(), POLL_MS)

  if (useList.getState().shareId) {
    useSync.setState({ status: 'syncing' })
    void pull()
  }

  return () => {
    unsub()
    document.removeEventListener('visibilitychange', onVisible)
    window.removeEventListener('online', onVisible)
    if (pollTimer) clearInterval(pollTimer)
    if (pushTimer) clearTimeout(pushTimer)
  }
}

// ── 사용자 동작 ──────────────────────────────────────────

/** 지금 목록으로 새 공유 링크를 만든다 */
async function withLock<T>(fn: () => Promise<T>): Promise<T> {
  locked = true
  try {
    return await fn()
  } finally {
    locked = false
  }
}

export const createShare = (): Promise<string> =>
  withLock(async () => {
    const id = newShareId()
    const { items } = await call({ op: 'merge', id, items: outgoing() })
    applyRemote(items)
    useList.getState().setShareId(id)
    useSync.setState({ notice: null })
    markOk()
    return id
  })

/**
 * 받은 링크로 참여. 이미 다른 공유 목록에 연결돼 있었다면 그 목록을 비우고 새 목록으로 바꾸고,
 * 혼자 쓰던 목록이면 공유 목록에 합친다.
 */
export const joinShare = (id: string): Promise<void> => withLock(() => joinInner(id))

async function joinInner(id: string): Promise<void> {
  const st = useList.getState()
  const wasShared = st.shareId != null && st.shareId !== id
  // 존재하는 목록인지 먼저 확인 (잘못된 링크로 빈 목록이 생기지 않게)
  const remote = await call({ op: 'get', id })
  if (wasShared) {
    applyRemote(remote.items, true)
    useList.getState().setShareId(id)
  } else {
    const { items } = await call({ op: 'merge', id, items: outgoing() })
    applyRemote(items)
    useList.getState().setShareId(id)
  }
  useSync.setState({ notice: null })
  markOk()
}

/** 링크 재발급: 새 링크로 옮기고 옛 링크는 끊는다 */
export const reissueShare = (): Promise<string> =>
  withLock(async () => {
    const old = useList.getState().shareId
    const id = newShareId()
    const live = visibleItems(useList.getState().items).slice(-300)
    const { items } = await call({ op: 'merge', id, items: live })
    applyRemote(items, true)
    useList.getState().setShareId(id)
    if (old) await call({ op: 'revoke', id: old }).catch(() => {})
    markOk()
    return id
  })

/** 이 폰에서 공유 끄기 (목록은 남고, 가족 목록과 연결만 끊김) */
export function stopShare() {
  useList.getState().setShareId(null)
  dirty = false
  useSync.setState({ status: 'off', notice: null })
}

export const clearNotice = () => useSync.setState({ notice: null })
