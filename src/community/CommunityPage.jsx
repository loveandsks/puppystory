// 커뮤니티 게시판: 글·답글 (텍스트만). 읽기는 누구나, 쓰기는 카카오 로그인.
// 서버 규칙은 supabase/schema.sql, 설정 방법은 COMMUNITY.md.
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { Link, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import PageTitle from '../components/PageTitle.jsx'
import TogetherTabs from '../components/TogetherTabs.jsx'
import { Banner, Button, Chip, Disclaimer, Empty, Field, Modal, inputClass } from '../components/ui.jsx'
import {
  CATEGORIES,
  LIMITS,
  categoryOf,
  communityErrorMessage,
  relativeTime,
  validateComment,
  validateNickname,
  validatePost,
} from '../utils/community.js'
import * as api from './api.js'
import { OPERATOR_CONTACT, isCommunityConfigured } from './config.js'
import { takeAuthError } from './returnHash.js'

export default function CommunityPage() {
  if (!isCommunityConfigured) {
    return (
      <Shell>
        <Banner tone="info" icon="🛠️" data-testid="community-not-ready">
          커뮤니티를 준비하고 있어요. 조금만 기다려 주세요!
        </Banner>
      </Shell>
    )
  }
  return (
    <AuthProvider>
      <Routes>
        <Route index element={<PostList />} />
        <Route path="post/:id" element={<PostDetail />} />
        <Route path="write" element={<PostForm />} />
        <Route path="edit/:id" element={<PostForm />} />
        <Route path="me" element={<MyInfo />} />
        <Route path="privacy" element={<Privacy />} />
        <Route path="*" element={<PostList />} />
      </Routes>
    </AuthProvider>
  )
}

function Shell({ children, tabs = true }) {
  return (
    <div className="space-y-4">
      {tabs && (
        <>
          <PageTitle sub="견주들과 묻고 나누는 공간">함께</PageTitle>
          <TogetherTabs />
        </>
      )}
      {children}
    </div>
  )
}

const BackLink = ({ to = '/community', children = '‹ 목록' }) => (
  <Link to={to} className="inline-flex min-h-11 items-center text-sm font-bold text-muted">
    {children}
  </Link>
)

// ── 로그인 상태 공유 ─────────────────────────────────────
const AuthContext = createContext(null)
const useAuth = () => useContext(AuthContext)

function AuthProvider({ children }) {
  const session = api.useSession()
  const uid = session?.user?.id ?? null
  const [profile, setProfile] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [authError, setAuthError] = useState(() => takeAuthError())

  const reloadProfile = useCallback(() => {
    if (!uid) return Promise.resolve()
    return api
      .fetchMyProfile(uid)
      .then(setProfile)
      .catch(() => setProfile(null))
  }, [uid])

  useEffect(() => {
    setProfile(null)
    setIsAdmin(false)
    if (!uid) return
    reloadProfile()
    api.amIAdmin().then(setIsAdmin, () => setIsAdmin(false))
  }, [uid, reloadProfile])

  const value = { session, uid, profile, isAdmin, reloadProfile, authError, clearAuthError: () => setAuthError(null) }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/** 로그인 버튼 (개인정보 안내에 동의해야 진행) */
function LoginButton({ label = '카카오로 로그인', className = '' }) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const go = async () => {
    setBusy(true)
    setError(null)
    try {
      await api.signInWithKakao() // 카카오 화면으로 이동한다
    } catch (err) {
      setError(communityErrorMessage(err))
      setBusy(false)
    }
  }
  return (
    <>
      <Button onClick={() => setOpen(true)} className={className}>
        {label}
      </Button>
      {open && (
        <Modal title="카카오로 로그인" onClose={() => setOpen(false)}>
          <div className="space-y-3 text-sm">
            <p>글과 답글을 쓰려면 로그인이 필요해요. 읽기는 로그인 없이도 할 수 있어요.</p>
            <ul className="list-disc space-y-1 pl-5 text-muted">
              <li>카카오에서 받는 정보: 회원번호, 닉네임, 프로필 사진, 이메일(동의한 경우)</li>
              <li>커뮤니티에는 카카오 이름 대신 직접 정한 닉네임만 보여요.</li>
              <li>앱의 성장 기록과 사진은 서버로 보내지 않아요.</li>
              <li>탈퇴하면 계정과 내가 쓴 글·답글이 모두 지워져요.</li>
            </ul>
            <Link to="/community/privacy" onClick={() => setOpen(false)} className="inline-block min-h-11 text-xs text-faint underline">
              개인정보 처리방침·이용 수칙 전체 보기
            </Link>
            {error && (
              <p role="alert" className="text-danger">
                {error}
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)}>
                취소
              </Button>
              <Button onClick={go} disabled={busy}>
                동의하고 로그인
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}

/** 화면 위쪽: 로그인 상태 */
function AccountBar() {
  const { session, profile, authError, clearAuthError } = useAuth()
  return (
    <div className="space-y-2">
      {authError && (
        <Banner tone="warn" icon="🔑">
          {authError}{' '}
          <button type="button" onClick={clearAuthError} className="underline">
            닫기
          </button>
        </Banner>
      )}
      {session === undefined ? null : session ? (
        <div className="flex min-h-11 items-center justify-between gap-2 rounded-2xl bg-card px-3 py-1 shadow-soft">
          <span className="min-w-0 truncate text-sm">
            <span aria-hidden>🐾 </span>
            <b data-testid="my-nickname">{profile?.nickname ?? '…'}</b> 님
          </span>
          <Link to="/community/me" className="inline-flex min-h-11 shrink-0 items-center text-sm text-muted underline">
            내 정보
          </Link>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2 rounded-2xl bg-card p-3 shadow-soft">
          <span className="text-sm text-muted">글을 쓰려면 로그인해 주세요.</span>
          <LoginButton label="카카오 로그인" className="shrink-0" />
        </div>
      )}
    </div>
  )
}

function OfflineNotice() {
  return navigator.onLine ? null : (
    <Banner tone="warn" icon="📡">
      커뮤니티는 인터넷에 연결되어 있어야 볼 수 있어요.
    </Banner>
  )
}

const CategoryBadge = ({ id }) => {
  const c = categoryOf(id)
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-tint px-2 py-0.5 text-xs font-bold text-cocoa">
      <span aria-hidden>{c.icon}</span>
      {c.label}
    </span>
  )
}

const Nickname = ({ author }) => <span className="font-bold">{author?.nickname ?? '알 수 없음'}</span>

// ── 목록 ─────────────────────────────────────────────────
function PostList() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [category, setCategory] = useState(null)
  const [state, setState] = useState({ posts: [], page: 0, hasMore: false, loading: true, error: null })

  const load = useCallback(
    (page) => {
      setState((s) => ({ ...s, loading: true, error: null }))
      api
        .fetchPosts({ category, page })
        .then(({ posts, hasMore }) =>
          setState((s) => ({ posts: page === 0 ? posts : [...s.posts, ...posts], page, hasMore, loading: false, error: null })),
        )
        .catch((err) => setState((s) => ({ ...s, loading: false, error: communityErrorMessage(err) })))
    },
    [category],
  )

  useEffect(() => {
    setState({ posts: [], page: 0, hasMore: false, loading: true, error: null })
    load(0)
  }, [load])

  return (
    <Shell>
      <OfflineNotice />
      <AccountBar />

      <div className="flex items-center gap-2">
        <div role="group" aria-label="말머리" className="-mx-1 flex min-w-0 flex-1 gap-1.5 overflow-x-auto px-1 pb-1">
          <Chip active={category === null} onClick={() => setCategory(null)} className="shrink-0">
            전체
          </Chip>
          {CATEGORIES.map((c) => (
            <Chip key={c.id} active={category === c.id} onClick={() => setCategory(c.id)} className="shrink-0">
              {c.label}
            </Chip>
          ))}
        </div>
      </div>

      {session && (
        <Button onClick={() => navigate('/community/write')} className="w-full">
          ✏️ 글쓰기
        </Button>
      )}

      {state.error ? (
        <Banner tone="warn" icon="⚠️">
          {state.error}{' '}
          <button type="button" onClick={() => load(0)} className="underline">
            다시 시도
          </button>
        </Banner>
      ) : !state.loading && state.posts.length === 0 ? (
        <Empty icon="💬">아직 글이 없어요. 첫 글을 남겨 주세요!</Empty>
      ) : (
        <ul className="space-y-2" aria-label="글 목록">
          {state.posts.map((p) => (
            <li key={p.id}>
              <Link to={`/community/post/${p.id}`} className="block rounded-3xl bg-card p-4 shadow-soft transition active:translate-y-px">
                <div className="mb-1 flex items-center gap-1.5">
                  <CategoryBadge id={p.category} />
                  {p.hidden && <span className="text-xs font-bold text-danger">숨김 처리됨</span>}
                </div>
                <p className="line-clamp-2 font-bold break-keep text-cocoa">{p.title}</p>
                <p className="mt-0.5 line-clamp-1 text-sm text-muted">{p.body}</p>
                <p className="mt-2 flex flex-wrap items-center gap-x-2 text-xs text-faint">
                  <Nickname author={p.author} />
                  <span>{relativeTime(p.created_at)}</span>
                  <span aria-label={`답글 ${p.comment_count}개`}>💬 {p.comment_count}</span>
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {state.loading && <p className="py-4 text-center text-sm text-muted">불러오는 중…</p>}
      {!state.loading && state.hasMore && !state.error && (
        <Button variant="outline" onClick={() => load(state.page + 1)} className="w-full">
          더 보기
        </Button>
      )}

      <CommunityFooter />
    </Shell>
  )
}

function CommunityFooter() {
  return (
    <div className="space-y-1 px-1 text-xs text-muted">
      <p>커뮤니티 글은 다른 견주의 경험담이에요. 아이 건강이 걱정되면 동물병원에 먼저 물어보세요.</p>
      <Disclaimer />
      <p className="text-center">
        <Link to="/community/privacy" className="inline-block min-h-11 py-3 underline">
          개인정보 처리방침·이용 수칙
        </Link>
      </p>
    </div>
  )
}

// ── 글 보기 ──────────────────────────────────────────────
function PostDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { uid, session, isAdmin } = useAuth()
  const [post, setPost] = useState(null)
  const [comments, setComments] = useState([])
  const [error, setError] = useState(null)
  const [reporting, setReporting] = useState(null) // { type: 'post'|'comment', id }

  const loadComments = useCallback(() => api.fetchComments(id).then(setComments), [id])

  useEffect(() => {
    setError(null)
    Promise.all([api.fetchPost(id), api.fetchComments(id)])
      .then(([p, c]) => {
        setPost(p)
        setComments(c)
      })
      .catch((err) => setError(communityErrorMessage(err)))
  }, [id])

  const removePost = async () => {
    if (!window.confirm('이 글을 지울까요? 답글도 함께 지워져요.')) return
    try {
      await api.deletePost(post.id)
      navigate('/community', { replace: true })
    } catch (err) {
      window.alert(communityErrorMessage(err))
    }
  }

  const removeComment = async (commentId) => {
    if (!window.confirm('이 답글을 지울까요?')) return
    try {
      await api.deleteComment(commentId)
      await loadComments()
      setPost((p) => ({ ...p, comment_count: Math.max(0, p.comment_count - 1) }))
    } catch (err) {
      window.alert(communityErrorMessage(err))
    }
  }

  if (error)
    return (
      <Shell tabs={false}>
        <BackLink />
        <Banner tone="warn" icon="⚠️">
          {error}
        </Banner>
      </Shell>
    )
  if (!post)
    return (
      <Shell tabs={false}>
        <BackLink />
        <p className="py-10 text-center text-sm text-muted">불러오는 중…</p>
      </Shell>
    )

  const mine = uid && post.author_id === uid
  return (
    <Shell tabs={false}>
      <BackLink />
      <article className="rounded-3xl bg-card p-4 shadow-soft" aria-label="글">
        <div className="mb-1 flex items-center gap-1.5">
          <CategoryBadge id={post.category} />
          {post.hidden && <span className="text-xs font-bold text-danger">신고가 쌓여 숨김 처리된 글이에요</span>}
        </div>
        <h1 className="text-xl font-extrabold break-keep text-cocoa">{post.title}</h1>
        <p className="mt-1 flex flex-wrap gap-x-2 text-xs text-faint">
          <Nickname author={post.author} />
          <span>{relativeTime(post.created_at)}</span>
          {post.updated_at && post.updated_at !== post.created_at && <span>(수정됨)</span>}
        </p>
        <p className="mt-3 text-base break-words whitespace-pre-wrap" data-testid="post-body">
          {post.body}
        </p>
        <div className="mt-3 flex flex-wrap justify-end gap-1">
          {mine && (
            <Button variant="ghost" onClick={() => navigate(`/community/edit/${post.id}`)}>
              수정
            </Button>
          )}
          {(mine || isAdmin) && (
            <Button variant="ghost" onClick={removePost}>
              삭제
            </Button>
          )}
          {session && !mine && (
            <Button variant="ghost" onClick={() => setReporting({ type: 'post', id: post.id })}>
              🚩 신고
            </Button>
          )}
        </div>
      </article>

      <section aria-label="답글" className="space-y-2">
        <h2 className="px-1 font-extrabold text-cocoa">답글 {comments.length}</h2>
        {comments.length === 0 && <p className="px-1 text-sm text-muted">첫 답글을 남겨 주세요.</p>}
        <ul className="space-y-2">
          {comments.map((c) => {
            const own = uid && c.author_id === uid
            return (
              <li key={c.id} className="rounded-2xl bg-card p-3 shadow-soft">
                <p className="flex flex-wrap items-center gap-x-2 text-xs text-faint">
                  <Nickname author={c.author} />
                  <span>{relativeTime(c.created_at)}</span>
                  {c.hidden && <span className="font-bold text-danger">숨김 처리됨</span>}
                  {post.author_id === c.author_id && <span className="rounded-full bg-tint px-1.5 font-bold text-cocoa">글쓴이</span>}
                </p>
                <p className="mt-1 text-sm break-words whitespace-pre-wrap">{c.body}</p>
                <div className="flex justify-end gap-1">
                  {(own || isAdmin) && (
                    <button type="button" onClick={() => removeComment(c.id)} className="min-h-11 px-2 text-xs text-muted">
                      삭제
                    </button>
                  )}
                  {session && !own && (
                    <button type="button" onClick={() => setReporting({ type: 'comment', id: c.id })} className="min-h-11 px-2 text-xs text-muted">
                      신고
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
        {session ? (
          <CommentForm
            postId={post.id}
            onPosted={async () => {
              await loadComments()
              setPost((p) => ({ ...p, comment_count: p.comment_count + 1 }))
            }}
          />
        ) : (
          session === null && (
            <div className="flex items-center justify-between gap-2 rounded-2xl bg-card p-3 shadow-soft">
              <span className="text-sm text-muted">답글을 쓰려면 로그인해 주세요.</span>
              <LoginButton label="카카오 로그인" className="shrink-0" />
            </div>
          )
        )}
      </section>

      <CommunityFooter />
      {reporting && <ReportModal target={reporting} onClose={() => setReporting(null)} />}
    </Shell>
  )
}

function CommentForm({ postId, onPosted }) {
  const [body, setBody] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const submit = async (e) => {
    e.preventDefault()
    const problem = validateComment(body)
    if (problem) return setError(problem)
    setBusy(true)
    setError(null)
    try {
      await api.createComment(postId, body)
      setBody('')
      await onPosted()
    } catch (err) {
      setError(communityErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }
  return (
    <form onSubmit={submit} className="space-y-2 rounded-2xl bg-card p-3 shadow-soft" aria-label="답글 쓰기">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={LIMITS.comment}
        rows={3}
        placeholder="따뜻한 답글을 남겨 주세요"
        aria-label="답글 내용"
        className={inputClass}
      />
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
      <Button type="submit" disabled={busy} className="w-full">
        답글 등록
      </Button>
    </form>
  )
}

function ReportModal({ target, onClose }) {
  const [reason, setReason] = useState('')
  const [message, setMessage] = useState(null)
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    setBusy(true)
    try {
      await (target.type === 'post' ? api.reportPost(target.id, reason) : api.reportComment(target.id, reason))
      setMessage({ ok: true, text: '신고했어요. 신고가 쌓이면 자동으로 숨겨지고, 운영자가 확인해요.' })
    } catch (err) {
      setMessage({ ok: false, text: err?.code === '23505' ? '이미 신고한 글이에요.' : communityErrorMessage(err) })
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal title="신고하기" onClose={onClose}>
      {message?.ok ? (
        <div className="space-y-3">
          <p role="status" className="text-sm text-ok">
            {message.text}
          </p>
          <Button onClick={onClose} className="w-full">
            닫기
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <Field label="신고 이유 (선택)">
            <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={LIMITS.reason} placeholder="예: 광고, 욕설, 잘못된 정보" className={inputClass} />
          </Field>
          {message && (
            <p role="alert" className="text-sm text-danger">
              {message.text}
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Button variant="ghost" onClick={onClose}>
              취소
            </Button>
            <Button variant="danger" onClick={submit} disabled={busy}>
              신고
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}

// ── 글쓰기·수정 ──────────────────────────────────────────
function PostForm() {
  const { id } = useParams() // 있으면 수정
  const navigate = useNavigate()
  const { session, uid } = useAuth()
  const [form, setForm] = useState({ category: 'question', title: '', body: '' })
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [loaded, setLoaded] = useState(!id)

  useEffect(() => {
    if (!id) return
    api
      .fetchPost(id)
      .then((p) => {
        setForm({ category: p.category, title: p.title, body: p.body })
        setLoaded(p.author_id === uid ? true : 'notMine')
      })
      .catch((err) => setServerError(communityErrorMessage(err)))
  }, [id, uid])

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    const found = validatePost(form)
    setErrors(found)
    if (Object.keys(found).length) return
    setBusy(true)
    setServerError(null)
    try {
      if (id) {
        await api.updatePost(id, form)
        navigate(`/community/post/${id}`, { replace: true })
      } else {
        const created = await api.createPost(form)
        navigate(`/community/post/${created.id}`, { replace: true })
      }
    } catch (err) {
      setServerError(communityErrorMessage(err))
      setBusy(false)
    }
  }

  if (session === undefined) return null
  if (!session)
    return (
      <Shell tabs={false}>
        <BackLink />
        <Banner tone="info" icon="🔑">
          글을 쓰려면 로그인해 주세요.
        </Banner>
        <LoginButton className="w-full" />
      </Shell>
    )
  if (loaded === 'notMine')
    return (
      <Shell tabs={false}>
        <BackLink />
        <Banner tone="warn">내가 쓴 글만 고칠 수 있어요.</Banner>
      </Shell>
    )

  return (
    <Shell tabs={false}>
      <BackLink to={id ? `/community/post/${id}` : '/community'} children="‹ 취소" />
      <h1 className="px-1 text-xl font-extrabold text-cocoa">{id ? '글 고치기' : '글쓰기'}</h1>
      {!loaded && !serverError ? (
        <p className="py-6 text-center text-sm text-muted">불러오는 중…</p>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-3 rounded-3xl bg-card p-4 shadow-soft" aria-label={id ? '글 고치기' : '글쓰기'}>
          <div role="group" aria-label="말머리" className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((c) => (
              <Chip key={c.id} active={form.category === c.id} onClick={() => setForm((f) => ({ ...f, category: c.id }))}>
                {c.icon} {c.label}
              </Chip>
            ))}
          </div>
          {errors.category && <p className="text-xs text-danger">{errors.category}</p>}
          <Field label="제목" error={errors.title}>
            <input value={form.title} onChange={set('title')} maxLength={LIMITS.title} className={inputClass} />
          </Field>
          <Field label="내용" error={errors.body}>
            <textarea value={form.body} onChange={set('body')} maxLength={LIMITS.body} rows={10} className={inputClass} />
          </Field>
          <p className="text-right text-xs text-faint">
            {[...form.body].length} / {LIMITS.body}
          </p>
          <p className="text-xs text-muted">
            개인정보(전화번호·주소 등)는 쓰지 말아 주세요. 광고·욕설·잘못된 의료 정보는 신고로 숨겨질 수 있어요.
          </p>
          {serverError && (
            <p role="alert" className="text-sm text-danger">
              {serverError}
            </p>
          )}
          <Button type="submit" disabled={busy} className="w-full">
            {id ? '고치기' : '올리기'}
          </Button>
        </form>
      )}
    </Shell>
  )
}

// ── 내 정보 ──────────────────────────────────────────────
function MyInfo() {
  const navigate = useNavigate()
  const { session, uid, profile, reloadProfile } = useAuth()
  const [nickname, setNickname] = useState('')
  const [message, setMessage] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (profile) setNickname(profile.nickname)
  }, [profile])

  if (session === undefined) return null
  if (!session)
    return (
      <Shell tabs={false}>
        <BackLink />
        <LoginButton className="w-full" />
      </Shell>
    )

  const save = async (e) => {
    e.preventDefault()
    const problem = validateNickname(nickname)
    if (problem) return setMessage({ ok: false, text: problem })
    setBusy(true)
    try {
      await api.updateNickname(uid, nickname)
      await reloadProfile()
      setMessage({ ok: true, text: '닉네임을 바꿨어요.' })
    } catch (err) {
      setMessage({ ok: false, text: communityErrorMessage(err) })
    } finally {
      setBusy(false)
    }
  }

  const logout = async () => {
    await api.signOut().catch(() => {})
    navigate('/community', { replace: true })
  }

  const withdraw = async () => {
    if (!window.confirm('탈퇴하면 계정과 내가 쓴 글·답글이 모두 지워지고 되돌릴 수 없어요. 탈퇴할까요?')) return
    try {
      await api.deleteMyAccount()
      await api.signOut().catch(() => {})
      window.alert('탈퇴했어요. 그동안 고마웠어요.')
      navigate('/community', { replace: true })
    } catch (err) {
      window.alert(communityErrorMessage(err))
    }
  }

  return (
    <Shell tabs={false}>
      <BackLink />
      <h1 className="px-1 text-xl font-extrabold text-cocoa">내 정보</h1>
      {profile?.banned && (
        <Banner tone="danger" icon="⛔">
          이용 수칙 위반으로 글쓰기가 제한된 계정이에요.
        </Banner>
      )}
      <form onSubmit={save} className="space-y-3 rounded-3xl bg-card p-4 shadow-soft" aria-label="닉네임 바꾸기">
        <Field label="닉네임 (커뮤니티에 보이는 이름)">
          <input value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={LIMITS.nicknameMax} className={inputClass} />
        </Field>
        <p className="text-xs text-faint">한글·영문·숫자·밑줄(_)로 2~12자. 실명 대신 별명을 추천해요.</p>
        {message && (
          <p role={message.ok ? 'status' : 'alert'} className={`text-sm ${message.ok ? 'text-ok' : 'text-danger'}`}>
            {message.text}
          </p>
        )}
        <Button type="submit" disabled={busy} className="w-full">
          저장
        </Button>
      </form>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={logout}>
          로그아웃
        </Button>
        <Button variant="danger" onClick={withdraw}>
          회원 탈퇴
        </Button>
      </div>
      <p className="text-center">
        <Link to="/community/privacy" className="inline-block min-h-11 py-3 text-xs text-faint underline">
          개인정보 처리방침·이용 수칙
        </Link>
      </p>
    </Shell>
  )
}

// ── 개인정보 처리방침·이용 수칙 (초안: 운영자가 검토해 확정할 것) ──
function Privacy() {
  return (
    <Shell tabs={false}>
      <BackLink />
      <article className="space-y-4 rounded-3xl bg-card p-4 text-sm shadow-soft" aria-label="개인정보 처리방침">
        <h1 className="text-xl font-extrabold text-cocoa">개인정보 처리방침</h1>
        <PolicySection title="1. 모으는 정보와 목적">
          커뮤니티 로그인(카카오)을 할 때 카카오 회원번호, 닉네임, 프로필 사진, 이메일(동의한 경우)을 받아요. 회원 확인과 부정 이용 방지에만
          쓰고, 커뮤니티에는 직접 정한 닉네임만 보여요. 작성한 글·답글·신고 내용과 작성 시각이 저장돼요.
        </PolicySection>
        <PolicySection title="2. 모으지 않는 정보">
          앱에 기록하는 성장·식단·건강·케어 기록과 사진은 서버로 보내지 않고 각자의 기기에만 저장돼요.
        </PolicySection>
        <PolicySection title="3. 보관 기간과 파기">탈퇴하면 계정 정보와 작성한 글·답글·신고 기록을 바로 지워요.</PolicySection>
        <PolicySection title="4. 처리를 맡기는 곳">
          데이터는 Supabase(데이터베이스·로그인 서비스)에 저장되고, 로그인은 카카오를 통해 이뤄져요.
        </PolicySection>
        <PolicySection title="5. 문의">
          {OPERATOR_CONTACT ? `운영자 연락처: ${OPERATOR_CONTACT}` : '운영자 연락처: (설정 필요)'}
        </PolicySection>

        <h2 className="pt-2 text-lg font-extrabold text-cocoa">커뮤니티 이용 수칙</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>서로 존중해 주세요. 욕설·비하·다툼을 부추기는 글은 숨겨질 수 있어요.</li>
          <li>광고·홍보·분양 거래 글은 올릴 수 없어요.</li>
          <li>전화번호·주소 같은 개인정보를 올리지 마세요.</li>
          <li>건강 관련 글은 경험담일 뿐이에요. 진단과 치료는 꼭 수의사와 상의해 주세요.</li>
          <li>신고가 3건 쌓인 글은 자동으로 숨겨지고, 반복 위반 시 글쓰기가 제한돼요.</li>
        </ul>
      </article>
    </Shell>
  )
}

const PolicySection = ({ title, children }) => (
  <section>
    <h2 className="font-bold text-cocoa">{title}</h2>
    <p className="mt-1 text-muted">{children}</p>
  </section>
)
