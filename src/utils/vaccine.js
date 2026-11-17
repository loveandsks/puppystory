// 접종 스케줄 (PRD F-3.1, F-3.2)
import { addDays, diffDays } from './date.js'

/** 1차 접종일 기준 전체 일정 생성: N차 예정일 = 1차 + 간격 × (N−1) */
export function buildDoses(firstDate, totalDoses, intervalDays) {
  return Array.from({ length: totalDoses }, (_, i) => ({
    n: i + 1,
    dueDate: addDays(firstDate, intervalDays * i),
    doneDate: null,
    clinic: '',
    memo: '',
  }))
}

/**
 * 완료되지 않은 차수의 예정일을 다시 계산한다.
 * 기준점 = 마지막으로 완료한 차수의 실제 접종일 (없으면 1차 예정일).
 * 총 차수가 바뀌면 차수를 늘리거나 줄인다 (완료된 차수는 지우지 않는다).
 */
export function rescheduleDoses(doses, totalDoses, intervalDays) {
  if (!doses.length) return doses
  const lastDone = [...doses].reverse().find((d) => d.doneDate)
  const anchor = lastDone ? { n: lastDone.n, date: lastDone.doneDate } : { n: 1, date: doses[0].dueDate }
  const doneCount = doses.filter((d) => d.doneDate).length
  const length = Math.max(totalDoses, lastDone?.n ?? 0, doneCount)

  return Array.from({ length }, (_, i) => {
    const n = i + 1
    const existing = doses.find((d) => d.n === n)
    if (existing?.doneDate) return existing
    // 기준점보다 앞선 차수(완료 안 된 채 건너뛴 경우)는 기존 예정일 유지
    if (n < anchor.n) return existing ?? { n, dueDate: anchor.date, doneDate: null, clinic: '', memo: '' }
    return {
      n,
      dueDate: addDays(anchor.date, intervalDays * (n - anchor.n)),
      doneDate: null,
      clinic: existing?.clinic ?? '',
      memo: existing?.memo ?? '',
    }
  })
}

/** 'done' | 'overdue' | 'scheduled' */
export function doseStatus(dose, today) {
  if (dose.doneDate) return 'done'
  return dose.dueDate < today ? 'overdue' : 'scheduled'
}

export const DOSE_STATUS_LABEL = { done: '완료', overdue: '지연', scheduled: '예정' }

/** 모든 차수를 맞았는지 */
export const isSeriesComplete = (vaccine) =>
  vaccine.doses.length > 0 &&
  vaccine.doses.length >= vaccine.totalDoses &&
  vaccine.doses.every((d) => d.doneDate)

/** 가장 가까운 미완료 접종 (지연 포함). 없으면 null */
export function nextUpcomingDose(vaccines, today) {
  const candidates = vaccines.flatMap((v) =>
    v.doses.filter((d) => !d.doneDate).map((d) => ({ vaccine: v, dose: d, daysLeft: diffDays(today, d.dueDate) })),
  )
  candidates.sort((a, b) => a.dose.dueDate.localeCompare(b.dose.dueDate))
  return candidates[0] ?? null
}

/** 종합백신 완료 여부 (산책 가이드 연동, PRD F-4.3) */
export const isCoreVaccineComplete = (vaccines) => {
  const core = vaccines.find((v) => v.id === 'vac_dhppl')
  return core ? isSeriesComplete(core) : false
}

/** "종합백신 4차까지 완료" 같은 요약 (문진 결과용) */
export function vaccineSummary(vaccines) {
  const parts = vaccines
    .map((v) => {
      const done = v.doses.filter((d) => d.doneDate).length
      if (!v.doses.length) return null
      return isSeriesComplete(v) ? `${v.name} 완료` : `${v.name} ${done}/${v.totalDoses}차`
    })
    .filter(Boolean)
  return parts.length ? parts.join(', ') : '접종 기록 없음'
}
