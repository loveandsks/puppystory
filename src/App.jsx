import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import Onboarding from './components/Onboarding.jsx'
import { usePuppyStore } from './store/usePuppyStore.js'
import HomePage from './pages/HomePage.jsx'
import GrowthPage from './pages/GrowthPage.jsx'
import DietPage from './pages/DietPage.jsx'
import HealthPage from './pages/HealthPage.jsx'
import CarePage from './pages/CarePage.jsx'
import GalleryPage from './pages/GalleryPage.jsx'
import EmergencyPage from './pages/EmergencyPage.jsx'
import SettingsPage from './pages/SettingsPage.jsx'
import GuidesPage from './pages/GuidesPage.jsx'
import GuideViewerPage from './pages/GuideViewerPage.jsx'

// 커뮤니티는 서버 연결 라이브러리가 커서 처음 열 때만 불러온다. 오프라인이라 못 불러오면 안내만 보여준다
const CommunityPage = lazy(() =>
  import('./community/CommunityPage.jsx').catch(() => ({
    default: () => (
      <p role="alert" className="py-10 text-center text-sm text-muted">
        커뮤니티는 인터넷에 연결되어 있어야 볼 수 있어요.
      </p>
    ),
  })),
)

export default function App() {
  const onboarded = usePuppyStore((s) => s.profile.onboarded)
  // 처음 연 사람: 우리 아이 정보부터 받는다 (이름·생일이 있어야 D-Day·급여량 계산이 된다)
  if (!onboarded) return <Onboarding />

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="growth" element={<GrowthPage />} />
        <Route path="diet" element={<DietPage />} />
        <Route path="health" element={<HealthPage />} />
        <Route path="care" element={<CarePage />} />
        <Route path="gallery" element={<GalleryPage />} />
        <Route path="guides" element={<GuidesPage />} />
        <Route path="guides/:file" element={<GuideViewerPage />} />
        <Route
          path="community/*"
          element={
            <Suspense fallback={<p className="py-10 text-center text-sm text-muted">불러오는 중…</p>}>
              <CommunityPage />
            </Suspense>
          }
        />
        <Route path="emergency" element={<EmergencyPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
