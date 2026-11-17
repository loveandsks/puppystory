// 추가 검증: 360px 가로 스크롤, 화면별 콘솔 에러 0개, 응급 카드 면책 문구·긴급도
import { DHPPL_PARTIAL, expect, openApp, seed, test, weight } from './helpers.js'

const PAGES = ['', 'growth', 'diet', 'health', 'care', 'gallery', 'emergency', 'settings']

// 화면을 꽉 채운 상태에서 확인하려고 데이터를 심어 둔다
const RICH = {
  weights: [weight('w1', '2026-11-01', 2.0), weight('w2', '2026-11-08', 2.3), weight('w3', '2026-11-15', 2.4)],
  vaccines: [DHPPL_PARTIAL],
  receipts: [
    {
      id: 'r1', visitDate: '2026-11-10', clinic: '아주아주긴이름의행복한동물메디컬센터본원', description: '종합백신 3차 및 기타 진료 내역이 길게 들어가는 경우',
      amount: 1234567890, insurer: 'KB손해보험 금쪽같은 펫보험', status: 'pending', claimedDate: null, paidAmount: null, imageIds: [], detailImageIds: [], memo: '',
    },
  ],
  grooming: { brushDates: ['2026-11-14', '2026-11-15'], badges: [], bestStreak: 2 },
  dailyReports: [{ date: '2026-11-12', walked: true, limping: true }, { date: '2026-11-15', walked: true, limping: true }],
  careTasks: [{ id: 'bath', name: '목욕', icon: '🛁', cycleDays: 21, lastDone: '2026-10-20', history: ['2026-10-20'] }],
  contacts: [{ id: 'contact_emergency24', type: 'emergency24', name: '24시 메디컬', phone: '021234567', address: '' }],
}

test.describe('360px 폭', () => {
  test.use({ viewport: { width: 360, height: 780 } })

  test('모든 화면에서 가로 스크롤 없음', async ({ page }) => {
    await seed(page, RICH)
    await openApp(page)
    for (const path of PAGES) {
      await page.goto(`./#/${path}`)
      await expect(page.getByTestId('dday-header')).toBeVisible()
      if (path === 'emergency') await page.getByTestId('card-diarrhea_blood').getByRole('button').first().click()
      const width = await page.evaluate(() => document.scrollingElement.scrollWidth)
      expect(width, `#/${path} scrollWidth`).toBeLessThanOrEqual(360)
    }
  })
})

test('빈 데이터로 모든 화면을 열어도 콘솔 에러 없음', async ({ page }) => {
  await openApp(page)
  for (const path of PAGES) {
    await page.goto(`./#/${path}`)
    await expect(page.locator('main')).not.toBeEmpty()
  }
})

test('응급 카드마다 긴급도 표시와 면책 문구가 있음', async ({ page }) => {
  await openApp(page, 'emergency')
  await expect(page.getByTestId('draft-banner')).toBeVisible()
  await expect(page.getByText('참고용이며 수의사 진단을 대신하지 않습니다').first()).toBeVisible()
  const cards = page.locator('article[data-testid^="card-"]')
  const n = await cards.count()
  expect(n).toBeGreaterThanOrEqual(15)
  for (let i = 0; i < n; i++) {
    const card = cards.nth(i)
    await expect(card.getByTestId('urgency')).toHaveText(/[🔴🟡🟢]/u)
    await card.getByRole('button').first().click()
    await expect(card).toContainText('확진과 치료는 수의사')
    await card.getByRole('button').first().click()
  }
})
