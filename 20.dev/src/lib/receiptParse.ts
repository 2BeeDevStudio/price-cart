/* 영수증 전체 텍스트 → 품목(상품명 + 금액) 최선 추출.
 * 영수증 형식이 제각각이라 완벽하진 않음 → 사용자가 확인 화면에서 보정하는 전제.
 */

export interface ParsedReceiptItem {
  name: string
  price: number
  quantity: number
}

// 품목이 아닌 줄(합계·결제·매장정보 등) 제외 키워드
const EXCLUDE =
  /합\s*계|소\s*계|총\s*액|총\s*구매|받을\s*금액|결제|거스름|현금|신용|체크|카드|승인|할부|일시불|부가\s*세|부가가치세|공급가액|과세|면세|포인트|적립|잔액|매출|영수증|사업자|대표자?|주소|전화|고객|회원|봉투|할인\s*합계|합계금액|판매|점\b|TEL|POS|번호/i

// 가격 숫자: 1,500 / 12,800 / 3000 등
const PRICE_RE = /-?\d{1,3}(?:,\d{3})+|-?\d{3,}/g

export function parseReceiptItems(text: string): ParsedReceiptItem[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  const items: ParsedReceiptItem[] = []
  for (const line of lines) {
    if (EXCLUDE.test(line)) continue

    const nums = line.match(PRICE_RE)
    if (!nums) continue

    // 이름 = 줄에서 뒤쪽 숫자/기호 덩어리 제거
    const name = line.replace(/[\d,.\-₩원xX*%\s]+$/, '').trim()
    if (!/[가-힣A-Za-z]/.test(name)) continue // 이름에 글자가 있어야 품목

    const prices = nums
      .map((n) => parseInt(n.replace(/,/g, ''), 10))
      .filter((v) => Number.isFinite(v) && v >= 100 && v < 10_000_000)
    if (!prices.length) continue

    // 금액(라인 합계)은 보통 가장 큰 값
    const price = Math.max(...prices)
    items.push({ name: name.slice(0, 40), price, quantity: 1 })
  }
  return items
}
