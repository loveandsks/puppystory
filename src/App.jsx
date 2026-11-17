import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import HomePage from './pages/HomePage.jsx'
import GrowthPage from './pages/GrowthPage.jsx'
import DietPage from './pages/DietPage.jsx'
import HealthPage from './pages/HealthPage.jsx'
import CarePage from './pages/CarePage.jsx'
import GalleryPage from './pages/GalleryPage.jsx'
import EmergencyPage from './pages/EmergencyPage.jsx'
import SettingsPage from './pages/SettingsPage.jsx'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="growth" element={<GrowthPage />} />
        <Route path="diet" element={<DietPage />} />
        <Route path="health" element={<HealthPage />} />
        <Route path="care" element={<CarePage />} />
        <Route path="gallery" element={<GalleryPage />} />
        <Route path="emergency" element={<EmergencyPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
