// 리뷰에서 찾은 버그의 회귀 테스트: 저장 실패 처리, 렌더 오류 격리
import { expect, openApp, seed, test } from './helpers.js'

test('localStorage 용량 초과 → 경고 배너, 앱은 계속 동작, 공간이 생기면 다시 저장', async ({ page }) => {
  await openApp(page, 'growth')
  await page.evaluate(() => {
    let chunk = 'x'.repeat(512 * 1024)
    let i = 0
    while (chunk.length >= 1) {
      try {
        localStorage.setItem(`fill${i++}`, chunk)
      } catch {
        chunk = chunk.slice(0, Math.floor(chunk.length / 2))
      }
    }
  })
  await page.getByLabel('체중 (kg)').fill('2.4')
  await page.getByLabel('메모').fill('메모 '.repeat(50))
  await page.getByRole('button', { name: '저장', exact: true }).click()
  await expect(page.getByTestId('save-error')).toContainText('저장 공간이 부족')
  await expect(page.getByTestId('weight-row')).toHaveCount(1)

  // 공간을 비우고 다음 기록을 하면 경고가 사라지고, 앞서 못 쓴 기록까지 함께 저장된다
  await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('fill')).forEach((k) => localStorage.removeItem(k)))
  await page.goto('./#/')
  await page.getByRole('checkbox', { name: /오늘의 빗질/ }).check()
  await expect(page.getByTestId('save-error')).toHaveCount(0)
  await page.reload()
  await page.goto('./#/growth')
  await expect(page.getByTestId('weight-row')).toHaveCount(1)
})

test('localStorage를 쓸 수 없는 브라우저 → 저장 불가 안내, 화면은 정상', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new DOMException('denied', 'SecurityError')
      },
    })
  })
  await openApp(page)
  await expect(page.getByTestId('save-error')).toContainText('저장할 수 없어요')
  await page.getByRole('checkbox', { name: /오늘의 빗질/ }).check()
  await expect(page.getByTestId('brush-streak')).toContainText('연속 1일')
})

test('형식이 깨진 저장 데이터는 걸러져서 화면이 깨지지 않음', async ({ page }) => {
  await seed(page, {
    photos: [{ id: 'p1', imageId: 'i1' }, { id: 'p2', imageId: 'i2' }], // 촬영일 없음
    weights: [{ id: 'w1', kg: 2.4 }, { id: 'w2', date: '2026-11-15', kg: 2.4, memo: '' }], // 하나는 날짜 없음
  })
  await openApp(page, 'gallery')
  await expect(page.getByTestId('error-fallback')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '첫 사진 올리기' })).toBeVisible()
  await page.goto('./#/growth')
  await expect(page.getByTestId('weight-row')).toHaveCount(1)
})

test('한 화면의 렌더 오류가 앱 전체를 하얗게 만들지 않음', async ({ page, consoleErrors }) => {
  // 앨범 화면 모듈을 렌더할 때 오류를 내는 것으로 바꿔치기 (개발 서버가 주는 모듈을 가로챈다)
  await page.route('**/src/pages/GalleryPage.jsx*', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: "export default function GalleryPage() { null.localeCompare('x') }",
    }),
  )
  await openApp(page, 'gallery')
  await expect(page.getByTestId('error-fallback')).toBeVisible()
  await expect(page.getByRole('link', { name: '응급 가이드' })).toBeVisible() // SOS는 계속 보인다
  await page.getByRole('navigation', { name: '하단 메뉴' }).getByRole('link', { name: '홈', exact: true }).click()
  await expect(page.getByTestId('dday-big')).toContainText('D+116')
  await page.getByRole('link', { name: '응급 가이드' }).click()
  await expect(page.getByTestId('card-diarrhea_blood')).toBeVisible()
  // React가 잡은 오류를 콘솔에 남기는 것은 의도된 동작
  expect(consoleErrors.join('\n')).toContain('localeCompare')
  consoleErrors.length = 0
})
