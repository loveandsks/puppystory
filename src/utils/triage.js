// 간단 문진 → 긴급도 (PRD F-6.4). 정해진 조건표만 쓰고, 병명을 추정하지 않는다.

const LEVEL = { green: 0, yellow: 1, red: 2 }
const BY_LEVEL = ['green', 'yellow', 'red']

/**
 * card: 증상 카드, answers: { since, energy, appetite }, ctx: { vaccinesDone }
 * → { urgency, reasons[] }
 */
export function triage(card, answers, { vaccinesDone }) {
  let level = LEVEL[card.urgency]
  const reasons = [`'${card.title}'의 기본 긴급도`]
  const raise = (to, reason) => {
    if (LEVEL[to] > level) {
      level = LEVEL[to]
      reasons.push(reason)
    }
  }

  if (answers.energy === 'none') raise('red', '많이 처지거나 못 일어남')
  if (answers.energy === 'low') raise('yellow', '기운이 떨어짐')
  if (answers.appetite === 'none') raise('yellow', '밥을 안 먹음')
  if (answers.appetite === 'none' && answers.since !== 'now') raise('red', '퍼피가 반나절 넘게 굶음 (저혈당 위험)')
  if (answers.since === 'day') raise('yellow', '하루 넘게 계속됨')
  if (card.escalateIfUnvaccinated && !vaccinesDone) raise('red', '종합백신 접종 미완료 (전염성 장염 위험)')

  return { urgency: BY_LEVEL[level], reasons }
}

const SINCE_TEXT = { now: '방금·몇 시간 전부터', halfday: '반나절 전부터', day: '하루 넘게' }

/** "병원에 전화해서 이렇게 말하세요" 요약 */
export function buildCallScript({ profile, days, weightKg, card, answers, count, vaccineText, foodName }) {
  return [
    `생후 ${days}일 ${profile.breed}${weightKg ? `, ${weightKg}kg` : ''}이에요.`,
    `${SINCE_TEXT[answers.since] ?? ''} '${card.title}' 증상이 있어요${count > 1 ? ` (${count}회)` : ''}.`,
    `접종: ${vaccineText}.`,
    foodName ? `사료: ${foodName}.` : null,
  ]
    .filter(Boolean)
    .join(' ')
}
