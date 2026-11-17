# 커뮤니티 설정 안내 (Supabase + 카카오 로그인)

커뮤니티 게시판은 서버가 필요해서 **Supabase**(무료 데이터베이스·로그인 서비스)를 씁니다.
아래 1~7단계를 한 번만 하면 되고, 끝나기 전까지 앱의 커뮤니티 화면에는 "준비하고 있어요"가 보입니다.

> 앱의 성장 기록·사진은 지금처럼 각 기기에만 저장됩니다. 서버에는 커뮤니티 글·답글·닉네임만 저장됩니다.

---

## 1. Supabase 프로젝트 만들기

1. https://supabase.com 에 가입 → **New project**
2. 이름: `puppystory` (자유)
3. Database Password: 복잡하게 정하고 따로 보관 (앱에는 넣지 않습니다)
4. **Region: Northeast Asia (Seoul)** ← 국내 이용자라 서울을 고르세요
5. 만들어지면 왼쪽 메뉴 **Project Settings → API Keys**에서 두 가지를 메모합니다.
   - **Project URL**: `https://xxxxxxxx.supabase.co` (Project Settings → Data API 또는 General에 있음)
   - **Publishable key**: `sb_publishable_...`
   - ⚠️ **Secret key(`sb_secret_...`)는 절대 앱이나 GitHub에 넣지 마세요.**

## 2. 데이터베이스 만들기

1. 왼쪽 메뉴 **SQL Editor → New query**
2. 이 저장소의 [`supabase/schema.sql`](supabase/schema.sql) 내용을 **전부** 복사해 붙여 넣고 **Run**
3. "Success" 가 나오면 끝. (여러 번 실행해도 괜찮습니다)

이 SQL이 서버 쪽 규칙을 모두 만듭니다: 남의 글 수정·삭제 금지, 10분에 글 5개·답글 20개 제한, 신고 3건이면 자동 숨김, 탈퇴 시 글 삭제.

## 3. 앱에 서버 주소 넣기

[`src/community/config.js`](src/community/config.js)를 열어 아래처럼 채웁니다.

```js
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://xxxxxxxx.supabase.co'
export const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_...'

export const OPERATOR_CONTACT = '010-6682-1479'   // 개인정보 처리방침에 표시됨 (설정됨)
```

Publishable key는 공개 저장소에 올려도 되는 키입니다. (권한은 2단계의 규칙이 지킵니다)

## 4. 카카오 개발자 설정

1. https://developers.kakao.com → 로그인 → **내 애플리케이션 → 애플리케이션 추가하기**
   - 앱 이름: `Puppy 성장스토리`, 회사명: 본인 이름, 카테고리: 라이프스타일 등
2. **비즈 앱 전환 (꼭 필요)**: [앱] → [일반] → 비즈니스 정보 → **"개인 개발자 비즈 앱 전환"**
   - 사업자등록번호 없이 무료로 됩니다.
   - 이유: Supabase는 카카오에 로그인을 요청할 때 항상 *이메일* 동의를 함께 요청합니다. 비즈 앱이 아니면 이메일 동의 항목을 켤 수 없어 `KOE205` 오류가 납니다.
3. **[카카오 로그인] → 사용 설정 → 상태 ON** (끄면 `KOE004` 오류)
4. **[카카오 로그인] → 동의항목**
   - 닉네임(`profile_nickname`): 필수 동의
   - 프로필 사진(`profile_image`): 선택 동의
   - 카카오계정(이메일)(`account_email`): 선택 동의
5. **[앱] → [플랫폼 키] → REST API 키**
   - 이 키가 **Client ID**입니다. 메모하세요.
   - 같은 화면의 **카카오 로그인 Redirect URI**에 다음을 등록합니다:
     `https://xxxxxxxx.supabase.co/auth/v1/callback` (1단계의 Project URL 뒤에 `/auth/v1/callback`)
   - **클라이언트 시크릿** 코드를 복사하고, 사용(활성화) 상태인지 확인합니다. 이것이 **Client Secret**입니다.
6. (권장) [앱] → [플랫폼] → Web 사이트 도메인에 `https://loveandsks.github.io` 등록

## 5. Supabase에 카카오 연결

1. Supabase 왼쪽 메뉴 **Authentication → Sign In / Providers → Kakao**
2. **Enable** 켜기 → Client ID(REST API 키), Client Secret 붙여 넣기
3. **"Allow users without an email"** 켜기 (이메일 동의를 안 한 사람도 가입되게)
4. Save

## 6. 로그인 후 돌아올 주소 등록

**Authentication → URL Configuration**

- **Site URL**: `https://loveandsks.github.io/puppystory/`
- **Redirect URLs**에 추가:
  - `https://loveandsks.github.io/puppystory/`
  - `http://localhost:5173/` (내 PC에서 확인용)

## 7. 확인하고 배포

1. 내 PC: `npm run dev` → http://localhost:5173 → 하단 **함께 → 💬 커뮤니티** → 카카오 로그인 → 글 하나 올려 보기
2. 잘 되면 커밋하고 `git push origin main` → 1~2분 뒤 실제 앱에 반영

---

## 운영자 지정 (처음 한 번)

본인이 카카오로 한 번 로그인한 뒤, SQL Editor에서:

```sql
-- 가입한 사람 목록 (가장 먼저 가입한 사람이 보통 본인)
select id, created_at, raw_user_meta_data->>'name' as kakao_name from auth.users order by created_at;

-- 위에서 찾은 본인 id를 넣어 운영자로 지정
insert into public.admins (user_id) values ('여기에-본인-id');
```

운영자는 앱에서 모든 글·답글에 **삭제** 버튼이 보이고, 숨김 처리된 글도 볼 수 있습니다.

## 운영할 때 쓰는 SQL

```sql
-- 최근 신고 보기
select r.created_at, r.reason, p.title, c.body as comment
from reports r left join posts p on p.id = r.post_id left join comments c on c.id = r.comment_id
order by r.created_at desc limit 50;

-- 잘못 숨겨진 글 되살리기
update posts set hidden = false where id = 123;

-- 문제 사용자 글쓰기 정지 / 해제
update profiles set banned = true where nickname = '닉네임';
update profiles set banned = false where nickname = '닉네임';
```

## 알아둘 점

- **무료 요금제는 1주일 동안 이용이 거의 없으면 프로젝트가 일시 정지**됩니다. 정지 전에 메일이 오고, 대시보드에서 다시 켜면 데이터는 그대로입니다. 정지된 동안 앱의 커뮤니티는 오류 안내가 뜨지만 나머지 기능은 정상입니다.
- 무료 한도: 데이터베이스 500MB, 월 활성 사용자 5만 명. 텍스트 게시판이라 한참 여유가 있습니다.
- 앱의 **개인정보 처리방침·이용 수칙**(커뮤니티 → 맨 아래 링크)은 초안입니다. 운영 전에 내용을 읽고 필요하면 고쳐 주세요. 위치: `src/community/CommunityPage.jsx`의 `Privacy`.
- 회원 탈퇴는 `delete_my_account` 함수가 계정을 지웁니다. 실제 프로젝트에서 한 번 테스트 계정으로 탈퇴가 되는지 확인해 주세요.
