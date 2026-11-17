// REVIEW.md 수정 제안 TOP 10 반영 확인
import {
  DHPPL_COMPLETE,
  expect,
  expectImageLoaded,
  makeJpeg,
  openApp,
  readStore,
  seed,
  test,
  weight,
} from './helpers.js'

const W24 = [weight('w1', '2026-11-15', 2.4)]

test.describe('④ 백업 리마인드', () => {
  test('기록은 있는데 백업한 적 없음 → 설정 배지·안내, 내보내면 사라짐', async ({ page }) => {
    await seed(page, { weights: W24 })
    await openApp(page)
    await expect(page.getByTestId('backup-badge')).toBeVisible()
    await page.getByRole('link', { name: '설정 (백업 필요)' }).click()
    await expect(page.getByTestId('backup-reminder')).toContainText('한 번도 백업하지 않았어요')
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: '기록만 내보내기' }).click()])
    expect(download.suggestedFilename()).toBe('편백이_백업_20261116.json')
    await expect(page.getByTestId('backup-status')).toContainText('2026-11-16 (0일 전)')
    await expect(page.getByTestId('backup-badge')).toHaveCount(0)
  })

  test('마지막 백업 후 30일이 지나면 다시 안내', async ({ page }) => {
    await seed(page, { weights: W24, backupInfo: { lastBackupDate: '2026-10-10' } })
    await openApp(page, 'settings')
    await expect(page.getByTestId('backup-reminder')).toContainText('37일')
  })

  test('빈 앱에서는 배지를 띄우지 않음', async ({ page }) => {
    await openApp(page)
    await expect(page.getByTestId('backup-badge')).toHaveCount(0)
  })
})

test('⑤ 깨진 항목이 섞인 백업 가져오기 → 건너뛴 개수 안내, 나머지는 정상', async ({ page }) => {
  await openApp(page, 'settings')
  page.on('dialog', (d) => d.accept())
  const backup = {
    app: 'puppy-diary',
    schemaVersion: 1,
    data: {
      profile: { name: '편백이', birthDate: '2026-07-23' },
      weights: [weight('w1', '2026-11-15', 2.4), { id: 'bad', kg: 'abc' }],
      photos: [{ id: 'p-bad', imageId: 'img1' }],
    },
  }
  await page.getByLabel('백업 파일 선택').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) })
  await expect(page.getByRole('status')).toContainText('형식이 맞지 않는 기록 2건은 건너뛰었어요')
  await page.goto('./#/growth')
  await expect(page.getByTestId('weight-row')).toHaveCount(1)
  await page.goto('./#/gallery')
  await expect(page.getByTestId('error-fallback')).toHaveCount(0)
})

test('③ 사료 예시 칼로리 경고 → 확인하면 사라지고 유지됨', async ({ page }) => {
  await seed(page, { weights: W24 })
  await openApp(page, 'diet')
  await expect(page.getByTestId('example-kcal')).toBeVisible()
  await page.getByRole('button', { name: '포장지와 같아요' }).click()
  await expect(page.getByTestId('example-kcal')).toHaveCount(0)
  await page.reload()
  await expect(page.getByTestId('example-kcal')).toHaveCount(0)
  await expect(page.getByTestId('food-result')).toContainText('g')
})

test('⑥ 산책 타이머가 3시간을 넘으면 실제 시간을 확인받음', async ({ page }) => {
  await seed(page, { vaccines: [DHPPL_COMPLETE] })
  await page.clock.install({ time: new Date('2026-11-16T07:00:00') })
  await page.goto('./#/care')
  await page.getByRole('button', { name: /산책 시작/ }).click()
  await page.clock.fastForward('04:00:00') // 종료를 깜빡함
  await page.getByRole('button', { name: '종료', exact: true }).click()
  await expect(page.getByTestId('walk-fix')).toContainText('4시간')
  await page.getByTestId('walk-fix').getByLabel('실제 산책 시간 (분)').fill('25')
  await page.getByRole('button', { name: '이 시간으로 저장' }).click()
  await expect(page.getByTestId('walk-today')).toContainText('25 / 권장 40분')
  const store = await readStore(page)
  expect(store.walks.map((w) => w.minutes)).toEqual([25])
})

test('⑦ 급여 체크 후 실제 급여량(g) 입력', async ({ page }) => {
  await seed(page, { weights: W24, feeding: { currentFoodId: 'food_monge_bwild' } })
  await openApp(page, 'diet')
  await page.getByRole('checkbox', { name: '1번째 07:00 급여' }).check()
  const grams = page.getByLabel('1번째 실제 급여량 (g)')
  await expect(grams).toHaveValue('27') // 권장 1회량으로 미리 채움
  await grams.fill('30')
  await grams.blur()
  await expect(page.getByTestId('meal-grams-total')).toContainText('오늘 먹은 양 30g / 권장 108g')
  const store = await readStore(page)
  expect(store.feeding.logs.find((l) => l.slot === 0).grams).toBe(30)
})

test('⑧ 배변 메모, 산책 장소·메모', async ({ page }) => {
  await seed(page, { vaccines: [DHPPL_COMPLETE] })
  await openApp(page, 'diet')
  await page.getByLabel('배변 메모').fill('패드 옆에 조금')
  await page.getByRole('button', { name: '지금 기록하기' }).click()
  await expect(page.getByText('패드 옆에 조금')).toBeVisible()

  await page.goto('./#/care')
  await page.getByLabel('직접 입력 (분)').fill('15')
  await page.getByLabel('장소 (선택)').fill('동네 공원')
  await page.getByLabel('산책 메모 (선택)').fill('하네스 적응 잘함')
  await page.getByRole('button', { name: '기록', exact: true }).click()
  await expect(page.getByText(/동네 공원 · 하네스 적응 잘함/)).toBeVisible()
})

test('⑧ 증상 기록에 사진 첨부 → 새로고침 후에도 보이고, 삭제하면 이미지도 지워짐', async ({ page }) => {
  await openApp(page, 'emergency')
  await page.getByRole('tab', { name: '증상 기록' }).click()
  await page.getByLabel('증상', { exact: true }).selectOption({ label: '구토 1~2회, 이후 기운 있음' })
  await page.locator('input[type=file]').setInputFiles({ name: 'vomit.jpg', mimeType: 'image/jpeg', buffer: await makeJpeg(page) })
  await page.getByRole('button', { name: '지금 시각으로 기록' }).click()
  await expectImageLoaded(page.getByRole('img', { name: '증상 사진 1' }))

  await page.reload()
  await page.getByRole('tab', { name: '증상 기록' }).click()
  await expectImageLoaded(page.getByRole('img', { name: '증상 사진 1' }))

  const imageCount = () =>
    page.evaluate(
      () =>
        new Promise((resolve) => {
          const req = indexedDB.open('puppyDiaryMedia')
          req.onsuccess = () => {
            const q = req.result.transaction('images').objectStore('images').count()
            q.onsuccess = () => resolve(q.result)
          }
        }),
    )
  expect(await imageCount()).toBe(1)
  page.on('dialog', (d) => d.accept())
  await page.getByRole('button', { name: '증상 기록 삭제' }).click()
  await expect.poll(imageCount).toBe(0)
})

test.describe('⑨ 알림', () => {
  test('권한이 없으면 브라우저 알림 체크가 켜지지 않음', async ({ page }) => {
    await openApp(page, 'settings')
    const box = page.getByRole('checkbox', { name: /브라우저 알림 받기/ })
    await box.click()
    await expect(box).not.toBeChecked()
    expect((await readStore(page)).notifications.enabled).toBe(false)
  })

  test('권한을 허용하면 켜짐', async ({ page, context }) => {
    await context.grantPermissions(['notifications'])
    await openApp(page, 'settings')
    const box = page.getByRole('checkbox', { name: /브라우저 알림 받기/ })
    await box.click()
    await expect(box).toBeChecked()
  })

  test('알림이 없으면 30초마다 저장하지 않음', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-11-16T10:00:00') })
    await page.goto('./#/')
    await expect(page.getByTestId('dday-header')).toBeVisible()
    const checkedAt = async () => (await readStore(page)).notifications.lastCheckedAt
    const first = await checkedAt()
    expect(first).not.toBeNull()
    await page.clock.runFor(2 * 60_000) // 30초 확인 4번
    expect(await checkedAt()).toBe(first)
    await page.clock.runFor(4 * 60_000) // 5분이 지나면 저장
    expect(await checkedAt()).toBeGreaterThan(first)
  })
})

test.describe('⑩ 입력 검증', () => {
  test('영수증 금액: 빈 값·너무 큰 값 거부', async ({ page }) => {
    await openApp(page, 'health')
    await page.getByRole('button', { name: '+ 추가' }).click()
    const dialog = page.getByRole('dialog', { name: '영수증 추가' })
    await dialog.getByRole('button', { name: '저장' }).click()
    await expect(dialog).toContainText('금액을 입력해 주세요')
    await dialog.getByLabel('금액 (원)').fill('200,000,000')
    await dialog.getByRole('button', { name: '저장' }).click()
    await expect(dialog).toContainText('금액이 너무 커요')
    expect((await readStore(page)).receipts).toEqual([])
  })

  test('이름을 다 지워도 빈 이름으로 저장되지 않음', async ({ page }) => {
    await openApp(page, 'settings')
    const name = page.getByLabel('이름', { exact: true })
    await name.fill('')
    await expect(page.getByTestId('dday-header')).toHaveAttribute('aria-label', /^편백이 · /)
    await name.blur()
    await expect(name).toHaveValue('편백이')
  })

  test('2차 이상 접종은 간격 0일 불가', async ({ page }) => {
    await openApp(page, 'health')
    await page.getByRole('button', { name: '종합백신(DHPPL) 차수·간격 변경' }).click()
    await page.getByLabel('간격(일)').fill('0')
    await page.getByRole('button', { name: '적용' }).click()
    await expect(page.getByRole('alert')).toContainText('간격은 1~365일')
    expect((await readStore(page)).vaccines.find((v) => v.id === 'vac_dhppl').intervalDays).toBe(14)
  })

  test('문진 횟수는 최대 50', async ({ page }) => {
    await openApp(page, 'emergency')
    await page.getByRole('tab', { name: '문진' }).click()
    const count = page.getByLabel('몇 번 그랬나요?')
    await count.fill('999')
    await expect(count).toHaveValue('50')
  })
})
