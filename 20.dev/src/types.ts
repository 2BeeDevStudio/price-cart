export interface Item {
  id: string
  /** 상품명 (선택). OCR 추측값 또는 사용자 입력 */
  name?: string
  /** 단가 (원). 쉼표 제거 후 정수로 저장 */
  price: number
  /** 수량 (최소 1) */
  quantity: number
  /** 담은 시각 (epoch ms) */
  createdAt: number
}
