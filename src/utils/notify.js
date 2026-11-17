// 알림 엔진 (PRD 4.2 기술적 제약, 7. 알림 트리거 요약)
// 서버가 없으므로 "앱이 열려 있을 때" 예정 시각에 알림을 띄우고,
// 닫혀 있던 동안 지나간 알림은 다음에 열 때 '놓친 일정'으로 모아 보여준다.
import { addDays, combineDateTime, toLocalDateString } from './date.js'
import { slotCalendarDate } from './feeding.js'
import { nextCareDue } from './care.js'

const VACCINE_HOUR = '09:00'
export const MISSED_LOOKBACK_HOURS = 48
const FIRED_KEEP_DAYS = 30

/**
 * [start, end] 구간에 울려야 하는 알림 목록 (시간순).
 * 각 알림 { key, at: Date, title, body, kind }
 * key가 같으면 같은 알림 — firedKeys로 중복 발송을 막는다.
 */
export function buildEvents(state, start, end) {
  const { profile, feeding, vaccines, careTasks = [], foods } = state
  const events = []
  const startDay = addDays(toLocalDateString(start), -1)
  const endDay = toLocalDateString(end)
  const inRange = (at) => at && at >= start && at <= end

  // 급여: 급여일마다 슬롯별 1건 (이미 체크한 슬롯은 제외)
  const slots = feeding.schedule.slice(0, feeding.mealsPerDay)
  const food = foods.find((f) => f.id === feeding.currentFoodId)
  for (let day = startDay; day <= endDay; day = addDays(day, 1)) {
    slots.forEach((time, slot) => {
      const at = combineDateTime(slotCalendarDate(day, time, feeding.firstMealTime), time)
      const done = feeding.logs.some((l) => l.date === day && l.slot === slot && l.done)
      if (!done && inRange(at)) {
        events.push({
          key: `feed-${day}-${slot}`,
          kind: 'feed',
          at,
          title: `🍚 ${profile.name} 밥 먹을 시간!`,
          body: `${time} ${slot + 1}번째 급여${food ? ` · ${food.name}` : ''}`,
        })
      }
    })
  }

  // 접종: 예정일 3일 전 09:00, 당일 09:00
  for (const v of vaccines) {
    for (const d of v.doses) {
      if (d.doneDate) continue
      const d3 = combineDateTime(addDays(d.dueDate, -3), VACCINE_HOUR)
      const d0 = combineDateTime(d.dueDate, VACCINE_HOUR)
      if (inRange(d3))
        events.push({ key: `vac-${v.id}-${d.n}-${d.dueDate}-d3`, kind: 'vaccine', at: d3, title: '💉 3일 뒤 접종 예정', body: `${v.name} ${d.n}차 (${d.dueDate})` })
      if (inRange(d0))
        events.push({ key: `vac-${v.id}-${d.n}-${d.dueDate}-d0`, kind: 'vaccine', at: d0, title: '💉 오늘은 접종일!', body: `${v.name} ${d.n}차` })
    }
  }

  // 관리 주기 (목욕·위생미용 등, 주기 7일 이상만 — 매일 하는 양치는 제외)
  for (const t of careTasks) {
    if (!t.lastDone || t.cycleDays < 7) continue
    const { dueDate } = nextCareDue(t.lastDone, t.cycleDays, toLocalDateString(start))
    const d3 = combineDateTime(addDays(dueDate, -3), VACCINE_HOUR)
    const d0 = combineDateTime(dueDate, VACCINE_HOUR)
    if (inRange(d3)) events.push({ key: `care-${t.id}-${dueDate}-d3`, kind: 'care', at: d3, title: `${t.icon} 3일 뒤 ${t.name} 예정`, body: dueDate })
    if (inRange(d0)) events.push({ key: `care-${t.id}-${dueDate}-d0`, kind: 'care', at: d0, title: `${t.icon} 오늘 ${t.name} 하는 날!`, body: '' })
  }

  return events.sort((a, b) => a.at - b.at)
}

/** 아직 안 울린 알림 중 now까지 지난 것 */
export function dueEvents(state, now, firedKeys, sinceMs) {
  const start = new Date(sinceMs ?? now.getTime() - MISSED_LOOKBACK_HOURS * 3600_000)
  return buildEvents(state, start, now).filter((e) => !firedKeys[e.key])
}

/** 30일 지난 발송 기록 정리. firedKeys: { key → 'YYYY-MM-DD'(발송일) } */
export function pruneFiredKeys(firedKeys, today) {
  const cutoff = addDays(today, -FIRED_KEEP_DAYS)
  return Object.fromEntries(Object.entries(firedKeys).filter(([, day]) => day >= cutoff))
}

/** 브라우저 알림 권한 상태: 'granted' | 'denied' | 'default' | 'unsupported' */
export const notificationPermission = () =>
  'Notification' in globalThis ? Notification.permission : 'unsupported'

export async function requestNotificationPermission() {
  if (!('Notification' in globalThis)) return 'unsupported'
  try {
    return await Notification.requestPermission()
  } catch {
    return Notification.permission
  }
}

/** 시스템 알림 (권한이 없거나 실패하면 false → 앱 안 토스트만 사용) */
export function showSystemNotification(title, body) {
  if (notificationPermission() !== 'granted') return false
  try {
    new Notification(title, { body, tag: title })
    return true
  } catch {
    // 안드로이드 크롬은 Service Worker 없이 new Notification()을 막는다
    return false
  }
}
