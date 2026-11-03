// Vercel Serverless Function: 가족 공유 장볼 목록 (Upstash Redis)
//
// 로그인 없이 "추측할 수 없는 링크 id" 를 아는 사람만 읽고 쓴다.
// 저장: Redis 해시 list:<id>  — 필드 = 항목 id, 값 = "<updatedAt>|<항목 JSON>"
// 병합: 항목마다 updatedAt 이 더 큰 쪽이 이김 (Lua 로 원자 처리 → 동시 수정에도 안전)
// 삭제: 항목은 지우지 않고 deleted:true (tombstone) 로 남겨 다른 폰에도 전파
//
// 요청 (모두 POST — 서비스워커 GET 캐시를 타지 않게):
//   { op: 'get',    id }                → { items }
//   { op: 'merge',  id, items: [...] }  → { items }   (병합 후 전체)
//   { op: 'revoke', id }                → { ok: true } (링크 재발급 시 옛 링크 끊기)
// 오류: 400 잘못된 요청 / 404 없는 목록(get) / 410 끊긴 링크 / 500·502 서버

const TTL_SEC = 60 * 60 * 24 * 180 // 180일 동안 아무도 안 열면 자동 삭제
const MAX_ITEMS = 300 // 한 번에 받는 항목 수
const MAX_FIELDS = 1000 // 목록 하나에 쌓일 수 있는 최대 항목(지운 것 포함)
const ID_RE = /^[A-Za-z0-9_-]{20,40}$/
const ITEM_ID_RE = /^[A-Za-z0-9_-]{1,64}$/

// KEYS[1]=목록, KEYS[2]=끊긴 링크 표시 / ARGV[1]=TTL, ARGV[2]=새 필드 허용 여부, 이후 (필드, ts, 값) 반복
const MERGE_LUA = `
if redis.call('EXISTS', KEYS[2]) == 1 then return {-1} end
local ttl = tonumber(ARGV[1])
local allowNew = ARGV[2] == '1' and redis.call('HLEN', KEYS[1]) < ${MAX_FIELDS}
for i = 3, #ARGV, 3 do
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
if ARGV[2] == '1' then redis.call('HSET', KEYS[1], '_', '1') end
redis.call('EXPIRE', KEYS[1], ttl)
return redis.call('HGETALL', KEYS[1])
`

const REVOKE_LUA = `
redis.call('DEL', KEYS[1])
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

/** 클라이언트가 보낸 항목을 검사하고 필요한 필드만 남긴다. 이상하면 null */
function cleanItem(raw, now) {
  if (!raw || typeof raw !== 'object') return null
  const { id, text, checked, createdAt, updatedAt, deleted } = raw
  if (typeof id !== 'string' || !ITEM_ID_RE.test(id)) return null
  if (typeof text !== 'string') return null
  const t = text.trim().slice(0, 40)
  if (!t && !deleted) return null
  const num = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : null)
  const c = num(createdAt)
  let u = num(updatedAt)
  if (c == null || u == null) return null
  // 미래 시각으로 "항상 이기는" 항목을 못 만들게 현재+1분으로 자른다
  u = Math.min(u, now + 60_000)
  const item = { id, text: t, checked: checked === true, createdAt: Math.min(c, u), updatedAt: u }
  if (deleted === true) item.deleted = true
  return item
}

/** HGETALL 결과 [필드, 값, 필드, 값...] → 항목 배열 */
function parseHash(flat) {
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
  const key = `list:${id}`
  const revKey = `listrev:${id}`

  try {
    if (op === 'revoke') {
      await redis(['EVAL', REVOKE_LUA, '2', key, revKey, String(TTL_SEC)])
      res.status(200).json({ ok: true })
      return
    }

    if (op === 'get') {
      const flat = await redis(['EVAL', MERGE_LUA, '2', key, revKey, String(TTL_SEC), '0'])
      if (flat.length === 1 && flat[0] === -1) {
        res.status(410).json({ error: '끊긴 링크' })
        return
      }
      if (flat.length === 0) {
        res.status(404).json({ error: '없는 목록' })
        return
      }
      res.status(200).json({ items: parseHash(flat) })
      return
    }

    if (op === 'merge') {
      const list = Array.isArray(body.items) ? body.items : null
      if (!list || list.length > MAX_ITEMS) {
        res.status(400).json({ error: '항목이 너무 많아요' })
        return
      }
      const now = Date.now()
      const args = []
      for (const raw of list) {
        const it = cleanItem(raw, now)
        if (!it) continue
        args.push(it.id, String(it.updatedAt), `${it.updatedAt}|${JSON.stringify(it)}`)
      }
      const flat = await redis(['EVAL', MERGE_LUA, '2', key, revKey, String(TTL_SEC), '1', ...args])
      if (flat.length === 1 && flat[0] === -1) {
        res.status(410).json({ error: '끊긴 링크' })
        return
      }
      res.status(200).json({ items: parseHash(flat) })
      return
    }

    res.status(400).json({ error: '알 수 없는 요청' })
  } catch (e) {
    res.status(e.status || 500).json({ error: e.status ? e.message : '서버 오류' })
  }
}
