import type { OcrWord } from './receiptOcr'

/* 영수증 단어 좌표 → 품목(상품명 + 금액) 추출.
 *  1) 단어들을 y좌표로 묶어 '행' 재구성 (다단 표에서 이름열·숫자열이 분리되는 문제 해결)
 *  2) '상품명' 헤더 ~ 합계/총품목 사이의 표 영역만 파싱 (헤더/푸터 잡음 제거)
 *  3) 각 행에서 오른쪽에 몰린 숫자들 중 금액(최댓값)을 가격으로
 */

export interface ParsedReceiptItem {
  name: string
  price: number
  quantity: number
}

// 품목이 아닌 줄 제외 (안전망)
const EXCLUDE =
  /합\s*계|소\s*계|총\s*액|받을|결제|거스름|현금|신용|체크|카드|승인|할부|일시불|부가|과세|면세|포인트|적립|잔액|매출|영수증|사업자|대표|본사|매장|주소|전화|고객|회원|봉투|품목|수량|단가|금액|교환|환불|포장|취소|인증|품질|경영|멤버십|문의|간편|국민가게|다이소|POS|TEL|ISO|CCM|WHOLESALE|CLUB/i

// 순수 숫자 토큰 (1,780 / 3560 / 2)
const PURE_NUM = /^-?\d{1,3}(?:,\d{3})*$|^-?\d+$/

// 바코드/상품코드 토큰: [1024573] 또는 7자리 이상 숫자 → 품목명·가격에서 제외
const isBarcode = (t: string) => /^\[\d{3,}\]$/.test(t) || /^\d{7,}$/.test(t)

const norm = (s: string) => s.replace(/\s/g, '')
const toNum = (t: string) => parseInt(t.replace(/[^\d]/g, ''), 10)

/** y좌표로 단어를 행으로 묶는다 */
function reconstructRows(words: OcrWord[]): OcrWord[][] {
  if (words.length === 0) return []
  const sorted = [...words].sort((a, b) => a.y - b.y)
  const hs = sorted.map((w) => w.h).filter((h) => h > 0).sort((a, b) => a - b)
  const medianH = hs.length ? hs[Math.floor(hs.length / 2)] : 12
  const tol = Math.max(6, medianH * 0.6)

  const rows: OcrWord[][] = []
  let cur: OcrWord[] = []
  let curY = -Infinity
  for (const w of sorted) {
    if (cur.length === 0 || Math.abs(w.y - curY) <= tol) {
      cur.push(w)
      curY = cur.reduce((s, x) => s + x.y, 0) / cur.length
    } else {
      rows.push(cur)
      cur = [w]
      curY = w.y
    }
  }
  if (cur.length) rows.push(cur)
  return rows
}

/** 영수증에서 구매일 추출 (YYYY-MM-DD 계열). 못 찾으면 null */
export function parseReceiptDate(words: OcrWord[]): number | null {
  const text = words.map((w) => w.text).join(' ')
  // 2026-08-14 / 2026.08.14 / 2026/08/14 (구분자 주변 공백 허용)
  const m = text.match(/(20\d{2})\s*[-.\/]\s*(\d{1,2})\s*[-.\/]\s*(\d{1,2})/)
  if (!m) return null
  const y = +m[1]
  const mo = +m[2]
  const d = +m[3]
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null
  return new Date(y, mo - 1, d, 12, 0, 0).getTime()
}

export function parseReceiptItems(words: OcrWord[]): ParsedReceiptItem[] {
  // 바코드/상품코드 토큰 제거 (이름 오염·행 어긋남 방지)
  const clean = words.filter((w) => !isBarcode(w.text.trim()))
  const rows = reconstructRows(clean)
  const rowText = rows.map((r) =>
    [...r].sort((a, b) => a.x - b.x).map((w) => w.text).join(' '),
  )

  // 표 영역: '상품명' 헤더 다음 ~ 합계/총품목 이전
  const headerIdx = rowText.findIndex((t) => /상품명|품명/.test(norm(t)))
  const start = headerIdx >= 0 ? headerIdx + 1 : 0
  let end = rows.length
  for (let k = start; k < rows.length; k++) {
    if (/합계|총품목|결제대상|면세물품|과세물품|부가세|소계|결제금액/.test(norm(rowText[k]))) {
      end = k
      break
    }
  }

  const items: ParsedReceiptItem[] = []
  for (let k = start; k < end; k++) {
    const tokens = [...rows[k]].sort((a, b) => a.x - b.x).map((w) => w.text)

    // 오른쪽에 몰린 순수 숫자 토큰 수집 (단가·수량·금액 열)
    let i = tokens.length
    const nums: number[] = []
    while (i > 0 && PURE_NUM.test(tokens[i - 1])) {
      nums.unshift(toNum(tokens[i - 1]))
      i--
    }
    if (nums.length === 0) continue

    const name = tokens
      .slice(0, i)
      .join(' ')
      .replace(/\s+/g, ' ')
      .replace(/^[^0-9A-Za-z가-힣]+/, '') // 앞 기호(*) 정리
      .trim()
    if (!/[가-힣A-Za-z]/.test(name)) continue // 이름에 글자 필요
    if (EXCLUDE.test(rowText[k])) continue

    const amount = Math.max(...nums.filter((n) => n > 0))
    if (!(amount >= 100 && amount < 10_000_000)) continue

    // 단가·수량·금액 열에서 수량 추론: amount = 단가 × 수량 이고 둘 다 숫자열에 존재
    let unit = amount
    let quantity = 1
    const asc = [...nums].sort((a, b) => a - b)
    for (const q of asc) {
      if (q < 1 || q > 999 || q >= amount) continue
      if (amount % q !== 0) continue
      const u = amount / q
      if (nums.includes(u)) {
        unit = u
        quantity = q
        break
      }
    }

    items.push({ name: name.slice(0, 40), price: unit, quantity })
  }
  return items
}
