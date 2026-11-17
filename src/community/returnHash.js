// 카카오 로그인 후 돌아올 화면 기억하기.
// 로그인은 PKCE 방식이라 `https://.../puppystory/?code=...`처럼 # 없이 돌아온다.
// HashRouter는 # 뒤를 화면 주소로 쓰므로, 로그인 전 화면(#/community/...)을 저장해 두었다가 돌아오면 되살린다.
// main.jsx가 앱을 그리기 전에 restoreReturnHash()를 부른다. (이 파일은 Supabase 라이브러리를 import하지 않는다)
const KEY = 'community.returnHash'

export function saveReturnHash(hash) {
  try {
    sessionStorage.setItem(KEY, hash?.startsWith('#/community') ? hash : '#/community')
  } catch {
    /* 저장이 막혀 있으면 커뮤니티 첫 화면으로 돌아온다 */
  }
}

/** 로그인에서 돌아왔으면(?code= 또는 ?error=) 저장해 둔 커뮤니티 화면으로 주소를 바꾼다 */
export function restoreReturnHash() {
  const params = new URLSearchParams(location.search)
  if (!params.has('code') && !params.has('error')) return
  let hash = '#/community'
  try {
    hash = sessionStorage.getItem(KEY) || hash
    sessionStorage.removeItem(KEY)
  } catch {
    /* 기본값 사용 */
  }
  history.replaceState(history.state, '', `${location.pathname}${location.search}${hash}`)
}

/** 로그인 실패·취소로 돌아왔을 때의 오류 문구를 꺼내고 주소에서 지운다 */
export function takeAuthError() {
  const params = new URLSearchParams(location.search)
  if (!params.has('error')) return null
  const text = params.get('error') === 'access_denied' ? '로그인을 취소했어요.' : '로그인하지 못했어요. 잠시 후 다시 시도해 주세요.'
  history.replaceState(history.state, '', `${location.pathname}${location.hash}`)
  return text
}
