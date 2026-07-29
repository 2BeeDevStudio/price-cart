/** 1980 -> "1,980원" */
export function formatWon(n: number): string {
  return `${n.toLocaleString('ko-KR')}원`
}

/** 1980 -> "1,980" (단위 없이) */
export function formatNumber(n: number): string {
  return n.toLocaleString('ko-KR')
}
