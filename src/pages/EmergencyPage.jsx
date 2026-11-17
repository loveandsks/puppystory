import { useState } from 'react'
import { Link } from 'react-router-dom'
import ImageThumb from '../components/ImageThumb.jsx'
import PageTitle from '../components/PageTitle.jsx'
import { Button, Card, Chip, Empty, Field, inputClass } from '../components/ui.jsx'
import {
  CATEGORIES,
  DIAGNOSIS_NOTE,
  DISCLAIMER,
  GUIDE_META,
  RED_FLAGS,
  SYMPTOM_CARDS,
  TRIAGE_QUESTIONS,
  URGENCY,
} from '../data/emergencyGuide.js'
import { deleteImage, saveImage } from '../db/imageDB.js'
import { usePuppyInfo } from '../hooks/usePuppyInfo.js'
import { usePuppyStore } from '../store/usePuppyStore.js'
import { parseLocalDateTime, toLocalDateTimeString } from '../utils/date.js'
import { compressImage } from '../utils/image.js'
import { POOP_CONDITIONS } from '../utils/potty.js'
import { buildCallScript, triage } from '../utils/triage.js'
import { vaccineSummary } from '../utils/vaccine.js'

const TABS = [
  ['guide', '가이드'],
  ['triage', '문진'],
  ['log', '증상 기록'],
  ['report', '병원 보고서'],
]

export default function EmergencyPage() {
  const [tab, setTab] = useState('guide')
  const [cardId, setCardId] = useState(null)

  const openTriage = (id) => {
    setCardId(id)
    setTab('triage')
  }

  return (
    <div className="space-y-4">
      <PageTitle>🆘 응급 가이드</PageTitle>
      {GUIDE_META.status === 'draft' && (
        <p className="rounded-xl bg-ink p-2 text-center text-xs text-cream" data-testid="draft-banner">
          초안 콘텐츠 · 수의사 감수 전
        </p>
      )}
      <CallButtons />
      <RedFlags />
      <div className="flex flex-wrap gap-2" role="tablist">
        {TABS.map(([v, label]) => (
          <Chip key={v} active={tab === v} onClick={() => setTab(v)} role="tab" aria-selected={tab === v}>
            {label}
          </Chip>
        ))}
      </div>
      {tab === 'guide' && <Guide onTriage={openTriage} />}
      {tab === 'triage' && <Triage cardId={cardId} setCardId={setCardId} />}
      {tab === 'log' && <SymptomLog />}
      {tab === 'report' && <VetReport />}
      <p className="text-xs text-faint">
        ⚕️ {DISCLAIMER} {DIAGNOSIS_NOTE}
      </p>
    </div>
  )
}

function CallButtons() {
  const contacts = usePuppyStore((s) => s.contacts)
  const label = { regular: '단골 병원', emergency24: '24시 응급 병원' }
  const withPhone = contacts.filter((c) => c.phone)
  if (!withPhone.length) {
    return (
      <Link to="/settings" className="block rounded-2xl border border-dashed border-danger/50 p-3 text-center text-sm text-danger">
        📞 병원 연락처를 등록해 두면 여기서 바로 전화할 수 있어요 →
      </Link>
    )
  }
  return (
    <div className="grid grid-cols-2 gap-2">
      {withPhone.map((c) => (
        <a
          key={c.id}
          href={`tel:${c.phone.replace(/[^\d+]/g, '')}`}
          className="rounded-2xl bg-sos p-3 text-center text-white shadow"
          data-testid={`call-${c.type}`}
        >
          <span className="block text-xs">📞 {label[c.type]}</span>
          <strong className="block truncate">{c.name || c.phone}</strong>
        </a>
      ))}
    </div>
  )
}

function RedFlags() {
  return (
    <section className="rounded-3xl border-4 border-danger bg-danger-bg p-4" aria-labelledby="redflag-title">
      <h2 id="redflag-title" className="mb-1 text-lg font-black text-danger">
        🚨 지금 바로 병원 가야 하는 신호
      </h2>
      <p className="mb-2 text-sm font-bold text-danger">하나라도 해당하면 가이드를 읽지 말고 바로 이동하세요. (밤이면 24시 병원)</p>
      <ul className="space-y-1.5 text-sm text-ink">
        {RED_FLAGS.map((f) => (
          <li key={f} className="flex gap-2">
            <span aria-hidden className="text-danger">
              ●
            </span>
            {f}
          </li>
        ))}
      </ul>
    </section>
  )
}

function UrgencyBadge({ urgency, note }) {
  const u = URGENCY[urgency]
  const color = { red: 'bg-danger-bg text-danger', yellow: 'bg-warn-bg text-warn', green: 'bg-ok-bg text-ok' }[urgency]
  return (
    <span className={`mt-1 inline-block rounded-full px-2.5 py-1 text-xs font-bold ${color}`} data-testid="urgency">
      {u.emoji} {u.label}
      {note && ` (${note})`}
    </span>
  )
}

function Guide({ onTriage }) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState(null)
  const [openId, setOpenId] = useState(null)
  const q = query.trim()
  const cards = SYMPTOM_CARDS.filter((c) => !category || c.category === category).filter(
    (c) => !q || [c.title, c.seenAs, c.category, ...c.keywords, ...c.causes].some((t) => t.includes(q)),
  )

  return (
    <div className="space-y-3">
      <input type="search" placeholder="증상 검색 (예: 토, 설사, 초콜릿)" value={query} onChange={(e) => setQuery(e.target.value)} className={inputClass} aria-label="증상 검색" />
      <div className="flex flex-wrap gap-1.5">
        <Chip active={!category} onClick={() => setCategory(null)}>
          전체
        </Chip>
        {CATEGORIES.map((c) => (
          <Chip key={c} active={category === c} onClick={() => setCategory(c)}>
            {c}
          </Chip>
        ))}
      </div>
      {cards.length === 0 && <Empty>찾는 증상이 없어요. 애매하면 병원에 전화해서 물어보세요.</Empty>}
      <ul className="space-y-2">
        {cards.map((c) => (
          <li key={c.id}>
            <SymptomCard card={c} open={openId === c.id} onToggle={() => setOpenId(openId === c.id ? null : c.id)} onTriage={() => onTriage(c.id)} />
          </li>
        ))}
      </ul>
    </div>
  )
}

function SymptomCard({ card, open, onToggle, onTriage }) {
  const { vaccinesDone } = usePuppyInfo()
  return (
    <article
      className={`overflow-hidden rounded-3xl border-l-8 bg-card shadow-soft ${
        { red: 'border-l-danger', yellow: 'border-l-warn', green: 'border-l-ok' }[card.urgency]
      }`}
      data-testid={`card-${card.id}`}
    >
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-start gap-2 p-3 text-left">
        <span className="min-w-0 flex-1">
          <span className="text-xs text-faint">{card.category}</span>
          <span className="block font-bold">{card.title}</span>
          <UrgencyBadge urgency={card.urgency} note={card.urgencyNote} />
        </span>
        <span aria-hidden className="mt-1 text-faint">
          {open ? '▲' : '▼'}
        </span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-line p-3 text-sm">
          <p className="text-muted">“{card.seenAs}”</p>
          {card.unvaccinatedNote && (
            <p className={`rounded-xl p-2 font-bold ${vaccinesDone ? 'bg-tint text-warn' : 'bg-danger-bg text-danger'}`} data-testid="unvaccinated-note">
              ⚠️ {card.unvaccinatedNote}
              {!vaccinesDone && ' — 편백이는 아직 종합백신 접종이 끝나지 않았어요.'}
            </p>
          )}
          <Section title="의심할 수 있는 원인" items={card.causes} />
          <Section title="✅ 지금 집에서 할 일" items={card.doNow} ordered />
          <Section title="🚫 하지 말 것" items={card.dont} />
          <Section title="🔴 이러면 바로 병원" items={card.escalate} />
          <Section title="🎒 병원에 가져갈 것" items={card.bring} />
          {card.tip && <p className="rounded-xl bg-tint p-2 text-xs">💡 {card.tip}</p>}
          <p className="text-xs text-faint">
            ⚕️ {DIAGNOSIS_NOTE} · 출처: {GUIDE_META.source} · 검토일: {GUIDE_META.reviewedAt ?? '감수 전'}
          </p>
          <Button variant="outline" className="w-full" onClick={onTriage}>
            이 증상으로 문진하기
          </Button>
        </div>
      )}
    </article>
  )
}

function Section({ title, items, ordered }) {
  const List = ordered ? 'ol' : 'ul'
  return (
    <div>
      <h3 className="mb-0.5 font-bold">{title}</h3>
      <List className={`${ordered ? 'list-decimal' : 'list-disc'} space-y-0.5 pl-5 text-ink`}>
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </List>
    </div>
  )
}

// ── 문진 (F-6.4) ──────────────────────────────────────────

function Triage({ cardId, setCardId }) {
  const { profile, days, latest, vaccinesDone } = usePuppyInfo()
  const vaccines = usePuppyStore((s) => s.vaccines)
  const foods = usePuppyStore((s) => s.foods)
  const currentFoodId = usePuppyStore((s) => s.feeding.currentFoodId)
  const addSymptomLog = usePuppyStore((s) => s.addSymptomLog)
  const [answers, setAnswers] = useState({ since: null, energy: null, appetite: null })
  const [count, setCount] = useState(1)
  const [logged, setLogged] = useState(false)

  const card = SYMPTOM_CARDS.find((c) => c.id === cardId)
  const complete = card && Object.values(answers).every(Boolean)
  const result = complete ? triage(card, answers, { vaccinesDone }) : null
  const script =
    result &&
    buildCallScript({
      profile,
      days,
      weightKg: latest?.kg,
      card,
      answers,
      count,
      vaccineText: vaccineSummary(vaccines),
      foodName: foods.find((f) => f.id === currentFoodId)?.name,
    })

  return (
    <Card title="간단 문진">
      <div className="space-y-4 text-sm">
        <Field label="1. 어떤 증상인가요?">
          <select
            value={cardId ?? ''}
            onChange={(e) => {
              setCardId(e.target.value || null)
              setLogged(false)
            }}
            className={inputClass}
          >
            <option value="">증상 선택</option>
            {SYMPTOM_CARDS.map((c) => (
              <option key={c.id} value={c.id}>
                [{c.category}] {c.title}
              </option>
            ))}
          </select>
        </Field>
        {Object.entries(TRIAGE_QUESTIONS).map(([key, q], i) => (
          <div key={key}>
            <p className="mb-1 text-muted">
              {i + 2}. {q.label}
            </p>
            <div className="flex flex-wrap gap-2">
              {q.options.map((o) => (
                <Chip key={o.value} active={answers[key] === o.value} onClick={() => setAnswers({ ...answers, [key]: o.value })}>
                  {o.label}
                </Chip>
              ))}
            </div>
          </div>
        ))}
        <div>
          <p className="mb-1 text-muted">5. 접종은 끝났나요? (앱 기록에서 자동)</p>
          <p className="font-bold">{vaccinesDone ? '종합백신 완료' : '종합백신 미완료'}</p>
        </div>
        <Field label="몇 번 그랬나요?">
          <input type="number" inputMode="numeric" min={1} max={50} value={count} onChange={(e) => setCount(Math.min(50, Math.max(1, Math.round(Number(e.target.value)) || 1)))} className={inputClass} />
        </Field>

        {result && (
          <div className="space-y-3 rounded-3xl bg-tint p-4" data-testid="triage-result">
            <div
              className={`rounded-2xl p-3 ${
                { red: 'bg-danger-bg text-danger', yellow: 'bg-warn-bg text-warn', green: 'bg-ok-bg text-ok' }[result.urgency]
              }`}
            >
              <p className="text-xs font-bold">결과</p>
              <p className="text-2xl font-black">
                {URGENCY[result.urgency].emoji} {URGENCY[result.urgency].label}
              </p>
              <ul className="mt-1 list-disc pl-5 text-xs">
                {result.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-1 font-bold">📞 병원에 전화해서 이렇게 말하세요</p>
              <p className="rounded-xl bg-card p-3" data-testid="call-script">
                {script}
              </p>
              <Button variant="ghost" onClick={() => navigator.clipboard?.writeText(script)}>
                복사
              </Button>
            </div>
            <Button
              variant="outline"
              className="w-full"
              disabled={logged}
              onClick={() => {
                addSymptomLog({ at: toLocalDateTimeString(), symptomId: card.id, count, urgency: result.urgency })
                setLogged(true)
              }}
            >
              {logged ? '증상 기록에 저장했어요' : '증상 기록에 저장'}
            </Button>
          </div>
        )}
      </div>
    </Card>
  )
}

// ── 증상 기록 (F-6.5) ─────────────────────────────────────

const cardTitle = (id) => SYMPTOM_CARDS.find((c) => c.id === id)?.title ?? id

function SymptomLog() {
  const logs = usePuppyStore((s) => s.symptomLogs)
  const addSymptomLog = usePuppyStore((s) => s.addSymptomLog)
  const incrementSymptom = usePuppyStore((s) => s.incrementSymptom)
  const deleteSymptomLog = usePuppyStore((s) => s.deleteSymptomLog)
  const [form, setForm] = useState({ symptomId: '', custom: '', memo: '' })
  const [files, setFiles] = useState([])
  const [fileKey, setFileKey] = useState(0) // 저장 후 파일 선택칸 비우기
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const add = async () => {
    const symptomId = form.symptomId || null
    if (!symptomId && !form.custom.trim()) return setError('증상을 고르거나 직접 입력해 주세요.')
    const at = toLocalDateTimeString() // 사진 처리 시간과 상관없이 누른 시각으로 기록
    setSaving(true)
    setError(null)
    const imageIds = []
    try {
      // 토사물·변·피부 사진 (PRD F-6.5) — 영수증과 같이 압축해서 IndexedDB에 저장
      for (const file of files) {
        const { blob } = await compressImage(file, { maxSide: 1600, quality: 0.8 })
        imageIds.push(await saveImage(blob, { kind: 'symptom' }))
      }
      addSymptomLog({ at, symptomId, custom: form.custom.trim(), memo: form.memo.trim(), imageIds })
      setForm({ symptomId: '', custom: '', memo: '' })
      setFiles([])
      setFileKey((k) => k + 1)
    } catch (err) {
      await Promise.all(imageIds.map((id) => deleteImage(id).catch(() => {})))
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const sorted = [...logs].sort((a, b) => b.at.localeCompare(a.at))
  return (
    <Card title="증상 기록">
      <div className="space-y-2">
        <select aria-label="증상" value={form.symptomId} onChange={(e) => setForm({ ...form, symptomId: e.target.value })} className={inputClass}>
          <option value="">직접 입력</option>
          {SYMPTOM_CARDS.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
        {!form.symptomId && (
          <input placeholder="증상 직접 입력" value={form.custom} onChange={(e) => setForm({ ...form, custom: e.target.value })} className={inputClass} />
        )}
        <input placeholder="메모 (색, 양, 상황 등)" value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} className={inputClass} />
        <Field label={`사진 (선택${files.length ? ` · ${files.length}장` : ''})`}>
          <input key={fileKey} type="file" accept="image/*" multiple onChange={(e) => setFiles([...e.target.files])} className="text-sm" />
        </Field>
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button className="w-full" onClick={add} disabled={saving}>
          {saving ? '저장 중…' : '지금 시각으로 기록'}
        </Button>
      </div>
      {sorted.length === 0 ? (
        <Empty>기록이 없어요.</Empty>
      ) : (
        <ul className="mt-3 divide-y divide-line text-sm">
          {sorted.map((l) => (
            <li key={l.id} className="flex items-center gap-2 py-2">
              <span className="w-24 text-xs text-muted">{l.at.replace('T', ' ').slice(5)}</span>
              <span className="flex-1">
                {l.symptomId ? cardTitle(l.symptomId) : l.custom}
                {l.memo && <span className="block text-xs text-faint">{l.memo}</span>}
                {l.imageIds?.length > 0 && (
                  <span className="mt-1 flex flex-wrap gap-1">
                    {l.imageIds.map((id, i) => (
                      <ImageThumb key={id} id={id} alt={`증상 사진 ${i + 1}`} filename={`증상_${l.at.slice(0, 10)}_${i + 1}.jpg`} className="size-11" />
                    ))}
                  </span>
                )}
              </span>
              <span className="font-bold">{l.count}회</span>
              <Button variant="outline" onClick={() => incrementSymptom(l.id)} aria-label="한 번 더">
                +1
              </Button>
              <Button
                variant="ghost"
                onClick={() => (!l.imageIds?.length || window.confirm('이 기록과 사진을 삭제할까요?')) && deleteSymptomLog(l.id)}
                aria-label="증상 기록 삭제"
              >
                삭제
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

// ── 병원 보고서 (F-6.5) ───────────────────────────────────

function VetReport() {
  const { profile, days, latest } = usePuppyInfo()
  const logs = usePuppyStore((s) => s.symptomLogs)
  const potty = usePuppyStore((s) => s.potty)
  const feeding = usePuppyStore((s) => s.feeding)
  const vaccines = usePuppyStore((s) => s.vaccines)
  const foods = usePuppyStore((s) => s.foods)
  const since = Date.now() - 72 * 3600_000
  const within = (at) => (parseLocalDateTime(at)?.getTime() ?? 0) >= since

  const recentLogs = logs.filter((l) => within(l.at)).sort((a, b) => a.at.localeCompare(b.at))
  const recentPotty = potty.filter((p) => within(p.at)).sort((a, b) => a.at.localeCompare(b.at))
  const recentMeals = feeding.logs.filter((l) => within(`${l.date}T00:00`) || within(`${l.date}T23:59`))
  const food = foods.find((f) => f.id === feeding.currentFoodId)

  return (
    <Card title="병원 보고서 (최근 72시간)">
      <dl className="space-y-3 text-sm" data-testid="vet-report">
        <div>
          <dt className="font-bold">기본 정보</dt>
          <dd>
            {profile.name} · {profile.breed} · 생후 {days}일 · {latest ? `${latest.kg}kg (${latest.date})` : '체중 기록 없음'}
          </dd>
          <dd>사료: {food?.name ?? '-'} · 하루 {feeding.mealsPerDay}회</dd>
          <dd>접종: {vaccineSummary(vaccines)}</dd>
        </div>
        <div>
          <dt className="font-bold">증상</dt>
          {recentLogs.length ? (
            recentLogs.map((l) => (
              <dd key={l.id}>
                {l.at.replace('T', ' ').slice(5)} · {l.symptomId ? cardTitle(l.symptomId) : l.custom} {l.count}회 {l.memo && `(${l.memo})`}
                {l.imageIds?.length > 0 && ` · 사진 ${l.imageIds.length}장`}
              </dd>
            ))
          ) : (
            <dd className="text-faint">기록 없음</dd>
          )}
        </div>
        <div>
          <dt className="font-bold">배변</dt>
          {recentPotty.length ? (
            recentPotty.map((p) => (
              <dd key={p.id}>
                {p.at.replace('T', ' ').slice(5)} · {p.type === 'pee' ? '소변' : `대변(${POOP_CONDITIONS.find((c) => c.value === p.condition)?.label ?? ''})`}
              </dd>
            ))
          ) : (
            <dd className="text-faint">기록 없음</dd>
          )}
        </div>
        <div>
          <dt className="font-bold">급여 체크</dt>
          <dd>
            {recentMeals.length ? `${recentMeals.length}회 체크 (최근 3일)` : '기록 없음'}
            {recentMeals.some((l) => l.grams) && ` · 합계 ${recentMeals.reduce((sum, l) => sum + (l.grams ?? 0), 0)}g`}
          </dd>
        </div>
      </dl>
      <Link to="/health" className="mt-4 block rounded-xl border border-peach p-3 text-center text-sm font-bold text-cocoa">
        진료 후 영수증 등록하기 →
      </Link>
    </Card>
  )
}
