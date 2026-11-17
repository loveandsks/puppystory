import { Link } from 'react-router-dom'
import BrushCheck from '../components/BrushCheck.jsx'
import { Card, ProgressBar, StatusPill } from '../components/ui.jsx'
import { useNow } from '../hooks/useToday.js'
import { usePuppyInfo } from '../hooks/usePuppyInfo.js'
import { usePuppyStore } from '../store/usePuppyStore.js'
import { nextCareDue, recommendedWalkMin } from '../utils/care.js'
import { feedingProgress, getFeedingDay } from '../utils/feeding.js'
import { growthPct } from '../utils/growth.js'
import { formatWon, pendingSummary } from '../utils/receipts.js'
import { nextUpcomingDose } from '../utils/vaccine.js'

export default function HomePage() {
  const { today, profile, isBorn, days, monthLabel, monthOrdinal, latest, vaccinesDone } = usePuppyInfo()
  const now = useNow()
  const feeding = usePuppyStore((s) => s.feeding)
  const vaccines = usePuppyStore((s) => s.vaccines)
  const receipts = usePuppyStore((s) => s.receipts)
  const careTasks = usePuppyStore((s) => s.careTasks)
  const walks = usePuppyStore((s) => s.walks)

  const feedDay = getFeedingDay(now, feeding.firstMealTime)
  const meals = feedingProgress(feeding, feedDay)
  const nextDose = nextUpcomingDose(vaccines, today)
  const pending = pendingSummary(receipts)
  const walkRec = recommendedWalkMin(monthOrdinal, vaccinesDone)
  const walkToday = walks.filter((w) => w.date === today).reduce((sum, w) => sum + w.minutes, 0)
  const soonCare = careTasks
    .map((t) => ({ ...t, due: nextCareDue(t.lastDone, t.cycleDays, today) }))
    .filter((t) => t.due.status === 'yellow' || t.due.status === 'red')
  const pct = latest ? growthPct(latest.kg, profile.targetWeightKg) : null

  return (
    <div className="space-y-4">
      {/* 큰 D-Day 카드 */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-peach/70 to-tint p-6 text-center shadow-soft">
        <span aria-hidden className="pointer-events-none absolute -top-3 -right-2 text-7xl opacity-20">
          🐾
        </span>
        <p className="font-bold text-cocoa">🐶 {profile.name}</p>
        <p className="mt-1 text-5xl font-black tracking-tight text-cocoa" data-testid="dday-big">
          {isBorn ? `D+${days}` : `D${days}`}
        </p>
        <p className="mt-1 text-lg font-bold text-on-peach">{isBorn ? `생후 ${days}일 · ${monthLabel}` : '곧 만나요!'}</p>
        {latest ? (
          <div className="mx-auto mt-4 max-w-60 text-left">
            <div className="mb-1 flex justify-between text-xs font-bold text-on-peach">
              <span>현재 {latest.kg}kg</span>
              <span>성견 대비 {pct}%</span>
            </div>
            <ProgressBar value={latest.kg} max={profile.targetWeightKg} label="성장률" />
          </div>
        ) : (
          <Link to="/growth" className="mt-4 inline-flex min-h-11 items-center rounded-full bg-card/70 px-4 text-sm font-bold text-cocoa">
            ⚖️ 첫 체중 기록하기
          </Link>
        )}
      </section>

      <Card title="오늘 할 일" icon="📋">
        <ul className="space-y-3">
          <li>
            <Link to="/diet" className="flex min-h-11 items-center gap-3 rounded-2xl bg-tint p-3">
              <span aria-hidden className="text-2xl">
                🍚
              </span>
              <span className="flex-1 font-bold">맘마</span>
              <span className="flex gap-1" aria-hidden>
                {Array.from({ length: meals.total }, (_, i) => (
                  <span key={i} className={`size-2.5 rounded-full ${i < meals.done ? 'bg-peach-strong' : 'bg-line'}`} />
                ))}
              </span>
              <span className="font-extrabold text-cocoa" data-testid="home-meals">
                오늘 {meals.done}/{meals.total}회
              </span>
            </Link>
          </li>
          <li>
            <BrushCheck big />
          </li>
          <li>
            <Link to="/care" className="block rounded-2xl bg-tint p-3">
              <div className="mb-2 flex items-center gap-3">
                <span aria-hidden className="text-2xl">
                  🐾
                </span>
                <span className="flex-1 font-bold">산책</span>
                <span className="text-sm font-bold text-cocoa">
                  {walkRec.mode === 'carry' ? '접종 전 · 안고 바깥 구경' : `${walkToday} / ${walkRec.daily}분`}
                </span>
              </div>
              {walkRec.mode === 'walk' && <ProgressBar value={walkToday} max={walkRec.daily} label="오늘 산책" tone="ok" />}
            </Link>
          </li>
        </ul>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Link to="/health" className="rounded-3xl bg-card p-4 shadow-soft">
          <p className="text-xs font-bold text-muted">💉 다음 접종</p>
          {nextDose ? (
            <>
              <p className="mt-1 truncate font-bold">
                {nextDose.vaccine.name} {nextDose.dose.n}차
              </p>
              <p className="font-black text-cocoa" data-testid="next-vaccine">
                {nextDose.daysLeft >= 0 ? (
                  <span className="text-2xl">D-{nextDose.daysLeft}</span>
                ) : (
                  <span className="mt-1 inline-block rounded-full bg-danger-bg px-2 py-0.5 text-sm text-danger">
                    🔴 {-nextDose.daysLeft}일 지연
                  </span>
                )}
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-faint">일정을 등록해 주세요</p>
          )}
        </Link>
        <Link to="/health" className="relative rounded-3xl bg-card p-4 shadow-soft">
          <p className="text-xs font-bold text-muted">🧾 미청구 영수증</p>
          <p className="mt-1 text-2xl font-black text-cocoa" data-testid="pending-count">
            {pending.count}건
          </p>
          <p className="truncate text-xs text-muted">{pending.count ? formatWon(pending.total) : '모두 청구했어요'}</p>
          {pending.count > 0 && (
            <span className="absolute top-3 right-3 grid size-6 place-items-center rounded-full bg-sos text-xs font-black text-white" aria-hidden>
              {pending.count}
            </span>
          )}
        </Link>
      </div>

      {soonCare.length > 0 && (
        <Card title="곧 할 관리" icon="✂️">
          <ul className="space-y-2">
            {soonCare.map((t) => (
              <li key={t.id}>
                <Link to="/care" className="flex min-h-11 items-center justify-between gap-2 rounded-2xl bg-tint px-3">
                  <span className="font-medium">
                    {t.icon} {t.name}
                  </span>
                  <StatusPill status={t.due.status}>{t.due.label}</StatusPill>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}
