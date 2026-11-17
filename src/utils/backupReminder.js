// 백업 리마인드 (PRD 8) — 순수 함수 (자가 진단에서 Node로도 돌린다)
import { diffDays } from './date.js'

export const BACKUP_REMIND_DAYS = 30

/** 백업할 만한 기록이 있는지 (처음 설치한 빈 앱에는 리마인드하지 않는다) */
export const hasUserRecords = (data) =>
  ['weights', 'receipts', 'photos', 'potty', 'walks', 'dailyReports', 'symptomLogs'].some((k) => data[k]?.length > 0) ||
  data.grooming?.brushDates?.length > 0

/**
 * 백업 리마인드 (PRD 8): 마지막 백업 후 30일이 지났거나, 기록은 있는데 한 번도 백업하지 않았으면 due
 * 반환: { due, daysSince(null이면 백업한 적 없음) }
 */
export function backupReminder(lastBackupDate, today, hasData) {
  const daysSince = lastBackupDate ? diffDays(lastBackupDate, today) : null
  const due = hasData && (daysSince === null || daysSince >= BACKUP_REMIND_DAYS)
  return { due, daysSince }
}
