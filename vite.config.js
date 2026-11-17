import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// public/ 안에서 미리 캐시하지 않을 파일: 호스팅 설정 파일
const NOT_PRECACHED = new Set(['_headers', '_redirects'])

/** public/ 파일 목록과 내용 해시 (manifest·아이콘). 빌드 번들에는 안 들어가므로 따로 읽어 precache에 넣는다 */
function publicFiles() {
  const dir = new URL('./public/', import.meta.url)
  if (!existsSync(dir)) return []
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && !NOT_PRECACHED.has(e.name))
    .map((e) => {
      const full = join(e.parentPath ?? e.path, e.name)
      const rel = relative(fileURLToPath(dir), full).split(sep).join('/')
      return { name: rel, stamp: createHash('sha256').update(readFileSync(full)).digest('hex') }
    })
}

/**
 * 빌드할 때 dist/sw.js를 만든다. 빌드 결과 파일 목록(해시 붙은 JS·CSS 포함)을 미리 캐시할 목록으로 넣고,
 * 파일이 바뀌면 버전도 바뀌어 옛 캐시가 정리된다. 개발 서버(npm run dev)에서는 쓰지 않는다.
 */
function serviceWorker() {
  return {
    name: 'puppy-diary-service-worker',
    apply: 'build',
    enforce: 'post',
    generateBundle(_, bundle) {
      const bundled = Object.keys(bundle)
        .filter((f) => !f.endsWith('.map'))
        .map((f) => ({ name: f, stamp: bundle[f].code ?? bundle[f].source?.length ?? '' }))
      const files = [...bundled, ...publicFiles()].sort((a, b) => a.name.localeCompare(b.name))
      const version = createHash('sha256')
        .update(files.map((f) => `${f.name}:${f.stamp}`).join('|'))
        .digest('hex')
        .slice(0, 12)
      const source = readFileSync(new URL('./src/sw.template.js', import.meta.url), 'utf8')
        .replace('__VERSION__', version)
        .replace('__PRECACHE__', JSON.stringify(['./', ...files.map((f) => `./${f.name}`)]))
      this.emitFile({ type: 'asset', fileName: 'sw.js', source })
    },
  }
}

export default defineConfig({
  // 상대 경로 빌드: 어떤 정적 호스팅/폴더에 올려도 동작
  base: './',
  plugins: [react(), tailwindcss(), serviceWorker()],
})
