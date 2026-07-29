/* 상품/마트 앞 아이콘 타일 색 — 이름을 해시해서 부드러운 파스텔 톤을 고른다. */

const PALETTE: { bg: string; fg: string }[] = [
  { bg: '#E0ECFF', fg: '#2563EB' }, // blue
  { bg: '#FDE4D8', fg: '#C2410C' }, // coral
  { bg: '#FCEACF', fg: '#B45309' }, // amber
  { bg: '#DCF3E4', fg: '#15803D' }, // green
  { bg: '#EBE3FB', fg: '#6D28D9' }, // purple
  { bg: '#D6F1F0', fg: '#0F766E' }, // teal
  { bg: '#FBE0EC', fg: '#BE185D' }, // pink
]

export function tileStyle(key: string): { bg: string; fg: string } {
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0
  return PALETTE[h % PALETTE.length]
}

/** 타일에 표시할 첫 글자 (없으면 빈 문자열) */
export function tileChar(name?: string): string {
  const t = name?.trim()
  return t ? [...t][0] : ''
}
