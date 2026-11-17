import { useState } from 'react'
import ImageThumb from '../components/ImageThumb.jsx'
import PageTitle from '../components/PageTitle.jsx'
import { Banner, Button, Card, Chip, Disclaimer, Empty, Field, Modal, inputClass } from '../components/ui.jsx'
import { deleteImage, saveImage } from '../db/imageDB.js'
import { useToday } from '../hooks/useToday.js'
import { usePuppyStore } from '../store/usePuppyStore.js'
import { downloadCalendar } from '../utils/calendarExport.js'
import { formatKoreanDate, isValidDateString } from '../utils/date.js'
import { compressImage } from '../utils/image.js'
import { NO_CLAIM, STATUS_LABEL, filterReceipts, formatWon, parseAmount, pendingSummary } from '../utils/receipts.js'
import { DOSE_STATUS_LABEL, doseStatus, isSeriesComplete } from '../utils/vaccine.js'

export default function HealthPage() {
  return (
    <div className="space-y-4">
      <PageTitle sub="접종 일정과 병원 영수증">💉 건강 · 보험</PageTitle>
      <VaccineScheduler />
      <ReceiptArchive />
      <Disclaimer />
    </div>
  )
}

// ── 접종 (F-3.1) ──────────────────────────────────────────

// 타임라인 점: 색 + 아이콘 + 글자를 함께 써서 색만으로 구분하지 않는다
const DOSE_STYLE = {
  done: { dot: 'bg-ok text-card', icon: '✓', label: 'text-ok', pill: 'bg-ok-bg text-ok' },
  overdue: { dot: 'bg-danger text-card', icon: '!', label: 'text-danger font-bold', pill: 'bg-danger-bg text-danger' },
  scheduled: { dot: 'border-2 border-peach bg-card text-cocoa', icon: '', label: 'text-ink', pill: 'bg-tint text-muted' },
}
// '2026-09-10' → '9/10' (좁은 화면에서 날짜가 줄바꿈되지 않게)
const formatMonthDay = (d) => `${Number(d.slice(5, 7))}/${Number(d.slice(8))}`
const DOSE_PILL_ICON = { done: '✅', overdue: '🔴', scheduled: '⏳' }

function VaccineScheduler() {
  const vaccines = usePuppyStore((s) => s.vaccines)
  return (
    <Card title="예방접종" icon="💉">
      <div className="space-y-3">
        {vaccines.map((v) => (
          <VaccineItem key={v.id} vaccine={v} />
        ))}
      </div>
      <Banner tone="info" icon="📅" className="mt-4">
        앱이 닫혀 있으면 알림이 울리지 않아요. 캘린더로 내보내면 폰이 3일 전·당일에 알려줘요.
        <Button variant="outline" className="mt-2 w-full" onClick={downloadCalendar}>
          캘린더로 내보내기 (.ics)
        </Button>
      </Banner>
    </Card>
  )
}

function VaccineItem({ vaccine }) {
  const today = useToday()
  const setFirstDose = usePuppyStore((s) => s.setFirstDose)
  const completeDose = usePuppyStore((s) => s.completeDose)
  const undoDose = usePuppyStore((s) => s.undoDose)
  const updateVaccinePlan = usePuppyStore((s) => s.updateVaccinePlan)
  const resetVaccine = usePuppyStore((s) => s.resetVaccine)
  const [firstDate, setFirstDate] = useState(today)
  const [completing, setCompleting] = useState(null) // { n, date, clinic }
  const [editing, setEditing] = useState(false)

  const complete = isSeriesComplete(vaccine)

  return (
    <div className={`rounded-2xl border-2 p-3 ${complete ? 'border-ok/30 bg-ok-bg/40' : 'border-line'}`} data-testid={`vaccine-${vaccine.id}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="font-extrabold">
          {vaccine.name} {complete && <span className="text-sm text-ok">✅ 완료</span>}
        </h3>
        <span className="flex shrink-0 items-center text-xs text-faint">
          {vaccine.totalDoses}차 · {vaccine.intervalDays}일
          <button type="button" onClick={() => setEditing(!editing)} className="min-h-11 px-2 underline" aria-label={`${vaccine.name} 차수·간격 변경`}>
            변경
          </button>
        </span>
      </div>

      {editing && (
        <PlanEditor
          vaccine={vaccine}
          onSave={(plan) => {
            updateVaccinePlan(vaccine.id, plan)
            setEditing(false)
          }}
        />
      )}

      {vaccine.doses.length === 0 ? (
        <div className="flex items-end gap-2">
          <Field label="1차 접종일" className="flex-1">
            <input type="date" value={firstDate} onChange={(e) => setFirstDate(e.target.value)} className={inputClass} />
          </Field>
          <Button
            onClick={() => isValidDateString(firstDate) && setFirstDose(vaccine.id, firstDate, firstDate <= today)}
          >
            일정 만들기
          </Button>
        </div>
      ) : (
        <ol className="relative ml-3 border-l-2 border-line text-sm">
          {vaccine.doses.map((d) => {
            const status = doseStatus(d, today)
            const s = DOSE_STYLE[status]
            return (
              <li key={d.n} className="relative flex min-h-12 items-center gap-2 pl-5" data-testid="dose-row">
                <span aria-hidden className={`absolute -left-[11px] grid size-5 place-items-center rounded-full text-[10px] font-black ${s.dot}`}>
                  {s.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="font-bold">{d.n}차</span>{' '}
                  <span className={s.label}>{d.doneDate ? `${formatMonthDay(d.doneDate)} 접종` : `${formatMonthDay(d.dueDate)} 예정`}</span>
                  {d.clinic && <span className="block truncate text-xs text-faint">{d.clinic}</span>}
                </span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${s.pill}`}>
                  {DOSE_PILL_ICON[status]} {DOSE_STATUS_LABEL[status]}
                </span>
                {d.doneDate ? (
                  <Button variant="ghost" className="px-2" onClick={() => undoDose(vaccine.id, d.n)} aria-label={`${d.n}차 완료 취소`}>
                    취소
                  </Button>
                ) : (
                  <Button variant="outline" className="px-3" onClick={() => setCompleting({ n: d.n, date: today, clinic: '' })}>
                    완료
                  </Button>
                )}
              </li>
            )
          })}
        </ol>
      )}
      {vaccine.doses.length > 0 && (
        <button
          type="button"
          onClick={() => window.confirm(`${vaccine.name} 일정을 모두 지울까요?`) && resetVaccine(vaccine.id)}
          className="mt-1 min-h-11 text-xs text-faint underline"
        >
          일정 초기화
        </button>
      )}

      {completing && (
        <Modal title={`${vaccine.name} ${completing.n}차 접종 완료`} onClose={() => setCompleting(null)}>
          <div className="space-y-3">
            <Field label="실제 접종일">
              <input
                type="date"
                value={completing.date}
                max={today}
                onChange={(e) => setCompleting({ ...completing, date: e.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="병원 (선택)">
              <input value={completing.clinic} onChange={(e) => setCompleting({ ...completing, clinic: e.target.value })} className={inputClass} />
            </Field>
            <p className="text-xs text-muted">다음 차수 예정일은 실제 접종일 기준으로 다시 계산돼요.</p>
            <Button
              className="w-full"
              disabled={!isValidDateString(completing.date) || completing.date > today}
              onClick={() => {
                completeDose(vaccine.id, completing.n, completing.date, completing.clinic)
                setCompleting(null)
              }}
            >
              저장
            </Button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function PlanEditor({ vaccine, onSave }) {
  const [total, setTotal] = useState(vaccine.totalDoses)
  const [interval, setIntervalDays] = useState(vaccine.intervalDays)
  const [error, setError] = useState(null)
  return (
    <div className="mb-3 flex flex-wrap items-end gap-2 rounded-xl bg-tint p-2">
      <Field label="총 차수" className="flex-1">
        <input type="number" inputMode="numeric" min={1} max={10} value={total} onChange={(e) => setTotal(e.target.value)} className={inputClass} />
      </Field>
      <Field label="간격(일)" className="flex-1">
        <input type="number" inputMode="numeric" min={0} max={365} value={interval} onChange={(e) => setIntervalDays(e.target.value)} className={inputClass} />
      </Field>
      <Button
        onClick={() => {
          const t = Math.round(Number(total))
          const i = Math.round(Number(interval))
          if (!(t >= 1 && t <= 10)) return setError('총 차수는 1~10이에요.')
          // 1차만 맞는 백신(광견병)은 간격 0을 허용하지만, 2차 이상이면 모든 차수가 같은 날이 되므로 막는다
          if (!(i >= (t >= 2 ? 1 : 0) && i <= 365)) return setError(t >= 2 ? '2차 이상이면 간격은 1~365일이에요.' : '간격은 0~365일이에요.')
          setError(null)
          onSave({ totalDoses: t, intervalDays: i })
        }}
      >
        적용
      </Button>
      {error && (
        <p role="alert" className="basis-full text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  )
}

// ── 영수증 (F-3.3, F-3.4) ─────────────────────────────────

function ReceiptArchive() {
  const receipts = usePuppyStore((s) => s.receipts)
  const insurers = usePuppyStore((s) => s.insurers)
  const toggleReceiptStatus = usePuppyStore((s) => s.toggleReceiptStatus)
  const updateReceipt = usePuppyStore((s) => s.updateReceipt)
  const deleteReceipt = usePuppyStore((s) => s.deleteReceipt)
  const today = useToday()
  const [status, setStatus] = useState('pending')
  const [insurer, setInsurer] = useState('all')
  const [adding, setAdding] = useState(false)

  const list = filterReceipts(receipts, { status, insurer })
  const summary = pendingSummary(receipts)
  const insurerOptions = [...new Set([...insurers, ...receipts.map((r) => r.insurer)])].filter((i) => i && i !== NO_CLAIM)

  return (
    <Card title="병원 영수증" icon="🧾" action={<Button onClick={() => setAdding(true)}>+ 추가</Button>}>
      <div
        className={`mb-3 rounded-2xl p-3 text-center ${summary.count ? 'bg-warn-bg text-warn' : 'bg-ok-bg text-ok'}`}
        data-testid="pending-summary"
      >
        <span className="text-sm font-bold">미청구 {summary.count}건</span>
        <span className="mx-1">·</span>
        <span className="text-lg font-black">합계 {formatWon(summary.total)}</span>
      </div>
      <div className="mb-2 flex flex-wrap gap-2">
        {[
          ['all', '전체'],
          ['pending', '청구 대기'],
          ['claimed', '청구 완료'],
        ].map(([v, label]) => (
          <Chip key={v} active={status === v} onClick={() => setStatus(v)}>
            {label}
          </Chip>
        ))}
      </div>
      <select aria-label="보험사 필터" value={insurer} onChange={(e) => setInsurer(e.target.value)} className={`${inputClass} mb-3`}>
        <option value="all">모든 보험사</option>
        {insurerOptions.map((i) => (
          <option key={i} value={i}>
            {i}
          </option>
        ))}
      </select>

      {list.length === 0 ? (
        <Empty icon="🧾" actionLabel="영수증 추가하기" onAction={() => setAdding(true)}>
          {status === 'pending' ? '청구할 영수증이 없어요.' : '영수증이 없어요.'}
        </Empty>
      ) : (
        <ul className="space-y-3">
          {list.map((r) => {
            const images = [
              ...r.imageIds.map((id, i) => ({ id, alt: `영수증 ${i + 1}`, file: `영수증_${r.visitDate}_${i + 1}.jpg` })),
              ...r.detailImageIds.map((id, i) => ({ id, alt: `세부내역서 ${i + 1}`, file: `세부내역서_${r.visitDate}_${i + 1}.jpg` })),
            ]
            return (
              <li key={r.id} className="rounded-2xl border-2 border-line p-3 text-sm" data-testid="receipt-row">
                <div className="flex gap-3">
                  {images[0] ? (
                    <ImageThumb id={images[0].id} alt={images[0].alt} filename={images[0].file} className="size-16 shrink-0" />
                  ) : (
                    <span aria-hidden className="grid size-16 shrink-0 place-items-center rounded-xl bg-tint text-2xl">
                      🏥
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{r.clinic || '병원'}</p>
                    <p className="text-xs text-muted">{formatKoreanDate(r.visitDate)}</p>
                    {r.description && <p className="truncate text-muted">{r.description}</p>}
                    <p className="text-lg font-black text-cocoa">{formatWon(r.amount)}</p>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-xs text-muted">🛡️ {r.insurer}</span>
                  {r.status === 'none' ? (
                    <span className="shrink-0 rounded-full bg-tint px-3 py-1 text-xs text-faint">{STATUS_LABEL.none}</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => toggleReceiptStatus(r.id, today)}
                      aria-pressed={r.status === 'claimed'}
                      className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-bold ${
                        r.status === 'claimed' ? 'bg-ok-bg text-ok' : 'bg-warn-bg text-warn'
                      }`}
                    >
                      {r.status === 'claimed' ? '✅' : '⏳'} [{STATUS_LABEL[r.status]}]
                    </button>
                  )}
                </div>
                {r.claimedDate && <p className="text-right text-xs text-faint">청구일 {r.claimedDate}</p>}
                {r.status === 'claimed' && (
                  <label className="mt-2 flex items-center gap-2 text-xs text-muted">
                    수령액
                    <input
                      inputMode="numeric"
                      defaultValue={r.paidAmount ?? ''}
                      placeholder="선택"
                      onBlur={(e) => {
                        const v = parseAmount(e.target.value)
                        if (v !== null) updateReceipt(r.id, { paidAmount: v || null })
                      }}
                      className="min-h-11 w-32 rounded-xl border-2 border-line bg-card px-2"
                    />
                    원
                  </label>
                )}
                {images.length > 1 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {images.slice(1).map((img) => (
                      <ImageThumb key={img.id} id={img.id} alt={img.alt} filename={img.file} className="size-12" />
                    ))}
                  </div>
                )}
                {r.memo && <p className="mt-1 text-xs text-muted">{r.memo}</p>}
                <button
                  type="button"
                  onClick={() => window.confirm('이 영수증과 사진을 삭제할까요?') && deleteReceipt(r.id)}
                  className="min-h-11 text-xs text-faint underline"
                >
                  삭제
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {adding && <ReceiptForm onClose={() => setAdding(false)} />}
    </Card>
  )
}

const OTHER = '__other__'
const MAX_RECEIPT_WON = 100_000_000

function ReceiptForm({ onClose }) {
  const today = useToday()
  const insurers = usePuppyStore((s) => s.insurers)
  const addReceipt = usePuppyStore((s) => s.addReceipt)
  const [form, setForm] = useState({
    visitDate: today,
    clinic: '',
    description: '',
    amount: '',
    insurer: insurers[0] ?? NO_CLAIM,
    otherInsurer: '',
    memo: '',
  })
  const [receiptFiles, setReceiptFiles] = useState([])
  const [detailFiles, setDetailFiles] = useState([])
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

  const submit = async (e) => {
    e.preventDefault()
    const amount = parseAmount(form.amount)
    const insurer = form.insurer === OTHER ? form.otherInsurer.trim() : form.insurer
    if (!isValidDateString(form.visitDate)) return setError('진료일을 확인해 주세요.')
    if (amount === null) return setError('금액은 숫자로 입력해 주세요.')
    if (amount === 0) return setError('금액을 입력해 주세요.')
    if (amount > MAX_RECEIPT_WON) return setError(`금액이 너무 커요. ${formatWon(MAX_RECEIPT_WON)} 이하로 입력해 주세요.`)
    if (!insurer) return setError('보험사 이름을 입력해 주세요.')
    setSaving(true)
    setError(null)
    const saved = []
    try {
      const store = async (files) => {
        const ids = []
        for (const file of files) {
          const { blob } = await compressImage(file, { maxSide: 1600, quality: 0.8 })
          const id = await saveImage(blob, { kind: 'receipt' })
          saved.push(id)
          ids.push(id)
        }
        return ids
      }
      const imageIds = await store(receiptFiles)
      const detailImageIds = await store(detailFiles)
      addReceipt({
        visitDate: form.visitDate,
        clinic: form.clinic.trim(),
        description: form.description.trim(),
        amount,
        insurer,
        status: insurer === NO_CLAIM ? 'none' : 'pending',
        imageIds,
        detailImageIds,
        memo: form.memo.trim(),
      })
      onClose()
    } catch (err) {
      // 일부만 저장된 이미지는 지워서 고아 이미지가 남지 않게
      await Promise.all(saved.map((id) => deleteImage(id).catch(() => {})))
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <Modal title="영수증 추가" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Field label="진료일">
            <input type="date" value={form.visitDate} max={today} onChange={(e) => set({ visitDate: e.target.value })} className={inputClass} />
          </Field>
          <Field label="금액 (원)">
            <input inputMode="numeric" placeholder="45000" value={form.amount} onChange={(e) => set({ amount: e.target.value })} className={inputClass} />
          </Field>
        </div>
        <Field label="병원명">
          <input value={form.clinic} onChange={(e) => set({ clinic: e.target.value })} className={inputClass} />
        </Field>
        <Field label="진료 내용">
          <input placeholder="예: 종합백신 3차, 피부 진료" value={form.description} onChange={(e) => set({ description: e.target.value })} className={inputClass} />
        </Field>
        <Field label="청구할 보험사">
          <select value={form.insurer} onChange={(e) => set({ insurer: e.target.value })} className={inputClass}>
            {insurers.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
            <option value={OTHER}>기타 (직접 입력)</option>
            <option value={NO_CLAIM}>{NO_CLAIM}</option>
          </select>
        </Field>
        {form.insurer === OTHER && (
          <input aria-label="보험사 직접 입력" placeholder="보험사 이름" value={form.otherInsurer} onChange={(e) => set({ otherInsurer: e.target.value })} className={inputClass} />
        )}
        <Field label={`영수증 사진 ${receiptFiles.length ? `(${receiptFiles.length}장)` : ''}`}>
          <input type="file" accept="image/*" multiple onChange={(e) => setReceiptFiles([...e.target.files])} className="text-sm" />
        </Field>
        <Field label={`세부내역서 사진 ${detailFiles.length ? `(${detailFiles.length}장)` : ''}`}>
          <input type="file" accept="image/*" multiple onChange={(e) => setDetailFiles([...e.target.files])} className="text-sm" />
        </Field>
        <Field label="메모">
          <input value={form.memo} onChange={(e) => set({ memo: e.target.value })} className={inputClass} />
        </Field>
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button type="submit" className="w-full" disabled={saving}>
          {saving ? '저장 중…' : '저장'}
        </Button>
      </form>
    </Modal>
  )
}
