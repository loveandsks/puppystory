// 급여량 계산 (PRD F-2.2, F-2.3)
import { DEFAULT_FOODS } from '../data/defaults.js'
import { addDays, isValidTime, toLocalDateString, toTimeString } from './date.js'

export const MAX_WEIGHT_KG = 30

/**
 * 체중 입력 문자열 → { value } 또는 { error }
 * "2,4"(쉼표 소수점), 공백, 0 이하, 숫자 아님, 비정상적으로 큰 값을 처리한다.
 */
export function parseWeightInput(input) {
  const text = String(input ?? '').trim().replace(',', '.')
  if (text === '') return { error: '체중을 입력해 주세요.' }
  if (!/^(\d+(\.\d+)?|\.\d+)$/.test(text)) return { error: '숫자로 입력해 주세요. (예: 2.4)' }
  const value = Number(text)
  if (!(value > 0)) return { error: '0보다 큰 값을 입력해 주세요.' }
  if (value > MAX_WEIGHT_KG) return { error: `${MAX_WEIGHT_KG}kg 이하로 입력해 주세요.` }
  return { value: Math.round(value * 100) / 100 }
}

/** 양수 숫자 입력 (kcal 등) → number 또는 null. 쉼표 소수점 허용 */
export function parsePositiveNumber(input) {
  const text = String(input ?? '').trim().replace(',', '.')
  if (!/^(\d+(\.\d+)?|\.\d+)$/.test(text)) return null
  const value = Number(text)
  return value > 0 ? value : null
}

/** 기본 등록 사료의 예시 칼로리를 아직 확인·수정하지 않았는지 (PRD F-2.1: 포장지로 꼭 확인) */
export const isExampleKcal = (food) =>
  !!food && food.verified !== true && DEFAULT_FOODS.some((d) => d.id === food.id && d.kcalPerG === food.kcalPerG)

/** 휴식기 에너지 요구량 RER (kcal/일) = 70 × kg^0.75 */
export const rer = (kg) => 70 * kg ** 0.75

/** kcal/kg 표기 → kcal/g */
export const kcalPerKgToPerG = (kcalPerKg) => Math.round((kcalPerKg / 1000) * 100) / 100

/**
 * 하루·1회 권장 급여량. 입력이 잘못되면 null
 * 하루 g = RER × 퍼피 가중치 / 사료 kcal/g, 1회 g = 하루 g / 급여 횟수
 */
export function calcDailyFood({ kg, factor = 3.0, kcalPerG, meals = 4 }) {
  if (!(kg > 0) || !(factor > 0) || !(kcalPerG > 0) || !(meals >= 1)) return null
  const rerKcal = rer(kg)
  const derKcal = rerKcal * factor
  const dailyGrams = Math.round(derKcal / kcalPerG)
  return {
    rer: Math.round(rerKcal * 10) / 10,
    der: Math.round(derKcal),
    dailyGrams,
    perMealGrams: Math.round(dailyGrams / meals),
    meals,
  }
}

/** 첫 급여 시각 + 간격 × 횟수로 시간표 생성 ('07:00', 6, 4 → 07:00 13:00 19:00 01:00) */
export function buildSchedule(firstMealTime, intervalHours, mealsPerDay) {
  if (!isValidTime(firstMealTime)) return []
  const [h, m] = firstMealTime.split(':').map(Number)
  return Array.from({ length: mealsPerDay }, (_, i) => {
    const total = (h * 60 + m + Math.round(intervalHours * 60) * i) % (24 * 60)
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
  })
}

/**
 * '급여일' — 첫 급여 시각 이전(예: 새벽 01:00 급여)은 전날 급여 일정에 속한다.
 * 그래서 새벽 1시에 체크해도 "어제 4/4회"로 맞게 집계된다.
 */
export function getFeedingDay(now, firstMealTime) {
  const today = toLocalDateString(now)
  if (!isValidTime(firstMealTime)) return today
  return toTimeString(now) < firstMealTime ? addDays(today, -1) : today
}

/** 급여일 + 슬롯 시각 → 실제 달력 날짜 (첫 급여 시각보다 이른 슬롯은 다음 날) */
export const slotCalendarDate = (feedingDay, time, firstMealTime) =>
  time < firstMealTime ? addDays(feedingDay, 1) : feedingDay

/** 특정 급여일의 진행 상황 */
export function feedingProgress(feeding, feedingDay) {
  const total = Math.min(feeding.mealsPerDay, feeding.schedule.length)
  const done = feeding.logs.filter((l) => l.date === feedingDay && l.done && l.slot < total).length
  return { done, total }
}

/** 경과 4개월 이상인데 가중치가 2.5보다 크면 2.5로 낮추자고 제안 (PRD F-2.2) */
export const shouldSuggestLowerFactor = (monthsElapsed, factor) => monthsElapsed >= 4 && factor > 2.5
