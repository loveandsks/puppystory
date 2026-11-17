import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import PageTitle from '../components/PageTitle.jsx'
import TogetherTabs from '../components/TogetherTabs.jsx'
import { Banner, Disclaimer, Empty } from '../components/ui.jsx'
import { fetchGuides, formatSize } from '../utils/guides.js'

/** 가이드 목록 불러오기: { guides, error, loading } */
export function useGuides() {
  const [state, setState] = useState({ guides: [], error: null, loading: true })
  useEffect(() => {
    let alive = true
    fetchGuides()
      .then((guides) => alive && setState({ guides, error: null, loading: false }))
      .catch((err) => alive && setState({ guides: [], error: err.message, loading: false }))
    return () => {
      alive = false
    }
  }, [])
  return state
}

export default function GuidesPage() {
  const { guides, error, loading } = useGuides()
  return (
    <div className="space-y-4">
      <PageTitle sub="초보 견주를 위한 참고 자료">함께</PageTitle>
      <TogetherTabs />

      {loading ? (
        <p className="py-6 text-center text-sm text-muted">불러오는 중…</p>
      ) : error ? (
        <Banner tone="warn" icon="📡">
          {navigator.onLine ? error : '인터넷에 연결되면 가이드 목록을 불러올게요.'}
        </Banner>
      ) : guides.length === 0 ? (
        <Empty icon="📚">아직 올라온 가이드가 없어요. 곧 채워질 거예요!</Empty>
      ) : (
        <ul className="space-y-2" aria-label="가이드 목록">
          {guides.map((g) => (
            <li key={g.file}>
              <Link
                to={`/guides/${encodeURIComponent(g.file)}`}
                className="flex min-h-14 items-center gap-3 rounded-3xl bg-card p-4 shadow-soft transition active:translate-y-px"
              >
                <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-2xl bg-tint text-xl">
                  📄
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold break-keep text-cocoa">{g.title}</span>
                  <span className="text-xs text-faint">PDF{g.size ? ` · ${formatSize(g.size)}` : ''}</span>
                </span>
                <span aria-hidden className="text-faint">
                  ›
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p className="px-1 text-xs text-muted">
        가이드는 AI 도구(NotebookLM)로 정리한 참고 자료예요. 틀린 내용이 있을 수 있으니 아이 상태에 맞는지 꼭 확인해 주세요. 한 번 연 가이드는 인터넷이 없어도 다시 볼 수 있어요.
      </p>
      <Disclaimer />
    </div>
  )
}
