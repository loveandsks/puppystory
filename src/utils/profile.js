// 첫 화면("우리 아이 정보 입력")에서 받은 값을 프로필 변경분으로 바꾼다. 순수 함수 (selfTest.js에서 확인)
import { isValidDateString } from './date.js'

const round1 = (n) => Math.round(n * 10) / 10

/**
 * 입력 검사. 문제가 있으면 { field: 메시지 }를 돌려주고, 없으면 빈 객체.
 * input: { name, birthDate, breed, targetWeightKg(문자열, 비어 있어도 됨) }, today: 'YYYY-MM-DD'
 */
export function validateOnboarding(input, today) {
  const errors = {}
  if (!input.name?.trim()) errors.name = '이름을 입력해 주세요.'
  if (!isValidDateString(input.birthDate)) errors.birthDate = '생년월일을 골라 주세요.'
  else if (input.birthDate > today) errors.birthDate = '오늘보다 뒤의 날짜는 고를 수 없어요.'
  if (!input.breed?.trim()) errors.breed = '견종을 입력해 주세요. 잘 모르면 "믹스"라고 적어도 돼요.'
  const kg = String(input.targetWeightKg ?? '').trim()
  if (kg) {
    const n = Number(kg.replace(',', '.'))
    if (!Number.isFinite(n) || n < 1 || n > 30) errors.targetWeightKg = '1~30kg 사이로 적어 주세요. 모르면 비워 두세요.'
  }
  return errors
}

/**
 * 검사를 통과한 입력 → updateProfile에 넘길 변경분.
 * 성견 예상 체중을 적으면 그래프의 예상 범위(띠)를 그 값의 ±20%로 잡는다. 비우면 기존 값을 그대로 둔다.
 */
export function onboardingPatch(input) {
  const patch = {
    name: input.name.trim(),
    birthDate: input.birthDate,
    breed: input.breed.trim(),
    onboarded: true,
  }
  const kg = String(input.targetWeightKg ?? '').trim()
  if (kg) {
    const n = round1(Number(kg.replace(',', '.')))
    patch.targetWeightKg = n
    patch.targetRangeKg = [round1(n * 0.8), round1(n * 1.2)]
  }
  return patch
}
