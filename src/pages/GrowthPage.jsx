import { useRef, useState } from 'react'
import GrowthChart from '../components/GrowthChart.jsx'
import PageTitle from '../components/PageTitle.jsx'
import { Banner, Button, Card, Disclaimer, Empty, Field, Modal, ProgressBar, inputClass } from '../components/ui.jsx'
import { usePuppyInfo } from '../hooks/usePuppyInfo.js'
import { usePuppyStore } from '../store/usePuppyStore.js'
import { formatKoreanDate, isValidDateString } from '../utils/date.js'
import { analyzeWeights, growthPct, sortWeights } from '../utils/growth.js'
import { parseWeightInput } from '../utils/feeding.js'

const emptyForm = (today) => ({ id: null, date: today, kg: '', memo: '' })

export default function GrowthPage() {
  const { today, profile, latest } = usePuppyInfo()
  const weights = usePuppyStore((s) => s.weights)
  const saveWeight = usePuppyStore((s) => s.saveWeight)
  const deleteWeight = usePuppyStore((s) => s.deleteWeight)
  const [form, setForm] = useState(() => emptyForm(today))
  const [error, setError] = useState(null)
  const [alertModal, setAlertModal] = useState(null)

  const sorted = sortWeights(weights)
  const analysis = analyzeWeights(weights, profile.weightAlertPct)
  const pct = latest ? growthPct(latest.kg, profile.targetWeightKg) : null
  const latestAlert = latest ? analysis[latest.id]?.alert : null
  const kgRef = useRef(null)

  const submit = (e) => {
    e.preventDefault()
    const parsed = parseWeightInput(form.kg)
    if (parsed.error) return setError(parsed.error)
    if (!isValidDateString(form.date) || form.date > today) return setError('측정일을 확인해 주세요. (미래 날짜는 안 돼요)')
    const sameDay = weights.find((w) => w.date === form.date && w.id !== form.id)
    if (sameDay && !window.confirm(`${form.date}에 이미 ${sameDay.kg}kg 기록이 있어요. 덮어쓸까요?`)) return
    if (sameDay && form.id) deleteWeight(form.id) // 수정 중 날짜를 다른 기록 날짜로 바꾼 경우
    const savedId = saveWeight({ id: sameDay ? sameDay.id : (form.id ?? undefined), date: form.date, kg: parsed.value, memo: form.memo })
    setError(null)
    setForm(emptyForm(today))
    // 저장 직후 경고 확인 (PRD F-1.4)
    const after = analyzeWeights(usePuppyStore.getState().weights, profile.weightAlertPct)
    if (after[savedId]?.alert) setAlertModal(after[savedId].alert)
  }

  const edit = (w) => {
    setForm({ id: w.id, date: w.date, kg: String(w.kg), memo: w.memo ?? '' })
    setError(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const remove = (w) => {
    if (window.confirm(`${w.date} ${w.kg}kg 기록을 삭제할까요?`)) deleteWeight(w.id)
  }

  return (
    <div className="space-y-4">
      <PageTitle sub="매주 같은 요일에 재면 정확해요">📈 성장</PageTitle>

      {latestAlert && (
        <Banner tone="warn" icon="⚠️" data-testid="growth-alert-banner">
          <strong className="block">최근 기록 확인이 필요해요</strong>
          {latestAlert.message}
        </Banner>
      )}

      <Card title="성장 곡선" icon="🌱">
        {latest ? (
          <>
            <div className="mb-3 flex items-end justify-between" data-testid="growth-summary">
              <p className="text-sm text-muted">
                현재 <strong className="text-2xl font-black text-cocoa">{latest.kg}kg</strong>
              </p>
              <p className="text-right text-sm text-muted">
                성견({profile.targetWeightKg}kg) 대비
                <strong className="block text-2xl font-black text-peach-strong">{pct}%</strong>
              </p>
            </div>
            <ProgressBar value={latest.kg} max={profile.targetWeightKg} label="성장률" />
            <div className="mt-4">
              <GrowthChart weights={sorted} analysis={analysis} profile={profile} />
            </div>
            <p className="mt-1 text-center text-xs text-faint">
              주황 띠: {profile.breed} 성견 예상 {profile.targetRangeKg[0]}~{profile.targetRangeKg[1]}kg · 점을 누르면 자세히 보여요
            </p>
          </>
        ) : (
          <Empty icon="⚖️" actionLabel="첫 체중 기록하기" onAction={() => kgRef.current?.focus()}>
            매주 체중을 기록하면 성장 곡선이 그려져요.
          </Empty>
        )}
      </Card>

      <Card title={form.id ? '체중 기록 수정' : '체중 기록'} icon="✏️">
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Field label="측정일">
              <input type="date" value={form.date} max={today} onChange={(e) => setForm({ ...form, date: e.target.value })} className={inputClass} />
            </Field>
            <Field label="체중 (kg)">
              <input
                ref={kgRef}
                inputMode="decimal"
                placeholder="2.4"
                value={form.kg}
                onChange={(e) => setForm({ ...form, kg: e.target.value })}
                className={inputClass}
              />
            </Field>
          </div>
          <Field label="메모">
            <input value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} className={inputClass} />
          </Field>
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="submit" className="flex-1">
              {form.id ? '수정 저장' : '저장'}
            </Button>
            {form.id && (
              <Button variant="ghost" onClick={() => setForm(emptyForm(today))}>
                취소
              </Button>
            )}
          </div>
        </form>
      </Card>

      <Card title="기록" icon="📒">
        {sorted.length === 0 ? (
          <Empty icon="📒">아직 기록이 없어요.</Empty>
        ) : (
          <ul className="divide-y divide-line">
            {[...sorted].reverse().map((w) => {
              const a = analysis[w.id]
              return (
                <li key={w.id} className="flex items-center gap-2 py-2 text-sm" data-testid="weight-row">
                  <span className="min-w-0 flex-1">
                    <span className="block text-muted">{formatKoreanDate(w.date)}</span>
                    {a?.weeklyPct !== null && a?.weeklyPct !== undefined && (
                      <span className={`text-xs ${a.alert ? 'font-bold text-warn' : 'text-faint'}`}>
                        {a.alert && <span aria-label="체중 경고">⚠️ </span>}
                        주당 {a.weeklyPct > 0 ? '+' : ''}
                        {a.weeklyPct}%
                      </span>
                    )}
                  </span>
                  <span className="text-lg font-black text-cocoa">{w.kg}kg</span>
                  <Button variant="ghost" className="px-2" onClick={() => edit(w)} aria-label={`${w.date} 수정`}>
                    수정
                  </Button>
                  <Button variant="ghost" className="px-2" onClick={() => remove(w)} aria-label={`${w.date} 삭제`}>
                    삭제
                  </Button>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <Disclaimer />

      {alertModal && (
        <Modal title="⚠️ 체중 확인이 필요해요" onClose={() => setAlertModal(null)}>
          <p className="mb-3" data-testid="weight-alert">
            {alertModal.message}
          </p>
          <Disclaimer className="mb-3" />
          <Button className="w-full" onClick={() => setAlertModal(null)}>
            확인
          </Button>
        </Modal>
      )}
    </div>
  )
}
