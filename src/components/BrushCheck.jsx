// '오늘의 빗질' 체크 — 홈과 케어 탭에서 같은 상태를 공유 (PRD F-4.1)
import { useState } from 'react'
import { useToday } from '../hooks/useToday.js'
import { usePuppyStore } from '../store/usePuppyStore.js'
import { brushStreak } from '../utils/grooming.js'
import { badgeIcon } from './badgeIcon.js'

export default function BrushCheck({ big = false }) {
  const today = useToday()
  const brushDates = usePuppyStore((s) => s.grooming.brushDates)
  const toggleBrush = usePuppyStore((s) => s.toggleBrush)
  const [celebrate, setCelebrate] = useState(null)
  const { streak, doneToday } = brushStreak(brushDates, today)

  const onChange = () => {
    const newly = toggleBrush(today)
    if (newly.length) setCelebrate(newly.at(-1))
  }

  return (
    <div>
      <label
        className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl transition ${
          big ? `p-3 ${doneToday ? 'bg-ok-bg' : 'bg-tint'}` : ''
        }`}
      >
        <input type="checkbox" checked={doneToday} onChange={onChange} className="size-6 shrink-0 accent-[var(--c-peach-strong)]" />
        <span className="min-w-0">
          <span className="block font-bold">🐩 오늘의 빗질</span>
          <span className="block text-xs text-muted">{doneToday ? '오늘도 보송보송 완료!' : `오늘 빗질하면 ${streak + 1}일!`}</span>
        </span>
        <span
          className={`ml-auto flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-sm font-extrabold ${
            streak > 0 ? 'bg-peach/40 text-cocoa' : 'bg-tint text-faint'
          }`}
          data-testid="brush-streak"
        >
          <span aria-hidden className={streak > 0 ? 'animate-pop' : 'grayscale'} key={streak}>
            🔥
          </span>
          연속 {streak}일
        </span>
      </label>
      {celebrate && (
        <div role="status" className="relative mt-3 overflow-hidden rounded-2xl bg-warn-bg p-4 text-center">
          <span aria-hidden className="pointer-events-none absolute inset-x-0 top-2 flex justify-around text-lg">
            {['🎉', '✨', '🐾', '✨', '🎉'].map((c, i) => (
              <span key={i} className="animate-confetti" style={{ animationDelay: `${i * 0.08}s` }}>
                {c}
              </span>
            ))}
          </span>
          <span className="animate-pop block text-5xl" aria-hidden>
            {badgeIcon(celebrate.icon)}
          </span>
          <p className="mt-1 font-extrabold text-cocoa">새 배지! {celebrate.name}</p>
          <button type="button" onClick={() => setCelebrate(null)} className="mt-1 min-h-11 px-4 text-sm text-muted">
            닫기
          </button>
        </div>
      )}
    </div>
  )
}
