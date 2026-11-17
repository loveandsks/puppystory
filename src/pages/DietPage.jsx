import { useState } from 'react'
import PageTitle from '../components/PageTitle.jsx'
import { Banner, Button, Card, Chip, Disclaimer, Empty, Field, inputClass } from '../components/ui.jsx'
import { useNow } from '../hooks/useToday.js'
import { usePuppyInfo } from '../hooks/usePuppyInfo.js'
import { usePuppyStore } from '../store/usePuppyStore.js'
import { formatKoreanDate, isValidTime, toLocalDateTimeString } from '../utils/date.js'
import {
  calcDailyFood,
  feedingProgress,
  getFeedingDay,
  isExampleKcal,
  kcalPerKgToPerG,
  parsePositiveNumber,
  parseWeightInput,
  shouldSuggestLowerFactor,
} from '../utils/feeding.js'
import { POOP_CONDITIONS, summarizePotty } from '../utils/potty.js'

export default function DietPage() {
  return (
    <div className="space-y-4">
      <PageTitle sub="3개월 퍼피는 하루 3~4회 나눠 먹여요">🍚 식단 · 배변</PageTitle>
      <FoodCalculator />
      <MealChecklist />
      <FeedingPlan />
      <FoodDatabase />
      <PottyTracker />
      <Disclaimer />
    </div>
  )
}

/** 권장 급여량 (F-2.2) */
function FoodCalculator() {
  const { profile, latest, monthsElapsed } = usePuppyInfo()
  const feeding = usePuppyStore((s) => s.feeding)
  const foods = usePuppyStore((s) => s.foods)
  const setCurrentFood = usePuppyStore((s) => s.setCurrentFood)
  const updateFood = usePuppyStore((s) => s.updateFood)
  const updateProfile = usePuppyStore((s) => s.updateProfile)
  // 최근 체중 기록을 기본값으로, 직접 바꿔서 계산해 볼 수도 있다
  const [weightInput, setWeightInput] = useState(latest ? String(latest.kg) : '')
  const [showDetail, setShowDetail] = useState(false)

  const food = foods.find((f) => f.id === feeding.currentFoodId)
  const parsed = parseWeightInput(weightInput)
  const result =
    !parsed.error && food
      ? calcDailyFood({ kg: parsed.value, factor: profile.puppyFactor, kcalPerG: food.kcalPerG, meals: feeding.mealsPerDay })
      : null

  return (
    <Card title="하루 권장 급여량" icon="🥣">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Field label="체중 (kg)" error={weightInput !== '' ? parsed.error : null}>
            <input
              inputMode="decimal"
              placeholder="2.4"
              value={weightInput}
              onChange={(e) => setWeightInput(e.target.value)}
              className={inputClass}
              aria-describedby="weight-hint"
            />
          </Field>
          <Field label="퍼피 가중치">
            <select
              value={profile.puppyFactor}
              onChange={(e) => updateProfile({ puppyFactor: Number(e.target.value) })}
              className={inputClass}
            >
              {[3.0, 2.8, 2.5, 2.2, 2.0].map((f) => (
                <option key={f} value={f}>
                  {f.toFixed(1)}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <p id="weight-hint" className="text-xs text-faint">
          {latest ? `최근 기록 ${latest.kg}kg (${latest.date})을 불러왔어요.` : '성장 탭에서 체중을 기록하면 자동으로 불러와요.'}
        </p>
        <Field label="급여 중인 사료">
          <select value={feeding.currentFoodId ?? ''} onChange={(e) => setCurrentFood(e.target.value)} className={inputClass}>
            {foods.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} ({f.kcalPerG} kcal/g)
              </option>
            ))}
          </select>
        </Field>

        {isExampleKcal(food) && (
          <Banner tone="warn" icon="📦" data-testid="example-kcal">
            <strong className="block">{food.kcalPerG} kcal/g은 예시값이에요</strong>
            포장지의 칼로리 표기와 다르면 급여량이 틀려요. 아래 사료 목록에서 수정하거나, 같으면 확인을 눌러 주세요.
            <span className="mt-2 flex gap-2">
              <Button variant="outline" className="flex-1 bg-card" onClick={() => updateFood(food.id, { verified: true })}>
                포장지와 같아요
              </Button>
              <Button variant="ghost" onClick={() => document.getElementById('food-db')?.scrollIntoView({ behavior: 'smooth' })}>
                수정하기
              </Button>
            </span>
          </Banner>
        )}

        {result ? (
          <div className="grid grid-cols-2 gap-2 text-center" data-testid="food-result">
            <div className="rounded-2xl bg-gradient-to-br from-peach/60 to-tint p-4">
              <p className="text-xs font-bold text-on-peach">하루</p>
              <p className="text-4xl font-black text-cocoa">
                {result.dailyGrams}
                <span className="text-xl">g</span>
              </p>
            </div>
            <div className="rounded-2xl bg-tint p-4">
              <p className="text-xs font-bold text-muted">1회</p>
              <p className="text-4xl font-black text-cocoa">
                {result.perMealGrams}
                <span className="text-xl">g</span>
              </p>
              <p className="text-xs font-bold text-muted">× {result.meals}회 분할</p>
            </div>
          </div>
        ) : (
          <Empty icon="🥣" actionLabel={food ? undefined : '사료 등록하러 가기'} onAction={() => document.getElementById('food-db')?.scrollIntoView({ behavior: 'smooth' })}>
            {food ? '체중을 입력하면 권장량을 계산해 드려요.' : '사료를 먼저 등록해 주세요.'}
          </Empty>
        )}

        {shouldSuggestLowerFactor(monthsElapsed, profile.puppyFactor) && (
          <Banner tone="warn" icon="💡">
            4개월이 지났어요. 퍼피 가중치를 2.5로 낮추는 걸 고려해 보세요.
          </Banner>
        )}

        {result && (
          <details className="rounded-2xl bg-tint/60 px-3 open:pb-3" onToggle={(e) => setShowDetail(e.currentTarget.open)}>
            <summary className="flex min-h-11 cursor-pointer items-center text-sm font-bold text-muted">
              🧮 계산 과정 {showDetail ? '접기' : '보기'} (RER → 하루 열량 → g)
            </summary>
            {showDetail && (
              <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm text-ink">
                <li>
                  RER = 70 × {parsed.value}<sup>0.75</sup> ≈ {result.rer} kcal
                </li>
                <li>
                  하루 필요 열량 = RER × {profile.puppyFactor} ≈ {result.der} kcal
                </li>
                <li>
                  하루 급여량 = {result.der} ÷ {food.kcalPerG} kcal/g ≈ {result.dailyGrams}g
                </li>
                <li>
                  1회 = {result.dailyGrams} ÷ {result.meals}회 ≈ {result.perMealGrams}g
                </li>
              </ol>
            )}
          </details>
        )}
        <p className="text-xs text-faint">🦴 간식은 하루 총열량의 10% 이내로 주세요.</p>
      </div>
    </Card>
  )
}

/** 오늘 급여 체크 (F-2.3) */
function MealChecklist() {
  const now = useNow()
  const { profile, latest } = usePuppyInfo()
  const feeding = usePuppyStore((s) => s.feeding)
  const foods = usePuppyStore((s) => s.foods)
  const toggleMeal = usePuppyStore((s) => s.toggleMeal)
  const setMealGrams = usePuppyStore((s) => s.setMealGrams)
  const feedDay = getFeedingDay(now, feeding.firstMealTime)
  const { done, total } = feedingProgress(feeding, feedDay)
  const food = foods.find((f) => f.id === feeding.currentFoodId)
  const perMeal =
    latest && food ? calcDailyFood({ kg: latest.kg, factor: profile.puppyFactor, kcalPerG: food.kcalPerG, meals: feeding.mealsPerDay }).perMealGrams : null
  const gramsToday = feeding.logs.filter((l) => l.date === feedDay && l.done && l.grams).reduce((sum, l) => sum + l.grams, 0)

  return (
    <Card
      title="오늘 맘마"
      icon="🍚"
      action={
        <span className="rounded-full bg-peach/40 px-3 py-1 text-sm font-extrabold text-cocoa" data-testid="meal-progress">
          {done}/{total}회
        </span>
      }
    >
      <p className="mb-2 text-xs text-faint">
        {formatKoreanDate(feedDay)} 급여 일정 · 체크하면 실제 급여량(g)을 적을 수 있어요
        {gramsToday > 0 && (
          <strong className="block text-cocoa" data-testid="meal-grams-total">
            오늘 먹은 양 {gramsToday}g{perMeal ? ` / 권장 ${perMeal * feeding.mealsPerDay}g` : ''}
          </strong>
        )}
      </p>
      <ul className="grid grid-cols-2 gap-2">
        {feeding.schedule.slice(0, feeding.mealsPerDay).map((time, slot) => {
          const log = feeding.logs.find((l) => l.date === feedDay && l.slot === slot && l.done)
          const checked = !!log
          return (
            <li key={slot} className="space-y-1">
              <label
                className={`flex min-h-14 cursor-pointer items-center gap-2 rounded-2xl border-2 px-3 transition ${
                  checked ? 'border-peach bg-peach/25' : 'border-line bg-card'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleMeal(feedDay, slot, perMeal)}
                  className="size-5 accent-[var(--c-peach-strong)]"
                  aria-label={`${slot + 1}번째 ${time} 급여`}
                />
                <span className="leading-tight">
                  <span className="block text-xs text-muted">{slot + 1}번째</span>
                  <strong className="text-lg">{time}</strong>
                </span>
                {checked && (
                  <span aria-hidden className="ml-auto">
                    😋
                  </span>
                )}
              </label>
              {checked && (
                <label className="flex items-center gap-1 px-1 text-xs text-muted">
                  실제
                  <input
                    key={`${feedDay}-${slot}-${log.grams ?? ''}`}
                    inputMode="decimal"
                    defaultValue={log.grams ?? ''}
                    placeholder={perMeal ? String(perMeal) : 'g'}
                    aria-label={`${slot + 1}번째 실제 급여량 (g)`}
                    onBlur={(e) => {
                      const v = e.target.value.trim() === '' ? null : parsePositiveNumber(e.target.value)
                      if (v === null && e.target.value.trim() !== '') return (e.target.value = log.grams ?? '')
                      if (v !== null && v > 500) return (e.target.value = log.grams ?? '')
                      setMealGrams(feedDay, slot, v === null ? null : Math.round(v))
                    }}
                    className="min-h-11 w-full min-w-0 rounded-xl border-2 border-line bg-card px-2 text-base text-ink"
                  />
                  g
                </label>
              )}
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

/** 급여 시간표 (F-2.3) */
function FeedingPlan() {
  const feeding = usePuppyStore((s) => s.feeding)
  const updateFeedingPlan = usePuppyStore((s) => s.updateFeedingPlan)
  const setScheduleTime = usePuppyStore((s) => s.setScheduleTime)

  return (
    <Card title="급여 시간표" icon="⏰">
      <div className="grid grid-cols-3 gap-2">
        <Field label="횟수">
          <select value={feeding.mealsPerDay} onChange={(e) => updateFeedingPlan({ mealsPerDay: Number(e.target.value) })} className={inputClass}>
            {[3, 4].map((n) => (
              <option key={n} value={n}>
                {n}회
              </option>
            ))}
          </select>
        </Field>
        <Field label="첫 급여">
          <input
            type="time"
            value={feeding.firstMealTime}
            onChange={(e) => isValidTime(e.target.value) && updateFeedingPlan({ firstMealTime: e.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label="간격">
          <select value={feeding.intervalHours} onChange={(e) => updateFeedingPlan({ intervalHours: Number(e.target.value) })} className={inputClass}>
            {[4, 5, 6, 7, 8].map((h) => (
              <option key={h} value={h}>
                {h}시간
              </option>
            ))}
          </select>
        </Field>
      </div>
      <p className="mt-3 mb-1 text-xs text-muted">시각별로 직접 바꿀 수 있어요</p>
      <div className="grid grid-cols-2 gap-2">
        {feeding.schedule.map((time, slot) => (
          <Field key={slot} label={`${slot + 1}번째`}>
            <input
              type="time"
              value={time}
              onChange={(e) => isValidTime(e.target.value) && setScheduleTime(slot, e.target.value)}
              className={inputClass}
            />
          </Field>
        ))}
      </div>
    </Card>
  )
}

/** 사료 DB (F-2.1) */
function FoodDatabase() {
  const foods = usePuppyStore((s) => s.foods)
  const addFood = usePuppyStore((s) => s.addFood)
  const updateFood = usePuppyStore((s) => s.updateFood)
  const deleteFood = usePuppyStore((s) => s.deleteFood)
  const [form, setForm] = useState({ id: null, name: '', kcal: '', unit: 'g' })
  const [error, setError] = useState(null)

  const submit = (e) => {
    e.preventDefault()
    const value = parsePositiveNumber(form.kcal)
    if (!form.name.trim()) return setError('사료 이름을 입력해 주세요.')
    if (!value) return setError('칼로리를 숫자로 입력해 주세요.')
    const kcalPerG = form.unit === 'kg' ? kcalPerKgToPerG(value) : value
    if (kcalPerG < 1 || kcalPerG > 7) return setError(`${kcalPerG} kcal/g은 일반 건사료 범위(약 3~5)를 벗어나요. 단위를 확인해 주세요.`)
    if (form.id) updateFood(form.id, { name: form.name.trim(), kcalPerG, verified: true })
    else addFood({ name: form.name.trim(), kcalPerG })
    setForm({ id: null, name: '', kcal: '', unit: 'g' })
    setError(null)
  }

  return (
    <Card title="사료 목록" icon="📦" id="food-db">
      {foods.some(isExampleKcal) && <p className="mb-2 text-xs text-warn">기본 칼로리는 예시값이에요. 포장지 표기로 꼭 확인·수정해 주세요.</p>}
      <ul className="mb-3 divide-y divide-line text-sm">
        {foods.map((f) => (
          <li key={f.id} className="flex items-center gap-2 py-1.5">
            <span className="flex-1">
              {f.name}
              {isExampleKcal(f) && <span className="ml-1 rounded-full bg-warn-bg px-1.5 text-[10px] font-bold text-warn">예시값</span>}
            </span>
            <span className="text-muted">{f.kcalPerG} kcal/g</span>
            <Button variant="ghost" onClick={() => setForm({ id: f.id, name: f.name, kcal: String(f.kcalPerG), unit: 'g' })}>
              수정
            </Button>
            <Button
              variant="ghost"
              disabled={foods.length <= 1}
              onClick={() => window.confirm(`'${f.name}'을 삭제할까요?`) && deleteFood(f.id)}
            >
              삭제
            </Button>
          </li>
        ))}
      </ul>
      <form onSubmit={submit} className="space-y-2">
        <Field label={form.id ? '사료 수정' : '사료 추가'}>
          <input placeholder="사료 이름" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} />
        </Field>
        <div className="flex gap-2">
          <input
            inputMode="decimal"
            placeholder={form.unit === 'kg' ? '3800' : '3.8'}
            aria-label="칼로리"
            value={form.kcal}
            onChange={(e) => setForm({ ...form, kcal: e.target.value })}
            className={inputClass}
          />
          <select aria-label="칼로리 단위" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className={`${inputClass} w-32`}>
            <option value="g">kcal/g</option>
            <option value="kg">kcal/kg</option>
          </select>
        </div>
        {form.unit === 'kg' && parsePositiveNumber(form.kcal) && (
          <p className="text-xs text-muted">= {kcalPerKgToPerG(parsePositiveNumber(form.kcal))} kcal/g</p>
        )}
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex gap-2">
          <Button type="submit" variant="outline" className="flex-1">
            {form.id ? '수정 저장' : '추가'}
          </Button>
          {form.id && (
            <Button variant="ghost" onClick={() => setForm({ id: null, name: '', kcal: '', unit: 'g' })}>
              취소
            </Button>
          )}
        </div>
      </form>
    </Card>
  )
}

/** 배변 기록 (F-2.4) */
function PottyTracker() {
  const { today } = usePuppyInfo()
  const potty = usePuppyStore((s) => s.potty)
  const addPotty = usePuppyStore((s) => s.addPotty)
  const deletePotty = usePuppyStore((s) => s.deletePotty)
  const [type, setType] = useState('pee')
  const [condition, setCondition] = useState('normal')
  const [onPad, setOnPad] = useState(true)
  const [memo, setMemo] = useState('')

  const summary = summarizePotty(potty, today)
  const todayList = potty.filter((p) => p.at.startsWith(today)).sort((a, b) => b.at.localeCompare(a.at))

  const record = () => {
    addPotty({ at: toLocalDateTimeString(), type, condition: type === 'poop' ? condition : null, onPad, memo: memo.trim() })
    setMemo('')
  }

  return (
    <Card
      title="배변 기록" icon="🚽"
      action={summary.diarrheaAlert && <span className="rounded-full bg-danger-bg px-2 py-0.5 text-xs font-bold text-danger">⚠️ 설사 {summary.diarrhea}회</span>}
    >
      <p className="mb-3 text-sm" data-testid="potty-summary">
        오늘 소변 {summary.pee} · 대변 {summary.poop}
        {summary.padRate !== null && ` · 패드 성공률 ${summary.padRate}%`}
      </p>
      <div className="space-y-2">
        <div className="flex gap-2">
          <Chip active={type === 'pee'} onClick={() => setType('pee')}>
            💧 소변
          </Chip>
          <Chip active={type === 'poop'} onClick={() => setType('poop')}>
            💩 대변
          </Chip>
        </div>
        {type === 'poop' && (
          <div className="flex flex-wrap gap-2">
            {POOP_CONDITIONS.map((c) => (
              <Chip key={c.value} active={condition === c.value} onClick={() => setCondition(c.value)}>
                {c.label}
              </Chip>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <Chip active={onPad} onClick={() => setOnPad(true)}>
            ✅ 패드 성공
          </Chip>
          <Chip active={!onPad} onClick={() => setOnPad(false)}>
            ❌ 실수
          </Chip>
        </div>
        <input aria-label="배변 메모" placeholder="메모 (선택: 색, 양, 장소 등)" value={memo} onChange={(e) => setMemo(e.target.value)} className={inputClass} />
        <Button className="w-full" onClick={record}>
          지금 기록하기
        </Button>
      </div>
      {summary.diarrheaAlert && (
        <p className="mt-2 text-xs text-danger">오늘 설사가 2회 이상이에요. 기운·식욕을 살피고, 계속되면 병원에 가 보세요.</p>
      )}
      {todayList.length > 0 && (
        <ul className="mt-3 divide-y divide-line text-sm">
          {todayList.map((p) => (
            <li key={p.id} className="flex items-center gap-2 py-1">
              <span className="w-12 text-muted">{p.at.slice(11)}</span>
              <span>{p.type === 'pee' ? '💧 소변' : `💩 ${POOP_CONDITIONS.find((c) => c.value === p.condition)?.label ?? ''}`}</span>
              <span>{p.onPad ? '✅' : '❌'}</span>
              {p.memo && <span className="min-w-0 truncate text-xs text-faint">{p.memo}</span>}
              <Button variant="ghost" className="ml-auto" onClick={() => deletePotty(p.id)} aria-label="배변 기록 삭제">
                삭제
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
