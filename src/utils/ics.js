// .ics 캘린더 내보내기 — 탭을 닫아도 폰 캘린더로 알림을 받기 위한 용도 (PRD F-2.3, F-3.2)
import { addDays, toLocalDateString } from './date.js'

const CRLF = '\r\n'

const escapeText = (s) =>
  String(s ?? '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')

/** RFC 5545: 한 줄은 75바이트 이하로 접는다 (한글은 3바이트) */
function fold(line) {
  const enc = new TextEncoder()
  const out = []
  let current = ''
  let bytes = 0
  for (const ch of line) {
    const b = enc.encode(ch).length
    if (bytes + b > (out.length ? 74 : 75)) {
      out.push(current)
      current = ''
      bytes = 0
    }
    current += ch
    bytes += b
  }
  out.push(current)
  return out.join(`${CRLF} `)
}

/** 'YYYY-MM-DD', 'HH:mm' → 시간대 없는 로컬 시각 '20261116T070000' */
const localStamp = (date, time) => `${date.replaceAll('-', '')}T${time.replace(':', '')}00`

function utcStamp(d = new Date()) {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

function addMinutes(time, mins) {
  const [h, m] = time.split(':').map(Number)
  const t = (h * 60 + m + mins) % 1440
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

function vevent({ uid, date, time, durationMin = 15, summary, description, rrule, alarms = ['PT0M'] }) {
  const endTime = addMinutes(time, durationMin)
  const endDate = endTime < time ? addDays(date, 1) : date
  const lines = [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${utcStamp()}`,
    `DTSTART:${localStamp(date, time)}`,
    `DTEND:${localStamp(endDate, endTime)}`,
    `SUMMARY:${escapeText(summary)}`,
    description ? `DESCRIPTION:${escapeText(description)}` : null,
    rrule ? `RRULE:${rrule}` : null,
    ...alarms.flatMap((trigger) => [
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeText(summary)}`,
      `TRIGGER:-${trigger}`,
      'END:VALARM',
    ]),
    'END:VEVENT',
  ]
  return lines.filter(Boolean)
}

/**
 * 급여 반복 일정(매일) + 미완료 접종일(D-3·D-0 알림) + 관리 주기 다음 예정일
 * 시각은 시간대 없는 로컬 시각으로 넣어 폰의 현재 시간대를 그대로 따른다.
 */
export function buildIcs(state, today = toLocalDateString()) {
  const { profile, feeding, vaccines } = state
  const events = []

  feeding.schedule.slice(0, feeding.mealsPerDay).forEach((time, i) => {
    const date = time < feeding.firstMealTime ? addDays(today, 1) : today
    events.push(
      ...vevent({
        uid: `feed-${i}@puppy-diary`,
        date,
        time,
        summary: `🍚 ${profile.name} ${i + 1}번째 급여`,
        rrule: 'FREQ=DAILY',
      }),
    )
  })

  for (const v of vaccines) {
    for (const d of v.doses) {
      if (d.doneDate) continue
      events.push(
        ...vevent({
          uid: `vac-${v.id}-${d.n}@puppy-diary`,
          date: d.dueDate,
          time: '09:00',
          durationMin: 60,
          summary: `💉 ${profile.name} ${v.name} ${d.n}차 접종`,
          description: '앱: Puppy 성장스토리',
          alarms: ['P3D', 'PT0M'], // 3일 전 09:00, 당일 09:00
        }),
      )
    }
  }

  const body = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//puppy-diary//KO',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${escapeText(`${profile.name} 성장일기`)}`,
    ...events,
    'END:VCALENDAR',
  ]
  return body.map(fold).join(CRLF) + CRLF
}
