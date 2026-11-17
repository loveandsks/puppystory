import { useRef, useState } from 'react'
import { useToday } from '../hooks/useToday.js'
import { usePuppyStore } from '../store/usePuppyStore.js'
import { parseBackup, restoreImages } from '../utils/backup.js'
import { validateOnboarding } from '../utils/profile.js'
import SaveErrorBanner from './SaveErrorBanner.jsx'
import { Button, Card, Field, inputClass } from './ui.jsx'

/**
 * 처음 연 사람에게 보여주는 "우리 아이 정보 입력" 화면.
 * profile.onboarded가 false일 때 App이 일반 화면 대신 이 화면을 띄운다.
 */
export default function Onboarding() {
  const today = useToday()
  const completeOnboarding = usePuppyStore((s) => s.completeOnboarding)
  const [form, setForm] = useState({ name: '', birthDate: '', breed: '', targetWeightKg: '' })
  const [errors, setErrors] = useState({})
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const submit = (e) => {
    e.preventDefault()
    const found = validateOnboarding(form, today)
    setErrors(found)
    if (Object.keys(found).length === 0) completeOnboarding(form)
  }

  return (
    <div className="mx-auto min-h-dvh max-w-md bg-cream px-4 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-[calc(2rem+env(safe-area-inset-bottom))] text-ink">
      <header className="mb-5 text-center">
        <p aria-hidden className="text-5xl">
          🐶
        </p>
        <h1 className="mt-2 text-2xl font-extrabold text-cocoa">Puppy 성장스토리</h1>
        <p className="mt-1 text-sm text-muted">우리 아이의 성장·식단·건강·케어를 한곳에 기록해요.</p>
      </header>

      {/* 저장이 막힌 브라우저(사생활 보호 모드 등)면 입력해도 창을 닫으면 사라진다고 먼저 알린다 */}
      <div className="-mx-4 mb-3">
        <SaveErrorBanner />
      </div>

      <Card title="우리 아이 정보" icon="🐾">
        <form onSubmit={submit} noValidate className="space-y-3" aria-label="우리 아이 정보 입력">
          <Field label="이름" error={errors.name}>
            <input value={form.name} onChange={set('name')} maxLength={20} placeholder="예: 콩이" autoComplete="off" className={inputClass} />
          </Field>
          <Field label="생년월일" error={errors.birthDate}>
            <input type="date" value={form.birthDate} max={today} onChange={set('birthDate')} className={inputClass} />
          </Field>
          <p className="-mt-2 text-xs text-faint">정확히 모르면 분양받을 때 들은 대략적인 날짜를 넣어도 돼요.</p>
          <Field label="견종" error={errors.breed}>
            <input value={form.breed} onChange={set('breed')} maxLength={20} placeholder="예: 말티즈, 푸들, 믹스" autoComplete="off" className={inputClass} />
          </Field>
          <Field label="성견 예상 체중 (kg, 선택)" error={errors.targetWeightKg}>
            <input value={form.targetWeightKg} onChange={set('targetWeightKg')} inputMode="decimal" placeholder="모르면 비워 두세요" className={inputClass} />
          </Field>
          <p className="-mt-2 text-xs text-faint">성장 그래프의 목표선에만 쓰여요. 나중에 설정에서 언제든 바꿀 수 있어요.</p>
          <Button type="submit" className="w-full">
            시작하기
          </Button>
        </form>
      </Card>

      <p className="mt-4 text-center text-xs text-muted">🔒 기록과 사진은 서버로 보내지 않고 이 기기 안에만 저장돼요.</p>

      <RestoreBackup />
    </div>
  )
}

/** 다른 기기에서 쓰던 기록이 있으면 백업 파일로 바로 시작한다 */
function RestoreBackup() {
  const importData = usePuppyStore((s) => s.importData)
  const fileRef = useRef(null)
  const [message, setMessage] = useState(null)
  const [busy, setBusy] = useState(false)

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    setMessage(null)
    try {
      const { data, images } = parseBackup(await file.text())
      await restoreImages(images)
      // 백업 안의 프로필은 입력을 마친 상태로 본다 (sanitize.js) → 바로 홈 화면으로 넘어간다
      importData(data)
    } catch (err) {
      setMessage(err.message)
      setBusy(false)
    }
  }

  return (
    <div className="mt-6 border-t border-line pt-4 text-center">
      <p className="text-sm text-muted">다른 기기에서 쓰던 기록이 있나요?</p>
      <Button variant="outline" disabled={busy} onClick={() => fileRef.current?.click()} className="mt-2">
        백업 파일 불러오기
      </Button>
      <input ref={fileRef} type="file" accept="application/json,.json" onChange={handleFile} className="hidden" aria-label="백업 파일 선택" />
      {message && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {message}
        </p>
      )}
    </div>
  )
}
