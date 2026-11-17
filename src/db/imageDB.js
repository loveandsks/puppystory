// 사진·영수증 이미지 저장소 (IndexedDB, 라이브러리 없음)
// localStorage는 5MB 한도라 이미지는 여기에 Blob으로 두고, 스토어에는 id만 저장한다.
import { makeId } from '../utils/id.js'

const DB_NAME = 'puppyDiaryMedia'
const DB_VERSION = 1
const STORE = 'images'

let dbPromise = null

function openDB() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in globalThis)) {
      reject(new Error('이 브라우저는 IndexedDB를 지원하지 않아요.'))
      return
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  // 실패하면 다음 호출에서 다시 시도할 수 있게 캐시를 비운다
  dbPromise.catch(() => {
    dbPromise = null
  })
  return dbPromise
}

/** 하나의 트랜잭션에서 요청 하나를 실행하고 결과를 돌려준다 */
async function run(mode, fn) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    const req = fn(tx.objectStore(STORE))
    tx.oncomplete = () => resolve(req.result)
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB 트랜잭션이 중단됐어요.'))
  })
}

/** Blob 저장 → 새 id 반환 */
export async function saveImage(blob, meta = {}) {
  const id = makeId('img')
  await run('readwrite', (store) => store.put({ id, blob, createdAt: Date.now(), ...meta }))
  return id
}

/** id로 Blob 조회. 없으면 null */
export async function getImage(id) {
  const record = await run('readonly', (store) => store.get(id))
  return record?.blob ?? null
}

export async function deleteImage(id) {
  await run('readwrite', (store) => store.delete(id))
}

/** 저장된 모든 이미지 id (고아 이미지 정리, 전체 백업용) */
export async function listImageIds() {
  return run('readonly', (store) => store.getAllKeys())
}

/** 백업 복원용: 지정한 id로 저장 (같은 id면 덮어씀) */
export async function putImage(id, blob, meta = {}) {
  await run('readwrite', (store) => store.put({ id, blob, createdAt: Date.now(), ...meta }))
}

/** 스토어가 참조하지 않는 이미지(고아) 삭제. 삭제한 개수 반환 */
export async function cleanupOrphans(referencedIds) {
  const keep = new Set(referencedIds)
  const orphans = (await listImageIds()).filter((id) => !keep.has(id))
  await Promise.all(orphans.map((id) => deleteImage(id)))
  return orphans.length
}
