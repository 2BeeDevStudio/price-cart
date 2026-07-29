/** 1980 -> "1,980원" */
export function formatWon(n: number): string {
  return `${n.toLocaleString('ko-KR')}원`
}

/** 1980 -> "1,980" (단위 없이) */
export function formatNumber(n: number): string {
  return n.toLocaleString('ko-KR')
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

/** epoch ms -> "7월 29일 (화)" (올해가 아니면 연도 포함) */
export function formatDateKo(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const base = `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAYS[d.getDay()]})`
  return d.getFullYear() === now.getFullYear() ? base : `${d.getFullYear()}년 ${base}`
}
