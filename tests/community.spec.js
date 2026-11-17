// '함께' 탭의 커뮤니티: 글·답글·신고·닉네임·카카오 로그인 (가짜 Supabase 서버로 확인)
// 실제 Supabase 주소가 없는 개발 서버 대신, 가짜 주소를 넣고 빌드한 preview(4173)에서 돌린다 (playwright.config.js)
import { TODAY, expect, test } from './helpers.js'
import { ME, OTHER, SUPABASE, installSupabaseMock, seedSession } from './supabaseMock.js'

const PREVIEW = 'http://localhost:4173/'
test.use({ baseURL: PREVIEW, serviceWorkers: 'block' })

const POSTS = [
  { id: 1, author_id: OTHER, category: 'question', title: '배변 훈련 언제부터 하나요?', body: '4개월 말티즈예요.\n패드를 자꾸 물어요.', created_at: '2026-11-16T00:55:00Z', comment_count: 1 },
  { id: 2, author_id: ME, category: 'tip', title: '발톱 깎기 꿀팁', body: '간식을 준비하세요.', created_at: '2026-11-15T01:00:00Z' },
]
const COMMENTS = [{ id: 10, post_id: 1, author_id: ME, body: '저희는 3개월부터 했어요!', created_at: '2026-11-16T00:58:00Z' }]

async function open(page, path = 'community') {
  await page.clock.setFixedTime(new Date(TODAY))
  await page.goto(`./#/${path}`)
}

test('로그인 없이 글 목록·말머리·글·답글을 볼 수 있고, 쓰기는 로그인 안내', async ({ page }) => {
  const mock = await installSupabaseMock(page, { posts: POSTS, comments: COMMENTS })
  await open(page)
  const list = page.getByRole('list', { name: '글 목록' })
  await expect(list.getByRole('link')).toHaveCount(2)
  await expect(list.getByRole('link').first()).toContainText('배변 훈련 언제부터 하나요?')
  await expect(list.getByRole('link').first()).toContainText('보리아빠')
  await expect(list.getByRole('link').first()).toContainText('5분 전')
  await expect(page.getByRole('button', { name: '✏️ 글쓰기' })).toHaveCount(0)
  await expect(page.getByText('참고용이며 수의사 진단을 대신하지 않습니다')).toBeVisible()

  await page.getByRole('group', { name: '말머리' }).getByRole('button', { name: '꿀팁' }).click()
  await expect(list.getByRole('link')).toHaveCount(1)
  expect(mock.requests.some((r) => r.url.includes('category=eq.tip'))).toBe(true)

  await page.getByRole('group', { name: '말머리' }).getByRole('button', { name: '전체' }).click()
  await list.getByRole('link', { name: /배변 훈련/ }).click()
  await expect(page.getByRole('heading', { name: '배변 훈련 언제부터 하나요?' })).toBeVisible()
  await expect(page.getByTestId('post-body')).toHaveText('4개월 말티즈예요.\n패드를 자꾸 물어요.')
  await expect(page.getByRole('region', { name: '답글' })).toContainText('저희는 3개월부터 했어요!')
  await expect(page.getByText('답글을 쓰려면 로그인해 주세요.')).toBeVisible()
  await expect(page.getByRole('button', { name: '🚩 신고' })).toHaveCount(0)
})

test('카카오 로그인: 동의 → 카카오(Supabase)로 이동 → 돌아오면 보던 글로 복귀하고 로그인 상태', async ({ page }) => {
  await installSupabaseMock(page, { posts: POSTS, comments: COMMENTS })
  let authorizeUrl = null
  // 카카오 로그인 화면 대신: 바로 앱으로 ?code=를 붙여 돌려보낸다
  await page.route(`${SUPABASE}/auth/v1/authorize**`, (route) => {
    authorizeUrl = new URL(route.request().url())
    return route.fulfill({ status: 302, headers: { location: `${PREVIEW}?code=test-code` } })
  })
  await open(page, 'community/post/1')
  await page.getByRole('button', { name: '카카오 로그인' }).click()
  const dialog = page.getByRole('dialog', { name: '카카오로 로그인' })
  await expect(dialog).toContainText('앱의 성장 기록과 사진은 서버로 보내지 않아요')
  await dialog.getByRole('button', { name: '동의하고 로그인' }).click()

  await expect(page.getByRole('heading', { name: '배변 훈련 언제부터 하나요?' })).toBeVisible()
  expect(authorizeUrl.searchParams.get('provider')).toBe('kakao')
  expect(authorizeUrl.searchParams.get('redirect_to')).toBe(PREVIEW)
  expect(authorizeUrl.searchParams.get('code_challenge')).toBeTruthy() // PKCE
  await expect(page.getByRole('form', { name: '답글 쓰기' })).toBeVisible()
  // ?code=는 주소에서 지워지고 화면 주소(#)는 그대로
  await expect.poll(() => new URL(page.url()).search).toBe('')
  expect(new URL(page.url()).hash).toBe('#/community/post/1')
})

test('로그인을 취소하고 돌아오면 안내', async ({ page }) => {
  await installSupabaseMock(page, { posts: POSTS })
  await page.clock.setFixedTime(new Date(TODAY))
  await page.addInitScript(() => sessionStorage.setItem('community.returnHash', '#/community'))
  await page.goto(`${PREVIEW}?error=access_denied&error_description=user+denied`)
  await expect(page.getByText('로그인을 취소했어요.')).toBeVisible()
  expect(new URL(page.url()).search).toBe('')
})

test('로그인하면 글쓰기·답글·수정·삭제·신고', async ({ page, consoleErrors }) => {
  const mock = await installSupabaseMock(page, { posts: POSTS, comments: COMMENTS })
  await seedSession(page)
  await open(page)
  await expect(page.getByTestId('my-nickname')).toHaveText('콩이맘')

  // 글쓰기: 빈칸 검사 → 올리기 → 올린 글 화면
  await page.getByRole('button', { name: '✏️ 글쓰기' }).click()
  const form = page.getByRole('form', { name: '글쓰기' })
  await form.getByRole('button', { name: '올리기' }).click()
  await expect(form.getByText('제목을 입력해 주세요.')).toBeVisible()
  await form.getByRole('button', { name: /일상/ }).click()
  await form.getByLabel('제목').fill('첫 산책 다녀왔어요')
  await form.getByLabel('내용').fill('2차 접종 끝나고 첫 산책!')
  await form.getByRole('button', { name: '올리기' }).click()
  await expect(page.getByRole('heading', { name: '첫 산책 다녀왔어요' })).toBeVisible()
  const created = mock.db.posts.find((p) => p.title === '첫 산책 다녀왔어요')
  expect(created).toMatchObject({ category: 'daily', author_id: ME })
  // 작성자는 서버가 정한다: 앱이 author_id를 보내지 않음
  expect(JSON.parse(mock.requests.find((r) => r.method === 'POST' && r.url.includes('/posts')).body)).not.toHaveProperty('author_id')

  // 수정
  await page.getByRole('button', { name: '수정' }).click()
  await page.getByRole('form', { name: '글 고치기' }).getByLabel('제목').fill('첫 산책 다녀왔어요 🐾')
  await page.getByRole('button', { name: '고치기' }).click()
  await expect(page.getByRole('heading', { name: '첫 산책 다녀왔어요 🐾' })).toBeVisible()

  // 답글 달기 → 지우기
  await page.getByLabel('답글 내용').fill('축하해요!')
  await page.getByRole('button', { name: '답글 등록' }).click()
  await expect(page.getByRole('region', { name: '답글' })).toContainText('축하해요!')
  await expect(page.getByRole('heading', { name: '답글 1' })).toBeVisible()
  page.once('dialog', (d) => d.accept())
  await page.getByRole('region', { name: '답글' }).getByRole('button', { name: '삭제' }).click()
  await expect(page.getByRole('heading', { name: '답글 0' })).toBeVisible()

  // 내 글 삭제 → 목록으로
  page.once('dialog', (d) => d.accept())
  await page.getByRole('article', { name: '글' }).getByRole('button', { name: '삭제' }).click()
  await expect(page.getByRole('list', { name: '글 목록' })).toBeVisible()
  expect(mock.db.posts.some((p) => p.id === created.id)).toBe(false)

  // 남의 글: 수정·삭제 없음, 신고 가능, 두 번은 안 됨
  await page.getByRole('link', { name: /배변 훈련/ }).click()
  const article = page.getByRole('article', { name: '글' })
  await expect(article.getByRole('button', { name: '수정' })).toHaveCount(0)
  await expect(article.getByRole('button', { name: '삭제' })).toHaveCount(0)
  await article.getByRole('button', { name: '🚩 신고' }).click()
  let dialog = page.getByRole('dialog', { name: '신고하기' })
  await dialog.getByLabel(/신고 이유/).fill('광고')
  await dialog.getByRole('button', { name: '신고' }).click()
  await expect(dialog.getByRole('status')).toContainText('신고했어요')
  await dialog.getByRole('button', { name: '닫기' }).click()
  await article.getByRole('button', { name: '🚩 신고' }).click()
  dialog = page.getByRole('dialog', { name: '신고하기' })
  await dialog.getByRole('button', { name: '신고' }).click()
  await expect(dialog.getByRole('alert')).toHaveText('이미 신고한 글이에요.')
  expect(mock.db.reports).toHaveLength(1)
  // 중복 신고 거절(409)은 브라우저가 콘솔에 남긴다
  expect(consoleErrors).toEqual([expect.stringContaining('status of 409')])
  consoleErrors.length = 0
})

test('도배 제한에 걸리면 이유를 알려줌', async ({ page, consoleErrors }) => {
  const mock = await installSupabaseMock(page, { posts: POSTS })
  await seedSession(page)
  mock.fail({ method: 'POST', table: 'posts', code: 'P0001', message: 'rate_limited' })
  await open(page, 'community/write')
  const form = page.getByRole('form', { name: '글쓰기' })
  await form.getByLabel('제목').fill('질문 있어요')
  await form.getByLabel('내용').fill('내용')
  await form.getByRole('button', { name: '올리기' }).click()
  await expect(form.getByRole('alert')).toContainText('짧은 시간에 너무 많이 올렸어요')
  // 일부러 낸 400 응답은 브라우저가 콘솔에 남긴다
  expect(consoleErrors.every((e) => e.includes('status of 400'))).toBe(true)
  consoleErrors.length = 0
})

test('닉네임 바꾸기: 형식 검사, 중복 거절, 저장', async ({ page, consoleErrors }) => {
  const mock = await installSupabaseMock(page)
  await seedSession(page)
  await open(page, 'community/me')
  const form = page.getByRole('form', { name: '닉네임 바꾸기' })
  const input = form.getByLabel(/닉네임/)
  await expect(input).toHaveValue('콩이맘')

  await input.fill('관리자콩')
  await form.getByRole('button', { name: '저장' }).click()
  await expect(form.getByRole('alert')).toContainText('운영자로 오해할 수 있는')

  await input.fill('보리아빠')
  await form.getByRole('button', { name: '저장' }).click()
  await expect(form.getByRole('alert')).toContainText('이미 쓰는 닉네임')
  expect(consoleErrors.every((e) => e.includes('status of 409'))).toBe(true)
  consoleErrors.length = 0

  await input.fill('콩이네')
  await form.getByRole('button', { name: '저장' }).click()
  await expect(form.getByRole('status')).toHaveText('닉네임을 바꿨어요.')
  expect(mock.db.profiles.find((p) => p.id === ME).nickname).toBe('콩이네')

  await page.getByRole('button', { name: '로그아웃' }).click()
  await expect(page.getByRole('button', { name: '카카오 로그인' })).toBeVisible()
})

test('개인정보 처리방침·이용 수칙 화면', async ({ page }) => {
  await installSupabaseMock(page)
  await open(page, 'community/privacy')
  await expect(page.getByRole('heading', { name: '개인정보 처리방침' })).toBeVisible()
  await expect(page.getByText('앱에 기록하는 성장·식단·건강·케어 기록과 사진은 서버로 보내지 않고')).toBeVisible()
  await expect(page.getByRole('heading', { name: '커뮤니티 이용 수칙' })).toBeVisible()
})
