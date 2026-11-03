import { create } from 'zustand'
import { useList, visibleItems, type ListItem } from '../store/list'
import { useCart } from '../store/cart'
import { useFamily, isMine } from '../store/family'
import type { ShoppingTrip } from '../types'

/**
 * 가족 공유 동기화 — 장볼 목록 + 가족 가계부(지난 쇼핑)
 * - 내가 고치면 0.4초 뒤 서버로 보내고(병합 결과를 받아 반영)
 * - 공유 중 + 화면이 보일 때만 4초마다 서버를 확인 (목록과 가계부를 한 번에)
 * - 가계부는 "마지막으로 받은 번호 이후 바뀐 기록"만 받는다
 * - 오프라인이면 조용히 기다렸다가 다시 연결되면 이어서 보낸다
 */

const API = '/api/list'
const POLL_MS = 4000
const PUSH_DELAY_MS = 400
const TRIP_BATCH = 50

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

/** 서버와 주고받는 기록 (보낼 때 수정 시각·삭제 표시를 붙인다) */
type RemoteTrip = ShoppingTrip & { updatedAt?: number; deleted?: boolean }

interface SyncResp {
  items: ListItem[]
  trips?: RemoteTrip[]
  tripsSeq: number
  more: boolean
}

async function call<T = SyncResp>(body: object): Promise<T> {
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

// ── 상태 ─────────────────────────────────────────────────

let dirty = false
let applying = false
let applyingTrips = false
let inflight = false
/** 보내는 동안 다시 고쳐진 기록 (보낸 뒤에도 대기열에 남겨야 함) */
const touchedDuringFlight = new Set<string>()
/** 공유 만들기·참여·재발급 중에는 자동 동기화를 멈춘다 */
let locked = false
let pushTimer: ReturnType<typeof setTimeout> | null = null
let pollTimer: ReturnType<typeof setInterval> | null = null

const ledgerOn = () => useFamily.getState().shareLedger && !!useList.getState().shareId
const tripsSince = () => (ledgerOn() ? useFamily.getState().ledgerSeq : -1)
const hasPendingTrips = () => ledgerOn() && useFamily.getState().ledgerPending.length > 0

function applyRemote(items: ListItem[], replace = false) {
  applying = true
  try {
    useList.getState().applyRemote(items, { replace })
  } finally {
    applying = false
  }
}

/** 가족이 남긴 기록을 반영 (내 기록은 이 폰이 기준이라 건너뜀) */
function applyRemoteTrips(remote: RemoteTrip[]) {
  const dev = useFamily.getState().deviceId
  applyingTrips = true
  try {
    useCart.setState((s) => {
      const map = new Map(s.trips.map((t) => [t.id, t]))
      let changed = false
      for (const r of remote) {
        if (!r || typeof r.id !== 'string' || r.authorId === dev) continue
        if (r.deleted) {
          if (map.delete(r.id)) changed = true
          continue
        }
        const { updatedAt: _u, deleted: _d, ...trip } = r
        map.set(r.id, trip)
        changed = true
      }
      return changed ? { trips: [...map.values()].sort((a, b) => b.date - a.date) } : s
    })
  } finally {
    applyingTrips = false
  }
}

/** 가족 기록을 이 폰에서 치운다 (공유를 끄거나 다른 가족으로 바꿀 때) */
function dropFamilyTrips() {
  const dev = useFamily.getState().deviceId
  applyingTrips = true
  try {
    useCart.setState((s) => ({ trips: s.trips.filter((t) => isMine(t, dev)) }))
  } finally {
    applyingTrips = false
  }
}

function applyResp(resp: SyncResp, id: string) {
  if (useList.getState().shareId !== id || locked) return
  applyRemote(resp.items)
  if (resp.trips && ledgerOn()) {
    applyRemoteTrips(resp.trips)
    useFamily.setState({ ledgerSeq: resp.tripsSeq })
    if (resp.more) setTimeout(() => void pull(), 50)
  }
}

function markOk() {
  useSync.setState({ status: 'ok', lastOkAt: Date.now() })
}

/** 링크가 끊겼거나 만료됨 → 공유를 끄고 안내 (내 목록·기록은 이 폰에 그대로 남음) */
function handleGone(code: number) {
  stopShare()
  useSync.setState({
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

// ── 보낼 것 ──────────────────────────────────────────────

/** 서버 한도(300개) 안에서 최근에 고친 것부터 보낸다 */
const outgoing = () =>
  [...useList.getState().items].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 300)

/** 내 기록을 가계부용으로 (예산은 빼고, 누가 썼는지 붙임) */
function toRemote(t: ShoppingTrip, now: number): RemoteTrip {
  const f = useFamily.getState()
  const { budget: _b, ...rest } = t
  return { ...rest, authorId: f.deviceId, authorName: f.myName || '가족', updatedAt: now }
}

/** 대기열에서 이번에 보낼 기록 (이 폰에서 지운 건 삭제 표시) */
function outgoingTrips(): RemoteTrip[] {
  if (!ledgerOn()) return []
  const f = useFamily.getState()
  const byId = new Map(useCart.getState().trips.map((t) => [t.id, t]))
  const now = Date.now()
  const out: RemoteTrip[] = []
  const drop: string[] = []
  for (const id of f.ledgerPending) {
    if (out.length >= TRIP_BATCH) break
    const t = byId.get(id)
    if (t && !isMine(t, f.deviceId)) {
      drop.push(id)
      continue
    }
    out.push(
      t
        ? toRemote(t, now)
        : ({ id, authorId: f.deviceId, authorName: f.myName || '가족', updatedAt: now, deleted: true } as RemoteTrip),
    )
  }
  if (drop.length) useFamily.setState({ ledgerPending: f.ledgerPending.filter((x) => !drop.includes(x)) })
  return out
}

function markTripsPending(ids: string[]) {
  const f = useFamily.getState()
  const excluded = new Set(f.ledgerExcluded)
  const next = new Set(f.ledgerPending)
  for (const id of ids) {
    if (excluded.has(id)) continue
    next.add(id)
    if (inflight) touchedDuringFlight.add(id)
  }
  useFamily.setState({ ledgerPending: [...next] })
}

// ── 동기화 ───────────────────────────────────────────────

async function push() {
  const id = useList.getState().shareId
  if (!id || inflight || locked) return
  inflight = true
  dirty = false
  touchedDuringFlight.clear()
  const trips = outgoingTrips()
  const sent = new Set(trips.map((t) => t.id))
  useSync.setState({ status: 'syncing' })
  try {
    const resp = await call({ op: 'merge', id, items: outgoing(), trips, tripsSince: tripsSince() })
    const pending = useFamily.getState().ledgerPending
    useFamily.setState({ ledgerPending: pending.filter((x) => !sent.has(x) || touchedDuringFlight.has(x)) })
    applyResp(resp, id)
    markOk()
  } catch (e) {
    dirty = true
    handleError(e)
  } finally {
    inflight = false
  }
  if (dirty || hasPendingTrips()) schedulePush()
}

async function pull() {
  const id = useList.getState().shareId
  if (!id || inflight || locked || document.visibilityState !== 'visible') return
  if (dirty || hasPendingTrips()) return void push()
  inflight = true
  try {
    const resp = await call({ op: 'get', id, tripsSince: tripsSince() })
    applyResp(resp, id)
    markOk()
  } catch (e) {
    handleError(e)
  } finally {
    inflight = false
  }
  if (dirty || hasPendingTrips()) schedulePush()
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
  // 목록: 내 수정만 서버로 (서버에서 받은 반영은 제외)
  const unsubList = useList.subscribe((s, prev) => {
    if (s.shareId !== prev.shareId) {
      useSync.setState({ status: s.shareId ? 'syncing' : 'off' })
      return
    }
    if (applying || !s.shareId || s.items === prev.items) return
    dirty = true
    schedulePush()
  })

  // 가계부: 내 기록이 생기거나 바뀌거나 지워지면 대기열에 넣는다
  const unsubCart = useCart.subscribe((s, prev) => {
    if (applyingTrips || s.trips === prev.trips || !ledgerOn()) return
    const dev = useFamily.getState().deviceId
    const prevMap = new Map(prev.trips.map((t) => [t.id, t]))
    const cur = new Set<string>()
    const changed: string[] = []
    let familyRemoved = false
    for (const t of s.trips) {
      cur.add(t.id)
      if (isMine(t, dev) && prevMap.get(t.id) !== t) changed.push(t.id)
    }
    for (const t of prev.trips) {
      if (cur.has(t.id)) continue
      if (isMine(t, dev)) changed.push(t.id)
      else familyRemoved = true
    }
    // 가족 기록이 이 폰에서만 지워졌다면(전체 삭제 등) 처음부터 다시 받아 복구
    if (familyRemoved) useFamily.setState({ ledgerSeq: 0 })
    if (changed.length) markTripsPending(changed)
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
    unsubList()
    unsubCart()
    document.removeEventListener('visibilitychange', onVisible)
    window.removeEventListener('online', onVisible)
    if (pollTimer) clearInterval(pollTimer)
    if (pushTimer) clearTimeout(pushTimer)
  }
}

// ── 사용자 동작 ──────────────────────────────────────────

async function withLock<T>(fn: () => Promise<T>): Promise<T> {
  locked = true
  try {
    return await fn()
  } finally {
    locked = false
  }
}

/** 지금 목록으로 새 공유 링크를 만든다 */
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
 * 받은 링크로 참여. 이미 다른 가족에 연결돼 있었다면 그 목록·가족 기록을 비우고 새 가족으로 바꾸고,
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
    dropFamilyTrips()
  } else {
    const { items } = await call({ op: 'merge', id, items: outgoing() })
    applyRemote(items)
  }
  useList.getState().setShareId(id)
  if (useFamily.getState().shareLedger) resetLedger(true)
  useSync.setState({ notice: null })
  markOk()
  schedulePush()
}

/** 링크 재발급: 목록·가계부를 새 링크로 옮기고 옛 링크는 끊는다 */
export const reissueShare = (): Promise<string> =>
  withLock(async () => {
    const old = useList.getState().shareId
    const id = newShareId()
    const live = visibleItems(useList.getState().items).slice(-300)
    const { items } = await call({ op: 'merge', id, items: live })
    if (useFamily.getState().shareLedger) {
      // 가족 기록까지 새 가계부로 옮긴다 (쓴 사람 정보 유지)
      const f = useFamily.getState()
      const now = Date.now()
      const excluded = new Set(f.ledgerExcluded)
      const all = useCart
        .getState()
        .trips.filter((t) => !(isMine(t, f.deviceId) && excluded.has(t.id)))
        .map((t) => (isMine(t, f.deviceId) ? toRemote(t, now) : { ...t, updatedAt: now }))
      for (let i = 0; i < all.length; i += TRIP_BATCH) {
        await call({ op: 'merge', id, items: [], trips: all.slice(i, i + TRIP_BATCH) })
      }
      useFamily.setState({ ledgerSeq: 0, ledgerPending: [] })
    }
    applyRemote(items, true)
    useList.getState().setShareId(id)
    if (old) await call({ op: 'revoke', id: old }).catch(() => {})
    markOk()
    return id
  })

/** 이 폰에서 공유 끄기 (내 목록·기록은 남고, 가족과 연결만 끊김) */
export function stopShare() {
  if (useFamily.getState().shareLedger) dropFamilyTrips()
  useFamily.setState({ shareLedger: false, ledgerSeq: 0, ledgerPending: [] })
  useList.getState().setShareId(null)
  dirty = false
  useSync.setState({ status: 'off', notice: null })
}

/** 가계부를 처음부터 다시 맞춘다: 가족 기록 다시 받기 + (원하면) 내 기록 다시 올리기 */
function resetLedger(reupload: boolean) {
  const f = useFamily.getState()
  const excluded = new Set(f.ledgerExcluded)
  const mine = useCart
    .getState()
    .trips.filter((t) => isMine(t, f.deviceId) && !excluded.has(t.id))
    .map((t) => t.id)
  useFamily.setState({ ledgerSeq: 0, ledgerPending: reupload ? mine : [] })
}

/** 가족 가계부 켜기. includePast=false 면 지금까지의 내 기록은 올리지 않는다 */
export function enableLedger(includePast: boolean) {
  const f = useFamily.getState()
  const mine = useCart
    .getState()
    .trips.filter((t) => isMine(t, f.deviceId))
    .map((t) => t.id)
  useFamily.setState({
    shareLedger: true,
    ledgerSeq: 0,
    ledgerExcluded: includePast ? [] : mine,
    ledgerPending: includePast ? mine : [],
  })
  schedulePush()
}

/** 가족 가계부 끄기 — 가족 기록은 이 폰에서 사라지고, 이미 올린 내 기록은 가족에게 남는다 */
export function disableLedger() {
  dropFamilyTrips()
  useFamily.setState({ shareLedger: false, ledgerSeq: 0, ledgerPending: [] })
}

/** 내 이름 바꾸기 — 가계부를 쓰는 중이면 내 기록의 이름도 다시 올린다 */
export function renameMe(name: string) {
  const before = useFamily.getState().myName
  useFamily.getState().setMyName(name)
  if (useFamily.getState().myName === before || !ledgerOn()) return
  const f = useFamily.getState()
  markTripsPending(
    useCart
      .getState()
      .trips.filter((t) => isMine(t, f.deviceId))
      .map((t) => t.id),
  )
  schedulePush()
}

export const clearNotice = () => useSync.setState({ notice: null })
