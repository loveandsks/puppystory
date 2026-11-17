// 체중·성장률 로직 (PRD F-1.3, F-1.4)
import { diffDays } from './date.js'

const round1 = (n) => Math.round(n * 10) / 10

/** 성견 대비 성장률(%) — 소수점 1자리 */
export function growthPct(kg, targetKg) {
  if (!(kg > 0) || !(targetKg > 0)) return null
  return round1((kg / targetKg) * 100)
}

/** 주당 변화율(%) — 기록 간격이 7일이 아니어도 주 단위로 환산 */
export function weeklyChangePct(prev, curr) {
  const days = diffDays(prev.date, curr.date)
  if (!days || days <= 0 || !(prev.kg > 0)) return null
  return round1(((curr.kg - prev.kg) / prev.kg / (days / 7)) * 100)
}

/** 날짜 오름차순 정렬 사본 */
export const sortWeights = (weights) => [...weights].sort((a, b) => a.date.localeCompare(b.date))

export const latestWeight = (weights) => sortWeights(weights).at(-1) ?? null

/** 직전 기록과 비교한 경고. 감소 → 'drop', 주당 변화율 ≥ 임계값 → 'surge', 정상 → null */
export function evaluateWeight(prev, curr, thresholdPct = 10) {
  if (!prev) return null
  const pct = weeklyChangePct(prev, curr)
  const diffKg = Math.round((curr.kg - prev.kg) * 100) / 100
  if (curr.kg < prev.kg) {
    return {
      type: 'drop',
      pct,
      diffKg,
      message: `지난 기록보다 체중이 ${Math.abs(diffKg)}kg 줄었어요. 식욕·변 상태를 확인하고, 계속 줄면 병원 상담을 권장해요.`,
    }
  }
  if (pct !== null && pct >= thresholdPct) {
    return {
      type: 'surge',
      pct,
      diffKg,
      message: `1주 기준 ${pct}% 늘었어요. 급여량이 너무 많지 않은지 확인해 보세요.`,
    }
  }
  return null
}

/**
 * 전체 기록에 대해 { id → { weeklyPct, alert } } 계산.
 * 경고는 저장하지 않고 매번 계산한다 — 중간 기록을 수정·삭제해도 항상 맞게 나온다.
 */
export function analyzeWeights(weights, thresholdPct = 10) {
  const sorted = sortWeights(weights)
  const result = {}
  sorted.forEach((w, i) => {
    const prev = sorted[i - 1]
    result[w.id] = {
      weeklyPct: prev ? weeklyChangePct(prev, w) : null,
      alert: evaluateWeight(prev, w, thresholdPct),
    }
  })
  return result
}
