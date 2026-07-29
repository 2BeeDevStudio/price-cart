/** 편의점 행사 유형 (undefined = 일반) */
export type PromoType = '1+1' | '2+1'

export interface Item {
  id: string
  /** 상품명 (선택). OCR 추측값 또는 사용자 입력 */
  name?: string
  /** 단가 (원). 쉼표 제거 후 정수로 저장 */
  price: number
  /** 수량 (최소 1) */
  quantity: number
  /** 행사 유형 (선택). 결제 금액 계산에 반영됨 */
  promo?: PromoType
  /** 담은 시각 (epoch ms) */
  createdAt: number
}

/** '쇼핑 끝'으로 저장한 한 번의 쇼핑 기록 (스냅샷) */
export interface ShoppingTrip {
  id: string
  /** 마트 이름 (선택) */
  store?: string
  /** 저장(완료) 시각 (epoch ms) */
  date: number
  /** 당시 담은 상품 목록 */
  items: Item[]
  /** 실제 결제 합계 (행사 반영, 스냅샷) */
  total: number
  /** 행사로 아낀 총 금액 (스냅샷) */
  savings?: number
  /** 총 상품 개수 (수량 합, 스냅샷) */
  itemCount: number
}
