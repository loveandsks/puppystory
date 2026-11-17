// 가이드 PDF 목록 (public/guides/*.pdf → 빌드 때 guides/index.json). 순수 함수는 selfTest.js에서 확인
export const GUIDE_INDEX_URL = './guides/index.json'

/** PDF 주소. vite.config.js의 guideUrl과 같은 규칙이어야 Service Worker가 따로 저장한다 */
export const guideUrl = (g) => `./guides/${encodeURIComponent(g.file)}?v=${g.v}`

/** 1234567 → '1.2MB', 2048 → '2KB' */
export function formatSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return ''
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`
}

/** index.json 항목 검사: 화면을 깨뜨릴 항목은 버린다 */
export function cleanGuideList(raw) {
  if (!Array.isArray(raw)) return []
  return raw.filter((g) => g && typeof g.file === 'string' && g.file && typeof g.title === 'string' && typeof g.v === 'string')
}

/** 가이드 목록 받기 (오프라인이면 Service Worker가 캐시에서 준다) */
export async function fetchGuides() {
  const res = await fetch(GUIDE_INDEX_URL, { cache: 'no-cache' })
  if (!res.ok) throw new Error(`가이드 목록을 불러오지 못했어요. (${res.status})`)
  return cleanGuideList(await res.json())
}
