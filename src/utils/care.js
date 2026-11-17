// 산책 가이드·관리 주기·일일 리포트 (PRD F-4.2 ~ F-4.4)
import { addDays, diffDays } from './date.js'

/**
 * 1회 권장 산책 시간 (PRD F-4.3)
 * - 종합백신 미완료: '안고 바깥 구경' 모드 (5~10분)
 * - 그 외: 개월차 × 5분, 7~12개월차는 최대 40분, 성견(13개월차~)은 45분 (30~60분 범위)
 */
export function recommendedWalkMin(monthOrdinal, vaccinesDone) {
  if (!vaccinesDone) {
    return { mode: 'carry', perWalk: 10, timesPerDay: 1, daily: 10, range: '5~10분', note: '안고 바깥 구경 위주' }
  }
  if (monthOrdinal >= 13) {
    return { mode: 'walk', perWalk: 45, timesPerDay: 2, daily: 90, range: '30~60분', note: '놀이·노즈워크를 같이 해주면 좋아요' }
  }
  const perWalk = Math.min(Math.max(monthOrdinal, 3) * 5, 40)
  const note =
    monthOrdinal <= 3 ? '첫 산책: 짧고 즐겁게, 하네스 적응' : monthOrdinal >= 7 ? '오래 뛰기·점프는 피해 주세요' : ''
  return { mode: 'walk', perWalk, timesPerDay: 2, daily: perWalk * 2, range: `약 ${perWalk}분`, note }
}

/** 1회 산책이 권장의 1.5배를 넘는지 (안내 수준) */
export const isWalkTooLong = (minutes, perWalk) => minutes > perWalk * 1.5

/**
 * 다음 관리 예정일과 상태 (PRD F-4.4)
 * status: 'unknown'(기록 없음) | 'green' | 'yellow'(D-3 이내) | 'red'(지남)
 */
export function nextCareDue(lastDone, cycleDays, today) {
  if (!lastDone) return { dueDate: null, daysLeft: null, status: 'unknown', label: '기록 없음' }
  const dueDate = addDays(lastDone, cycleDays)
  const daysLeft = diffDays(today, dueDate)
  if (daysLeft < 0) return { dueDate, daysLeft, status: 'red', label: `${-daysLeft}일 지남` }
  if (daysLeft === 0) return { dueDate, daysLeft, status: 'yellow', label: '오늘' }
  if (daysLeft <= 3) return { dueDate, daysLeft, status: 'yellow', label: `D-${daysLeft}` }
  return { dueDate, daysLeft, status: 'green', label: `D-${daysLeft}` }
}

export const STATUS_EMOJI = { green: '🟢', yellow: '🟡', red: '🔴', unknown: '⚪' }

/** 일일 리포트 항목 (PRD F-4.2 표) */
export const REPORT_QUESTIONS = [
  { key: 'matSlip', label: '실내 활동', question: '거실 매트 위에서 미끄러지거나 넘어진 적이 있나요?', badAnswer: true },
  { key: 'activeIndoor', label: '실내 활동량', question: '평소처럼 활발하게 놀았나요?', badAnswer: false },
  { key: 'walked', label: '산책 여부', question: '하네스를 차고 야외 산책을 했나요?', badAnswer: null },
  { key: 'limping', label: '절뚝거림', question: '산책 중/후 다리를 절거나 들고 걷는 모습이 있었나요?', badAnswer: true, walkOnly: true },
  { key: 'harnessIssue', label: '하네스', question: '하네스 착용 부위에 쓸림이나 불편해하는 모습이 있었나요?', badAnswer: true, walkOnly: true },
  { key: 'otherIssue', label: '기타 이상', question: '계단·소파에서 뛰어내리기, 특정 다리를 핥는 행동 등이 있었나요?', badAnswer: true },
]

/** 리포트 상태: 'red'(절뚝거림) | 'yellow'(다른 이상 답변) | 'green' */
export function reportStatus(report) {
  if (!report) return 'unknown'
  if (report.limping) return 'red'
  const bad = REPORT_QUESTIONS.some(
    (q) => q.badAnswer !== null && q.key !== 'limping' && report[q.key] === q.badAnswer && !(q.walkOnly && !report.walked),
  )
  return bad ? 'yellow' : 'green'
}

/** 최근 7일(오늘 포함) 절뚝거림 2회 이상이면 상담 권장 */
export function limpAlert(reports, today) {
  const from = addDays(today, -6)
  const count = reports.filter((r) => r.limping && r.date >= from && r.date <= today).length
  return { count, alert: count >= 2 }
}
