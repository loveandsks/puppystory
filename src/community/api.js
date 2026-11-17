// 커뮤니티 서버(Supabase) 연결. 커뮤니티 화면을 열 때만 불러오는 묶음에 들어간다.
import { createClient } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { PAGE_SIZE } from '../utils/community.js'
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './config.js'
import { saveReturnHash } from './returnHash.js'

let client = null
function sb() {
  client ??= createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      // PKCE: 로그인 결과가 # 대신 ?code=로 돌아와 HashRouter 주소와 부딪히지 않는다
      flowType: 'pkce',
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })
  return client
}

/** 오류가 있으면 throw, 없으면 data */
const unwrap = ({ data, error }) => {
  if (error) throw error
  return data
}

// ── 로그인 ───────────────────────────────────────────
/** 로그인 상태: undefined(확인 중) | null(로그아웃) | session */
export function useSession() {
  const [session, setSession] = useState(undefined)
  useEffect(() => {
    let alive = true
    const auth = sb().auth
    auth.getSession().then(({ data }) => alive && setSession(data.session ?? null))
    // 콜백 안에서는 다른 Supabase 호출을 하지 않는다 (라이브러리 권고: 교착 방지)
    const { data } = auth.onAuthStateChange((_event, s) => alive && setSession(s ?? null))
    return () => {
      alive = false
      data.subscription.unsubscribe()
    }
  }, [])
  return session
}

export async function signInWithKakao() {
  saveReturnHash(location.hash)
  await sb()
    .auth.signInWithOAuth({ provider: 'kakao', options: { redirectTo: `${location.origin}${location.pathname}` } })
    .then(unwrap)
}

export const signOut = () => sb().auth.signOut().then(unwrap)

// ── 내 정보 ──────────────────────────────────────────
export const fetchMyProfile = (uid) => sb().from('profiles').select('id, nickname, banned').eq('id', uid).single().then(unwrap)
export const updateNickname = (uid, nickname) => sb().from('profiles').update({ nickname: nickname.trim() }).eq('id', uid).then(unwrap)
export const amIAdmin = () => sb().rpc('am_i_admin').then(unwrap)
export const deleteMyAccount = () => sb().rpc('delete_my_account').then(unwrap)

// ── 글 ───────────────────────────────────────────────
const POST_FIELDS = 'id, author_id, category, title, body, comment_count, hidden, created_at, updated_at, author:profiles(nickname)'

/** 최신순 한 쪽(PAGE_SIZE개). page는 0부터. 다음 쪽이 있는지 알려고 하나 더 받는다 */
export async function fetchPosts({ category = null, page = 0 } = {}) {
  let q = sb()
    .from('posts')
    .select(POST_FIELDS)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)
  if (category) q = q.eq('category', category)
  const rows = unwrap(await q)
  return { posts: rows.slice(0, PAGE_SIZE), hasMore: rows.length > PAGE_SIZE }
}

export const fetchPost = (id) => sb().from('posts').select(POST_FIELDS).eq('id', id).single().then(unwrap)

export const createPost = ({ category, title, body }) =>
  sb().from('posts').insert({ category, title: title.trim(), body: body.trim() }).select('id').single().then(unwrap)

export const updatePost = (id, { category, title, body }) =>
  sb().from('posts').update({ category, title: title.trim(), body: body.trim() }).eq('id', id).then(unwrap)

export const deletePost = (id) => sb().from('posts').delete().eq('id', id).then(unwrap)

// ── 답글 ─────────────────────────────────────────────
export const fetchComments = (postId) =>
  sb()
    .from('comments')
    .select('id, post_id, author_id, body, hidden, created_at, author:profiles(nickname)')
    .eq('post_id', postId)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
    .then(unwrap)

export const createComment = (postId, body) => sb().from('comments').insert({ post_id: postId, body: body.trim() }).then(unwrap)
export const deleteComment = (id) => sb().from('comments').delete().eq('id', id).then(unwrap)

// ── 신고 ─────────────────────────────────────────────
export const reportPost = (postId, reason) => sb().from('reports').insert({ post_id: postId, reason: reason.trim() }).then(unwrap)
export const reportComment = (commentId, reason) => sb().from('reports').insert({ comment_id: commentId, reason: reason.trim() }).then(unwrap)
