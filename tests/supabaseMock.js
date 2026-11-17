// 커뮤니티 테스트용 가짜 Supabase 서버 (page.route로 https://test.supabase.co 요청을 받아 메모리 데이터로 응답)
// 실제 서버 규칙(supabase/schema.sql)의 핵심만 흉내 낸다: 작성자 = 로그인 사용자, 내 것만 수정·삭제, 중복 신고·닉네임 거절.
export const SUPABASE = 'https://test.supabase.co'
export const STORAGE_KEY_AUTH = 'sb-test-auth-token'
export const ME = '11111111-1111-4111-8111-111111111111'
export const OTHER = '22222222-2222-4222-8222-222222222222'

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
  'access-control-expose-headers': 'content-range',
}

const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url')
const EXP = 4102444800 // 2100년

/** 로그인된 세션 (supabase-js가 localStorage에 저장하는 모양) */
export function fakeSession(uid = ME) {
  const accessToken = `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ sub: uid, exp: EXP, role: 'authenticated', aud: 'authenticated' })}.sig`
  return {
    access_token: accessToken,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: EXP,
    refresh_token: 'refresh-token',
    user: { id: uid, aud: 'authenticated', role: 'authenticated', app_metadata: { provider: 'kakao' }, user_metadata: {}, created_at: '2026-11-01T00:00:00Z' },
  }
}

/** 첫 로드 전에 로그인 상태로 만들기 */
export async function seedSession(page, uid = ME) {
  await page.addInitScript(([key, session]) => localStorage.setItem(key, JSON.stringify(session)), [STORAGE_KEY_AUTH, fakeSession(uid)])
}

const uidFrom = (headers) => {
  const token = (headers.authorization ?? '').replace(/^Bearer\s+/i, '')
  try {
    return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).sub ?? null
  } catch {
    return null
  }
}

/**
 * 가짜 서버 설치. 반환값의 db로 데이터를 보고, requests로 받은 요청을 확인하고, fail로 다음 요청을 실패시킬 수 있다.
 */
export async function installSupabaseMock(page, { posts = [], comments = [], profiles = [] } = {}) {
  const db = {
    profiles: [
      { id: ME, nickname: '콩이맘', banned: false },
      { id: OTHER, nickname: '보리아빠', banned: false },
      ...profiles,
    ],
    posts: posts.map((p) => ({ comment_count: 0, hidden: false, updated_at: p.created_at, ...p })),
    comments: comments.map((c) => ({ hidden: false, ...c })),
    reports: [],
  }
  const requests = []
  const failures = [] // { method, table, error, status }
  let nextId = 100

  const withAuthor = (row) => ({ ...row, author: { nickname: db.profiles.find((p) => p.id === row.author_id)?.nickname ?? null } })
  const json = (route, status, body, extra = {}) =>
    route.fulfill({ status, headers: { ...CORS, 'content-type': 'application/json', ...extra }, body: body === undefined ? '' : JSON.stringify(body) })
  const pgError = (route, status, code, message) => json(route, status, { code, message, details: null, hint: null })

  await page.route(`${SUPABASE}/**`, async (route) => {
    const req = route.request()
    const method = req.method()
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS })
    const url = new URL(req.url())
    const headers = req.headers()
    const uid = uidFrom(headers)
    requests.push({ method, url: req.url(), body: req.postData() })

    // ── 로그인 ──
    if (url.pathname === '/auth/v1/logout') return route.fulfill({ status: 204, headers: CORS })
    if (url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'pkce') {
      return json(route, 200, fakeSession(ME))
    }

    // ── 함수 ──
    if (url.pathname === '/rest/v1/rpc/am_i_admin') return json(route, 200, false)
    if (url.pathname === '/rest/v1/rpc/delete_my_account') {
      db.posts = db.posts.filter((p) => p.author_id !== uid)
      return route.fulfill({ status: 204, headers: CORS })
    }

    const table = url.pathname.replace('/rest/v1/', '')
    const failure = failures.findIndex((f) => f.method === method && f.table === table)
    if (failure >= 0) {
      const [f] = failures.splice(failure, 1)
      return pgError(route, f.status ?? 400, f.code, f.message ?? f.code)
    }

    const single = (headers.accept ?? '').includes('vnd.pgrst.object')
    const eq = (field) => url.searchParams.get(field)?.replace(/^eq\./, '')
    const rows = db[table]
    if (!rows) return pgError(route, 404, 'PGRST205', 'no table')
    const match = (r) =>
      ['id', 'post_id', 'category', 'author_id'].every((f) => eq(f) === undefined || String(r[f]) === eq(f))
    const body = req.postData() ? JSON.parse(req.postData()) : null

    if (method === 'GET') {
      let found = rows.filter(match).filter((r) => !r.hidden || r.author_id === uid)
      if (table === 'posts') found.sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id)
      if (table === 'comments') found.sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id - b.id)
      const offset = Number(url.searchParams.get('offset') ?? 0)
      const limit = Number(url.searchParams.get('limit') ?? found.length)
      found = found.slice(offset, offset + limit).map((r) => (table === 'profiles' ? r : withAuthor(r)))
      if (single) return found[0] ? json(route, 200, found[0]) : pgError(route, 406, 'PGRST116', 'not found')
      return json(route, 200, found)
    }

    if (!uid) return pgError(route, 401, '42501', 'not logged in')

    if (method === 'POST') {
      const now = new Date().toISOString()
      if (table === 'reports') {
        const dup = db.reports.some((r) => r.reporter_id === uid && r.post_id === (body.post_id ?? null) && r.comment_id === (body.comment_id ?? null))
        if (dup) return pgError(route, 409, '23505', 'duplicate key')
        db.reports.push({ reporter_id: uid, post_id: body.post_id ?? null, comment_id: body.comment_id ?? null, reason: body.reason })
        return route.fulfill({ status: 201, headers: CORS })
      }
      const row = { id: nextId++, author_id: uid, created_at: now, hidden: false, ...body }
      if (table === 'posts') Object.assign(row, { comment_count: 0, updated_at: now })
      if (table === 'comments') {
        const post = db.posts.find((p) => p.id === body.post_id)
        if (post) post.comment_count += 1
      }
      rows.push(row)
      if (url.searchParams.has('select')) return json(route, 201, single ? { id: row.id } : [{ id: row.id }])
      return route.fulfill({ status: 201, headers: CORS })
    }

    if (method === 'PATCH') {
      const target = rows.filter(match)
      if (table === 'profiles') {
        if (target.some((r) => r.id !== uid)) return pgError(route, 403, '42501', 'forbidden')
        if (db.profiles.some((p) => p.id !== uid && p.nickname.toLowerCase() === body.nickname.toLowerCase()))
          return pgError(route, 409, '23505', 'duplicate nickname')
      } else if (target.some((r) => r.author_id !== uid)) return route.fulfill({ status: 204, headers: CORS }) // RLS: 조용히 0건
      for (const r of target) Object.assign(r, body, table === 'posts' ? { updated_at: new Date().toISOString() } : {})
      return route.fulfill({ status: 204, headers: CORS })
    }

    if (method === 'DELETE') {
      const target = rows.filter(match).filter((r) => r.author_id === uid)
      db[table] = rows.filter((r) => !target.includes(r))
      if (table === 'comments') {
        for (const c of target) {
          const post = db.posts.find((p) => p.id === c.post_id)
          if (post) post.comment_count = Math.max(0, post.comment_count - 1)
        }
      }
      return route.fulfill({ status: 204, headers: CORS })
    }

    return pgError(route, 405, 'PGRST000', 'unsupported')
  })

  return { db, requests, fail: (f) => failures.push(f) }
}
