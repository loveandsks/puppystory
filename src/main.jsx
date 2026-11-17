import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'

// 개발 모드: 계산 로직 자가 진단 (실패하면 콘솔에 표시)
if (import.meta.env.DEV) {
  import('./utils/selfTest.js').then(({ runSelfTests }) => {
    for (const r of runSelfTests()) console.assert(r.pass, `[자가 진단] ${r.name}: 기대 ${r.expected}, 결과 ${r.actual}`)
  })
}

// 브라우저가 저장 공간이 부족할 때 이 앱의 데이터를 임의로 지우지 않도록 요청 (PRD 5.1)
navigator.storage?.persist?.().catch(() => {})

// 오프라인에서도 새로고침·다시 열기가 되도록 Service Worker 등록 (빌드본 + http(s)에서만. file://와 개발 서버는 제외)
if (import.meta.env.PROD && 'serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}))
}

// HashRouter: 서버 rewrite 설정 없이도 새로고침/딥링크가 깨지지 않는다 (정적 호스팅·로컬 파일용)
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
)
