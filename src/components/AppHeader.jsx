import { Link } from 'react-router-dom'
import { usePuppyInfo } from '../hooks/usePuppyInfo.js'
import { usePuppyStore } from '../store/usePuppyStore.js'
import { backupReminder, hasUserRecords } from '../utils/backupReminder.js'

export default function AppHeader() {
  const { today, profile, isBorn, days, monthLabel } = usePuppyInfo()
  const lastBackupDate = usePuppyStore((s) => s.backupInfo.lastBackupDate)
  const hasData = usePuppyStore(hasUserRecords)
  const backupDue = backupReminder(lastBackupDate, today, hasData).due
  const ageText = isBorn ? `생후 D+${days}일 · ${monthLabel}` : `태어나기 ${-days}일 전`

  return (
    <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-line bg-cream/90 px-3 pt-[calc(0.5rem+env(safe-area-inset-top))] pb-2 backdrop-blur">
      <Link
        to="/settings"
        aria-label={backupDue ? '설정 (백업 필요)' : '설정'}
        className="relative grid size-11 shrink-0 place-items-center rounded-full text-xl"
      >
        ⚙️
        {backupDue && (
          <span aria-hidden className="absolute top-1 right-1 size-3 rounded-full bg-sos ring-2 ring-cream" data-testid="backup-badge" />
        )}
      </Link>
      <div className="min-w-0 flex-1 text-center" data-testid="dday-header" aria-label={`${profile.name} · ${ageText}`}>
        <p className="truncate text-base leading-tight font-extrabold text-cocoa">
          <span aria-hidden>🐶 </span>
          {profile.name}
        </p>
        <p className="truncate text-xs font-bold text-muted">
          {isBorn ? (
            <>
              생후 <span className="text-peach-strong">D+{days}일</span> · {monthLabel}
            </>
          ) : (
            ageText
          )}
        </p>
      </div>
      <Link
        to="/emergency"
        aria-label="응급 가이드"
        className="grid size-12 shrink-0 place-items-center rounded-full bg-sos text-sm font-black text-white shadow-soft ring-4 ring-sos/20"
      >
        SOS
      </Link>
    </header>
  )
}
