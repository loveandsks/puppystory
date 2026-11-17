// Service Worker 원본 (앱 코드에서 import하지 않는다).
// 빌드할 때 vite.config.js의 serviceWorker 플러그인이 캐시 버전과 미리 캐시할 파일 목록을 채워 dist/sw.js로 내보낸다.
// 목적: 한 번 연 뒤에는 네트워크 없이 새로고침·다시 열기가 되게 한다 (PRD NFR-5, AC-11).
/* eslint-disable no-restricted-globals */
const CACHE = 'puppy-diary-__VERSION__'
const PRECACHE = __PRECACHE__
const NAV_TIMEOUT_MS = 3000

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('puppy-diary-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

// 페이지 이동: 네트워크 우선(새 버전 반영), 3초 안에 안 오거나 오프라인이면 캐시된 index.html
async function handleNavigate(request) {
  const cache = await caches.open(CACHE)
  try {
    const response = await Promise.race([
      fetch(request),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), NAV_TIMEOUT_MS)),
    ])
    if (response.ok) cache.put('./index.html', response.clone())
    return response
  } catch {
    return (await cache.match('./index.html', { ignoreVary: true })) ?? (await cache.match('./', { ignoreVary: true })) ?? Response.error()
  }
}

// 그 밖의 파일(JS·CSS·아이콘): 캐시 우선, 없으면 네트워크에서 받아 캐시에 추가
async function handleAsset(request) {
  const cache = await caches.open(CACHE)
  const cached = await cache.match(request, { ignoreVary: true, ignoreSearch: true })
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok) cache.put(request, response.clone())
  return response
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return
  event.respondWith(request.mode === 'navigate' ? handleNavigate(request) : handleAsset(request))
})
