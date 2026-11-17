// 체중 꺾은선 그래프 (SVG 직접 구현, PRD F-1.3)
import { useState } from 'react'
import { getDayCount } from '../utils/dday.js'
import { growthPct } from '../utils/growth.js'

const W = 320
const H = 200
const PAD = { l: 32, r: 10, t: 10, b: 26 }

export default function GrowthChart({ weights, analysis, profile }) {
  const [selected, setSelected] = useState(null)
  const [lo, hi] = profile.targetRangeKg
  const points = weights.map((w) => ({ ...w, day: getDayCount(profile.birthDate, w.date) }))

  const maxDay = Math.max(...points.map((p) => p.day), 7)
  const minDay = Math.min(...points.map((p) => p.day), 0)
  const maxKg = Math.max(hi + 0.5, ...points.map((p) => p.kg + 0.5))
  const x = (d) => PAD.l + ((d - minDay) / (maxDay - minDay || 1)) * (W - PAD.l - PAD.r)
  const y = (kg) => H - PAD.b - (kg / maxKg) * (H - PAD.t - PAD.b)

  // X축 눈금: 주 단위, 너무 촘촘하면 2주·4주 간격
  const span = maxDay - minDay
  const step = span > 120 ? 28 : span > 56 ? 14 : 7
  const xTicks = []
  for (let d = Math.ceil(minDay / step) * step; d <= maxDay; d += step) xTicks.push(d)
  const yTicks = Array.from({ length: Math.floor(maxKg / 2) + 1 }, (_, i) => i * 2)
  const sel = points.find((p) => p.id === selected)

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="체중 성장 그래프">
        {/* 목표 범위 음영 + 목표값 점선 */}
        <rect x={PAD.l} y={y(hi)} width={W - PAD.l - PAD.r} height={y(lo) - y(hi)} fill="var(--c-peach)" opacity="0.22" />
        <line x1={PAD.l} x2={W - PAD.r} y1={y(profile.targetWeightKg)} y2={y(profile.targetWeightKg)} stroke="var(--c-peach-strong)" strokeDasharray="4 4" />
        <text x={W - PAD.r} y={y(profile.targetWeightKg) - 4} fontSize="9" textAnchor="end" fill="var(--c-peach-strong)">
          목표 {profile.targetWeightKg}kg
        </text>
        {yTicks.map((kg) => (
          <g key={kg}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(kg)} y2={y(kg)} stroke="var(--c-line)" />
            <text x={PAD.l - 4} y={y(kg) + 3} fontSize="9" textAnchor="end" fill="var(--c-faint)">
              {kg}
            </text>
          </g>
        ))}
        {xTicks.map((d) => (
          <text key={d} x={x(d)} y={H - 8} fontSize="9" textAnchor="middle" fill="var(--c-faint)">
            {d}일
          </text>
        ))}
        {points.length > 1 && (
          <polyline fill="none" stroke="var(--c-cocoa)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" points={points.map((p) => `${x(p.day)},${y(p.kg)}`).join(' ')} />
        )}
        {points.map((p) => (
          <g key={p.id} onClick={() => setSelected(p.id === selected ? null : p.id)} className="cursor-pointer">
            {/* 손가락으로 누르기 쉽게 투명한 큰 터치 영역 */}
            <circle cx={x(p.day)} cy={y(p.kg)} r="14" fill="transparent" />
            <circle
              cx={x(p.day)}
              cy={y(p.kg)}
              r={selected === p.id ? 7 : 5}
              fill={analysis[p.id]?.alert ? 'var(--c-warn)' : 'var(--c-cocoa)'}
              stroke="var(--c-card)"
              strokeWidth="2"
            >
              <title>{`${p.date} ${p.kg}kg`}</title>
            </circle>
          </g>
        ))}
      </svg>
      {sel && (
        <p className="mt-2 rounded-2xl bg-tint p-2.5 text-center text-sm font-medium" data-testid="chart-detail">
          {sel.date} · 생후 {sel.day}일 · {sel.kg}kg · 성장률 {growthPct(sel.kg, profile.targetWeightKg)}%
          {analysis[sel.id]?.weeklyPct !== null && ` · 주당 ${analysis[sel.id].weeklyPct > 0 ? '+' : ''}${analysis[sel.id].weeklyPct}%`}
        </p>
      )}
    </div>
  )
}
