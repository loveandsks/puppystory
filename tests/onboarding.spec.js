// 처음 연 사람: "우리 아이 정보 입력" 화면 (여러 견주가 쓰는 앱이 되면서 추가)
import { STORAGE_KEY, TODAY, completeOnboarding, expect, readStore, seed, test } from './helpers.js'

test.use({ freshStart: true })

test('처음 열면 정보 입력 화면 → 입력하면 우리 아이 이름으로 시작, 새로고침해도 유지', async ({ page }) => {
  await page.clock.setFixedTime(new Date(TODAY))
  await page.goto('./#/')
  await expect(page.getByRole('heading', { name: 'Puppy 성장스토리' })).toBeVisible()
  await expect(page.getByTestId('dday-header')).toHaveCount(0)
  // 편백이 기본값이 보이면 안 된다
  await expect(page.getByText('편백이')).toHaveCount(0)

  await completeOnboarding(page, { name: '콩이', birthDate: '2026-09-01', breed: '말티즈', targetWeightKg: '3' })
  await expect(page.getByTestId('dday-header')).toContainText('콩이')
  await expect(page.getByTestId('dday-header')).toContainText('D+76')

  const { profile } = await readStore(page)
  expect(profile).toMatchObject({ name: '콩이', breed: '말티즈', birthDate: '2026-09-01', onboarded: true, targetWeightKg: 3, targetRangeKg: [2.4, 3.6] })

  await page.reload()
  await expect(page.getByTestId('dday-header')).toContainText('콩이')
})

test('새 견주는 사료·매트·하네스 목록이 비어 있고, 첫 사료를 추가하면 바로 급여 중 사료가 됨', async ({ page }) => {
  await page.clock.setFixedTime(new Date(TODAY))
  await page.goto('./#/')
  await completeOnboarding(page)
  const stored = await readStore(page)
  expect(stored.foods).toEqual([])
  expect(stored.feeding.currentFoodId).toBeNull()
  expect(stored.gear).toEqual({ mats: [], harnesses: [] })

  await page.goto('./#/diet')
  await expect(page.getByTestId('no-foods')).toBeVisible()
  await expect(page.getByText('사료를 먼저 등록해 주세요.')).toBeVisible()
  const db = page.locator('#food-db')
  await db.getByPlaceholder('사료 이름').fill('우리 사료')
  await db.getByLabel('칼로리', { exact: true }).fill('3.8')
  await db.getByRole('button', { name: '추가' }).click()
  await expect(page.getByLabel('급여 중인 사료')).toHaveValue((await readStore(page)).foods[0].id)
  await expect(page.getByTestId('no-foods')).toHaveCount(0)
})

test('빈칸·미래 날짜는 시작하지 않고 이유를 알려줌', async ({ page }) => {
  await page.clock.setFixedTime(new Date(TODAY))
  await page.goto('./#/')
  const form = page.getByRole('form', { name: '우리 아이 정보 입력' })
  await form.getByRole('button', { name: '시작하기' }).click()
  await expect(form.getByText('이름을 입력해 주세요.')).toBeVisible()
  await expect(form.getByText('생년월일을 골라 주세요.')).toBeVisible()
  await expect(form.getByText(/견종을 입력해 주세요/)).toBeVisible()

  await form.getByLabel('이름').fill('콩이')
  await form.getByLabel('생년월일').fill('2026-12-01')
  await form.getByLabel('견종').fill('믹스')
  await form.getByLabel(/성견 예상 체중/).fill('99')
  await form.getByRole('button', { name: '시작하기' }).click()
  await expect(form.getByText('오늘보다 뒤의 날짜는 고를 수 없어요.')).toBeVisible()
  await expect(form.getByText(/1~30kg 사이/)).toBeVisible()
  await expect(page.getByTestId('dday-header')).toHaveCount(0)
})

test('이미 쓰던 사람(옛 저장분)은 입력 화면 없이 바로 홈', async ({ page }) => {
  // 업데이트 전 저장분: profile에 onboarded가 없다
  await seed(page, { profile: { name: '편백이', birthDate: '2026-07-23', breed: '꼬숑' } })
  await page.clock.setFixedTime(new Date(TODAY))
  await page.goto('./#/')
  await expect(page.getByTestId('dday-header')).toContainText('편백이')
  await expect(page.getByTestId('dday-header')).toContainText('D+116')
})

test('입력 화면에서 백업 파일로 바로 시작', async ({ page }) => {
  await page.clock.setFixedTime(new Date(TODAY))
  await page.goto('./#/')
  const backup = {
    app: 'puppy-diary',
    schemaVersion: 1,
    data: { profile: { name: '보리', birthDate: '2026-08-01', breed: '푸들' }, weights: [{ id: 'w1', date: '2026-11-10', kg: 1.8, memo: '' }] },
  }
  await page.getByLabel('백업 파일 선택').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) })
  await expect(page.getByTestId('dday-header')).toContainText('보리')
  const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).state, STORAGE_KEY)
  expect(stored.weights).toHaveLength(1)
  expect(stored.profile.onboarded).toBe(true)
})
