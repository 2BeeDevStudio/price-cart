// Vercel Serverless Function: 가족 공유 — 장볼 목록 + 가족 가계부 (Upstash Redis)
//
// 로그인 없이 "추측할 수 없는 링크 id" 를 아는 사람만 읽고 쓴다.
// 장볼 목록  list:<id>   해시  필드=항목 id  값="<updatedAt>|<JSON>"
// 가계부     trips:<id>  해시  필드=기록 id  값="<updatedAt>|<seq>|<authorId>|<JSON>"
//            tseq:<id>   기록이 바뀔 때마다 1씩 오르는 번호 → "이 번호 이후 바뀐 것만" 내려준다
// 병합: 항목·기록마다 updatedAt 이 더 큰 쪽이 이김 (Lua 로 원자 처리)
//       기록은 처음 쓴 사람(authorId)만 고칠 수 있음
// 삭제: 지우지 않고 deleted:true 로 남겨 다른 폰에도 전파
//
// 요청 (모두 POST — 서비스워커 GET 캐시를 타지 않게):
//   { op: 'get',    id, tripsSince? }               → { items, trips?, tripsSeq, more }
//   { op: 'merge',  id, items, trips?, tripsSince? } → 위와 같음 (병합 후)
//   { op: 'revoke', id }                             → { ok: true } (링크 재발급 시 옛 링크 끊기)
//   tripsSince: 가계부를 안 쓰면 생략(-1). 쓰면 마지막으로 받은 tripsSeq (처음엔 0)
// 오류: 400 잘못된 요청 / 404 없는 목록(get) / 410 끊긴 링크 / 500·502 서버

const TTL_SEC = 60 * 60 * 24 * 180 // 180일 동안 아무도 안 열면 자동 삭제
const MAX_ITEMS = 300 // 한 번에 받는 목록 항목 수
const MAX_TRIPS = 50 // 한 번에 받는 기록 수
const MAX_FIELDS = 1000 // 목록 하나에 쌓일 수 있는 최대 항목(지운 것 포함)
const MAX_TRIP_FIELDS = 3000 // 가계부 하나에 쌓일 수 있는 최대 기록
const TRIPS_PAGE = 100 // 한 번에 내려주는 기록 수
const MAX_TRIP_JSON = 30_000 // 기록 하나 최대 크기(글자)
const ID_RE = /^[A-Za-z0-9_-]{20,40}$/
const ITEM_ID_RE = /^[A-Za-z0-9_-]{1,64}$/

// KEYS: 1=목록 2=끊긴링크표시 3=가계부 4=가계부번호
// ARGV: 1=TTL 2=쓰기여부 3=tripsSince(-1=가계부 안 봄) 4=목록 인자 수
//       이후 목록 (필드, ts, 값) 반복, 그 뒤 기록 (필드, ts, author, json) 반복
const SYNC_LUA = `
if redis.call('EXISTS', KEYS[2]) == 1 then return {-1} end
local ttl = tonumber(ARGV[1])
local write = ARGV[2] == '1'
local since = tonumber(ARGV[3])
local nItem = tonumber(ARGV[4])
local itemEnd = 4 + nItem
if write then
  local allowNew = redis.call('HLEN', KEYS[1]) < ${MAX_FIELDS}
  for i = 5, itemEnd, 3 do
    local f = ARGV[i]
    local ts = tonumber(ARGV[i + 1])
    local cur = redis.call('HGET', KEYS[1], f)
    if cur then
      local cts = tonumber(string.match(cur, '^(%d+)|')) or -1
      if ts > cts then redis.call('HSET', KEYS[1], f, ARGV[i + 2]) end
    elseif allowNew then
      redis.call('HSET', KEYS[1], f, ARGV[i + 2])
    end
  end
  local allowNewTrip = redis.call('HLEN', KEYS[3]) < ${MAX_TRIP_FIELDS}
  for i = itemEnd + 1, #ARGV, 4 do
    local f = ARGV[i]
    local ts = tonumber(ARGV[i + 1])
    local author = ARGV[i + 2]
    local cur = redis.call('HGET', KEYS[3], f)
    local ok = false
    if cur then
      local cts, _, cauthor = string.match(cur, '^(%d+)|(%d+)|([^|]*)|')
      ok = cauthor == author and ts > (tonumber(cts) or -1)
    else
      ok = allowNewTrip
    end
    if ok then
      local seq = redis.call('INCR', KEYS[4])
      redis.call('HSET', KEYS[3], f, ARGV[i + 1] .. '|' .. seq .. '|' .. author .. '|' .. ARGV[i + 3])
    end
  end
  redis.call('HSET', KEYS[1], '_', '1')
end
redis.call('EXPIRE', KEYS[1], ttl)
local list = redis.call('HGETALL', KEYS[1])
if since < 0 then return {list, {}, 0, 0} end
redis.call('EXPIRE', KEYS[3], ttl)
redis.call('EXPIRE', KEYS[4], ttl)
local changed = {}
local vals = redis.call('HVALS', KEYS[3])
for _, v in ipairs(vals) do
  local _, sq, _, js = string.match(v, '^(%d+)|(%d+)|([^|]*)|(.*)$')
  sq = tonumber(sq)
  if sq and sq > since then table.insert(changed, {sq, js}) end
end
table.sort(changed, function(a, b) return a[1] < b[1] end)
local out = {}
local last = since
local n = math.min(#changed, ${TRIPS_PAGE})
for i = 1, n do
  out[i] = changed[i][2]
  last = changed[i][1]
end
return {list, out, last, #changed > n and 1 or 0}
`

const REVOKE_LUA = `
redis.call('DEL', KEYS[1], KEYS[3], KEYS[4])
redis.call('SET', KEYS[2], '1', 'EX', tonumber(ARGV[1]))
return 1
`

async function redis(command) {
  const url = process.env.KV_REST_API_URL
  const token = process.env.KV_REST_API_TOKEN
  if (!url || !token) throw Object.assign(new Error('저장소가 연결되지 않았어요'), { status: 500 })
  const r = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok || data.error) throw Object.assign(new Error('저장소 오류'), { status: 502 })
  return data.result
}

const num = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : null)
const int = (v, min, max) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : min
const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

/** 장볼 목록 항목 검사. 이상하면 null */
function cleanItem(raw, now) {
  if (!raw || typeof raw !== 'object') return null
  const { id, text, checked, createdAt, updatedAt, deleted } = raw
  if (typeof id !== 'string' || !ITEM_ID_RE.test(id)) return null
  if (typeof text !== 'string') return null
  const t = text.trim().slice(0, 40)
  if (!t && !deleted) return null
  const c = num(createdAt)
  let u = num(updatedAt)
  if (c == null || u == null) return null
  // 미래 시각으로 "항상 이기는" 항목을 못 만들게 현재+1분으로 자른다
  u = Math.min(u, now + 60_000)
  const item = { id, text: t, checked: checked === true, createdAt: Math.min(c, u), updatedAt: u }
  if (deleted === true) item.deleted = true
  return item
}

/** 가계부 기록 검사 — 필요한 필드만 남김 (예산은 공유 안 함). 이상하면 null */
function cleanTrip(raw, now) {
  if (!raw || typeof raw !== 'object') return null
  const { id, authorId } = raw
  if (typeof id !== 'string' || !ITEM_ID_RE.test(id)) return null
  if (typeof authorId !== 'string' || !ITEM_ID_RE.test(authorId)) return null
  let u = num(raw.updatedAt)
  if (u == null) return null
  u = Math.min(u, now + 60_000)
  const base = { id, authorId, authorName: str(raw.authorName, 20), updatedAt: u }
  if (raw.deleted === true) return { ...base, deleted: true }

  const date = num(raw.date)
  if (date == null || !Array.isArray(raw.items) || raw.items.length > 200) return null
  const items = []
  for (const it of raw.items) {
    if (!it || typeof it !== 'object' || typeof it.id !== 'string' || !ITEM_ID_RE.test(it.id)) continue
    const price = int(it.price, 0, 100_000_000)
    const o = num(it.originalPrice)
    items.push({
      id: it.id,
      ...(str(it.name, 60) ? { name: str(it.name, 60) } : {}),
      price,
      ...(o && o > price && o <= 100_000_000 ? { originalPrice: o } : {}),
      quantity: int(it.quantity, 1, 9999),
      ...(it.promo === '1+1' || it.promo === '2+1' ? { promo: it.promo } : {}),
      createdAt: num(it.createdAt) ?? date,
    })
  }
  const trip = {
    ...base,
    ...(str(raw.store, 40) ? { store: str(raw.store, 40) } : {}),
    date,
    items,
    total: int(raw.total, 0, 10_000_000_000),
    savings: int(raw.savings, 0, 10_000_000_000),
    itemCount: int(raw.itemCount, 0, 10_000_000),
  }
  return JSON.stringify(trip).length <= MAX_TRIP_JSON ? trip : null
}

/** HGETALL 결과 [필드, 값, ...] → 목록 항목 배열 */
function parseList(flat) {
  const items = []
  for (let i = 0; i + 1 < flat.length; i += 2) {
    if (flat[i] === '_') continue
    const v = String(flat[i + 1])
    const bar = v.indexOf('|')
    if (bar < 0) continue
    try {
      items.push(JSON.parse(v.slice(bar + 1)))
    } catch {
      /* 깨진 값은 건너뜀 */
    }
  }
  return items
}

function parseTrips(arr) {
  const trips = []
  for (const js of arr) {
    try {
      trips.push(JSON.parse(js))
    } catch {
      /* 깨진 값은 건너뜀 */
    }
  }
  return trips
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST only' })
    return
  }

  let body
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
  } catch {
    res.status(400).json({ error: '잘못된 요청' })
    return
  }
  const op = body && body.op
  const id = body && body.id
  if (typeof id !== 'string' || !ID_RE.test(id)) {
    res.status(400).json({ error: '잘못된 링크' })
    return
  }
  const keys = ['4', `list:${id}`, `listrev:${id}`, `trips:${id}`, `tseq:${id}`]

  try {
    if (op === 'revoke') {
      await redis(['EVAL', REVOKE_LUA, ...keys, String(TTL_SEC)])
      res.status(200).json({ ok: true })
      return
    }
    if (op !== 'get' && op !== 'merge') {
      res.status(400).json({ error: '알 수 없는 요청' })
      return
    }

    const since =
      typeof body.tripsSince === 'number' && Number.isFinite(body.tripsSince) && body.tripsSince >= 0
        ? Math.floor(body.tripsSince)
        : -1

    const itemArgs = []
    const tripArgs = []
    if (op === 'merge') {
      const list = Array.isArray(body.items) ? body.items : []
      const trips = Array.isArray(body.trips) ? body.trips : []
      if (list.length > MAX_ITEMS || trips.length > MAX_TRIPS) {
        res.status(400).json({ error: '한 번에 보내는 양이 너무 많아요' })
        return
      }
      const now = Date.now()
      for (const raw of list) {
        const it = cleanItem(raw, now)
        if (it) itemArgs.push(it.id, String(it.updatedAt), `${it.updatedAt}|${JSON.stringify(it)}`)
      }
      for (const raw of trips) {
        const t = cleanTrip(raw, now)
        if (t) tripArgs.push(t.id, String(t.updatedAt), t.authorId, JSON.stringify(t))
      }
    }

    const result = await redis([
      'EVAL',
      SYNC_LUA,
      ...keys,
      String(TTL_SEC),
      op === 'merge' ? '1' : '0',
      String(since),
      String(itemArgs.length),
      ...itemArgs,
      ...tripArgs,
    ])
    if (result.length === 1 && result[0] === -1) {
      res.status(410).json({ error: '끊긴 링크' })
      return
    }
    const [listFlat, tripVals, seq, more] = result
    if (op === 'get' && listFlat.length === 0) {
      res.status(404).json({ error: '없는 목록' })
      return
    }
    const out = { items: parseList(listFlat), tripsSeq: Number(seq) || 0, more: more === 1 }
    if (since >= 0) out.trips = parseTrips(tripVals)
    res.status(200).json(out)
  } catch (e) {
    res.status(e.status || 500).json({ error: e.status ? e.message : '서버 오류' })
  }
}
