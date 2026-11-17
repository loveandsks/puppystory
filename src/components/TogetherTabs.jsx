import { NavLink } from 'react-router-dom'

const TABS = [
  { to: '/guides', label: '📚 가이드' },
  { to: '/community', label: '💬 커뮤니티' },
]

/** 하단 '함께' 탭 안의 두 화면(가이드·커뮤니티) 전환 */
export default function TogetherTabs() {
  return (
    <nav aria-label="함께 메뉴" className="mb-4 grid grid-cols-2 gap-1 rounded-2xl bg-tint p-1">
      {TABS.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          className={({ isActive }) =>
            `grid min-h-11 place-items-center rounded-xl text-sm font-bold transition ${isActive ? 'bg-card text-cocoa shadow-soft' : 'text-muted'}`
          }
        >
          {t.label}
        </NavLink>
      ))}
    </nav>
  )
}
