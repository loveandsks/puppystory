-- Puppy 성장스토리 커뮤니티 데이터베이스
-- Supabase 대시보드 → SQL Editor에 이 파일 전체를 붙여 넣고 Run 하면 된다. (COMMUNITY.md 2단계)
-- 여러 번 실행해도 안전하도록 대부분 "if not exists" / "or replace"로 썼다.
--
-- 보안 원칙: 앱(브라우저)에는 공개 키만 들어가므로, 모든 규칙은 여기(RLS·권한·트리거)에서 지킨다.
--   - 글·답글 읽기: 누구나 (숨김 처리된 것은 작성자·운영자만)
--   - 쓰기: 로그인한 사람, 정지되지 않은 사람만. 작성자는 서버가 정한다(auth.uid()).
--   - 수정·삭제: 자기 것만. 운영자는 모든 글 삭제 가능.
--   - 도배 방지: 10분에 글 5개, 답글 20개까지.
--   - 신고 3건이 쌓이면 자동 숨김.

create schema if not exists private;
-- 정책(RLS) 안에서 private 함수를 부를 수 있게. private 스키마는 API에 공개되지 않는다
grant usage on schema private to anon, authenticated;

-- ── 운영자 ───────────────────────────────────────────────
-- 운영자 지정: 대시보드 SQL Editor에서
--   insert into public.admins (user_id) select id from auth.users where id = '<내 user id>';
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);
alter table public.admins enable row level security; -- 정책이 없으므로 앱에서는 읽을 수 없다

create or replace function private.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()))
$$;

-- ── 프로필 (닉네임) ──────────────────────────────────────
-- 카카오 이름·이메일은 여기에 복사하지 않는다. 가입하면 '견주' + 임의 글자로 닉네임을 만들고, 앱에서 바꿀 수 있다.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nickname text not null check (char_length(btrim(nickname)) between 2 and 12),
  banned boolean not null default false, -- 운영자가 정지한 사용자 (대시보드에서 true로)
  created_at timestamptz not null default now()
);
create unique index if not exists profiles_nickname_key on public.profiles (lower(nickname));
alter table public.profiles enable row level security;

drop policy if exists "profiles: 누구나 읽기" on public.profiles;
create policy "profiles: 누구나 읽기" on public.profiles for select to anon, authenticated using (true);
drop policy if exists "profiles: 내 닉네임 수정" on public.profiles;
create policy "profiles: 내 닉네임 수정" on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, nickname)
  values (new.id, '견주' || substr(replace(new.id::text, '-', ''), 1, 6));
  return new;
end
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- 글을 쓸 수 있는 사람인지 (로그인 + 정지 아님)
create or replace function private.can_write() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()) and not banned)
$$;

-- ── 글 ───────────────────────────────────────────────────
create table if not exists public.posts (
  id bigint generated always as identity primary key,
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  category text not null default 'free' check (category in ('question', 'tip', 'daily', 'free')),
  title text not null check (char_length(btrim(title)) between 1 and 80),
  body text not null check (char_length(btrim(body)) between 1 and 5000),
  comment_count integer not null default 0,
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists posts_created_idx on public.posts (created_at desc, id desc);
create index if not exists posts_author_idx on public.posts (author_id);
alter table public.posts enable row level security;

drop policy if exists "posts: 읽기" on public.posts;
create policy "posts: 읽기" on public.posts for select to anon, authenticated
  using (not hidden or author_id = (select auth.uid()) or (select private.is_admin()));
drop policy if exists "posts: 쓰기" on public.posts;
create policy "posts: 쓰기" on public.posts for insert to authenticated
  with check (author_id = (select auth.uid()) and (select private.can_write()));
drop policy if exists "posts: 내 글 수정" on public.posts;
create policy "posts: 내 글 수정" on public.posts for update to authenticated
  using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()) and (select private.can_write()));
drop policy if exists "posts: 내 글·운영자 삭제" on public.posts;
create policy "posts: 내 글·운영자 삭제" on public.posts for delete to authenticated
  using (author_id = (select auth.uid()) or (select private.is_admin()));

-- ── 답글 ─────────────────────────────────────────────────
create table if not exists public.comments (
  id bigint generated always as identity primary key,
  post_id bigint not null references public.posts (id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists comments_post_idx on public.comments (post_id, created_at);
create index if not exists comments_author_idx on public.comments (author_id);
alter table public.comments enable row level security;

drop policy if exists "comments: 읽기" on public.comments;
create policy "comments: 읽기" on public.comments for select to anon, authenticated
  using (not hidden or author_id = (select auth.uid()) or (select private.is_admin()));
drop policy if exists "comments: 쓰기" on public.comments;
create policy "comments: 쓰기" on public.comments for insert to authenticated
  with check (author_id = (select auth.uid()) and (select private.can_write()));
drop policy if exists "comments: 내 답글·운영자 삭제" on public.comments;
create policy "comments: 내 답글·운영자 삭제" on public.comments for delete to authenticated
  using (author_id = (select auth.uid()) or (select private.is_admin()));

-- ── 신고 ─────────────────────────────────────────────────
create table if not exists public.reports (
  id bigint generated always as identity primary key,
  reporter_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  post_id bigint references public.posts (id) on delete cascade,
  comment_id bigint references public.comments (id) on delete cascade,
  reason text not null default '' check (char_length(reason) <= 200),
  created_at timestamptz not null default now(),
  check ((post_id is null) <> (comment_id is null)),
  unique (reporter_id, post_id),
  unique (reporter_id, comment_id)
);
alter table public.reports enable row level security;

drop policy if exists "reports: 신고하기" on public.reports;
create policy "reports: 신고하기" on public.reports for insert to authenticated
  with check (reporter_id = (select auth.uid()));
drop policy if exists "reports: 운영자만 보기" on public.reports;
create policy "reports: 운영자만 보기" on public.reports for select to authenticated
  using ((select private.is_admin()));

-- ── 권한: 사용자가 바꿀 수 있는 칸만 열어 둔다 (작성자·숨김·답글 수는 서버만 바꾼다) ──
revoke all on public.profiles, public.posts, public.comments, public.reports, public.admins from anon, authenticated;
grant select on public.profiles, public.posts, public.comments to anon, authenticated;
grant update (nickname) on public.profiles to authenticated;
grant insert (category, title, body) on public.posts to authenticated;
grant update (category, title, body) on public.posts to authenticated;
grant delete on public.posts to authenticated;
grant insert (post_id, body) on public.comments to authenticated;
grant delete on public.comments to authenticated;
grant insert (post_id, comment_id, reason) on public.reports to authenticated;
grant select on public.reports to authenticated;

-- ── 트리거: 수정 시각, 답글 수, 도배 방지, 신고 자동 숨김 ──
create or replace function private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end
$$;
drop trigger if exists posts_touch on public.posts;
create trigger posts_touch before update on public.posts
  for each row execute function private.touch_updated_at();

create or replace function private.count_comments() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set comment_count = comment_count + 1 where id = new.post_id;
  elsif tg_op = 'DELETE' then
    update public.posts set comment_count = greatest(comment_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end
$$;
drop trigger if exists comments_count on public.comments;
create trigger comments_count after insert or delete on public.comments
  for each row execute function private.count_comments();

create or replace function private.rate_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  recent integer;
begin
  if tg_table_name = 'posts' then
    select count(*) into recent from public.posts where author_id = new.author_id and created_at > now() - interval '10 minutes';
    if recent >= 5 then raise exception 'rate_limited' using errcode = 'P0001'; end if;
  else
    select count(*) into recent from public.comments where author_id = new.author_id and created_at > now() - interval '10 minutes';
    if recent >= 20 then raise exception 'rate_limited' using errcode = 'P0001'; end if;
  end if;
  return new;
end
$$;
drop trigger if exists posts_rate_limit on public.posts;
create trigger posts_rate_limit before insert on public.posts
  for each row execute function private.rate_limit();
drop trigger if exists comments_rate_limit on public.comments;
create trigger comments_rate_limit before insert on public.comments
  for each row execute function private.rate_limit();

create or replace function private.auto_hide() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.post_id is not null
     and (select count(*) from public.reports where post_id = new.post_id) >= 3 then
    update public.posts set hidden = true where id = new.post_id;
  elsif new.comment_id is not null
     and (select count(*) from public.reports where comment_id = new.comment_id) >= 3 then
    update public.comments set hidden = true where id = new.comment_id;
  end if;
  return null;
end
$$;
drop trigger if exists reports_auto_hide on public.reports;
create trigger reports_auto_hide after insert on public.reports
  for each row execute function private.auto_hide();

-- ── 앱에서 부르는 함수 ───────────────────────────────────
-- 내가 운영자인지 (삭제 버튼 표시용. 실제 권한은 위 정책이 지킨다)
create or replace function public.am_i_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()))
$$;
revoke execute on function public.am_i_admin() from public, anon;
grant execute on function public.am_i_admin() to authenticated;

-- 회원 탈퇴: 계정을 지우면 프로필·글·답글·신고가 함께 지워진다 (on delete cascade)
create or replace function public.delete_my_account() returns void
language sql security definer set search_path = '' as $$
  delete from auth.users where id = (select auth.uid())
$$;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
