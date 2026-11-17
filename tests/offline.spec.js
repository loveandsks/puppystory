// NFR-5 / AC-11: 한 번 연 뒤에는 네트워크 없이 새로고침·다시 열기가 된다 (빌드본 + Service Worker)
import { expect, test } from './helpers.js'
import { installSupabaseMock } from './supabaseMock.js'

const PREVIEW = 'http://localhost:4173/'

test.use({ baseURL: PREVIEW })

test('오프라인에서 새로고침·새 탭으로 다시 열어도 앱과 응급 가이드가 열림', async ({ page, context }) => {
  await page.clock.setFixedTime(new Date('2026-11-16T10:00:00'))
  await page.goto('./#/')
  await expect(page.getByTestId('dday-header')).toContainText('D+116')
  // Service Worker가 설치되고 이 페이지를 맡을 때까지 기다린다
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
    if (!navigator.serviceWorker.controller) {
      await new Promise((r) => navigator.serviceWorker.addEventListener('controllerchange', r, { once: true }))
    }
  })

  await page.getByRole('checkbox', { name: /오늘의 빗질/ }).check()
  await context.setOffline(true)

  await page.reload()
  await expect(page.getByTestId('dday-header')).toContainText('D+116')
  await expect(page.getByTestId('brush-streak')).toContainText('연속 1일')

  // 브라우저를 닫았다 다시 연 것처럼 새 탭에서 열기 (응급 화면으로 바로)
  const again = await context.newPage()
  await again.clock.setFixedTime(new Date('2026-11-16T10:00:00'))
  await again.goto(`${PREVIEW}#/emergency`)
  await again.getByTestId('card-diarrhea_blood').getByRole('button').first().click()
  await expect(again.getByTestId('card-diarrhea_blood')).toContainText('하지 말 것')

  await context.setOffline(false)
})

test('홈 화면 설치: manifest와 아이콘이 배포본에 있고 오프라인 캐시에도 들어감', async ({ page, request }) => {
  await page.goto('./#/')
  const href = await page.locator('link[rel="manifest"]').getAttribute('href')
  const manifestUrl = new URL(href, PREVIEW).href
  const res = await request.get(manifestUrl)
  expect(res.ok()).toBe(true)
  const manifest = await res.json()
  expect(manifest).toMatchObject({ name: 'Puppy 성장스토리', start_url: './', scope: './', display: 'standalone' })
  // 안드로이드 설치 조건: 192px·512px 아이콘, 그리고 maskable 아이콘
  const sizes = manifest.icons.map((i) => i.sizes)
  expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']))
  expect(manifest.icons.some((i) => i.purpose === 'maskable')).toBe(true)

  const iconUrls = [
    ...manifest.icons.map((i) => new URL(i.src, manifestUrl).href),
    new URL(await page.locator('link[rel="apple-touch-icon"]').getAttribute('href'), PREVIEW).href,
  ]
  for (const url of iconUrls) {
    const icon = await request.get(url)
    expect(icon.ok(), url).toBe(true)
    expect(icon.headers()['content-type']).toBe('image/png')
  }

  // Service Worker가 아이콘·manifest를 미리 캐시해 오프라인에서도 설치 아이콘이 깨지지 않음
  const cached = await page.evaluate(async () => {
    await navigator.serviceWorker.ready
    const keys = await caches.keys()
    const cache = await caches.open(keys.find((k) => k.startsWith('puppy-diary-')))
    return (await cache.keys()).map((r) => new URL(r.url).pathname)
  })
  expect(cached).toEqual(expect.arrayContaining(['/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png']))
  // 호스팅 설정 파일은 캐시하지 않음
  expect(cached).not.toContain('/_headers')

  // Chrome이 직접 판단한 설치 가능 여부 (설치 불가 사유가 없어야 함)
  const cdp = await page.context().newCDPSession(page)
  const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors')
  expect(installabilityErrors).toEqual([])
})

test('큰 라이브러리(커뮤니티·PDF 뷰어)는 미리 받지 않고, 처음 열 때 받아 두면 오프라인에서도 열림', async ({ page, context, consoleErrors }) => {
  await installSupabaseMock(page)
  await page.clock.setFixedTime(new Date('2026-11-16T10:00:00'))
  await page.goto('./#/')
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
    if (!navigator.serviceWorker.controller) {
      await new Promise((r) => navigator.serviceWorker.addEventListener('controllerchange', r, { once: true }))
    }
  })
  const precached = await page.evaluate(async () => {
    const keys = await caches.keys()
    const cache = await caches.open(keys.find((k) => k.startsWith('puppy-diary-')))
    return (await cache.keys()).map((r) => new URL(r.url).pathname)
  })
  expect(precached.some((p) => /CommunityPage|pdfjs|pdf.worker/.test(p))).toBe(false)
  expect(precached).toContain('/guides/index.json')

  await page.goto('./#/community')
  await expect(page.getByRole('list', { name: '글 목록' }).or(page.getByText('아직 글이 없어요'))).toBeVisible()
  const lazy = await page.evaluate(async () => (await (await caches.open('puppy-lazy')).keys()).map((r) => new URL(r.url).pathname))
  expect(lazy.some((p) => p.includes('CommunityPage'))).toBe(true)

  await context.setOffline(true)
  await page.reload()
  await expect(page.getByText('커뮤니티는 인터넷에 연결되어 있어야 볼 수 있어요.')).toBeVisible()
  await context.setOffline(false)
  // 오프라인에서 서버 요청이 실패한 기록은 브라우저가 콘솔에 남길 수 있다
  expect(consoleErrors.every((e) => /ERR_INTERNET_DISCONNECTED|Failed to fetch|ERR_FAILED/.test(e))).toBe(true)
  consoleErrors.length = 0
})
