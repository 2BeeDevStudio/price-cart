import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
// PWA(오프라인/설치)는 public/sw.js + public/manifest.webmanifest 로 직접 구현했다.
// (vite-plugin-pwa 의 workbox-build 가 Node 18 에서 동작하지 않아 수동 구성)
export default defineConfig({
  plugins: [react()],
})
