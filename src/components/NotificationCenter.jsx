// 알림 엔진 실행 + 토스트·놓친 일정 표시 (PRD F-2.3, F-3.2)
import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { readStoredFiredKeys, usePuppyStore } from '../store/usePuppyStore.js'
import { useUiStore } from '../store/useUiStore.js'
import { toLocalDateString } from '../utils/date.js'
import { MISSED_LOOKBACK_HOURS, dueEvents, showSystemNotification } from '../utils/notify.js'

const CHECK_MS = 30_000
// 알림이 없을 때 '마지막 확인 시각'은 이 간격으로만 저장 (30초마다 localStorage 쓰기·다른 탭 재로딩 방지)
const SAVE_CHECKED_MS = 5 * 60_000

export default function NotificationCenter() {
  const toasts = useUiStore((s) => s.toasts)
  const missed = useUiStore((s) => s.missed)
  const dismissToast = useUiStore((s) => s.dismissToast)
  const clearMissed = useUiStore((s) => s.clearMissed)
  const openedAt = useRef(Date.now())

  useEffect(() => {
    let first = true
    const check = () => {
      const state = usePuppyStore.getState()
      const now = new Date()
      // 처음 설치했을 때는 지난 일정을 '놓친 일정'으로 쏟아내지 않도록 지금부터 센다
      const since = Math.max(state.notifications.lastCheckedAt ?? now.getTime(), now.getTime() - MISSED_LOOKBACK_HOURS * 3600_000)
      // 다른 탭이 방금 보낸 알림도 '보냄'으로 친다 (탭 두 개에서 같은 알림이 두 번 뜨는 것 방지)
      const otherFired = readStoredFiredKeys()
      const events = dueEvents(state, now, { ...otherFired, ...state.notifications.firedKeys }, since)
      if (!events.length) {
        const last = state.notifications.lastCheckedAt
        if (last === null || now.getTime() - last >= SAVE_CHECKED_MS) state.markChecked([], toLocalDateString(now), now.getTime(), otherFired)
        first = false
        return
      }
      // 앱을 열기 전에 지나간 알림 → '놓친 일정', 열려 있는 동안 된 알림 → 즉시 알림
      const missedNow = events.filter((e) => first && e.at.getTime() < openedAt.current - 60_000)
      const live = events.filter((e) => !missedNow.includes(e))
      if (missedNow.length) useUiStore.getState().addMissed(missedNow)
      for (const e of live) {
        useUiStore.getState().toast(e.title, e.body)
        if (state.notifications.enabled) showSystemNotification(e.title, e.body)
      }
      state.markChecked(events.map((e) => e.key), toLocalDateString(now), now.getTime(), otherFired)
      first = false
    }
    check()
    const id = setInterval(check, CHECK_MS)
    // 화면을 떠날 때는 마지막 확인 시각을 저장해 둔다 (다음에 열 때 '놓친 일정' 범위가 정확하도록)
    const saveChecked = () => {
      const now = new Date()
      usePuppyStore.getState().markChecked([], toLocalDateString(now), now.getTime(), readStoredFiredKeys())
    }
    const onVisible = () => (document.visibilityState === 'visible' ? check() : saveChecked())
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('pagehide', saveChecked)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('pagehide', saveChecked)
    }
  }, [])

  return (
    <>
      {missed.length > 0 && (
        <div role="alert" className="mx-4 mt-3 rounded-2xl border border-warn/30 bg-warn-bg p-3 text-sm">
          <div className="mb-1 flex items-center justify-between">
            <strong className="text-warn">⏰ 놓친 일정 {missed.length}건</strong>
            <button type="button" onClick={clearMissed} className="min-h-11 px-2 text-xs text-muted">
              확인
            </button>
          </div>
          <ul className="space-y-0.5 text-ink">
            {missed.slice(-5).map((e) => (
              <li key={e.key}>
                {e.at.toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · {e.title}{' '}
                <span className="text-muted">{e.body}</span>
              </li>
            ))}
          </ul>
          {missed.some((e) => e.kind === 'feed') && (
            <Link to="/diet" onClick={clearMissed} className="mt-1 inline-block text-xs text-cocoa underline">
              급여 체크하러 가기
            </Link>
          )}
        </div>
      )}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-[calc(4.5rem+env(safe-area-inset-top))] z-40 mx-auto flex max-w-md flex-col gap-2 px-4">
        {toasts.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => dismissToast(t.id)}
            className="pointer-events-auto rounded-2xl bg-cocoa p-3 text-left text-sm text-white shadow-lg"
          >
            <strong className="block">{t.title}</strong>
            {t.body}
          </button>
        ))}
      </div>
    </>
  )
}
