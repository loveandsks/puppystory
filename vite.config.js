import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// public/ 안에서 미리 캐시하지 않을 파일: 호스팅 설정 파일
const NOT_PRECACHED = new Set(['_headers', '_redirects'])
// public/ 안에서 미리 캐시하지 않을 폴더: 가이드 PDF (용량이 커서 처음 열 때 받아 저장한다)
const GUIDE_DIR = 'guides'

const hashOf = (buf) => createHash('sha256').update(buf).digest('hex')

/** public/ 파일 목록과 내용 해시 (manifest·아이콘). 빌드 번들에는 안 들어가므로 따로 읽어 precache에 넣는다 */
function publicFiles() {
  const dir = new URL('./public/', import.meta.url)
  if (!existsSync(dir)) return []
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && !NOT_PRECACHED.has(e.name))
    .map((e) => {
      const full = join(e.parentPath ?? e.path, e.name)
      const rel = relative(fileURLToPath(dir), full).split(sep).join('/')
      return { name: rel, stamp: hashOf(readFileSync(full)) }
    })
    .filter((f) => !f.name.startsWith(`${GUIDE_DIR}/`))
}

/**
 * public/guides/*.pdf → 가이드 목록. 파일 이름이 곧 제목이다.
 * 앞의 순서 번호("01_", "2. ")는 정렬에만 쓰고 제목에서는 뺀다. v는 내용 해시(파일을 바꾸면 새로 받게).
 */
function guideList() {
  const dir = new URL(`./public/${GUIDE_DIR}/`, import.meta.url)
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((name) => name.toLowerCase().endsWith('.pdf'))
    .sort((a, b) => a.localeCompare(b, 'ko', { numeric: true }))
    .map((file) => {
      const full = fileURLToPath(new URL(file, dir))
      return {
        file,
        title: file.replace(/\.pdf$/i, '').replace(/^\d+[\s._-]+/, '').trim() || file,
        size: statSync(full).size,
        v: hashOf(readFileSync(full)).slice(0, 10),
      }
    })
}

/** 가이드 PDF 주소 (앱의 utils/guides.js와 같은 규칙) */
const guideUrl = (g) => `./${GUIDE_DIR}/${encodeURIComponent(g.file)}?v=${g.v}`

/**
 * guides/index.json: 빌드 때는 파일로 내보내고, 개발 서버에서는 요청마다 만들어 준다.
 * (public/guides에 PDF를 넣고 push만 하면 목록이 바뀐다)
 */
function guidesIndex() {
  return {
    name: 'puppy-guides-index',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.split('?')[0].endsWith(`/${GUIDE_DIR}/index.json`)) return next()
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.setHeader('Cache-Control', 'no-cache')
        res.end(JSON.stringify(guideList()))
      })
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: `${GUIDE_DIR}/index.json`, source: JSON.stringify(guideList()) })
    },
  }
}

/** 처음 쓸 때 받아 두는 큰 라이브러리 묶음인지 (PDF 뷰어, 커뮤니티 서버 연결) */
function isLazyLibrary(fileName, output) {
  if (fileName.includes('pdf.worker')) return true
  return output.type === 'chunk' && (output.moduleIds ?? []).some((id) => /node_modules[\\/](pdfjs-dist|@supabase)[\\/]/.test(id))
}

/**
 * 빌드할 때 dist/sw.js를 만든다. 빌드 결과 파일 목록(해시 붙은 JS·CSS 포함)을 미리 캐시할 목록으로 넣고,
 * 파일이 바뀌면 버전도 바뀌어 옛 캐시가 정리된다. 개발 서버(npm run dev)에서는 쓰지 않는다.
 * 큰 라이브러리와 가이드 PDF는 미리 캐시하지 않고(LAZY), 처음 열 때 별도 캐시에 저장해 버전이 바뀌어도 유지한다.
 */
function serviceWorker() {
  return {
    name: 'puppy-diary-service-worker',
    apply: 'build',
    enforce: 'post',
    generateBundle(_, bundle) {
      const all = Object.keys(bundle)
        .filter((f) => !f.endsWith('.map'))
        .map((f) => ({ name: f, stamp: bundle[f].code ?? bundle[f].source?.length ?? '', lazy: isLazyLibrary(f, bundle[f]) }))
      const precached = [...all.filter((f) => !f.lazy), ...publicFiles()].sort((a, b) => a.name.localeCompare(b.name))
      const lazy = [...all.filter((f) => f.lazy).map((f) => `./${f.name}`), ...guideList().map(guideUrl)].sort()
      const version = hashOf([...precached.map((f) => `${f.name}:${f.stamp}`), ...lazy].join('|')).slice(0, 12)
      const source = readFileSync(new URL('./src/sw.template.js', import.meta.url), 'utf8')
        .replace('__VERSION__', version)
        .replace('__PRECACHE__', JSON.stringify(['./', ...precached.map((f) => `./${f.name}`)]))
        .replace('__LAZY__', JSON.stringify(lazy))
      this.emitFile({ type: 'asset', fileName: 'sw.js', source })
    },
  }
}

export default defineConfig({
  // 상대 경로 빌드: 어떤 정적 호스팅/폴더에 올려도 동작
  base: './',
  plugins: [react(), tailwindcss(), guidesIndex(), serviceWorker()],
})
