// PRD 9. 성공 기준 AC-1 ~ AC-15 (1:1)
import fs from 'node:fs/promises'
import {
  CORONA_DUE_1124,
  DHPPL_COMPLETE,
  DHPPL_PARTIAL,
  expect,
  expectImageLoaded,
  makeJpeg,
  moveToday,
  openApp,
  readStore,
  seed,
  test,
  weight,
} from './helpers.js'

test('AC-1 헤더에 생후 D+116일 · 4개월차', async ({ page }) => {
  await openApp(page)
  const header = page.getByTestId('dday-header')
  await expect(header).toContainText('D+116')
  await expect(header).toContainText('4개월차')
  await expect(header).toHaveAttribute('aria-label', '편백이 · 생후 D+116일 · 4개월차')
  // 다른 탭에서도 고정 노출
  for (const path of ['growth', 'diet', 'health', 'care', 'gallery', 'emergency', 'settings']) {
    await page.goto(`./#/${path}`)
    await expect(header).toContainText('D+116')
  }
})

test('AC-2 체중·빗질·영수증·사진이 새로고침 뒤에도 남아 있음', async ({ page }) => {
  await openApp(page, 'growth')
  await page.getByLabel('체중 (kg)').fill('2.4')
  await page.getByRole('button', { name: '저장', exact: true }).click()
  await expect(page.getByTestId('weight-row')).toHaveCount(1)

  await page.goto('./#/')
  await page.getByRole('checkbox', { name: /오늘의 빗질/ }).check()
  await expect(page.getByTestId('brush-streak')).toContainText('연속 1일')

  await page.goto('./#/health')
  await page.getByRole('button', { name: '+ 추가' }).click()
  const dialog = page.getByRole('dialog', { name: '영수증 추가' })
  await dialog.getByLabel('금액 (원)').fill('45000')
  await dialog.getByLabel('병원명').fill('행복동물병원')
  await dialog.locator('input[type=file]').first().setInputFiles({ name: 'receipt.jpg', mimeType: 'image/jpeg', buffer: await makeJpeg(page) })
  await dialog.getByRole('button', { name: '저장' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByTestId('receipt-row')).toHaveCount(1)

  await page.goto('./#/gallery')
  await page.getByLabel('사진 선택').setInputFiles({ name: 'puppy.jpg', mimeType: 'image/jpeg', buffer: await makeJpeg(page, '2026-11-16', '#8cf') })
  await page.getByRole('button', { name: '앨범에 저장' }).click()
  await expect(page.getByTestId('photo-tag')).toHaveCount(1)

  await page.reload()

  await expect(page.getByTestId('photo-tag')).toHaveText('생후 116일차 편백이')
  await expectImageLoaded(page.getByRole('img', { name: '생후 116일차 편백이' }))
  await page.goto('./#/health')
  await expect(page.getByTestId('receipt-row')).toHaveCount(1)
  await expect(page.getByTestId('receipt-row')).toContainText('45,000원')
  await expectImageLoaded(page.getByRole('img', { name: '영수증 1' }))
  await page.goto('./#/growth')
  await expect(page.getByTestId('weight-row')).toContainText('2.4kg')
  await page.goto('./#/')
  await expect(page.getByRole('checkbox', { name: /오늘의 빗질/ })).toBeChecked()
  await expect(page.getByTestId('brush-streak')).toContainText('연속 1일')
})

test('AC-3 급증(+15%)·감소 경고', async ({ page }) => {
  await openApp(page, 'growth')
  const save = async (date, kg) => {
    await page.getByLabel('측정일').fill(date)
    await page.getByLabel('체중 (kg)').fill(kg)
    await page.getByRole('button', { name: '저장', exact: true }).click()
  }
  await save('2026-11-01', '2.0')
  await expect(page.getByRole('dialog')).toHaveCount(0)

  await save('2026-11-08', '2.3')
  const dialog = page.getByRole('dialog')
  await expect(page.getByTestId('weight-alert')).toContainText('15%')
  await expect(page.getByTestId('weight-alert')).toContainText('늘었')
  await dialog.getByRole('button', { name: '확인' }).click()

  await save('2026-11-15', '2.2')
  await expect(page.getByTestId('weight-alert')).toContainText('0.1kg 줄었')
  await dialog.getByRole('button', { name: '확인' }).click()
  // 기록에 ⚠️ 표시가 남는다
  await expect(page.getByLabel('체중 경고')).toHaveCount(2)
})

test('AC-4 2.4kg · 3.8kcal/g · 4회 → 하루 107g, 1회 27g', async ({ page }) => {
  await seed(page, { weights: [weight('w1', '2026-11-15', 2.4)] })
  await openApp(page, 'diet')
  await page.getByLabel('급여 중인 사료').selectOption({ label: '몬지 비와일드 (퍼피) (3.8 kcal/g)' })
  const result = page.getByTestId('food-result')
  await expect(result).toContainText('107g')
  await expect(result).toContainText('27g')
  await expect(result).toContainText('× 4회')
})

test('AC-5 종합백신 1차 2026-09-10 → 2~5차 09-24, 10-08, 10-22, 11-05', async ({ page }) => {
  await openApp(page, 'health')
  const card = page.getByTestId('vaccine-vac_dhppl')
  await card.getByLabel('1차 접종일').fill('2026-09-10')
  await card.getByRole('button', { name: '일정 만들기' }).click()
  const rows = card.getByTestId('dose-row')
  await expect(rows).toHaveCount(5)
  await expect(rows.nth(0)).toContainText('9/10 접종')
  for (const [i, md] of ['9/24', '10/8', '10/22', '11/5'].entries()) await expect(rows.nth(i + 1)).toContainText(md)
  const store = await readStore(page)
  expect(store.vaccines.find((v) => v.id === 'vac_dhppl').doses.map((d) => d.dueDate)).toEqual([
    '2026-09-10',
    '2026-09-24',
    '2026-10-08',
    '2026-10-22',
    '2026-11-05',
  ])
})

test.describe('AC-6 접종 알림', () => {
  for (const [label, time, title] of [
    ['D-3 09:00', '2026-11-21T08:59:45', '💉 3일 뒤 접종 예정'],
    ['당일 09:00', '2026-11-24T08:59:45', '💉 오늘은 접종일!'],
  ]) {
    test(`${label}에 앱 안 알림이 뜸`, async ({ page }) => {
      await seed(page, { vaccines: [DHPPL_COMPLETE, CORONA_DUE_1124] })
      await page.clock.install({ time: new Date(time) })
      await page.goto('./#/')
      await expect(page.getByTestId('dday-header')).toBeVisible()
      const toasts = page.locator('[aria-live="polite"]').getByRole('button')
      await expect(toasts).toHaveCount(0)
      await page.clock.runFor(31_000) // 30초마다 확인 → 09:00을 넘긴 첫 확인
      await expect(toasts).toHaveCount(1)
      await expect(toasts).toContainText(title)
      await expect(toasts).toContainText('코로나 장염 2차')
      // 새로고침해도 같은 알림이 다시 울리지 않음
      await page.reload()
      await page.clock.runFor(31_000)
      await expect(toasts).toHaveCount(0)
    })
  }

  test('.ics 파일에 D-3·D-0 VALARM 포함', async ({ page }) => {
    await seed(page, { vaccines: [DHPPL_COMPLETE, CORONA_DUE_1124] })
    await openApp(page, 'health')
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: '캘린더로 내보내기 (.ics)' }).click(),
    ])
    expect(download.suggestedFilename()).toMatch(/\.ics$/)
    const ics = await fs.readFile(await download.path(), 'utf8')
    expect(ics).toContain('BEGIN:VCALENDAR')
    const vaccineEvent = ics.split('BEGIN:VEVENT').find((e) => e.includes('코로나 장염 2차'))
    expect(vaccineEvent).toBeTruthy()
    expect(vaccineEvent).toContain('DTSTART:20261124T090000')
    expect(vaccineEvent).toContain('BEGIN:VALARM')
    expect(vaccineEvent).toContain('TRIGGER:-P3D')
    expect(vaccineEvent).toContain('TRIGGER:-PT0M')
  })
})

test('AC-7 영수증 3건 중 2건 청구 대기 → 필터 2건, 합계 정확', async ({ page }) => {
  const r = (id, amount, status, insurer = 'DB손해보험 펫블리') => ({
    id, visitDate: '2026-11-10', clinic: '행복동물병원', description: '', amount, insurer, status,
    claimedDate: status === 'claimed' ? '2026-11-12' : null, paidAmount: null, imageIds: [], detailImageIds: [], memo: '',
  })
  await seed(page, { receipts: [r('r1', 45000, 'pending'), r('r2', 82000, 'pending', 'KB손해보험 금쪽같은 펫보험'), r('r3', 30000, 'claimed')] })
  await openApp(page, 'health')
  const summary = page.getByTestId('pending-summary')
  await expect(summary).toContainText('미청구 2건')
  await expect(summary).toContainText('127,000원')
  await expect(page.getByTestId('receipt-row')).toHaveCount(2) // 기본 보기 = 청구 대기
  await page.getByRole('button', { name: '청구 완료', exact: true }).click()
  await expect(page.getByTestId('receipt-row')).toHaveCount(1)
  await page.getByRole('button', { name: '전체', exact: true }).click()
  await expect(page.getByTestId('receipt-row')).toHaveCount(3)
  await page.getByRole('button', { name: '청구 대기', exact: true }).click()
  await page.getByLabel('보험사 필터').selectOption('KB손해보험 금쪽같은 펫보험')
  await expect(page.getByTestId('receipt-row')).toHaveCount(1)
  // 홈 미청구 배지
  await page.goto('./#/')
  await expect(page.getByTestId('pending-count')).toHaveText('2건')
})

test('AC-8 3일 연속 빗질 → 배지, 하루 건너뛰면 streak 0 (배지·최고 기록 유지)', async ({ page }) => {
  const brush = page.getByRole('checkbox', { name: /오늘의 빗질/ })
  await openApp(page, '', '2026-11-14T10:00:00')
  await brush.check()
  await moveToday(page, '2026-11-15T10:00:00')
  await expect(page.getByTestId('brush-streak')).toContainText('연속 1일') // 오늘 체크 전: 어제까지
  await brush.check()
  await moveToday(page, '2026-11-16T10:00:00')
  await brush.check()
  await expect(page.getByTestId('brush-streak')).toContainText('연속 3일')
  await expect(page.getByRole('status')).toContainText('새 배지! 빗질 입문')

  await moveToday(page, '2026-11-18T10:00:00') // 11-17 건너뜀
  await expect(page.getByTestId('brush-streak')).toContainText('연속 0일')
  await page.goto('./#/care')
  await expect(page.getByTestId('badge-streak3')).toHaveAttribute('data-earned', 'true')
  await expect(page.getByText('최고 기록 3일')).toBeVisible()
})

test('AC-9 7일 안에 절뚝거림 2번 → 상담 권장 경고', async ({ page }) => {
  await seed(page, { dailyReports: [{ date: '2026-11-12', walked: true, limping: true }] })
  await openApp(page, 'care')
  await expect(page.getByTestId('limp-alert')).toHaveCount(0)
  await page.getByRole('group', { name: '산책 여부' }).getByRole('button', { name: '예' }).click()
  await page.getByRole('group', { name: '절뚝거림' }).getByRole('button', { name: '예' }).click()
  await expect(page.getByTestId('limp-alert')).toContainText('반복되는 절뚝거림 — 수의사 상담 권장')
  await expect(page.getByTestId('report-status')).toContainText('이상')
})

test('AC-10 EXIF 촬영일 2026-11-16 사진 → "생후 116일차 편백이" 태그', async ({ page }) => {
  await openApp(page, 'gallery')
  await page.getByLabel('사진 선택').setInputFiles([
    { name: 'today.jpg', mimeType: 'image/jpeg', buffer: await makeJpeg(page, '2026-11-16') },
    { name: 'old.jpg', mimeType: 'image/jpeg', buffer: await makeJpeg(page, '2026-11-01') }, // 파일 날짜가 아니라 EXIF를 읽는지 확인
  ])
  await expect(page.getByTestId('upload-tag')).toHaveText(['생후 116일차 편백이', '생후 101일차 편백이'])
  await expect(page.getByText('촬영일 (사진 정보)')).toHaveCount(2)
  await page.getByRole('button', { name: '앨범에 저장' }).click()
  await expect(page.getByTestId('photo-tag')).toHaveText(['생후 116일차 편백이', '생후 101일차 편백이'])
  await expect(page.getByText('4개월차 (2026.11)')).toBeVisible()
})

test('AC-11 네트워크를 끈 상태에서 주요 기능 동작 (응급 가이드 포함)', async ({ page, context, isMobile }) => {
  await seed(page, { vaccines: [DHPPL_PARTIAL] })
  await openApp(page)
  await context.setOffline(true)
  const nav = page.getByRole('navigation', { name: '하단 메뉴' })
  const tab = (name) => nav.getByRole('link', { name, exact: true })

  await tab('성장').click()
  await page.getByLabel('체중 (kg)').fill('2.4')
  await page.getByRole('button', { name: '저장', exact: true }).click()
  await expect(page.getByTestId('weight-row')).toContainText('2.4kg')
  if (isMobile) await page.locator('body').click({ position: { x: 5, y: 200 } }) // 키보드 닫힘 → 하단 탭 다시 표시

  await tab('식단').click()
  await expect(page.getByTestId('food-result')).toContainText('g')
  await page.getByRole('button', { name: '지금 기록하기' }).click()
  await expect(page.getByTestId('potty-summary')).toContainText('소변 1')

  await tab('케어').click()
  await page.getByRole('checkbox', { name: /오늘의 빗질/ }).check()
  await expect(page.getByTestId('brush-streak')).toContainText('연속 1일')

  await tab('건강').click()
  await expect(page.getByTestId('vaccine-vac_dhppl')).toBeVisible()

  await page.getByRole('link', { name: '응급 가이드' }).click()
  await page.getByTestId('card-diarrhea_blood').getByRole('button').first().click()
  await expect(page.getByTestId('card-diarrhea_blood')).toContainText('하지 말 것')
  await page.getByLabel('증상 검색').fill('초콜릿')
  await expect(page.locator('[data-testid^="card-"]')).not.toHaveCount(0)

  await context.setOffline(false)
})

test.describe('AC-12 산책 권장 시간', () => {
  test('4개월차·종합백신 완료 → 1회 약 20분', async ({ page }) => {
    await seed(page, { vaccines: [DHPPL_COMPLETE] })
    await openApp(page, 'care')
    await expect(page.getByTestId('walk-recommend')).toContainText('약 20분')
    await expect(page.getByTestId('walk-carry-banner')).toHaveCount(0)
  })
  test('종합백신 미완료 → 안고 바깥 구경 배너', async ({ page }) => {
    await seed(page, { vaccines: [DHPPL_PARTIAL] })
    await openApp(page, 'care')
    await expect(page.getByTestId('walk-carry-banner')).toContainText('안고 바깥 구경')
    await expect(page.getByTestId('walk-recommend')).toHaveCount(0)
  })
})

test('AC-13 목욕 11-01 + 21일 → 11-22, 11-19부터 🟡, 11-23부터 🔴 1일 지남', async ({ page }) => {
  await seed(page, { careTasks: [{ id: 'bath', name: '목욕', icon: '🛁', cycleDays: 21, lastDone: '2026-11-01', history: ['2026-11-01'] }] })
  const bath = page.getByTestId('care-bath')
  const status = bath.getByTestId('care-status')
  await openApp(page, 'care', '2026-11-16T10:00:00')
  await expect(bath).toContainText('다음 11-22')
  await expect(status).toHaveText('🟢D-6')
  for (const [time, text] of [
    ['2026-11-18T10:00:00', '🟢D-4'],
    ['2026-11-19T10:00:00', '🟡D-3'],
    ['2026-11-22T10:00:00', '🟡오늘'],
    ['2026-11-23T10:00:00', '🔴1일 지남'],
  ]) {
    await moveToday(page, time)
    await expect(status).toHaveText(text)
  }
  // 홈 '곧 할 관리'에도 뜬다
  await page.goto('./#/')
  await expect(page.getByText('🛁 목욕')).toBeVisible()
})

test('AC-14 어느 탭에서든 SOS 한 번 → 응급 화면, 24시 병원 tel: 링크', async ({ page }) => {
  await openApp(page, 'settings')
  await page.getByLabel('24시 응급 병원 이름').fill('24시 행복동물메디컬')
  await page.getByLabel('24시 응급 병원 전화번호').fill('02-1234-5678')
  await page.getByLabel('24시 응급 병원 주소').click() // blur → 저장

  const sos = page.getByRole('link', { name: '응급 가이드' })
  for (const path of ['', 'growth', 'diet', 'health', 'care', 'gallery', 'settings']) {
    await page.goto(`./#/${path}`)
    await sos.click()
    await expect(page).toHaveURL(/#\/emergency$/)
    const call = page.getByTestId('call-emergency24')
    await expect(call).toHaveAttribute('href', 'tel:0212345678')
    await expect(call).toContainText('24시 행복동물메디컬')
  }
})

test('AC-15 피 섞인 설사 카드 🔴 + 접종 미완료 문구, 문진 결과에 생후 일수·체중·접종 자동 입력', async ({ page }) => {
  await seed(page, { weights: [weight('w1', '2026-11-15', 2.4)], vaccines: [DHPPL_PARTIAL] })
  await openApp(page, 'emergency')
  const card = page.getByTestId('card-diarrhea_blood')
  await expect(card.getByTestId('urgency')).toContainText('🔴')
  await expect(card.getByTestId('urgency')).toContainText('지금 바로 병원')
  await card.getByRole('button').first().click()
  await expect(card.getByTestId('unvaccinated-note')).toContainText('접종 미완료 시 특히 응급')
  await expect(card).toContainText('수의사')

  await card.getByRole('button', { name: '이 증상으로 문진하기' }).click()
  await page.getByRole('button', { name: '방금·몇 시간 안' }).click()
  await page.getByRole('button', { name: '조금 처져요' }).click()
  await page.getByRole('button', { name: '덜 먹어요' }).click()
  const result = page.getByTestId('triage-result')
  await expect(result).toContainText('지금 바로 병원')
  const script = page.getByTestId('call-script')
  await expect(script).toContainText('생후 116일')
  await expect(script).toContainText('2.4kg')
  await expect(script).toContainText('종합백신(DHPPL) 3/5차')
})
