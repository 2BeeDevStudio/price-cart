import { create } from 'zustand'
import { useList, visibleItems, type ListItem } from '../store/list'
import { useCart } from '../store/cart'
import { useFamily, isMine } from '../store/family'
import { useTogether, addedByMe, type CartItemOut, type TogetherMeta } from '../store/together'
import type { Item, ShoppingTrip } from '../types'

/**
 * 가족 공유 동기화 — 장볼 목록 + 가족 가계부(지난 쇼핑)
 * - 내가 고치면 0.4초 뒤 서버로 보내고(병합 결과를 받아 반영)
 * - 공유 중 + 화면이 보일 때만 4초마다 서버를 확인 (목록과 가계부를 한 번에)
 * - 가계부는 "마지막으로 받은 번호 이후 바뀐 기록"만 받는다
 * - 오프라인이면 조용히 기다렸다가 다시 연결되면 이어서 보낸다
 * - 같이 장보기 중이면 담은 상품·마트·예산도 같은 요청에 실어 주고받는다
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

/** 서버의 같이 장보기 */
interface RemoteCart {
  sid: string
  active: boolean
  touchedAt: number
  metaTs: number
  meta: TogetherMeta
  items: CartItemOut[]
}

interface SyncResp {
  items: ListItem[]
  trips?: RemoteTrip[]
  tripsSeq: number
  more: boolean
  /** 같이 장보기를 물어봤을 때만 (없으면 null) */
  cart?: RemoteCart | null
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
/** 같이 장보기: 서버로 보낼 게 있음 / 서버에서 받은 걸 반영하는 중 */
let cartDirty = false
let applyingCart = false
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
const hasPendingCart = () => cartDirty || useTogether.getState().pendingEnd != null
const needsPush = () => dirty || hasPendingTrips() || hasPendingCart()

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
  if (resp.cart !== undefined) applyCart(resp.cart)
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
  const listDirty = dirty
  dirty = false
  touchedDuringFlight.clear()
  const trips = outgoingTrips()
  const sent = new Set(trips.map((t) => t.id))
  const cart = cartRequest()
  const sentEnd = useTogether.getState().pendingEnd
  if (cart.mode === 'merge') cartDirty = false
  useSync.setState({ status: 'syncing' })
  try {
    const resp = await call({
      op: 'merge',
      id,
      items: listDirty ? outgoing() : [],
      trips,
      tripsSince: tripsSince(),
      cart,
    })
    const pending = useFamily.getState().ledgerPending
    useFamily.setState({ ledgerPending: pending.filter((x) => !sent.has(x) || touchedDuringFlight.has(x)) })
    if (cart.mode === 'end' && useTogether.getState().pendingEnd === sentEnd) {
      useTogether.setState({ pendingEnd: null })
    }
    applyResp(resp, id)
    markOk()
  } catch (e) {
    dirty = dirty || listDirty
    if (cart.mode === 'merge') cartDirty = true
    handleError(e)
  } finally {
    inflight = false
  }
  if (needsPush()) schedulePush()
}

async function pull() {
  const id = useList.getState().shareId
  if (!id || inflight || locked || document.visibilityState !== 'visible') return
  if (needsPush()) return void push()
  inflight = true
  try {
    const resp = await call({ op: 'get', id, tripsSince: tripsSince(), cart: { mode: 'read' } })
    applyResp(resp, id)
    markOk()
  } catch (e) {
    handleError(e)
  } finally {
    inflight = false
  }
  if (needsPush()) schedulePush()
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

  // 같이 장보기: 내가 담거나 고치거나 지운 상품, 마트·예산 변경을 서버로
  const unsubTogether = useCart.subscribe((s, prev) => {
    if (applyingCart || !useTogether.getState().sid) return
    const itemsChanged = s.items !== prev.items
    const metaChanged = s.storeName !== prev.storeName || s.budget !== prev.budget
    if (!itemsChanged && !metaChanged) return
    const now = Date.now()
    if (itemsChanged) {
      const cur = new Set(s.items.map((i) => i.id))
      const gone = prev.items.filter((i) => !cur.has(i.id))
      if (gone.length) {
        const tomb = { ...useTogether.getState().tomb }
        for (const i of gone) tomb[i.id] = now
        useTogether.setState({ tomb })
      }
    }
    if (metaChanged) useTogether.setState({ metaTs: now })
    cartDirty = true
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
    unsubTogether()
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
    dropTogether()
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
  dropTogether()
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

// ── 같이 장보기 ──────────────────────────────────────────
// 가족 중 한 명이 시작하면 그 장보기 동안만 장바구니 하나를 같이 쓴다.
// 상품마다 updatedAt 이 더 큰 쪽이 이기고, 지운 상품은 삭제 표시로 보낸다.
// 누가 "쇼핑 완료"를 누르면 그 사람 폰에 기록 하나로 남고, 다른 폰에서는 그 상품들이 치워진다.

const CART_SEND_ITEMS = 200
const CART_SEND_TOMBS = 100

const myLabel = () => useFamily.getState().myName || '가족'

/** 서버로 보낼 상품 (내 상품엔 지금 내 이름을 붙인다) + 삭제 표시 */
function outgoingCart(): CartItemOut[] {
  const dev = useFamily.getState().deviceId
  const out: CartItemOut[] = useCart
    .getState()
    .items.slice(0, CART_SEND_ITEMS)
    .map((it) => {
      const mine = addedByMe(it, dev)
      return {
        ...it,
        updatedAt: it.updatedAt ?? it.createdAt,
        by: it.by ?? dev,
        byName: mine ? myLabel() : it.byName,
      }
    })
  const tombs = Object.entries(useTogether.getState().tomb)
    .sort((a, b) => b[1] - a[1])
    .slice(0, CART_SEND_TOMBS)
  for (const [id, ts] of tombs) out.push({ id, updatedAt: ts, deleted: true })
  return out
}

/** 마트·예산은 지금 장바구니 값으로 */
function currentMeta(): TogetherMeta {
  const c = useCart.getState()
  const { store: _s, budget: _b, ...rest } = useTogether.getState().meta
  return {
    ...rest,
    ...(c.storeName.trim() ? { store: c.storeName.trim() } : {}),
    ...(c.budget != null ? { budget: c.budget } : {}),
  }
}

/** 이번 요청에 실을 같이 장보기 부분 */
function cartRequest(): { mode: string } & Record<string, unknown> {
  const t = useTogether.getState()
  if (t.pendingEnd) return { mode: 'end', ...t.pendingEnd }
  if (t.sid && cartDirty) {
    return { mode: 'merge', sid: t.sid, metaTs: t.metaTs || 1, meta: currentMeta(), items: outgoingCart() }
  }
  return { mode: 'read' }
}

function setCart(patch: Partial<{ items: Item[]; storeName: string; budget: number | null }>) {
  applyingCart = true
  try {
    useCart.setState(patch)
  } finally {
    applyingCart = false
  }
}

/** 이 폰에서만 같이 장보기를 그만둔다 (장바구니는 그대로) */
function dropTogether() {
  const t = useTogether.getState()
  if (!t.sid && !t.invite) return
  useTogether.setState({ sid: null, metaTs: 0, meta: {}, tomb: {}, invite: null, dismissed: t.sid ?? t.dismissed })
  cartDirty = false
}

/** 서버의 같이 장보기를 이 폰에 반영 */
function applyCart(remote: RemoteCart | null) {
  const t = useTogether.getState()
  const dev = useFamily.getState().deviceId

  // 참여 중이 아니면: 진행 중인 같이 장보기가 있으면 참여를 권한다
  if (!t.sid) {
    const invite =
      remote && remote.active && remote.sid !== t.dismissed && remote.sid !== t.pendingEnd?.sid
        ? {
            sid: remote.sid,
            name: remote.meta.startedBy === dev ? '내' : remote.meta.startedByName || '가족',
            store: remote.meta.store,
          }
        : null
    if (JSON.stringify(invite) !== JSON.stringify(t.invite)) useTogether.setState({ invite })
    return
  }

  // 같이 장보기가 사라졌거나(하루 지남·링크 재발급) 다른 것으로 바뀜 → 혼자 장보기로 (장바구니는 그대로)
  if (!remote || remote.sid !== t.sid || (!remote.active && !remote.meta.endedBy)) {
    dropTogether()
    return
  }

  // 누가 쇼핑을 완료함 → 기록에 들어간 상품만 치운다 (그 뒤에 내가 담은 건 남김)
  if (!remote.active) {
    const m = remote.meta
    const done = m.ids ? new Set(m.ids) : null
    const rest = done ? useCart.getState().items.filter((i) => !done.has(i.id)) : []
    setCart(rest.length ? { items: rest } : { items: [], storeName: '', budget: null })
    useTogether.setState({
      sid: null,
      metaTs: 0,
      meta: {},
      tomb: {},
      dismissed: remote.sid,
      ended:
        m.endedBy === dev
          ? null
          : { name: m.endedByName || '가족', store: m.store, total: m.total ?? 0, count: m.count ?? 0 },
    })
    cartDirty = false
    return
  }

  // 진행 중: 상품별로 더 최근에 고친 쪽
  const cart = useCart.getState()
  const byId = new Map(cart.items.map((i) => [i.id, i]))
  let changed = false
  for (const r of remote.items) {
    if (!r || typeof r.id !== 'string') continue
    const cur = byId.get(r.id)
    const curTs = cur ? (cur.updatedAt ?? cur.createdAt) : -1
    if ('deleted' in r && r.deleted) {
      if (cur && curTs <= r.updatedAt) {
        byId.delete(r.id)
        changed = true
      }
      continue
    }
    const tombTs = t.tomb[r.id]
    if (tombTs != null && tombTs >= r.updatedAt) continue
    if (!cur || curTs < r.updatedAt) {
      byId.set(r.id, r as Item)
      changed = true
    }
  }
  const patch: Partial<{ items: Item[]; storeName: string; budget: number | null }> = {}
  if (changed) patch.items = [...byId.values()].sort((a, b) => b.createdAt - a.createdAt)
  if (remote.metaTs > t.metaTs) {
    patch.storeName = remote.meta.store ?? ''
    patch.budget = remote.meta.budget ?? null
    useTogether.setState({ metaTs: remote.metaTs, meta: remote.meta })
  }
  if (Object.keys(patch).length) setCart(patch)
}

/**
 * 같이 장보기 시작. 가족이 이미 시작했으면 거기에 참여한다 (지금 담은 상품은 합쳐짐).
 * 'started' = 내가 시작 / 'joined' = 가족 것에 참여
 */
export const startTogether = (): Promise<'started' | 'joined'> =>
  withLock(async () => {
    const id = useList.getState().shareId
    if (!id) throw new ApiError(400)
    const f = useFamily.getState()
    const sid = newShareId()
    const now = Date.now()
    // 예전 상품엔 담은 사람·고친 시각이 없을 수 있어 채운다
    setCart({
      items: useCart
        .getState()
        .items.map((it) => ({ ...it, by: it.by ?? f.deviceId, updatedAt: it.updatedAt ?? now })),
    })
    useTogether.setState({ tomb: {}, meta: {} })
    const meta = { ...currentMeta(), startedBy: f.deviceId, startedByName: myLabel() }
    const resp = await call({
      op: 'merge',
      id,
      items: [],
      cart: { mode: 'start', sid, metaTs: now, meta, items: outgoingCart() },
    })
    const rc = resp.cart
    if (!rc || !rc.active) throw new ApiError(500)
    useTogether.setState({ sid: rc.sid, metaTs: 0, meta: {}, tomb: {}, invite: null, ended: null, dismissed: null })
    cartDirty = false
    applyCart(rc)
    applyRemote(resp.items)
    markOk()
    return rc.sid === sid ? 'started' : 'joined'
  })

/** 같이 장보기에서 나가기 — 내 장바구니는 비우고, 내가 담은 상품은 가족 쪽에 남는다 */
export function leaveTogether() {
  if (!useTogether.getState().sid) return
  dropTogether()
  setCart({ items: [], storeName: '', budget: null })
}

/** 같이 담은 사람 이름 (완료한 나부터, 나머지는 먼저 담은 순서) */
export function togetherShoppers(items: Item[]): string[] {
  const dev = useFamily.getState().deviceId
  const names = new Map<string, string>([[dev, myLabel()]])
  for (const it of [...items].sort((a, b) => a.createdAt - b.createdAt)) {
    const key = it.by ?? dev
    if (!names.has(key)) names.set(key, it.byName || '가족')
  }
  return [...names.values()]
}

/**
 * 쇼핑 완료. 같이 장보는 중이면 함께 담은 사람을 기록에 남기고,
 * 가족 폰에도 완료를 알린다 (연결이 안 되면 나중에 이어서 보냄)
 */
export function finishShoppingTogether(): ShoppingTrip | null {
  const t = useTogether.getState()
  const cart = useCart.getState()
  if (!t.sid) return cart.finishShopping()
  if (cart.items.length === 0) return null
  const f = useFamily.getState()
  const items = outgoingCart()
  const meta = currentMeta()
  const sid = t.sid
  const ids = cart.items.map((i) => i.id)
  const shoppers = togetherShoppers(cart.items)
  // 먼저 같이 장보기에서 빠져야 장바구니 비우기가 "전부 삭제"로 퍼지지 않는다
  useTogether.setState({ sid: null, metaTs: 0, meta: {}, tomb: {}, dismissed: sid })
  cartDirty = false
  const trip = cart.finishShopping({ shoppers })
  if (!trip) return null
  useTogether.setState({
    pendingEnd: {
      sid,
      metaTs: Date.now(),
      meta: {
        ...meta,
        endedBy: f.deviceId,
        endedByName: myLabel(),
        tripId: trip.id,
        total: trip.total,
        count: trip.itemCount,
        ids,
      },
      items,
    },
  })
  schedulePush()
  return trip
}

/** 참여 권유 닫기 */
export function dismissInvite() {
  const inv = useTogether.getState().invite
  if (inv) useTogether.setState({ invite: null, dismissed: inv.sid })
}

/** 완료 안내 닫기 */
export const clearEnded = () => useTogether.setState({ ended: null })
