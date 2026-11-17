// 자가 진단: PRD 검증 예시로 순수 함수를 확인한다 (설정 → 자가 진단, 개발 모드 시작 시 console.assert)
import { addDays, diffDays, parseLocalDate, toLocalDateString } from './date.js'
import { ageTag, getDayCount, getMonthOrdinal } from './dday.js'
import { analyzeWeights, growthPct, weeklyChangePct } from './growth.js'
import { buildSchedule, calcDailyFood, getFeedingDay, isExampleKcal, parseWeightInput } from './feeding.js'
import { backupReminder } from './backupReminder.js'
import { sanitizeData } from './sanitize.js'
import { summarizePotty } from './potty.js'
import { buildDoses, rescheduleDoses } from './vaccine.js'
import { filterReceipts, pendingSummary } from './receipts.js'
import { brushStreak, updateBadges } from './grooming.js'
import { limpAlert, nextCareDue, recommendedWalkMin } from './care.js'
import { parseExifDate, injectExif } from './exif.js'
import { buildIcs } from './ics.js'
import { buildEvents, pruneFiredKeys } from './notify.js'
import { triage } from './triage.js'
import { SYMPTOM_CARDS } from '../data/emergencyGuide.js'

const BIRTH = '2026-07-23'
const TODAY = '2026-11-16'

function cases() {
  const doses = buildDoses('2026-09-10', 5, 14)
  const late = rescheduleDoses(
    doses.map((d) => (d.n === 2 ? { ...d, doneDate: '2026-09-27' } : d.n === 1 ? { ...d, doneDate: '2026-09-10' } : d)),
    5,
    14,
  )
  const weightsUp = [
    { id: 'a', date: '2026-11-01', kg: 2.0 },
    { id: 'b', date: '2026-11-08', kg: 2.3 },
  ]
  const weightsDown = [...weightsUp, { id: 'c', date: '2026-11-15', kg: 2.2 }]
  const receipts = [
    { id: 1, visitDate: '2026-11-01', amount: 45000, status: 'pending', insurer: 'A' },
    { id: 2, visitDate: '2026-11-05', amount: 82000, status: 'pending', insurer: 'B' },
    { id: 3, visitDate: '2026-11-09', amount: 30000, status: 'claimed', insurer: 'A' },
  ]
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9])
  const state = {
    profile: { name: '편백이' },
    foods: [],
    feeding: { schedule: ['07:00', '13:00', '19:00', '01:00'], mealsPerDay: 4, firstMealTime: '07:00', logs: [], currentFoodId: null },
    vaccines: [{ id: 'v', name: '종합백신', doses: [{ n: 3, dueDate: '2026-11-19', doneDate: null }] }],
    careTasks: [],
  }
  const ics = buildIcs(state, TODAY)
  const events = buildEvents(state, new Date(2026, 10, 16, 0, 0), new Date(2026, 10, 16, 23, 59))
  const card = (id) => SYMPTOM_CARDS.find((c) => c.id === id)

  return [
    ['날짜: 로컬 자정 파싱', parseLocalDate('2026-07-23').getHours(), 0],
    ['날짜: 없는 날짜 거부', parseLocalDate('2026-02-30'), null],
    ['날짜: 월말 더하기', addDays('2026-01-31', 1), '2026-02-01'],
    ['날짜: 일수 차이', diffDays('2026-11-01', '2026-11-22'), 21],
    ['AC-1 생후 일수', getDayCount(BIRTH, TODAY), 116],
    ['AC-1 개월차', getMonthOrdinal(BIRTH, TODAY), 4],
    ['개월차: 생일 하루 전', getMonthOrdinal(BIRTH, '2026-08-22'), 1],
    ['개월차: 한 달 되는 날', getMonthOrdinal(BIRTH, '2026-08-23'), 2],
    ['개월차: 1/31생의 2월 말', getMonthOrdinal('2026-01-31', '2026-02-28'), 2],
    ['사진 태그', ageTag(BIRTH, TODAY, '편백이'), '생후 116일차 편백이'],
    ['사진 태그: 생일 전', ageTag(BIRTH, '2026-07-01', '편백이'), '태어나기 전 편백이'],
    ['AC-4 하루 급여량', calcDailyFood({ kg: 2.4, factor: 3, kcalPerG: 3.8, meals: 4 }).dailyGrams, 107],
    ['AC-4 1회 급여량', calcDailyFood({ kg: 2.4, factor: 3, kcalPerG: 3.8, meals: 4 }).perMealGrams, 27],
    ['체중 입력: 쉼표 소수점', parseWeightInput('2,4').value, 2.4],
    ['체중 입력: 0 거부', Boolean(parseWeightInput('0').error), true],
    ['체중 입력: 문자 거부', Boolean(parseWeightInput('abc').error), true],
    ['체중 입력: 음수 거부', Boolean(parseWeightInput('-1').error), true],
    ['급여 시간표', buildSchedule('07:00', 6, 4).join(' '), '07:00 13:00 19:00 01:00'],
    ['급여일: 새벽 1시는 전날', getFeedingDay(new Date(2026, 10, 17, 1, 30), '07:00'), TODAY],
    ['성장률', growthPct(2.4, 6.5), 36.9],
    ['주당 변화율 (14일 간격 환산)', weeklyChangePct({ date: '2026-11-01', kg: 2 }, { date: '2026-11-15', kg: 2.4 }), 10],
    ['AC-3 급증 경고', analyzeWeights(weightsUp, 10).b.alert?.type, 'surge'],
    ['AC-3 감소 경고', analyzeWeights(weightsDown, 10).c.alert?.type, 'drop'],
    ['배변: 설사 2회 주의', summarizePotty([{ at: `${TODAY}T08:00`, type: 'poop', condition: 'diarrhea' }, { at: `${TODAY}T12:00`, type: 'poop', condition: 'diarrhea', onPad: true }], TODAY).diarrheaAlert, true],
    ['AC-5 접종 일정', doses.map((d) => d.dueDate.slice(5)).join(' '), '09-10 09-24 10-08 10-22 11-05'],
    ['접종: 실제 접종일 기준 재계산', late.slice(2).map((d) => d.dueDate.slice(5)).join(' '), '10-11 10-25 11-08'],
    ['AC-7 청구 대기 필터', filterReceipts(receipts, { status: 'pending' }).length, 2],
    ['AC-7 미청구 합계', pendingSummary(receipts).total, 127000],
    ['AC-8 3일 연속', brushStreak(['2026-11-14', '2026-11-15', TODAY], TODAY).streak, 3],
    ['AC-8 오늘 미체크면 어제까지', brushStreak(['2026-11-14', '2026-11-15'], TODAY).streak, 2],
    ['AC-8 하루 건너뛰면 0', brushStreak(['2026-11-14', '2026-11-15', TODAY], '2026-11-18').streak, 0],
    ['AC-8 배지 획득', updateBadges({ brushDates: ['2026-11-14', '2026-11-15', TODAY], badges: [], bestStreak: 0 }, TODAY).newly[0]?.id, 'streak3'],
    ['AC-9 절뚝거림 7일 2회', limpAlert([{ date: '2026-11-11', limping: true }, { date: TODAY, limping: true }], TODAY).alert, true],
    ['AC-9 8일 전은 제외', limpAlert([{ date: '2026-11-09', limping: true }, { date: TODAY, limping: true }], TODAY).alert, false],
    ['AC-10 EXIF 촬영일', parseExifDate(injectExif(jpeg, TODAY).buffer), TODAY],
    ['EXIF 없는 JPEG', parseExifDate(jpeg.buffer), null],
    ['AC-12 산책 4개월차 접종 완료', recommendedWalkMin(4, true).perWalk, 20],
    ['AC-12 접종 미완료', recommendedWalkMin(4, false).mode, 'carry'],
    ['AC-13 목욕 예정일', nextCareDue('2026-11-01', 21, TODAY).dueDate, '2026-11-22'],
    ['AC-13 11-19 🟡', nextCareDue('2026-11-01', 21, '2026-11-19').status, 'yellow'],
    ['AC-13 11-23 🔴 1일 지남', nextCareDue('2026-11-01', 21, '2026-11-23').label, '1일 지남'],
    ['AC-6 .ics 접종 D-3 알림', ics.includes('TRIGGER:-P3D'), true],
    ['AC-6 .ics 급여 매일 반복', ics.includes('RRULE:FREQ=DAILY'), true],
    ['AC-6 접종 D-3 알림 이벤트', events.some((e) => e.key.endsWith('-d3')), true],
    ['알림: 급여 4건 (새벽 1시 제외 3건 + 전날 01:00)', events.filter((e) => e.kind === 'feed').length, 4],
    ['알림: 30일 지난 기록 정리', Object.keys(pruneFiredKeys({ a: '2026-10-01', b: TODAY }, TODAY)).join(), 'b'],
    ['AC-15 피 섞인 설사 + 접종 미완료 → 🔴', triage(card('diarrhea_blood'), { since: 'now', energy: 'normal', appetite: 'normal' }, { vaccinesDone: false }).urgency, 'red'],
    ['문진: 가벼운 구토는 🟢', triage(card('vomit_once'), { since: 'now', energy: 'normal', appetite: 'normal' }, { vaccinesDone: true }).urgency, 'green'],
    ['문진: 못 일어나면 🔴', triage(card('vomit_once'), { since: 'now', energy: 'none', appetite: 'normal' }, { vaccinesDone: true }).urgency, 'red'],
    ['응급 카드 18개', SYMPTOM_CARDS.length, 18],
    ['백업 리마인드: 기록 있고 백업 없음', backupReminder(null, TODAY, true).due, true],
    ['백업 리마인드: 빈 앱은 안 띄움', backupReminder(null, TODAY, false).due, false],
    ['백업 리마인드: 29일은 아직', backupReminder('2026-10-18', TODAY, true).due, false],
    ['백업 리마인드: 30일 지나면', backupReminder('2026-10-17', TODAY, true).due, true],
    ['가져오기 검사: 날짜 없는 체중·사진 제외', sanitizeData({ weights: [{ id: 'a', kg: 2 }, { id: 'b', date: TODAY, kg: 2.4 }], photos: [{ id: 'p' }] }).dropped, 2],
    ['가져오기 검사: 빈 이름은 기본값', sanitizeData({ profile: { name: ' ' } }).data.profile.name, '편백이'],
    ['가져오기 검사: 영수증 빠진 배열 채움', sanitizeData({ receipts: [{ id: 'r', visitDate: TODAY, amount: 1000, status: 'pending' }] }).data.receipts[0].imageIds.length, 0],
    ['사료 예시값 표시', isExampleKcal({ id: 'food_monge_bwild', kcalPerG: 3.8 }), true],
    ['사료 예시값: 확인하면 해제', isExampleKcal({ id: 'food_monge_bwild', kcalPerG: 3.8, verified: true }), false],
    ['오늘 날짜 문자열 형식', /^\d{4}-\d{2}-\d{2}$/.test(toLocalDateString()), true],
  ]
}

/** [{ name, pass, expected, actual }] */
export function runSelfTests() {
  return cases().map(([name, actual, expected]) => ({ name, actual, expected, pass: Object.is(actual, expected) }))
}
