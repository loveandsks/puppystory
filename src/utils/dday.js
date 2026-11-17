// 생년월일 기반 날짜 연산 (PRD F-1.1)
import { diffDays, parseLocalDate } from './date.js'

/** 생후 일수 (로컬 자정 기준). 생일 당일 0, 생일 전이면 음수 */
export function getDayCount(birth, date) {
  return diffDays(birth, date)
}

/** 생일로부터 달력 기준으로 꽉 채워 지난 개월 수 (7/23생 → 11/16은 3) */
export function getMonthsElapsed(birth, date) {
  const b = parseLocalDate(birth)
  const d = parseLocalDate(date)
  if (!b || !d) return null
  let months = (d.getFullYear() - b.getFullYear()) * 12 + (d.getMonth() - b.getMonth())
  // 이번 달 생일 날짜가 아직 안 됐으면 1개월 덜 지난 것.
  // 그 달에 생일 날짜가 없으면(1/31생의 2월) 말일을 생일로 본다.
  const lastDayOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  if (d.getDate() < Math.min(b.getDate(), lastDayOfMonth)) months -= 1
  return months
}

/** 'N개월차'의 N (= 경과 개월 + 1). 생일 전이면 0 */
export function getMonthOrdinal(birth, date) {
  const m = getMonthsElapsed(birth, date)
  if (m === null) return null
  return m < 0 ? 0 : m + 1
}

/** 헤더 표시용 묶음 */
export function getDDayInfo(birth, date) {
  const days = getDayCount(birth, date)
  const monthOrdinal = getMonthOrdinal(birth, date)
  return {
    days,
    monthOrdinal,
    isBorn: days !== null && days >= 0,
    dayLabel: days === null ? '' : days >= 0 ? `D+${days}` : `D${days}`,
    monthLabel: monthOrdinal ? `${monthOrdinal}개월차` : '',
  }
}

/** 사진 태그 (PRD F-5.2): "생후 116일차 편백이" / "태어나기 전 편백이" */
export function ageTag(birth, date, name) {
  const days = getDayCount(birth, date)
  if (days === null) return ''
  return days < 0 ? `태어나기 전 ${name}` : `생후 ${days}일차 ${name}`
}
