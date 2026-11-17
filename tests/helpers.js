import { test as base, expect } from '@playwright/test'
import { injectExif } from '../src/utils/exif.js'

export const STORAGE_KEY = 'puppyDiary.v1'
export const TODAY = '2026-11-16T10:00:00'

/**
 * 모든 테스트 공통: 콘솔 에러·페이지 에러가 하나라도 나오면 실패.
 * (테스트마다 새 컨텍스트라 localStorage·IndexedDB는 항상 비어 있는 상태에서 시작한다)
 */
export const test = base.extend({
  consoleErrors: [
    async ({ page }, use) => {
      const errors = []
      page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
      page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`))
      await use(errors)
      expect(errors, '콘솔 에러가 없어야 해요').toEqual([])
    },
    { auto: true },
  ],
})
export { expect }

/** 오늘을 고정하고 앱 열기 */
export async function openApp(page, path = '', time = TODAY) {
  await page.clock.setFixedTime(new Date(time))
  await page.goto(`./#/${path}`)
  await expect(page.getByTestId('dday-header')).toBeVisible()
}

/** 오늘을 바꾸고 새로고침 (앱은 새로고침·자정에 오늘 날짜를 다시 읽는다) */
export async function moveToday(page, time) {
  await page.clock.setFixedTime(new Date(time))
  await page.reload()
  await expect(page.getByTestId('dday-header')).toBeVisible()
}

/** 첫 로드 전에 localStorage에 데이터 심기 (새로고침 때는 다시 심지 않음) */
export async function seed(page, state) {
  await page.addInitScript(
    ([key, s]) => {
      if (!localStorage.getItem('e2e-seeded')) {
        localStorage.setItem(key, JSON.stringify({ state: s, version: 1 }))
        localStorage.setItem('e2e-seeded', '1')
      }
    },
    [STORAGE_KEY, state],
  )
}

/** 저장된 스토어 데이터 읽기 */
export async function readStore(page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)).state, STORAGE_KEY)
}

/** 브라우저 Canvas로 작은 JPEG를 만들고, dateStr이 있으면 EXIF DateTimeOriginal을 넣는다 */
export async function makeJpeg(page, dateStr, color = '#f6a') {
  const b64 = await page.evaluate(async (fill) => {
    const c = document.createElement('canvas')
    c.width = 80
    c.height = 60
    const ctx = c.getContext('2d')
    ctx.fillStyle = fill
    ctx.fillRect(0, 0, 80, 60)
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.9))
    const bytes = new Uint8Array(await blob.arrayBuffer())
    let s = ''
    for (const b of bytes) s += String.fromCharCode(b)
    return btoa(s)
  }, color)
  const jpeg = new Uint8Array(Buffer.from(b64, 'base64'))
  return Buffer.from(dateStr ? injectExif(jpeg, dateStr) : jpeg)
}

/** <img>가 실제로 디코딩돼 보이는지 (IndexedDB Blob → objectURL) */
export async function expectImageLoaded(img) {
  await expect(img).toBeVisible()
  await expect.poll(() => img.evaluate((el) => el.complete && el.naturalWidth > 0)).toBe(true)
}

const done = (n, date) => ({ n, dueDate: date, doneDate: date, clinic: '', memo: '' })
const due = (n, date) => ({ n, dueDate: date, doneDate: null, clinic: '', memo: '' })

/** 종합백신 3/5차 완료 (미완료 상태) */
export const DHPPL_PARTIAL = {
  id: 'vac_dhppl',
  name: '종합백신(DHPPL)',
  totalDoses: 5,
  intervalDays: 14,
  doses: [done(1, '2026-09-10'), done(2, '2026-09-24'), done(3, '2026-10-08'), due(4, '2026-11-20'), due(5, '2026-12-04')],
}

/** 종합백신 5/5차 완료 */
export const DHPPL_COMPLETE = {
  ...DHPPL_PARTIAL,
  doses: [done(1, '2026-09-10'), done(2, '2026-09-24'), done(3, '2026-10-08'), done(4, '2026-10-22'), done(5, '2026-11-05')],
}

export const CORONA_DUE_1124 = {
  id: 'vac_corona',
  name: '코로나 장염',
  totalDoses: 2,
  intervalDays: 14,
  doses: [done(1, '2026-11-10'), due(2, '2026-11-24')],
}

export const weight = (id, date, kg) => ({ id, date, kg, memo: '' })
