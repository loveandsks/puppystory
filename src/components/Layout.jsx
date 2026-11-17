import { Outlet, useLocation } from 'react-router-dom'
import AppHeader from './AppHeader.jsx'
import BottomNav from './BottomNav.jsx'
import ErrorBoundary from './ErrorBoundary.jsx'
import NotificationCenter from './NotificationCenter.jsx'
import SaveErrorBanner from './SaveErrorBanner.jsx'

// 모바일 폭(최대 448px) 중앙 정렬 래퍼. PC에서는 폰 화면처럼 보인다.
export default function Layout() {
  const { pathname } = useLocation()
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-cream text-ink shadow-soft">
      <AppHeader />
      <SaveErrorBanner />
      <NotificationCenter />
      {/* 하단 네비 높이(4rem) + iOS 홈 인디케이터만큼 아래 여백 확보 */}
      <main className="flex-1 px-4 pt-4 pb-[calc(5rem+env(safe-area-inset-bottom))]">
        {/* 경로가 바뀌면 key가 바뀌어 오류 상태가 초기화된다 */}
        <ErrorBoundary key={pathname}>
          <Outlet />
        </ErrorBoundary>
      </main>
      <BottomNav />
    </div>
  )
}
