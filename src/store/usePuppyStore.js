import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import {
  DEFAULT_CARE_TASKS,
  DEFAULT_CONTACTS,
  DEFAULT_FEEDING,
  DEFAULT_FOODS,
  DEFAULT_GEAR,
  DEFAULT_INSURERS,
  DEFAULT_PROFILE,
  DEFAULT_VACCINES,
} from '../data/defaults.js'
import { deleteImage } from '../db/imageDB.js'
import { buildSchedule } from '../utils/feeding.js'
import { updateBadges } from '../utils/grooming.js'
import { makeId } from '../utils/id.js'
import { pruneFiredKeys } from '../utils/notify.js'
import { sanitizeData } from '../utils/sanitize.js'
import { buildDoses, rescheduleDoses } from '../utils/vaccine.js'
import { useUiStore } from './useUiStore.js'

export const STORAGE_KEY = 'puppyDiary.v1'
export const SCHEMA_VERSION = 1

/** 사용자 데이터 초기값 (PRD 5.2). 이미지 Blob은 여기 넣지 않고 IndexedDB(src/db/imageDB.js)에 둔다. */
export function createInitialData() {
  // structuredClone: 기본값 객체를 여러 번 써도 서로 참조가 섞이지 않게
  return structuredClone({
    profile: DEFAULT_PROFILE,
    weights: [],
    foods: DEFAULT_FOODS,
    feeding: DEFAULT_FEEDING,
    potty: [],
    vaccines: DEFAULT_VACCINES,
    receipts: [],
    insurers: DEFAULT_INSURERS,
    grooming: { brushDates: [], badges: [], bestStreak: 0 },
    dailyReports: [],
    walks: [],
    walkTimer: { startedAt: null }, // 진행 중인 산책 (새로고침해도 타이머 유지)
    careTasks: DEFAULT_CARE_TASKS,
    groomingSalon: [],
    gear: DEFAULT_GEAR,
    contacts: DEFAULT_CONTACTS,
    symptomLogs: [],
    photos: [],
    // firedKeys: { 알림 key → 발송일 }, lastCheckedAt: 마지막 확인 시각(ms) — 이후 지나간 알림만 '놓친 일정'
    notifications: { enabled: false, firedKeys: {}, lastCheckedAt: null },
    // 마지막으로 백업 파일을 내려받은 날 (30일 지나면 설정 버튼에 배지, PRD 8)
    backupInfo: { lastBackupDate: null },
  })
}

const DATA_KEYS = Object.keys(createInitialData())

/** 스토어 state에서 함수(액션)를 뺀 순수 데이터만 추출 — persist 저장과 백업에 공통 사용 */
export const pickData = (state) => Object.fromEntries(DATA_KEYS.map((k) => [k, state[k]]))

/**
 * 외부에서 들어온 데이터(백업 파일, 옛 버전 저장분)를 현재 스키마에 맞춘다.
 * 없는 키는 기본값으로 채우고, 모르는 키는 버린다.
 */
function normalizeData(raw) {
  const base = createInitialData()
  const out = {}
  // 1단계 저장분은 firedKeys가 배열이었다
  if (Array.isArray(raw?.notifications?.firedKeys)) raw = { ...raw, notifications: { ...raw.notifications, firedKeys: {} } }
  // 항목 단위 검사: 화면을 깨뜨릴 항목(날짜 없는 기록 등)은 버린다 (utils/sanitize.js)
  const clean = sanitizeData(raw).data
  for (const key of DATA_KEYS) {
    const value = clean?.[key]
    if (value === undefined || value === null) out[key] = base[key]
    else if (Array.isArray(base[key])) out[key] = Array.isArray(value) ? value : base[key]
    else if (typeof base[key] === 'object') out[key] = { ...base[key], ...value }
    else out[key] = value
  }
  return out
}

/**
 * localStorage 래퍼. 쓰기가 실패해도(용량 초과 등) 액션이 예외로 멈추지 않게 하고,
 * 실패 상태를 useUiStore.saveError에 남겨 화면에 경고를 띄운다.
 * 접근 자체가 막힌 브라우저면 throw → persist가 저장 없이(메모리만) 동작한다.
 */
function safeLocalStorage() {
  const ui = useUiStore.getState
  let ls
  try {
    ls = window.localStorage
    ls.getItem(STORAGE_KEY)
  } catch (err) {
    ui().setSaveError('blocked')
    throw err
  }
  return {
    getItem: (key) => ls.getItem(key),
    setItem: (key, value) => {
      try {
        ls.setItem(key, value)
        if (ui().saveError) ui().setSaveError(null)
      } catch (err) {
        ui().setSaveError(err?.name === 'QuotaExceededError' ? 'quota' : 'unknown')
      }
    },
    removeItem: (key) => ls.removeItem(key),
  }
}

const byId = (id) => (item) => item.id === id
const replaceById = (list, id, fn) => list.map((item) => (item.id === id ? fn(item) : item))

export const usePuppyStore = create(
  persist(
    (set, get) => ({
      ...createInitialData(),

      // ── 프로필 ─────────────────────────────────────
      updateProfile: (patch) => set((s) => ({ profile: { ...s.profile, ...patch } })),

      // ── 체중 (F-1.2) ──────────────────────────────
      /** 같은 날짜 기록이 있으면 그 기록을 대체한다 (덮어쓰기 확인은 화면에서). 저장된 id 반환 */
      saveWeight: ({ id, date, kg, memo = '' }) => {
        const newId = id ?? makeId('w')
        set((s) => ({
          weights: [
            ...s.weights.filter((w) => w.id !== newId && w.date !== date),
            { id: newId, date, kg, memo },
          ].sort((a, b) => a.date.localeCompare(b.date)),
        }))
        return newId
      },
      deleteWeight: (id) => set((s) => ({ weights: s.weights.filter((w) => w.id !== id) })),

      // ── 사료·급여 (F-2.1 ~ F-2.3) ─────────────────
      // verified: 사용자가 포장지 값으로 확인했는지 (기본 사료는 예시값이라 false)
      addFood: ({ name, kcalPerG }) => set((s) => ({ foods: [...s.foods, { id: makeId('food'), name, kcalPerG, verified: true }] })),
      updateFood: (id, patch) => set((s) => ({ foods: replaceById(s.foods, id, (f) => ({ ...f, ...patch })) })),
      deleteFood: (id) =>
        set((s) => {
          const foods = s.foods.filter((f) => f.id !== id)
          const currentFoodId = s.feeding.currentFoodId === id ? (foods[0]?.id ?? null) : s.feeding.currentFoodId
          return { foods, feeding: { ...s.feeding, currentFoodId } }
        }),
      setCurrentFood: (id) => set((s) => ({ feeding: { ...s.feeding, currentFoodId: id } })),

      /** 첫 급여 시각·간격·횟수를 바꾸면 시간표를 다시 만든다 */
      updateFeedingPlan: (patch) =>
        set((s) => {
          const next = { ...s.feeding, ...patch }
          next.schedule = buildSchedule(next.firstMealTime, next.intervalHours, next.mealsPerDay)
          return { feeding: next }
        }),
      /** 시간표의 한 칸만 직접 수정 */
      setScheduleTime: (slot, time) =>
        set((s) => {
          const schedule = [...s.feeding.schedule]
          schedule[slot] = time
          return { feeding: { ...s.feeding, schedule } }
        }),
      /** 급여 체크 토글. date는 '급여일'(feeding.getFeedingDay) */
      toggleMeal: (date, slot, grams) =>
        set((s) => {
          const exists = s.feeding.logs.find((l) => l.date === date && l.slot === slot)
          const logs = exists
            ? s.feeding.logs.filter((l) => l !== exists)
            : [...s.feeding.logs, { date, slot, time: s.feeding.schedule[slot], done: true, grams: grams ?? null }]
          return { feeding: { ...s.feeding, logs } }
        }),
      setMealGrams: (date, slot, grams) =>
        set((s) => ({
          feeding: {
            ...s.feeding,
            logs: s.feeding.logs.map((l) => (l.date === date && l.slot === slot ? { ...l, grams } : l)),
          },
        })),

      // ── 배변 (F-2.4) ──────────────────────────────
      addPotty: (entry) => set((s) => ({ potty: [...s.potty, { id: makeId('p'), memo: '', ...entry }] })),
      deletePotty: (id) => set((s) => ({ potty: s.potty.filter((p) => p.id !== id) })),

      // ── 접종 (F-3.1) ──────────────────────────────
      /** 1차 접종일 입력 → 전체 일정 생성. alreadyDone이면 1차를 완료로 표시 */
      setFirstDose: (vaccineId, date, alreadyDone) =>
        set((s) => ({
          vaccines: replaceById(s.vaccines, vaccineId, (v) => {
            const doses = buildDoses(date, v.totalDoses, v.intervalDays)
            if (alreadyDone) doses[0].doneDate = date
            return { ...v, doses }
          }),
        })),
      /** 완료 처리 → 이후 차수는 실제 접종일 기준으로 다시 계산 */
      completeDose: (vaccineId, n, doneDate, clinic = '') =>
        set((s) => ({
          vaccines: replaceById(s.vaccines, vaccineId, (v) => {
            const doses = v.doses.map((d) => (d.n === n ? { ...d, doneDate, clinic: clinic || d.clinic } : d))
            return { ...v, doses: rescheduleDoses(doses, v.totalDoses, v.intervalDays) }
          }),
        })),
      undoDose: (vaccineId, n) =>
        set((s) => ({
          vaccines: replaceById(s.vaccines, vaccineId, (v) => ({
            ...v,
            doses: v.doses.map((d) => (d.n === n ? { ...d, doneDate: null } : d)),
          })),
        })),
      updateDose: (vaccineId, n, patch) =>
        set((s) => ({
          vaccines: replaceById(s.vaccines, vaccineId, (v) => ({
            ...v,
            doses: v.doses.map((d) => (d.n === n ? { ...d, ...patch } : d)),
          })),
        })),
      /** 총 차수·간격 변경 → 미완료 차수 재계산 */
      updateVaccinePlan: (vaccineId, { totalDoses, intervalDays }) =>
        set((s) => ({
          vaccines: replaceById(s.vaccines, vaccineId, (v) => ({
            ...v,
            totalDoses,
            intervalDays,
            doses: rescheduleDoses(v.doses, totalDoses, intervalDays),
          })),
        })),
      resetVaccine: (vaccineId) =>
        set((s) => ({ vaccines: replaceById(s.vaccines, vaccineId, (v) => ({ ...v, doses: [] })) })),

      // ── 영수증 (F-3.3, F-3.4) ─────────────────────
      addReceipt: (receipt) =>
        set((s) => ({
          receipts: [
            ...s.receipts,
            { id: makeId('r'), claimedDate: null, paidAmount: null, imageIds: [], detailImageIds: [], memo: '', ...receipt },
          ],
        })),
      updateReceipt: (id, patch) => set((s) => ({ receipts: replaceById(s.receipts, id, (r) => ({ ...r, ...patch })) })),
      /** [청구 대기] ↔ [청구 완료]. 완료 시 청구일 기록 */
      toggleReceiptStatus: (id, today) =>
        set((s) => ({
          receipts: replaceById(s.receipts, id, (r) =>
            r.status === 'claimed'
              ? { ...r, status: 'pending', claimedDate: null, paidAmount: null }
              : { ...r, status: 'claimed', claimedDate: today },
          ),
        })),
      /** 영수증 삭제 + IndexedDB 이미지 삭제 */
      deleteReceipt: (id) => {
        const r = get().receipts.find(byId(id))
        set((s) => ({ receipts: s.receipts.filter((x) => x.id !== id) }))
        for (const imgId of [...(r?.imageIds ?? []), ...(r?.detailImageIds ?? [])]) deleteImage(imgId).catch(() => {})
      },
      setInsurers: (insurers) => set({ insurers }),

      // ── 알림 ──────────────────────────────────────
      setNotificationsEnabled: (enabled) => set((s) => ({ notifications: { ...s.notifications, enabled } })),
      /** 알림 확인 기록: 발송한 key 저장 + 마지막 확인 시각 갱신 */
      /** otherFiredKeys: 다른 탭이 방금 저장한 발송 기록 (함께 합쳐서 덮어쓰지 않게) */
      markChecked: (keys, today, nowMs, otherFiredKeys = {}) =>
        set((s) => {
          const firedKeys = { ...otherFiredKeys, ...s.notifications.firedKeys }
          for (const k of keys) firedKeys[k] = today
          return {
            notifications: { ...s.notifications, firedKeys: pruneFiredKeys(firedKeys, today), lastCheckedAt: nowMs },
          }
        }),

      // ── 빗질 (F-4.1) ──────────────────────────────
      /** 체크/해제. 새로 받은 배지 목록 반환 (축하 표시용) */
      toggleBrush: (date, today = date) => {
        const g = get().grooming
        const brushDates = g.brushDates.includes(date)
          ? g.brushDates.filter((d) => d !== date)
          : [...g.brushDates, date].sort()
        const { badges, bestStreak, newly } = updateBadges({ ...g, brushDates }, today)
        set({ grooming: { ...g, brushDates, badges, bestStreak } })
        return newly
      },

      // ── 일일 리포트 (F-4.2) ───────────────────────
      saveDailyReport: (date, patch) =>
        set((s) => {
          const existing = s.dailyReports.find((r) => r.date === date)
          return {
            dailyReports: existing
              ? s.dailyReports.map((r) => (r.date === date ? { ...r, ...patch } : r))
              : [...s.dailyReports, { date, ...patch }],
          }
        }),

      // ── 산책 (F-4.3) ──────────────────────────────
      startWalk: (startedAt) => set({ walkTimer: { startedAt } }),
      cancelWalk: () => set({ walkTimer: { startedAt: null } }),
      addWalk: (walk) =>
        set((s) => ({ walks: [...s.walks, { id: makeId('wk'), memo: '', place: '', ...walk }], walkTimer: { startedAt: null } })),
      deleteWalk: (id) => set((s) => ({ walks: s.walks.filter((w) => w.id !== id) })),

      // ── 관리 주기 (F-4.4) ─────────────────────────
      markCareDone: (taskId, date) =>
        set((s) => ({
          careTasks: replaceById(s.careTasks, taskId, (t) => {
            const history = [...new Set([...t.history, date])].sort()
            return { ...t, history, lastDone: history.at(-1) }
          }),
        })),
      undoCareDone: (taskId, date) =>
        set((s) => ({
          careTasks: replaceById(s.careTasks, taskId, (t) => {
            const history = t.history.filter((d) => d !== date)
            return { ...t, history, lastDone: history.at(-1) ?? null }
          }),
        })),
      setCareCycle: (taskId, cycleDays) =>
        set((s) => ({ careTasks: replaceById(s.careTasks, taskId, (t) => ({ ...t, cycleDays })) })),
      setGear: (gear) => set((s) => ({ gear: { ...s.gear, ...gear } })),

      // ── 사진 (F-5) ────────────────────────────────
      addPhoto: (photo) => set((s) => ({ photos: [...s.photos, { id: makeId('ph'), memo: '', ...photo }] })),
      updatePhoto: (id, patch) => set((s) => ({ photos: replaceById(s.photos, id, (p) => ({ ...p, ...patch })) })),
      deletePhoto: (id) => {
        const p = get().photos.find(byId(id))
        set((s) => ({ photos: s.photos.filter((x) => x.id !== id) }))
        for (const imgId of [p?.imageId, p?.thumbId].filter(Boolean)) deleteImage(imgId).catch(() => {})
      },

      // ── 응급 (F-6) ────────────────────────────────
      updateContact: (id, patch) => set((s) => ({ contacts: replaceById(s.contacts, id, (c) => ({ ...c, ...patch })) })),
      addSymptomLog: (log) =>
        set((s) => ({ symptomLogs: [...s.symptomLogs, { id: makeId('s'), count: 1, memo: '', imageIds: [], ...log }] })),
      incrementSymptom: (id) =>
        set((s) => ({ symptomLogs: replaceById(s.symptomLogs, id, (l) => ({ ...l, count: l.count + 1 })) })),
      /** 증상 기록 삭제 + 첨부 사진(IndexedDB) 삭제 */
      deleteSymptomLog: (id) => {
        const log = get().symptomLogs.find(byId(id))
        set((s) => ({ symptomLogs: s.symptomLogs.filter((l) => l.id !== id) }))
        for (const imgId of log?.imageIds ?? []) deleteImage(imgId).catch(() => {})
      },

      // ── 백업 (PRD 8) ──────────────────────────────
      markBackedUp: (date) => set({ backupInfo: { lastBackupDate: date } }),

      // ── 백업 ──────────────────────────────────────
      /** 백업 JSON 가져오기. 검증은 호출하는 쪽(utils/backup.js)에서 끝낸 상태로 들어온다. */
      importData: (data) => set(normalizeData(data)),
      resetAll: () => set(createInitialData()),
    }),
    {
      name: STORAGE_KEY,
      version: SCHEMA_VERSION,
      storage: createJSONStorage(safeLocalStorage),
      partialize: pickData,
      // 스키마가 바뀌면 SCHEMA_VERSION을 올리고 여기서 옛 데이터를 변환한다.
      migrate: (persisted /* , fromVersion */) => normalizeData(persisted),
      // 저장분에 새로 추가된 키가 없어도 기본값으로 채워지게 정규화
      merge: (persisted, current) => ({ ...current, ...normalizeData(persisted) }),
    },
  ),
)

/** 다른 탭이 localStorage에 막 저장한 알림 발송 기록 (storage 이벤트가 오기 전의 짧은 경합 대비) */
export function readStoredFiredKeys() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY))?.state?.notifications?.firedKeys ?? {}
  } catch {
    return {}
  }
}

// 다른 탭에서 저장하면 이 탭도 다시 불러온다 — 탭 두 개가 서로 덮어쓰는 것 방지
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) usePuppyStore.persist.rehydrate()
  })
}
