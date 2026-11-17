// 빗질 streak·배지 (PRD F-4.1)
import { addDays } from './date.js'

export const BRUSH_BADGES = [
  { id: 'streak3', days: 3, icon: '🪮', name: '빗질 입문' },
  { id: 'streak7', days: 7, icon: '✨', name: '뭉침 방지 1주' },
  { id: 'streak14', days: 14, icon: '🐑', name: '보송보송 2주' },
  { id: 'streak30', days: 30, icon: '🏅', name: '한 달 개근' },
  { id: 'streak100', days: 100, icon: '👑', name: '털 관리 마스터' },
]

/**
 * 현재 연속 일수.
 * 오늘 체크했으면 오늘부터, 아직이면 어제부터 거슬러 센다 (오늘 안 했다고 바로 0이 되지 않게).
 */
export function brushStreak(brushDates, today) {
  const set = new Set(brushDates)
  const doneToday = set.has(today)
  let day = doneToday ? today : addDays(today, -1)
  let streak = 0
  while (set.has(day)) {
    streak += 1
    day = addDays(day, -1)
  }
  return { streak, doneToday }
}

/** 기록 전체에서 가장 긴 연속 일수 (지난 날짜를 나중에 체크해도 반영) */
export function longestStreak(brushDates) {
  const sorted = [...new Set(brushDates)].sort()
  let best = 0
  let run = 0
  sorted.forEach((d, i) => {
    run = i > 0 && addDays(sorted[i - 1], 1) === d ? run + 1 : 1
    best = Math.max(best, run)
  })
  return best
}

/**
 * 체크 후 상태 갱신: 새로 받은 배지와 최고 기록.
 * 배지와 최고 기록은 줄어들지 않는다 (체크 해제·streak 끊김에도 유지).
 */
export function updateBadges(grooming, today) {
  const best = Math.max(grooming.bestStreak ?? 0, longestStreak(grooming.brushDates))
  const owned = new Set(grooming.badges.map((b) => b.id))
  const newly = BRUSH_BADGES.filter((b) => b.days <= best && !owned.has(b.id))
  return {
    bestStreak: best,
    badges: [...grooming.badges, ...newly.map((b) => ({ id: b.id, earnedAt: today }))],
    newly,
  }
}
