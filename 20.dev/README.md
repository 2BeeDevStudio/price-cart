# PriceCart (V1)

쇼핑 중 담은 물건의 총 결제 금액을 미리 계산하는 웹앱(PWA).
가격표를 촬영하면 온디바이스 OCR로 숫자를 읽어 합계를 계산한다.

## 스택

- Vite + React + TypeScript
- Zustand (localStorage 영속화)
- Tailwind CSS
- Tesseract.js — 온디바이스 OCR (서버/API 불필요, 무료)
- 수동 Service Worker + manifest — 오프라인 & 홈 화면 설치(PWA)

## 개발

> Node 18+ / npm. (이 프로젝트는 WSL Ubuntu 의 Node 18.19 에서 개발/빌드 확인됨)

```bash
cd 20.dev
npm install
npm run dev      # 개발 서버 (http://localhost:5173)
npm run build    # 프로덕션 빌드 → dist/
npm run preview  # 빌드 결과 미리보기 (http://localhost:4173)
```

## 폰에서 테스트하기

OCR 카메라는 실제 폰에서 테스트하는 게 좋다. 두 가지 방법:

1. **같은 Wi-Fi + HTTPS 없이 데스크톱 IP 접속** — 카메라(`getUserMedia`)와 서비스워커는
   `localhost` 또는 `https` 에서만 동작한다. 폰에서 `http://<PC-IP>:4173` 은 카메라 권한이
   막힐 수 있으므로, 아래 배포 방식을 권장.
2. **정적 호스팅에 배포 (권장)** — `npm run build` 후 `dist/` 를 Vercel / Netlify /
   Cloudflare Pages / GitHub Pages 등에 올리면 HTTPS 로 제공되어 폰에서 카메라·설치 모두 정상 동작.
   - Vercel: 이 폴더(`20.dev`)를 루트로, 빌드 명령 `npm run build`, 출력 `dist`.

설치: 폰 브라우저에서 열고 **홈 화면에 추가** → 앱처럼 실행된다.

## 기능 (V1)

- 홈: 총 예상 결제금액 · 상품 개수 · 상품 목록
- 상품 추가: 가격표 촬영 → OCR 가격 인식 → 확인/수정/다시 촬영 (또는 직접 입력)
- 수량 −/+, 상품 삭제 — 총액 즉시 갱신
- 전체 비우기(새 쇼핑 시작)
- 데이터는 기기 로컬(localStorage)에만 저장 (회원가입/서버 없음, 오프라인 동작)

## 데이터 구조

```ts
interface Item { id: string; price: number; quantity: number; createdAt: number }
```

## OCR 동작 메모

- `eng` 데이터로 숫자 인식에 집중. 최초 1회 CDN 에서 wasm/언어데이터를 받고, 서비스워커가
  캐시하여 이후 오프라인에서도 동작.
- 인식된 숫자 중 가장 큰 값을 대표 가격으로 제안하고, 다른 후보는 칩으로 보여줘 탭 선택 가능.
  값은 언제든 직접 수정할 수 있다.

## 로드맵 (V2, 미구현)

상품명 인식/DB 연결, 영수증 OCR, 구매 이력, 가격 비교, 할인 분석.
자세한 내용은 `../10.기획문서/` 참고.
