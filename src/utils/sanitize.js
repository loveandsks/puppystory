// 외부에서 들어온 데이터(백업 파일, 저장된 옛 데이터)의 항목별 형식 검사.
// 고칠 수 있는 것(빠진 메모·빈 배열 등)은 기본값으로 채우고, 화면이 깨질 항목(날짜 없는 체중 등)은 버린다.
// 키 단위 정규화는 store의 normalizeData가, 항목 단위 검사는 여기서 한다.
import { DEFAULT_PROFILE } from '../data/defaults.js'
import { isValidDateString, isValidTime, parseLocalDateTime } from './date.js'

const isObj = (v) => typeof v === 'object' && v !== null && !Array.isArray(v)
const isStr = (v) => typeof v === 'string'
const isId = (v) => isStr(v) && v.length > 0
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const str = (v, fallback = '') => (isStr(v) ? v : fallback)
const strList = (v) => (Array.isArray(v) ? v.filter(isId) : [])
const validDateTime = (v) => isStr(v) && parseLocalDateTime(v) !== null

/** 배열의 각 항목을 fix(item) → 고친 항목 또는 null(버림). 버린 개수도 센다 */
function cleanList(list, fix, counter) {
  if (!Array.isArray(list)) return list
  const out = []
  for (const item of list) {
    const fixed = isObj(item) ? fix(item) : null
    if (fixed) out.push(fixed)
    else counter.dropped += 1
  }
  return out
}

const FIXERS = {
  weights: (w) => (isId(w.id) && isValidDateString(w.date) && num(w.kg) > 0 ? { ...w, memo: str(w.memo) } : null),
  foods: (f) => (isId(f.id) && isStr(f.name) && num(f.kcalPerG) > 0 ? f : null),
  potty: (p) => (isId(p.id) && validDateTime(p.at) && (p.type === 'pee' || p.type === 'poop') ? { ...p, memo: str(p.memo) } : null),
  vaccines: (v, c) => {
    if (!isId(v.id) || !isStr(v.name) || !(num(v.totalDoses) >= 1) || !(num(v.intervalDays) >= 0)) return null
    const doses = cleanList(
      Array.isArray(v.doses) ? v.doses : [],
      (d) =>
        num(d.n) >= 1 && isValidDateString(d.dueDate) && (d.doneDate === null || d.doneDate === undefined || isValidDateString(d.doneDate))
          ? { ...d, doneDate: d.doneDate ?? null, clinic: str(d.clinic), memo: str(d.memo) }
          : null,
      c,
    )
    return { ...v, doses }
  },
  receipts: (r) =>
    isId(r.id) && isValidDateString(r.visitDate) && num(r.amount) >= 0 && ['pending', 'claimed', 'none'].includes(r.status)
      ? {
          ...r,
          clinic: str(r.clinic),
          description: str(r.description),
          insurer: str(r.insurer),
          memo: str(r.memo),
          imageIds: strList(r.imageIds),
          detailImageIds: strList(r.detailImageIds),
          claimedDate: isValidDateString(r.claimedDate) ? r.claimedDate : null,
        }
      : null,
  dailyReports: (r) => (isValidDateString(r.date) ? r : null),
  walks: (w) => (isId(w.id) && isValidDateString(w.date) && num(w.minutes) > 0 ? { ...w, start: str(w.start), harness: str(w.harness), place: str(w.place), memo: str(w.memo) } : null),
  careTasks: (t) => {
    if (!isId(t.id) || !isStr(t.name) || !(num(t.cycleDays) >= 1)) return null
    const history = [...new Set((Array.isArray(t.history) ? t.history : []).filter(isValidDateString))].sort()
    const lastDone = isValidDateString(t.lastDone) ? t.lastDone : (history.at(-1) ?? null)
    return { ...t, icon: str(t.icon, '📌'), history, lastDone }
  },
  groomingSalon: (g) => (isId(g.id) ? g : null),
  contacts: (c) => (isId(c.id) && isStr(c.type) ? { ...c, name: str(c.name), phone: str(c.phone), address: str(c.address) } : null),
  symptomLogs: (l) =>
    isId(l.id) && validDateTime(l.at)
      ? { ...l, count: num(l.count) >= 1 ? l.count : 1, imageIds: strList(l.imageIds), memo: str(l.memo), custom: str(l.custom) }
      : null,
  photos: (p) => (isId(p.id) && isId(p.imageId) && isValidDateString(p.takenAt) ? { ...p, memo: str(p.memo) } : null),
}

const inRange = (v, min, max, fallback) => (num(v) !== null && v >= min && v <= max ? v : fallback)

function fixProfile(p) {
  const out = { ...DEFAULT_PROFILE, ...p }
  out.name = isStr(out.name) && out.name.trim() ? out.name : DEFAULT_PROFILE.name
  out.breed = str(out.breed, DEFAULT_PROFILE.breed)
  if (!isValidDateString(out.birthDate)) out.birthDate = DEFAULT_PROFILE.birthDate
  out.targetWeightKg = inRange(out.targetWeightKg, 1, 30, DEFAULT_PROFILE.targetWeightKg)
  out.weightAlertPct = inRange(out.weightAlertPct, 1, 100, DEFAULT_PROFILE.weightAlertPct)
  out.puppyFactor = inRange(out.puppyFactor, 1, 5, DEFAULT_PROFILE.puppyFactor)
  const range = out.targetRangeKg
  out.targetRangeKg = Array.isArray(range) && range.length === 2 && range.every((n) => num(n) > 0) ? range : DEFAULT_PROFILE.targetRangeKg
  return out
}

/**
 * data의 있는 키만 검사한다 (없는 키 채우기는 normalizeData 몫).
 * 반환: { data: 고친 사본, dropped: 버린 항목 수 }
 */
export function sanitizeData(input) {
  if (!isObj(input)) return { data: input, dropped: 0 }
  const counter = { dropped: 0 }
  const data = { ...input }

  for (const [key, fix] of Object.entries(FIXERS)) {
    if (Array.isArray(data[key])) data[key] = cleanList(data[key], (item) => fix(item, counter), counter)
  }
  if (isObj(data.profile)) data.profile = fixProfile(data.profile)
  if (Array.isArray(data.insurers)) data.insurers = strList(data.insurers)
  if (isObj(data.gear)) data.gear = { ...data.gear, mats: strList(data.gear.mats), harnesses: strList(data.gear.harnesses) }
  if (isObj(data.feeding)) {
    const f = data.feeding
    data.feeding = {
      ...f,
      schedule: Array.isArray(f.schedule) && f.schedule.every(isValidTime) ? f.schedule : undefined,
      logs: cleanList(Array.isArray(f.logs) ? f.logs : [], (l) => (isValidDateString(l.date) && num(l.slot) >= 0 ? l : null), counter),
    }
    if (!data.feeding.schedule) delete data.feeding.schedule // 기본값으로 채워지게
  }
  if (isObj(data.grooming)) {
    const g = data.grooming
    data.grooming = {
      ...g,
      brushDates: [...new Set((Array.isArray(g.brushDates) ? g.brushDates : []).filter(isValidDateString))].sort(),
      badges: Array.isArray(g.badges) ? g.badges.filter((b) => isObj(b) && isId(b.id)) : [],
      bestStreak: num(g.bestStreak) >= 0 ? g.bestStreak : 0,
    }
  }
  if (isObj(data.walkTimer)) data.walkTimer = { startedAt: num(data.walkTimer.startedAt) }
  if (isObj(data.notifications)) {
    const n = data.notifications
    data.notifications = {
      ...n,
      enabled: n.enabled === true,
      firedKeys: isObj(n.firedKeys) ? n.firedKeys : {},
      lastCheckedAt: num(n.lastCheckedAt),
    }
  }
  if (isObj(data.backupInfo)) {
    data.backupInfo = { ...data.backupInfo, lastBackupDate: isValidDateString(data.backupInfo.lastBackupDate) ? data.backupInfo.lastBackupDate : null }
  }
  return { data, dropped: counter.dropped }
}
