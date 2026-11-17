import { Component } from 'react'
import { Link } from 'react-router-dom'

/**
 * 한 화면에서 렌더 오류가 나도 앱 전체가 하얀 화면이 되지 않게 막는다.
 * Layout에서 경로마다 key를 바꿔 끼우므로, 다른 탭으로 이동하면 자동으로 복구된다.
 * 헤더의 SOS 버튼은 바깥에 있어서 오류 중에도 응급 가이드로 갈 수 있다.
 */
export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div role="alert" className="space-y-3 rounded-3xl border-2 border-danger/40 bg-danger-bg p-5 text-center" data-testid="error-fallback">
        <p className="text-4xl" aria-hidden>
          🙀
        </p>
        <p className="font-extrabold text-danger">이 화면을 보여주다가 문제가 생겼어요.</p>
        <p className="text-sm text-ink">
          저장된 기록 일부가 예상과 다른 형식일 수 있어요. 다른 탭은 그대로 쓸 수 있고, 설정에서 백업을 내려받아 둘 수 있어요.
        </p>
        <p className="truncate text-xs text-faint">{String(this.state.error?.message ?? this.state.error)}</p>
        <div className="flex justify-center gap-2">
          <button type="button" onClick={() => window.location.reload()} className="min-h-11 rounded-2xl bg-peach px-4 text-sm font-bold text-on-peach">
            새로고침
          </button>
          <Link to="/settings" className="grid min-h-11 place-items-center rounded-2xl border-2 border-peach px-4 text-sm font-bold text-cocoa">
            설정 · 백업
          </Link>
        </div>
      </div>
    )
  }
}
