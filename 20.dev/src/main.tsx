import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// 기록이 브라우저 정리(저장 공간 부족 등)로 지워지지 않게 "보존" 요청
if (navigator.storage?.persist) {
  void navigator.storage.persisted().then((ok) => {
    if (!ok) void navigator.storage.persist().catch(() => {})
  })
}

// PWA: 서비스워커 등록 (프로덕션에서만 — dev 에서는 캐시가 개발을 방해함)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('SW 등록 실패:', err)
    })
  })
}
