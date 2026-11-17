// 날짜는 항상 로컬 기준 'YYYY-MM-DD' 문자열로 다룬다.
// new Date('YYYY-MM-DD')는 UTC 자정으로 해석되고, toISOString()은 UTC로 바꿔서
// 시간대에 따라 하루가 밀리므로 이 파일 밖에서는 쓰지 않는다.

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/
const MS_PER_DAY = 86_400_000

const pad = (n) => String(n).padStart(2, '0')

/** Date → 로컬 기준 'YYYY-MM-DD' */
export function toLocalDateString(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** 'YYYY-MM-DD' → 로컬 자정 Date. 형식이 틀리거나 없는 날짜(2026-02-30 등)면 null */
export function parseLocalDate(str) {
  const m = DATE_RE.exec(str ?? '')
  if (!m) return null
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const date = new Date(y, mo - 1, d)
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null
  return date
}

/** 'YYYY-MM-DD'에 n일을 더한 'YYYY-MM-DD' */
export function addDays(dateStr, n) {
  const date = parseLocalDate(dateStr)
  if (!date) return null
  date.setDate(date.getDate() + n)
  return toLocalDateString(date)
}

/** to − from 일수 (정수). 서머타임으로 하루가 23/25시간이어도 반올림으로 보정 */
export function diffDays(from, to) {
  const a = parseLocalDate(from)
  const b = parseLocalDate(to)
  if (!a || !b) return null
  return Math.round((b - a) / MS_PER_DAY)
}

/** 'YYYY-MM-DD' 형식이면서 실제 존재하는 날짜인지 */
export const isValidDateString = (str) => parseLocalDate(str) !== null

/** Date → 로컬 기준 'YYYY-MM-DDTHH:mm' */
export function toLocalDateTimeString(date = new Date()) {
  return `${toLocalDateString(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** 'YYYY-MM-DDTHH:mm' → 로컬 Date. 잘못된 값이면 null */
export function parseLocalDateTime(str) {
  const [d, t] = String(str ?? '').split('T')
  const date = parseLocalDate(d)
  const m = /^(\d{2}):(\d{2})$/.exec(t ?? '')
  if (!date || !m) return null
  date.setHours(Number(m[1]), Number(m[2]), 0, 0)
  return date
}

/** 'YYYY-MM-DD' + 'HH:mm' → 로컬 Date */
export const combineDateTime = (dateStr, timeStr) => parseLocalDateTime(`${dateStr}T${timeStr}`)

/** 'HH:mm' 형식 검사 */
export const isValidTime = (t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t ?? '')

/** Date → 'HH:mm' */
export const toTimeString = (date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`

/** 'YYYY-MM-DD' → '11월 16일 (월)' */
export function formatKoreanDate(dateStr, { withYear = false } = {}) {
  const d = parseLocalDate(dateStr)
  if (!d) return ''
  const w = '일월화수목금토'[d.getDay()]
  return `${withYear ? `${d.getFullYear()}년 ` : ''}${d.getMonth() + 1}월 ${d.getDate()}일 (${w})`
}
