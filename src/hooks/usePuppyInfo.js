import { usePuppyStore } from '../store/usePuppyStore.js'
import { getDDayInfo, getMonthsElapsed } from '../utils/dday.js'
import { latestWeight } from '../utils/growth.js'
import { isCoreVaccineComplete } from '../utils/vaccine.js'
import { useToday } from './useToday.js'

/** 여러 화면에서 쓰는 파생값 묶음 */
export function usePuppyInfo() {
  const today = useToday()
  const profile = usePuppyStore((s) => s.profile)
  const weights = usePuppyStore((s) => s.weights)
  const vaccines = usePuppyStore((s) => s.vaccines)
  const dday = getDDayInfo(profile.birthDate, today)
  return {
    today,
    profile,
    ...dday,
    monthsElapsed: getMonthsElapsed(profile.birthDate, today),
    latest: latestWeight(weights),
    vaccinesDone: isCoreVaccineComplete(vaccines),
  }
}
