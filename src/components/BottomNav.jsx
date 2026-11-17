import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'

const TABS = [
  { to: '/', label: '홈', icon: '🏠', end: true },
  { to: '/growth', label: '성장', icon: '📈' },
  { to: '/diet', label: '식단', icon: '🍚' },
  { to: '/health', label: '건강', icon: '💉' },
  { to: '/care', label: '케어', icon: '✂️' },
  { to: '/gallery', label: '앨범', icon: '🖼️' },
  // 가이드·커뮤니티 두 화면을 묶은 탭 (화면 위의 TogetherTabs로 전환)
  { to: '/guides', label: '함께', icon: '🤝', also: ['/community'] },
]

const TYPING = 'input:not([type=checkbox]):not([type=radio]):not([type=file]):not([type=button]), textarea, select'

/** 폰에서 키보드가 올라오면(입력창 포커스) 하단 네비를 숨겨 입력창을 가리지 않게 한다 */
function useKeyboardOpen() {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const touch = window.matchMedia('(pointer: coarse)')
    const onIn = (e) => touch.matches && e.target.matches?.(TYPING) && setOpen(true)
    const onOut = () => setOpen(false)
    document.addEventListener('focusin', onIn)
    document.addEventListener('focusout', onOut)
    return () => {
      document.removeEventListener('focusin', onIn)
      document.removeEventListener('focusout', onOut)
    }
  }, [])
  return open
}

export default function BottomNav() {
  const keyboardOpen = useKeyboardOpen()
  const { pathname } = useLocation()
  const inAlso = (tab) => tab.also?.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  return (
    <nav
      aria-label="하단 메뉴"
      hidden={keyboardOpen}
      className="fixed inset-x-0 bottom-0 z-10 mx-auto max-w-md border-t border-line bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="grid h-16 grid-cols-7 px-0.5">
        {TABS.map((tab) => (
          <li key={tab.to}>
            <NavLink
              to={tab.to}
              end={tab.end}
              className={({ isActive: active }) => {
                const isActive = active || inAlso(tab)
                return `group flex h-full flex-col items-center justify-center gap-0.5 text-[11px] transition-colors ${
                  isActive ? 'font-extrabold text-cocoa' : 'text-faint'
                }`
              }}
            >
              {({ isActive: active }) => (
                <>
                  <span
                    aria-hidden
                    className={`grid h-7 w-11 place-items-center rounded-full text-lg leading-none transition ${
                      active || inAlso(tab) ? 'bg-peach/40' : 'grayscale-[40%]'
                    }`}
                  >
                    {tab.icon}
                  </span>
                  {tab.label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
