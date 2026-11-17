// 영수증 필터·요약 (PRD F-3.3, F-3.4)

export const NO_CLAIM = '청구 안 함'
export const STATUS_LABEL = { pending: '청구 대기', claimed: '청구 완료', none: '청구 안 함' }

/** status: 'all' | 'pending' | 'claimed', insurer: 'all' | 보험사명 */
export function filterReceipts(receipts, { status = 'pending', insurer = 'all' } = {}) {
  return receipts
    .filter((r) => status === 'all' || r.status === status)
    .filter((r) => insurer === 'all' || r.insurer === insurer)
    .sort((a, b) => b.visitDate.localeCompare(a.visitDate))
}

/** 미청구 건수·합계 */
export function pendingSummary(receipts) {
  const pending = receipts.filter((r) => r.status === 'pending')
  return { count: pending.length, total: pending.reduce((sum, r) => sum + (Number(r.amount) || 0), 0) }
}

export const formatWon = (n) => `${(Number(n) || 0).toLocaleString('ko-KR')}원`

/** "45,000" / "45000원" 같은 입력 → 정수 원. 잘못되면 null */
export function parseAmount(input) {
  const digits = String(input ?? '').replace(/[,\s원]/g, '')
  if (digits === '') return 0
  if (!/^\d+$/.test(digits)) return null
  return Number(digits)
}
