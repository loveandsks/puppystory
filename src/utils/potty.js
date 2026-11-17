// 배변 기록 요약 (PRD F-2.4)

export const POOP_CONDITIONS = [
  { value: 'normal', label: '정상' },
  { value: 'soft', label: '무름' },
  { value: 'diarrhea', label: '설사' },
  { value: 'hard', label: '딱딱함' },
]

/** 특정 날짜('YYYY-MM-DD')의 배변 요약 */
export function summarizePotty(potty, date) {
  const list = potty.filter((p) => p.at.startsWith(date))
  const onPad = list.filter((p) => p.onPad).length
  const diarrhea = list.filter((p) => p.type === 'poop' && p.condition === 'diarrhea').length
  return {
    pee: list.filter((p) => p.type === 'pee').length,
    poop: list.filter((p) => p.type === 'poop').length,
    total: list.length,
    padRate: list.length ? Math.round((onPad / list.length) * 100) : null,
    diarrhea,
    diarrheaAlert: diarrhea >= 2,
  }
}
