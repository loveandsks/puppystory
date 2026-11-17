# 배포 가이드 — 편백이 성장일기

이 앱은 서버가 없는 **정적 웹앱**이에요. `npm run build`로 만든 `dist/` 폴더를 정적 호스팅에 올리면 끝이에요.
데이터는 서버로 가지 않고 **각 브라우저 안(localStorage + IndexedDB)** 에만 저장돼요. 그래서 주소를 아는 다른 사람이 접속해도 내 기록은 보이지 않아요.

## 0. 먼저 알아둘 것 (중요)

1. **데이터는 주소(도메인)마다 따로예요.** 지금 `http://localhost:5173`에서 쓰던 기록은 배포한 주소에 자동으로 넘어가지 않아요.
   → 기존 앱에서 **⚙️ 설정 → 데이터 백업 → 사진 포함 내보내기**로 백업 파일을 받고, 배포한 주소에서 **⚙️ 설정 → 데이터 백업 → 가져오기**로 불러오세요.
2. **iPhone은 Safari와 "홈 화면에 추가"한 앱의 저장 공간이 서로 달라요.** 한쪽에서만 쓰고, 옮길 때는 내보내기 → 가져오기를 쓰세요.
3. 같은 이유로 **휴대폰과 PC는 동기화되지 않아요.** 주로 쓸 기기 하나를 정하는 걸 권해요.
4. **HTTPS 주소여야** 오프라인 캐시(Service Worker), 홈 화면 설치, 알림이 동작해요. 아래 호스팅은 모두 HTTPS를 자동으로 붙여 줘요.
5. 배포 주소는 한 번 정하면 바꾸지 않는 게 좋아요. 주소가 바뀌면 1번처럼 내보내기 → 가져오기를 다시 해야 해요.

## 1. 빌드

```
npm install
npm run build      # dist/ 생성 (index.html, assets/, sw.js, manifest, 아이콘)
npm run preview    # http://localhost:4173 에서 배포본 그대로 확인
```

`dist/`는 상대 경로로 빌드되므로 도메인 루트(`https://xxx.netlify.app/`)든 하위 경로(`https://아이디.github.io/저장소/`)든 그대로 동작해요.

## 2. 호스팅 고르기

| 방법 | 난이도 | 특징 |
|---|---|---|
| **A. Netlify Drop** | ★ 가장 쉬움 | 브라우저에서 `dist` 폴더를 끌어다 놓기만 하면 돼요. Git이 필요 없어요 |
| B. Cloudflare Pages | ★★ | 무료, 빠름. 폴더 업로드 또는 Git 연결 |
| C. Vercel | ★★ | `npx vercel` 한 줄 또는 Git 연결 |
| D. GitHub Pages | ★★★ | GitHub 저장소 필요. push하면 자동 배포 |

캐시 설정은 미리 넣어 두었어요: `public/_headers`(Netlify·Cloudflare), `vercel.json`(Vercel), `netlify.toml`(Netlify Git 연결).
`index.html`과 `sw.js`는 매번 새로 확인하고, 이름에 해시가 붙은 `assets/`는 오래 캐시해요. 그래서 새 버전을 올리면 다음 접속 때 바로 반영돼요.

### A. Netlify Drop (추천: 처음 한 번 올려 보기)

1. `npm run build`
2. https://app.netlify.com/drop 접속 → (무료 가입/로그인)
3. 탐색기에서 프로젝트의 **`dist` 폴더**를 화면에 끌어다 놓기
4. `https://임의이름.netlify.app` 주소가 생겨요. **Site configuration → Change site name**에서 `pyeonbaek-diary` 같은 이름으로 바꿀 수 있어요.
5. 업데이트: 다시 빌드한 뒤 사이트의 **Deploys** 탭에 `dist` 폴더를 끌어다 놓기

### B. Cloudflare Pages

- 폴더 업로드: 대시보드 → Workers & Pages → Create → Pages → **Upload assets** → `dist` 폴더 업로드
- Git 연결 시: Build command `npm run build`, Build output directory `dist`

### C. Vercel

```
npx vercel login
npx vercel --prod
```
처음 물어보는 질문은 기본값으로 두면 돼요(빌드 명령·출력 폴더는 `vercel.json`에 들어 있어요).

### D. GitHub Pages

1. GitHub에 저장소를 만들고 이 폴더를 push해요(`main` 브랜치).
2. 저장소 **Settings → Pages → Build and deployment → Source**를 **GitHub Actions**로 바꿔요.
3. 이후 `main`에 push할 때마다 `.github/workflows/deploy-pages.yml`이 빌드해서 `https://아이디.github.io/저장소이름/`에 올려요.

> 공개 저장소에 올리면 **코드**는 누구나 볼 수 있어요(기록 데이터는 올라가지 않아요). 코드도 비공개로 두려면 A~C를 쓰세요.

## 3. 휴대폰에 앱처럼 설치하기

- **안드로이드(Chrome)**: 배포 주소 접속 → 메뉴(⋮) → **홈 화면에 추가** 또는 **앱 설치**
- **iPhone(Safari)**: 배포 주소 접속 → 공유 버튼 → **홈 화면에 추가**
- **PC(Chrome·Edge)**: 주소창 오른쪽의 설치 아이콘

설치하면 주소창 없이 전체 화면으로 열리고, 한 번 연 뒤에는 인터넷이 없어도 열려요(응급 가이드 포함).

## 4. 배포 후 확인 목록

- [ ] 배포 주소가 `https://`로 열린다
- [ ] 헤더에 D-Day가 보이고, 탭 6개가 모두 열린다
- [ ] 기존 백업 파일을 **⚙️ 설정 → 데이터 백업 → 가져오기**로 불러왔다
- [ ] 한 번 연 뒤 비행기 모드로 바꾸고 새로고침해도 열린다
- [ ] 휴대폰 홈 화면에 🐶 아이콘으로 설치된다
- [ ] 알림을 쓰려면 설정에서 알림 권한을 허용했다 (앱이 열려 있을 때만 울려요. 닫혀 있을 때는 `.ics` 캘린더 내보내기를 쓰세요)

## 5. 새 버전 올리기

코드를 고친 뒤 `npm run build` → 같은 사이트에 다시 올리면 돼요. 빌드할 때마다 `sw.js`의 캐시 버전이 바뀌어서,
사용자가 다음에 앱을 열 때 새 버전을 받고 옛 캐시는 지워져요. 기록 데이터는 그대로 남아요.

아이콘을 바꾸려면 `scripts/make-icons.mjs`를 고친 뒤 `npm run icons`를 실행하세요(결과는 `public/`에 저장돼요).
