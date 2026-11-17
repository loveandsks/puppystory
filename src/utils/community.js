// 커뮤니티 게시판의 순수 함수 (입력 검사, 시간 표시, 오류 문구). selfTest.js에서 확인한다.
// 글자 수 제한은 supabase/schema.sql의 check 제약과 같아야 한다.

export const CATEGORIES = [
  { id: 'question', label: '질문', icon: '🙋' },
  { id: 'tip', label: '꿀팁', icon: '💡' },
  { id: 'daily', label: '일상', icon: '📷' },
  { id: 'free', label: '자유', icon: '💬' },
]
export const categoryOf = (id) => CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[3]

export const LIMITS = { title: 80, body: 5000, comment: 1000, nicknameMin: 2, nicknameMax: 12, reason: 200 }
export const PAGE_SIZE = 20

const len = (s) => [...String(s ?? '').trim()].length

/** 글 검사 → { field: 메시지 } (문제 없으면 빈 객체) */
export function validatePost({ category, title, body }) {
  const errors = {}
  if (!CATEGORIES.some((c) => c.id === category)) errors.category = '말머리를 골라 주세요.'
  if (len(title) === 0) errors.title = '제목을 입력해 주세요.'
  else if (len(title) > LIMITS.title) errors.title = `제목은 ${LIMITS.title}자까지 쓸 수 있어요.`
  if (len(body) === 0) errors.body = '내용을 입력해 주세요.'
  else if (len(body) > LIMITS.body) errors.body = `내용은 ${LIMITS.body}자까지 쓸 수 있어요.`
  return errors
}

/** 답글 검사 → 오류 문구 또는 null */
export function validateComment(body) {
  if (len(body) === 0) return '답글 내용을 입력해 주세요.'
  if (len(body) > LIMITS.comment) return `답글은 ${LIMITS.comment}자까지 쓸 수 있어요.`
  return null
}

/** 닉네임 검사 → 오류 문구 또는 null. 한글·영문·숫자·밑줄만 (다른 사람 흉내를 어렵게) */
export function validateNickname(name) {
  const n = String(name ?? '').trim()
  if (len(n) < LIMITS.nicknameMin || len(n) > LIMITS.nicknameMax) return `닉네임은 ${LIMITS.nicknameMin}~${LIMITS.nicknameMax}자로 정해 주세요.`
  if (!/^[가-힣a-zA-Z0-9_]+$/.test(n)) return '닉네임은 한글·영문·숫자·밑줄(_)만 쓸 수 있어요.'
  if (/운영자|관리자|admin/i.test(n)) return '운영자로 오해할 수 있는 닉네임은 쓸 수 없어요.'
  return null
}

/** ISO 시각 → '방금 전', '5분 전', '3시간 전', '2일 전', 일주일 넘으면 'YYYY.MM.DD' */
export function relativeTime(iso, now = Date.now()) {
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return ''
  const sec = Math.max(0, Math.floor((now - t) / 1000))
  if (sec < 60) return '방금 전'
  if (sec < 3600) return `${Math.floor(sec / 60)}분 전`
  if (sec < 86400) return `${Math.floor(sec / 3600)}시간 전`
  if (sec < 7 * 86400) return `${Math.floor(sec / 86400)}일 전`
  const d = new Date(t)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

/** 서버 오류 → 사용자에게 보여줄 문구 */
export function communityErrorMessage(err) {
  const msg = String(err?.message ?? '')
  const code = String(err?.code ?? '')
  if (msg.includes('rate_limited')) return '짧은 시간에 너무 많이 올렸어요. 10분쯤 뒤에 다시 시도해 주세요.'
  if (code === '23505') return '이미 쓰는 닉네임이에요. 다른 닉네임을 골라 주세요.'
  if (code === '42501') return '권한이 없어요. 다시 로그인하거나, 이용이 제한된 계정인지 확인해 주세요.'
  if (code === '23514') return '글자 수나 형식이 맞지 않아요.'
  if (code === 'PGRST116') return '글을 찾을 수 없어요. 삭제되었거나 숨겨진 글일 수 있어요.'
  if (/fetch|network|load failed/i.test(msg) || (typeof navigator !== 'undefined' && navigator.onLine === false))
    return '인터넷 연결을 확인해 주세요.'
  return '잠시 문제가 생겼어요. 조금 뒤에 다시 시도해 주세요.'
}
