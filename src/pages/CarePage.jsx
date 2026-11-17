import { useState } from 'react'
import BrushCheck from '../components/BrushCheck.jsx'
import PageTitle from '../components/PageTitle.jsx'
import { Banner, Button, Card, Disclaimer, Empty, Field, ProgressBar, StatusPill, YesNo, inputClass } from '../components/ui.jsx'
import { useNow } from '../hooks/useToday.js'
import { usePuppyInfo } from '../hooks/usePuppyInfo.js'
import { usePuppyStore } from '../store/usePuppyStore.js'
import {
  REPORT_QUESTIONS,
  STATUS_EMOJI,
  isWalkTooLong,
  limpAlert,
  nextCareDue,
  recommendedWalkMin,
  reportStatus,
} from '../utils/care.js'
import { addDays, isValidDateString, parseLocalDate, toLocalDateString, toTimeString } from '../utils/date.js'
import { BRUSH_BADGES } from '../utils/grooming.js'
import { badgeIcon } from '../components/badgeIcon.js'

const REPORT_STATUS_LABEL = { green: '정상', yellow: '살펴보기', red: '이상', unknown: '미기록' }

export default function CarePage() {
  return (
    <div className="space-y-4">
      <PageTitle sub="털 엉킴 방지와 관절 건강 챙기기">✂️ 케어</PageTitle>
      <Card title="빗질" icon="🐩">
        <BrushCheck big />
        <Badges />
        <BrushHeatmap />
      </Card>
      <WalkSection />
      <CareTasks />
      <DailyReport />
      <Disclaimer />
    </div>
  )
}

function Badges() {
  const grooming = usePuppyStore((s) => s.grooming)
  const owned = new Map(grooming.badges.map((b) => [b.id, b.earnedAt]))
  const next = BRUSH_BADGES.find((b) => !owned.has(b.id))
  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="font-bold text-muted">🏆 배지</span>
        <span className="text-muted">
          최고 기록 <strong className="text-cocoa">{grooming.bestStreak}일</strong>
          {next && ` · 다음: ${next.name} (${next.days}일)`}
        </span>
      </div>
      <ul className="grid grid-cols-5 gap-1.5 text-center text-[10px] leading-tight" aria-label="배지">
        {BRUSH_BADGES.map((b) => {
          const earned = owned.has(b.id)
          return (
            <li
              key={b.id}
              className={`rounded-2xl px-0.5 py-2 ${earned ? 'bg-peach/30 font-bold text-cocoa' : 'bg-tint text-faint'}`}
              data-testid={`badge-${b.id}`}
              data-earned={earned}
              aria-label={`${b.name} ${b.days}일 ${earned ? '획득' : '미획득'}`}
            >
              <span aria-hidden className={`block text-2xl ${earned ? '' : 'opacity-40 grayscale'}`}>
                {earned ? badgeIcon(b.icon) : '🔒'}
              </span>
              {b.name}
              <span className="block font-normal">{b.days}일</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** 이번 달 빗질 달력. 지난 날짜를 눌러 빠뜨린 기록을 고칠 수 있다 */
function BrushHeatmap() {
  const { today } = usePuppyInfo()
  const brushDates = usePuppyStore((s) => s.grooming.brushDates)
  const toggleBrush = usePuppyStore((s) => s.toggleBrush)
  const t = parseLocalDate(today)
  const first = new Date(t.getFullYear(), t.getMonth(), 1)
  const daysInMonth = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate()
  const set = new Set(brushDates)
  const cells = [
    ...Array(first.getDay()).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => toLocalDateString(new Date(t.getFullYear(), t.getMonth(), i + 1))),
  ]
  return (
    <div className="mt-4">
      <p className="mb-1 text-xs text-muted">{t.getMonth() + 1}월 빗질 달력</p>
      <div className="-mx-3 grid grid-cols-7 gap-0.5 text-center text-xs">
        {'일월화수목금토'.split('').map((d) => (
          <span key={d} className="text-faint">
            {d}
          </span>
        ))}
        {cells.map((d, i) =>
          d ? (
            <button
              key={d}
              type="button"
              disabled={d > today}
              onClick={() => toggleBrush(d, today)}
              aria-label={`${d} 빗질 ${set.has(d) ? '완료' : '안 함'}`}
              className={`aspect-square min-h-11 rounded-xl ${set.has(d) ? 'bg-peach font-bold text-cocoa' : 'bg-tint text-faint'} ${d === today ? 'ring-2 ring-cocoa' : ''} disabled:opacity-30`}
            >
              {Number(d.slice(8))}
            </button>
          ) : (
            <span key={`b${i}`} />
          ),
        )}
      </div>
    </div>
  )
}

// ── 산책 (F-4.3) ──────────────────────────────────────────

const WEATHER_TIPS = {
  summer: '🌞 아스팔트를 손등에 7초 대보고 뜨거우면 산책을 미뤄요. 11~16시 한낮은 피해요.',
  winter: '❄️ 산책 후 발바닥의 염화칼슘을 닦아요. 짧게 자주 나가요.',
  mild: '🍂 풀숲 산책 후에는 진드기를 꼭 확인해요.',
}
// 타이머로 이보다 길게 잡히면 종료를 잊은 것으로 보고 실제 시간을 묻는다
const MAX_TIMER_MIN = 180
const MAX_WALK_MIN = 300

const season = (month) => (month >= 6 && month <= 8 ? 'summer' : month === 12 || month <= 2 ? 'winter' : 'mild')

function WalkSection() {
  const { today, monthOrdinal, vaccinesDone } = usePuppyInfo()
  const now = useNow(15_000)
  const walks = usePuppyStore((s) => s.walks)
  const walkTimer = usePuppyStore((s) => s.walkTimer)
  const harnesses = usePuppyStore((s) => s.gear.harnesses)
  const startWalk = usePuppyStore((s) => s.startWalk)
  const cancelWalk = usePuppyStore((s) => s.cancelWalk)
  const addWalk = usePuppyStore((s) => s.addWalk)
  const deleteWalk = usePuppyStore((s) => s.deleteWalk)
  const [manual, setManual] = useState({ minutes: '', harness: harnesses[0] ?? '', place: '', memo: '' })
  const [notice, setNotice] = useState(null)
  const [fixing, setFixing] = useState(null) // 너무 긴 타이머: { start: Date, minutes: string, measured: number }

  const rec = recommendedWalkMin(monthOrdinal, vaccinesDone)
  const todayWalks = walks.filter((w) => w.date === today)
  const total = todayWalks.reduce((s, w) => s + w.minutes, 0)
  const elapsed = walkTimer.startedAt ? Math.max(0, Math.round((now - walkTimer.startedAt) / 60000)) : 0

  const save = (minutes, startDate) => {
    addWalk({
      date: toLocalDateString(startDate),
      start: toTimeString(startDate),
      minutes,
      harness: manual.harness,
      place: manual.place.trim(),
      memo: manual.memo.trim(),
    })
    setManual((m) => ({ ...m, minutes: '', place: '', memo: '' }))
    setNotice(isWalkTooLong(minutes, rec.perWalk) ? '어린 퍼피는 관절이 약해요. 다음엔 조금 짧게 해주세요.' : null)
  }

  const stop = () => {
    const start = new Date(walkTimer.startedAt)
    const measured = Math.max(1, Math.round((Date.now() - walkTimer.startedAt) / 60000))
    if (measured > MAX_TIMER_MIN) return setFixing({ start, minutes: String(rec.perWalk), measured })
    save(measured, start)
  }

  const saveFixed = () => {
    const m = Math.round(Number(fixing.minutes))
    if (!(m >= 1 && m <= MAX_WALK_MIN)) return setNotice(`산책 시간은 1~${MAX_WALK_MIN}분으로 입력해 주세요.`)
    save(m, fixing.start)
    setFixing(null)
  }

  const addManual = () => {
    const m = Math.round(Number(manual.minutes))
    if (!(m >= 1 && m <= MAX_WALK_MIN)) return setNotice(`산책 시간은 1~${MAX_WALK_MIN}분으로 입력해 주세요.`)
    save(m, new Date())
  }

  return (
    <Card title="산책" icon="🐾">
      {rec.mode === 'carry' ? (
        <Banner tone="warn" icon="🐣" className="mb-3" data-testid="walk-carry-banner">
          아직 접종 전이에요 — 땅에 내려놓는 산책 대신 안고 바깥 구경을 해주세요. (마지막 접종 후 1~2주 뒤부터 권장, 담당 수의사
          확인)
        </Banner>
      ) : (
        <div className="rounded-2xl bg-tint p-3">
          <p className="mb-2 text-sm" data-testid="walk-recommend">
            {monthOrdinal}개월차 권장 1회 <strong className="text-lg font-black text-cocoa">{rec.range}</strong> × 하루{' '}
            {rec.timesPerDay}회
            {rec.note && <span className="block text-xs text-muted">{rec.note}</span>}
          </p>
          <div className="mb-1 flex justify-between text-xs font-bold text-muted">
            <span>오늘 산책</span>
            <span data-testid="walk-today">
              {total} / 권장 {rec.daily}분
            </span>
          </div>
          <ProgressBar value={total} max={rec.daily} label="오늘 산책" tone="ok" />
        </div>
      )}

      <div className="mt-3 space-y-2">
        {fixing ? (
          <div className="space-y-2 rounded-2xl bg-warn-bg p-3 text-sm" data-testid="walk-fix">
            <p className="font-bold text-warn">
              타이머가 {Math.floor(fixing.measured / 60)}시간 {fixing.measured % 60}분이에요. 종료를 늦게 누르셨나요?
            </p>
            <Field label="실제 산책 시간 (분)">
              <input inputMode="numeric" value={fixing.minutes} onChange={(e) => setFixing({ ...fixing, minutes: e.target.value })} className={inputClass} />
            </Field>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={saveFixed}>
                이 시간으로 저장
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setFixing(null)
                  cancelWalk()
                }}
              >
                기록 안 함
              </Button>
            </div>
          </div>
        ) : walkTimer.startedAt ? (
          <div className="flex items-center gap-2 rounded-2xl bg-ok-bg p-2 pl-4">
            <span className="flex-1 font-extrabold text-ok">
              <span aria-hidden className="animate-pop inline-block">
                🐾
              </span>{' '}
              산책 중 {elapsed}분
            </span>
            <Button onClick={stop}>종료</Button>
            <Button variant="ghost" onClick={cancelWalk}>
              취소
            </Button>
          </div>
        ) : (
          <Button className="w-full text-base" onClick={() => startWalk(Date.now())}>
            🦮 산책 시작
          </Button>
        )}
        <div className="flex items-end gap-2">
          <Field label="직접 입력 (분)" className="flex-1">
            <input inputMode="numeric" value={manual.minutes} onChange={(e) => setManual({ ...manual, minutes: e.target.value })} className={inputClass} />
          </Field>
          {harnesses.length > 0 && (
            <Field label="하네스" className="flex-1">
              <select value={manual.harness} onChange={(e) => setManual({ ...manual, harness: e.target.value })} className={inputClass}>
                {harnesses.map((h) => (
                  <option key={h}>{h}</option>
                ))}
              </select>
            </Field>
          )}
          <Button variant="outline" onClick={addManual}>
            기록
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="장소 (선택)">
            <input value={manual.place} onChange={(e) => setManual({ ...manual, place: e.target.value })} className={inputClass} />
          </Field>
          <Field label="산책 메모 (선택)">
            <input value={manual.memo} onChange={(e) => setManual({ ...manual, memo: e.target.value })} className={inputClass} />
          </Field>
        </div>
        {notice && <p className="text-xs text-warn">{notice}</p>}
      </div>

      {todayWalks.length > 0 && (
        <ul className="mt-3 divide-y divide-line text-sm">
          {todayWalks.map((w) => (
            <li key={w.id} className="flex items-center gap-2 py-1">
              <span className="text-muted">{w.start}</span>
              <span>{w.minutes}분</span>
              <span className="min-w-0 truncate text-xs text-faint">{[w.harness, w.place, w.memo].filter(Boolean).join(' · ')}</span>
              <Button variant="ghost" className="ml-auto" onClick={() => deleteWalk(w.id)} aria-label="산책 기록 삭제">
                삭제
              </Button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-muted">{WEATHER_TIPS[season(parseLocalDate(today).getMonth() + 1)]}</p>
      <p className="text-xs text-muted">산책 후: 발 닦기 · 진드기 확인 · 털 엉킴 확인</p>
    </Card>
  )
}

// ── 관리 주기 (F-4.4) ─────────────────────────────────────

function CareTasks() {
  const { today } = usePuppyInfo()
  const careTasks = usePuppyStore((s) => s.careTasks)
  const markCareDone = usePuppyStore((s) => s.markCareDone)
  const undoCareDone = usePuppyStore((s) => s.undoCareDone)
  const setCareCycle = usePuppyStore((s) => s.setCareCycle)
  const [editing, setEditing] = useState(null) // { id, date, cycle }

  return (
    <Card title="관리 주기" icon="🛁">
      <p className="mb-2 text-xs text-muted">🟢 여유 · 🟡 3일 이내 · 🔴 지남 · ⚪ 기록 없음</p>
      <ul className="space-y-2">
        {careTasks.map((t) => {
          const due = nextCareDue(t.lastDone, t.cycleDays, today)
          const bar = { green: 'border-l-ok', yellow: 'border-l-warn', red: 'border-l-danger', unknown: 'border-l-line' }[due.status]
          return (
            <li key={t.id} className={`rounded-2xl border-l-8 bg-tint/60 p-3 text-sm ${bar}`} data-testid={`care-${t.id}`}>
              <div className="flex items-center gap-2">
                <span aria-hidden className="text-2xl">
                  {t.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold">{t.name}</span>
                  <span className="block text-xs text-muted">
                    {t.cycleDays}일 주기 · {t.lastDone ? `마지막 ${t.lastDone.slice(5)}` : '기록 없음'}
                    {due.dueDate && ` · 다음 ${due.dueDate.slice(5)}`}
                  </span>
                </span>
                <StatusPill status={due.status} data-testid="care-status">
                  {due.label}
                </StatusPill>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(editing?.id === t.id ? null : { id: t.id, date: addDays(today, -1), cycle: t.cycleDays })}
                  className="min-h-11 text-xs text-muted underline"
                >
                  지난 날짜 기록 · 주기 변경
                </button>
                {t.history.includes(today) ? (
                  <Button variant="ghost" onClick={() => undoCareDone(t.id, today)}>
                    ✅ 오늘 완료 · 취소
                  </Button>
                ) : (
                  <Button variant="outline" onClick={() => markCareDone(t.id, today)}>
                    오늘 했어요
                  </Button>
                )}
              </div>
              {editing?.id === t.id && (
                <div className="mt-2 grid grid-cols-[1fr_auto] items-end gap-2 rounded-2xl bg-card p-3">
                  <Field label="한 날짜">
                    <input type="date" max={today} value={editing.date} onChange={(e) => setEditing({ ...editing, date: e.target.value })} className={inputClass} />
                  </Field>
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (isValidDateString(editing.date) && editing.date <= today) markCareDone(t.id, editing.date)
                    }}
                  >
                    기록
                  </Button>
                  <Field label="주기(일)">
                    <input type="number" inputMode="numeric" min={1} max={365} value={editing.cycle} onChange={(e) => setEditing({ ...editing, cycle: e.target.value })} className={inputClass} />
                  </Field>
                  <Button
                    variant="outline"
                    onClick={() => {
                      const c = Math.round(Number(editing.cycle))
                      if (c >= 1 && c <= 365) setCareCycle(t.id, c)
                    }}
                  >
                    적용
                  </Button>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

// ── 일일 리포트 (F-4.2) ───────────────────────────────────

function DailyReport() {
  const { today } = usePuppyInfo()
  const reports = usePuppyStore((s) => s.dailyReports)
  const walks = usePuppyStore((s) => s.walks)
  const mats = usePuppyStore((s) => s.gear.mats)
  const saveDailyReport = usePuppyStore((s) => s.saveDailyReport)

  const report = reports.find((r) => r.date === today) ?? {}
  const walkedMinutes = walks.filter((w) => w.date === today).reduce((s, w) => s + w.minutes, 0)
  // 산책 기록이 있으면 '산책 여부'를 자동으로 채운다
  const walked = report.walked ?? (walkedMinutes > 0 ? true : null)
  const status = reportStatus({ ...report, walked })
  const limp = limpAlert(reports, today)
  const save = (patch) => saveDailyReport(today, { walked, walkMinutes: walkedMinutes || report.walkMinutes || null, ...patch })

  return (
    <Card
      title="관절·활동 리포트"
      icon="🦴"
      action={
        <StatusPill status={status} data-testid="report-status">
          {REPORT_STATUS_LABEL[status]}
        </StatusPill>
      }
    >
      {limp.alert && (
        <Banner tone="danger" icon="🔴" role="alert" className="mb-3" data-testid="limp-alert">
          <strong className="block">반복되는 절뚝거림 — 수의사 상담 권장</strong>
          최근 7일 동안 절뚝거림이 {limp.count}번 있었어요. 소형견에 흔한 슬개골 탈구를 확인해 볼 수 있어요.
        </Banner>
      )}
      <ul className="space-y-4">
        {REPORT_QUESTIONS.filter((q) => !q.walkOnly || walked).map((q) => (
          <li key={q.key} className="text-sm">
            <p className="mb-1.5">
              <strong className="text-cocoa">{q.label}</strong>
              <span className="block text-muted">{q.question}</span>
            </p>
            <YesNo name={q.label} value={q.key === 'walked' ? walked : (report[q.key] ?? null)} onChange={(v) => save({ [q.key]: v })} />
          </li>
        ))}
      </ul>
      {mats.length > 0 && (
        <Field label="매트" className="mt-3">
          <select value={report.mat ?? ''} onChange={(e) => save({ mat: e.target.value })} className={inputClass}>
            <option value="">선택 안 함</option>
            {mats.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </Field>
      )}
      {walked && walkedMinutes > 0 && <p className="mt-2 text-xs text-muted">오늘 산책 {walkedMinutes}분 (산책 기록에서 자동 연결)</p>}
      <Field label="메모" className="mt-3">
        <input
          key={today}
          defaultValue={report.memo ?? ''}
          onBlur={(e) => e.target.value !== (report.memo ?? '') && save({ memo: e.target.value })}
          className={inputClass}
        />
      </Field>
      <RecentReports reports={reports} today={today} />
    </Card>
  )
}

function RecentReports({ reports, today }) {
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13))
  const byDate = new Map(reports.map((r) => [r.date, r]))
  if (!reports.length) return <Empty icon="📝">아직 리포트가 없어요. 위 질문에 답하면 바로 기록돼요.</Empty>
  return (
    <div className="mt-4 rounded-2xl bg-tint/60 p-3">
      <p className="mb-2 text-xs text-muted">최근 2주 · 🟢 정상 · 🟡 이상 답변 · 🔴 절뚝거림 · ⚪ 미기록</p>
      <div className="grid grid-cols-7 gap-1 text-center text-xs">
        {days.map((d) => {
          const s = reportStatus(byDate.get(d))
          return (
            <span key={d} title={d} aria-label={`${d} ${REPORT_STATUS_LABEL[s]}`}>
              <span aria-hidden>{STATUS_EMOJI[s]}</span>
              <span className="block text-faint">{Number(d.slice(8))}</span>
            </span>
          )
        })}
      </div>
    </div>
  )
}
