import { Link } from 'react-router-dom'
import { useUiStore } from '../store/useUiStore.js'

const MESSAGE = {
  quota: '기기 저장 공간이 부족해서 방금 입력한 기록이 저장되지 않았어요. 새로고침하면 사라질 수 있으니 지금 백업을 내려받아 주세요.',
  blocked: '이 브라우저(사생활 보호 모드·쿠키 차단 등)에서는 기록을 저장할 수 없어요. 창을 닫으면 입력한 내용이 사라져요.',
  unknown: '기록을 저장하지 못했어요. 새로고침하기 전에 설정에서 백업을 내려받아 주세요.',
}

/** localStorage 저장 실패 경고 (usePuppyStore의 safeLocalStorage가 상태를 채운다) */
export default function SaveErrorBanner() {
  const saveError = useUiStore((s) => s.saveError)
  if (!saveError) return null
  return (
    <div role="alert" className="mx-4 mt-3 rounded-2xl border border-danger/40 bg-danger-bg p-3 text-sm text-danger" data-testid="save-error">
      <strong className="block">⚠️ 저장 실패</strong>
      {MESSAGE[saveError] ?? MESSAGE.unknown}
      {saveError !== 'blocked' && (
        <Link to="/settings" className="mt-1 block min-h-11 font-bold underline">
          설정 → 데이터 백업으로 가기
        </Link>
      )}
    </div>
  )
}
