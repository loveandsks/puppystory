import { defineConfig, devices } from '@playwright/test'

// PRD 9. 성공 기준(AC-1 ~ AC-15) E2E 검증
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5173/',
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    trace: 'retain-on-failure',
    acceptDownloads: true,
  },
  projects: [
    { name: 'desktop-chrome', use: { ...devices['Desktop Chrome'] } },
    // iPhone 13 화면(390px)·터치 에뮬레이션. 설치된 브라우저가 Chromium뿐이라 엔진은 Chromium으로 돌린다.
    { name: 'iphone-13', use: { ...devices['iPhone 13'], browserName: 'chromium' } },
  ],
  webServer: [
    {
      command: 'npm run dev',
      url: 'http://localhost:5173/',
      reuseExistingServer: true,
      timeout: 60_000,
    },
    // Service Worker는 빌드본에서만 등록되므로 오프라인 새로고침 테스트(tests/offline.spec.js)는 preview로 확인한다.
    // 커뮤니티 테스트(tests/community.spec.js)도 여기서: 가짜 Supabase 주소를 넣고 빌드한다 (개발 서버는 이미 떠 있는 것을 재사용할 수 있어 환경 변수를 보장할 수 없다)
    {
      command: 'npm run build && npx vite preview --port 4173 --strictPort',
      url: 'http://localhost:4173/',
      reuseExistingServer: false,
      timeout: 120_000,
      env: { ...process.env, VITE_SUPABASE_URL: 'https://test.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test' },
    },
  ],
})
