// 앱 최초 실행 시 들어가는 기본값 (PRD 5.2, F-2.1, F-3.1, F-4.4)

export const DEFAULT_PROFILE = {
  name: '편백이',
  birthDate: '2026-07-23',
  breed: '꼬숑',
  targetWeightKg: 6.5,
  targetRangeKg: [5, 8],
  weightAlertPct: 10,
  puppyFactor: 3.0,
}

// kcal/g은 초기값. 포장지 표기로 꼭 확인·수정해야 한다 (PRD F-2.1)
export const DEFAULT_FOODS = [
  { id: 'food_royal_hypo', name: '로얄캐닌 하이포알러제닉', kcalPerG: 3.9 },
  { id: 'food_monge_bwild', name: '몬지 비와일드 (퍼피)', kcalPerG: 3.8 },
  { id: 'food_naturalcore_eco5b', name: '네츄럴코어 에코5b', kcalPerG: 3.6 },
]

export const DEFAULT_FEEDING = {
  currentFoodId: 'food_royal_hypo',
  mealsPerDay: 4,
  firstMealTime: '07:00',
  intervalHours: 6,
  schedule: ['07:00', '13:00', '19:00', '01:00'],
  logs: [],
}

// 일정(doses)은 1차 접종일을 입력하면 2단계 로직이 채운다
export const DEFAULT_VACCINES = [
  { id: 'vac_dhppl', name: '종합백신(DHPPL)', totalDoses: 5, intervalDays: 14, doses: [] },
  { id: 'vac_corona', name: '코로나 장염', totalDoses: 2, intervalDays: 14, doses: [] },
  { id: 'vac_kennel', name: '켄넬코프', totalDoses: 2, intervalDays: 14, doses: [] },
  { id: 'vac_influenza', name: '인플루엔자', totalDoses: 2, intervalDays: 14, doses: [] },
  { id: 'vac_rabies', name: '광견병', totalDoses: 1, intervalDays: 0, doses: [] },
]

export const DEFAULT_INSURERS = ['DB손해보험 펫블리', 'KB손해보험 금쪽같은 펫보험']

export const DEFAULT_CARE_TASKS = [
  { id: 'bath', name: '목욕', icon: '🛁', cycleDays: 21, lastDone: null, history: [] },
  { id: 'hygieneTrim', name: '위생미용', icon: '✂️', cycleDays: 21, lastDone: null, history: [] },
  { id: 'fullGrooming', name: '전체 미용', icon: '💇', cycleDays: 42, lastDone: null, history: [] },
  { id: 'nails', name: '발톱 깎기', icon: '💅', cycleDays: 14, lastDone: null, history: [] },
  { id: 'ears', name: '귀 청소', icon: '👂', cycleDays: 7, lastDone: null, history: [] },
  { id: 'teeth', name: '양치', icon: '🦷', cycleDays: 1, lastDone: null, history: [] },
  { id: 'analGlands', name: '항문낭 짜기', icon: '🍑', cycleDays: 28, lastDone: null, history: [] },
  { id: 'parasite', name: '심장사상충·외부기생충 예방', icon: '💊', cycleDays: 28, lastDone: null, history: [] },
]

// 일일 리포트·산책에서 고르는 매트·하네스 (설정에서 편집)
export const DEFAULT_GEAR = {
  mats: ['플로리아', '더조은매트'],
  harnesses: ['아워스 리뿌'],
}

export const DEFAULT_CONTACTS = [
  { id: 'contact_regular', type: 'regular', name: '', phone: '', address: '' },
  { id: 'contact_emergency24', type: 'emergency24', name: '', phone: '', address: '' },
]
