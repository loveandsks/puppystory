import { useRef, useState } from 'react'
import PageTitle from '../components/PageTitle.jsx'
import { Banner, Button, Card, Field, inputClass } from '../components/ui.jsx'
import { cleanupOrphans } from '../db/imageDB.js'
import { useToday } from '../hooks/useToday.js'
import { usePuppyStore } from '../store/usePuppyStore.js'
import { downloadBackup, parseBackup, referencedImageIds, restoreImages } from '../utils/backup.js'
import { BACKUP_REMIND_DAYS, backupReminder, hasUserRecords } from '../utils/backupReminder.js'
import { downloadCalendar } from '../utils/calendarExport.js'
import { isValidDateString } from '../utils/date.js'
import { parsePositiveNumber } from '../utils/feeding.js'
import { notificationPermission, requestNotificationPermission } from '../utils/notify.js'
import { runSelfTests } from '../utils/selfTest.js'

export default function SettingsPage() {
  return (
    <div className="space-y-4">
      <PageTitle>⚙️ 설정</PageTitle>
      <ProfileSection />
      <ContactsSection />
      <NotificationSection />
      <ListEditor title="보험사 목록" storeKey="insurers" />
      <GearSection />
      <BackupSection />
      <SelfTestSection />
    </div>
  )
}

function ProfileSection() {
  const today = useToday()
  const profile = usePuppyStore((s) => s.profile)
  const updateProfile = usePuppyStore((s) => s.updateProfile)
  // 이름은 입력 중엔 화면 상태로 두고, 비어 있지 않을 때만 저장 (빈 이름이 헤더·태그에 나가지 않게)
  const [name, setName] = useState(profile.name)

  const numberField = (key, { min, max }) => ({
    inputMode: 'decimal',
    defaultValue: profile[key],
    onBlur: (e) => {
      const v = parsePositiveNumber(e.target.value)
      if (v !== null && v >= min && v <= max) updateProfile({ [key]: v })
      else e.target.value = profile[key]
    },
    className: inputClass,
  })

  return (
    <Card title="프로필" icon="🐶">
      <div className="space-y-3">
        <Field label="이름">
          <input
            value={name}
            maxLength={20}
            onChange={(e) => {
              setName(e.target.value)
              if (e.target.value.trim()) updateProfile({ name: e.target.value.trim() })
            }}
            onBlur={() => setName(profile.name)}
            className={inputClass}
          />
        </Field>
        <Field label="생년월일">
          <input
            type="date"
            value={profile.birthDate}
            max={today}
            // 지우는 중이거나 미래 날짜면 저장하지 않는다 (D-Day가 음수가 되는 것 방지)
            onChange={(e) => isValidDateString(e.target.value) && e.target.value <= today && updateProfile({ birthDate: e.target.value })}
            className={inputClass}
          />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="성견 목표 체중 (kg)">
            <input aria-label="성견 목표 체중" {...numberField('targetWeightKg', { min: 1, max: 30 })} />
          </Field>
          <Field label="체중 급증 경고 (%/주)">
            <input aria-label="체중 급증 경고" {...numberField('weightAlertPct', { min: 1, max: 100 })} />
          </Field>
        </div>
        <p className="text-xs text-faint">
          3~4개월 퍼피는 원래 빨리 커서 주당 10%를 넘기도 해요. 경고가 너무 자주 뜨면 기준을 올려 주세요.
        </p>
      </div>
    </Card>
  )
}

function ContactsSection() {
  const contacts = usePuppyStore((s) => s.contacts)
  const updateContact = usePuppyStore((s) => s.updateContact)
  const label = { regular: '단골 병원', emergency24: '24시 응급 병원' }
  return (
    <Card title="병원 연락처" icon="📞">
      <div className="space-y-4">
        {contacts.map((c) => (
          <fieldset key={c.id} className="space-y-2">
            <legend className="text-sm font-bold">{label[c.type]}</legend>
            <input aria-label={`${label[c.type]} 이름`} placeholder="병원 이름" defaultValue={c.name} onBlur={(e) => updateContact(c.id, { name: e.target.value.trim() })} className={inputClass} />
            <input
              aria-label={`${label[c.type]} 전화번호`}
              type="tel"
              placeholder="전화번호"
              defaultValue={c.phone}
              onBlur={(e) => updateContact(c.id, { phone: e.target.value.trim() })}
              className={inputClass}
            />
            <input aria-label={`${label[c.type]} 주소`} placeholder="주소" defaultValue={c.address} onBlur={(e) => updateContact(c.id, { address: e.target.value.trim() })} className={inputClass} />
          </fieldset>
        ))}
      </div>
    </Card>
  )
}

function NotificationSection() {
  const enabled = usePuppyStore((s) => s.notifications.enabled)
  const setEnabled = usePuppyStore((s) => s.setNotificationsEnabled)
  const [permission, setPermission] = useState(notificationPermission())
  const permissionText = {
    granted: '허용됨',
    denied: '차단됨 — 브라우저 설정에서 이 사이트의 알림을 허용해 주세요.',
    default: '아직 묻지 않음',
    unsupported: '이 브라우저는 알림을 지원하지 않아요. 앱 안 알림과 캘린더 내보내기를 써 주세요.',
  }

  const on = enabled && permission === 'granted'
  const toggle = async () => {
    if (on) return setEnabled(false)
    // 권한을 받은 경우에만 켠다. 거부·미지원이면 꺼진 채로 두고 안내 문구만 바뀐다 (앱 안 알림은 항상 동작)
    const p = permission === 'granted' ? 'granted' : await requestNotificationPermission()
    setPermission(p)
    setEnabled(p === 'granted')
  }

  return (
    <Card title="알림" icon="🔔">
      <label className="flex min-h-11 items-center gap-3">
        <input type="checkbox" checked={on} onChange={toggle} className="size-5 accent-[var(--c-peach-strong)]" />
        브라우저 알림 받기 (급여 시각, 접종 3일 전·당일, 관리 주기)
      </label>
      <p className="text-xs text-muted">권한: {permissionText[permission]}</p>
      <p className="mt-2 text-xs text-warn">
        서버가 없는 앱이라 이 탭이 열려 있을 때만 알림이 울려요. 닫혀 있어도 받으려면 일정을 폰 캘린더로 내보내 주세요.
      </p>
      <Button variant="outline" className="mt-2 w-full" onClick={downloadCalendar}>
        📅 급여·접종 일정 캘린더(.ics)로 내보내기
      </Button>
    </Card>
  )
}

/** 문자열 목록 편집 (보험사, 매트, 하네스) */
function ListEditor({ title, storeKey, gearKey }) {
  const list = usePuppyStore((s) => (gearKey ? s.gear[gearKey] : s[storeKey]))
  const setInsurers = usePuppyStore((s) => s.setInsurers)
  const setGear = usePuppyStore((s) => s.setGear)
  const [value, setValue] = useState('')
  const save = (next) => (gearKey ? setGear({ [gearKey]: next }) : setInsurers(next))

  return (
    <Card title={title}>
      <ul className="mb-2 text-sm">
        {list.map((item) => (
          <li key={item} className="flex items-center justify-between">
            {item}
            <Button variant="ghost" onClick={() => save(list.filter((x) => x !== item))} aria-label={`${item} 삭제`}>
              삭제
            </Button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <input aria-label={`${title} 추가`} value={value} onChange={(e) => setValue(e.target.value)} className={inputClass} />
        <Button
          variant="outline"
          onClick={() => {
            const v = value.trim()
            if (v && !list.includes(v)) save([...list, v])
            setValue('')
          }}
        >
          추가
        </Button>
      </div>
    </Card>
  )
}

function GearSection() {
  return (
    <>
      <ListEditor title="매트 종류" gearKey="mats" />
      <ListEditor title="하네스 종류" gearKey="harnesses" />
    </>
  )
}

function BackupSection() {
  const today = useToday()
  const importData = usePuppyStore((s) => s.importData)
  const lastBackupDate = usePuppyStore((s) => s.backupInfo.lastBackupDate)
  const hasData = usePuppyStore(hasUserRecords)
  const reminder = backupReminder(lastBackupDate, today, hasData)
  const fileRef = useRef(null)
  const [message, setMessage] = useState(null)
  const [busy, setBusy] = useState(false)

  const run = async (fn) => {
    setBusy(true)
    setMessage(null)
    try {
      await fn()
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setBusy(false)
    }
  }

  const handleImport = (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // 같은 파일을 다시 골라도 change 이벤트가 나도록
    if (!file) return
    run(async () => {
      const { data, images, dropped } = parseBackup(await file.text())
      const ok = window.confirm(
        `'${data.profile.name ?? '이름 없음'}' 백업으로 지금 데이터를 덮어써요.\n지금 데이터는 먼저 백업 파일로 저장해 둘게요. 계속할까요?`,
      )
      if (!ok) return
      await downloadBackup({ withImages: true }) // 덮어쓰기 전 현재 데이터 자동 백업 (PRD 8)
      const restored = await restoreImages(images)
      importData(data)
      setMessage({
        type: 'ok',
        text: `백업을 불러왔어요.${restored ? ` (사진 ${restored}장)` : ''}${dropped ? ` 형식이 맞지 않는 기록 ${dropped}건은 건너뛰었어요.` : ''}`,
      })
    })
  }

  const cleanup = () =>
    run(async () => {
      const n = await cleanupOrphans(referencedImageIds(usePuppyStore.getState()))
      setMessage({ type: 'ok', text: n ? `쓰지 않는 사진 ${n}장을 정리했어요.` : '정리할 사진이 없어요.' })
    })

  return (
    <Card title="데이터 백업" icon="💾">
      {reminder.due ? (
        <Banner tone="warn" icon="⏰" className="mb-3" data-testid="backup-reminder">
          {reminder.daysSince === null
            ? '아직 한 번도 백업하지 않았어요. 기록을 지키려면 지금 내보내 두세요.'
            : `마지막 백업 후 ${reminder.daysSince}일이 지났어요. (${BACKUP_REMIND_DAYS}일마다 권장)`}
        </Banner>
      ) : (
        <p className="mb-2 text-sm text-muted" data-testid="backup-status">
          마지막 백업: {lastBackupDate ? `${lastBackupDate} (${reminder.daysSince}일 전)` : '없음'}
        </p>
      )}
      <p className="mb-3 text-xs text-muted">
        브라우저의 &lsquo;사이트 데이터 삭제&rsquo;를 하면 기록이 지워질 수 있어요. 정기적으로 백업해 주세요.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Button disabled={busy} onClick={() => run(() => downloadBackup({ withImages: false }))}>
          기록만 내보내기
        </Button>
        <Button disabled={busy} onClick={() => run(() => downloadBackup({ withImages: true }))}>
          사진 포함 내보내기
        </Button>
        <Button variant="outline" disabled={busy} onClick={() => fileRef.current?.click()} className="col-span-2">
          가져오기
        </Button>
      </div>
      <input ref={fileRef} type="file" accept="application/json,.json" onChange={handleImport} className="hidden" aria-label="백업 파일 선택" />
      <button type="button" onClick={cleanup} className="mt-2 min-h-11 text-xs text-faint underline">
        쓰지 않는 사진 정리
      </button>
      {message && (
        <p role="status" className={`text-sm ${message.type === 'ok' ? 'text-ok' : 'text-danger'}`}>
          {message.text}
        </p>
      )}
    </Card>
  )
}

function SelfTestSection() {
  const [results, setResults] = useState(null)
  const failed = results?.filter((r) => !r.pass) ?? []
  return (
    <Card title="자가 진단" icon="🧪">
      <p className="mb-2 text-xs text-muted">계산 로직이 PRD 예시값(D+116, 하루 107g 등)과 맞는지 확인해요.</p>
      <Button variant="outline" className="w-full" onClick={() => setResults(runSelfTests())}>
        자가 진단 실행
      </Button>
      {results && (
        <div className="mt-3 text-sm" data-testid="selftest-result">
          <p className={failed.length ? 'font-bold text-danger' : 'font-bold text-ok'}>
            {results.length - failed.length} / {results.length} 통과
          </p>
          <ul className="mt-1 max-h-60 space-y-0.5 overflow-y-auto text-xs">
            {results.map((r) => (
              <li key={r.name} className={r.pass ? 'text-muted' : 'text-danger'}>
                {r.pass ? '✅' : '❌'} {r.name}
                {!r.pass && ` (기대 ${JSON.stringify(r.expected)}, 결과 ${JSON.stringify(r.actual)})`}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}
