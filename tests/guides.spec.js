// '함께' 탭의 가이드: public/guides/*.pdf → 목록 → 앱 안 PDF 뷰어
import { expect, openApp, test } from './helpers.js'

/** Chromium으로 한글 2쪽짜리 PDF를 만든다 (NotebookLM에서 내보낸 PDF 대신) */
async function makePdf(browser) {
  const ctx = await browser.newContext()
  const p = await ctx.newPage()
  await p.setContent(`
    <h1>셀프 미용 가이드</h1><p>발톱은 2주마다 조금씩 깎아 주세요.</p>
    <div style="page-break-before: always"><h2>2쪽: 귀 청소</h2></div>`)
  const pdf = await p.pdf({ format: 'A4' })
  await ctx.close()
  return pdf
}

const GUIDE = { file: '01_셀프 미용 가이드.pdf', title: '셀프 미용 가이드', size: 52_000, v: 'test1' }

async function stubGuides(page, list, pdf) {
  await page.route('**/guides/index.json', (route) => route.fulfill({ json: list }))
  if (pdf) await page.route('**/guides/*.pdf*', (route) => route.fulfill({ body: pdf, contentType: 'application/pdf' }))
}

test('가이드 목록 → PDF를 앱 안에서 보고, 확대해도 화면 전체가 가로로 밀리지 않음', async ({ page, browser }) => {
  await stubGuides(page, [GUIDE], await makePdf(browser))
  await openApp(page)
  await page.getByRole('link', { name: '함께' }).click()
  await expect(page.getByRole('link', { name: '📚 가이드' })).toHaveAttribute('aria-current', 'page')

  const item = page.getByRole('list', { name: '가이드 목록' }).getByRole('link')
  await expect(item).toHaveCount(1)
  await expect(item).toContainText('셀프 미용 가이드')
  await expect(item).toContainText('51KB')
  await expect(page.getByText('참고용이며 수의사 진단을 대신하지 않습니다')).toBeVisible()

  await item.click()
  await expect(page.getByRole('heading', { name: '셀프 미용 가이드' })).toBeVisible()
  await expect(page.getByText('총 2쪽')).toBeVisible()
  await expect(page.getByRole('img', { name: '셀프 미용 가이드 1쪽' })).toHaveAttribute('data-rendered', 'true')
  // 하단 '함께' 탭이 계속 선택된 상태
  await expect(page.getByRole('navigation', { name: '하단 메뉴' }).getByRole('link', { name: '함께' })).toHaveClass(/font-extrabold/)

  await page.getByRole('button', { name: '2배' }).click()
  await expect(page.getByRole('img', { name: '셀프 미용 가이드 1쪽' })).toHaveAttribute('data-rendered', 'true')
  const viewport = page.viewportSize().width
  expect(await page.evaluate(() => document.scrollingElement.scrollWidth)).toBeLessThanOrEqual(viewport)
  expect(await page.getByTestId('pdf-pages').evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true)

  await page.getByRole('link', { name: '‹ 가이드 목록' }).click()
  await expect(page.getByRole('list', { name: '가이드 목록' })).toBeVisible()
})

test('가이드가 없으면 안내, 목록을 못 받으면 오류 안내', async ({ page, consoleErrors }) => {
  await stubGuides(page, [])
  await openApp(page, 'guides')
  await expect(page.getByText('아직 올라온 가이드가 없어요')).toBeVisible()

  await page.unroute('**/guides/index.json')
  await page.route('**/guides/index.json', (route) => route.fulfill({ status: 500, body: '' }))
  await page.reload()
  await expect(page.getByText(/가이드 목록을 불러오지 못했어요/)).toBeVisible()
  // 일부러 낸 500 응답은 브라우저가 콘솔에 남긴다
  expect(consoleErrors.length).toBeGreaterThan(0)
  expect(consoleErrors.every((e) => e.includes('status of 500'))).toBe(true)
  consoleErrors.length = 0
})

test('없는 가이드 주소로 들어오면 안내', async ({ page }) => {
  await stubGuides(page, [GUIDE])
  await openApp(page, `guides/${encodeURIComponent('없는.pdf')}`)
  await expect(page.getByText('이 가이드를 찾을 수 없어요')).toBeVisible()
})

test('개발 서버도 public/guides 폴더로 목록을 만들어 줌', async ({ request }) => {
  const res = await request.get('./guides/index.json')
  expect(res.ok()).toBe(true)
  expect(Array.isArray(await res.json())).toBe(true)
})

test('서버 주소를 넣기 전에는 커뮤니티가 "준비 중"', async ({ page }) => {
  // 개발 서버는 Supabase 주소 없이 뜬다 (community.spec.js는 주소를 넣은 preview에서 돈다)
  await openApp(page, 'community')
  await expect(page.getByTestId('community-not-ready')).toBeVisible()
  await expect(page.getByRole('link', { name: '💬 커뮤니티' })).toHaveAttribute('aria-current', 'page')
})
