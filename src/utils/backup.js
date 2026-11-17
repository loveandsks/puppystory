// JSON 백업 내보내기/가져오기 (PRD 8. 데이터 안전)
// - 가벼운 백업: 기록(텍스트)만
// - 전체 백업: 기록 + IndexedDB 사진·영수증 이미지(base64)
import { getImage, putImage } from '../db/imageDB.js'
import { SCHEMA_VERSION, pickData, usePuppyStore } from '../store/usePuppyStore.js'
import { toLocalDateString } from './date.js'
import { sanitizeData } from './sanitize.js'
import { downloadBlob } from './image.js'

/** 스토어가 참조하는 모든 이미지 id */
export function referencedImageIds(data) {
  return [
    ...data.receipts.flatMap((r) => [...(r.imageIds ?? []), ...(r.detailImageIds ?? [])]),
    ...data.photos.flatMap((p) => [p.imageId, p.thumbId]),
    ...data.symptomLogs.flatMap((l) => l.imageIds ?? []),
  ].filter(Boolean)
}

const blobToDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })

const dataUrlToBlob = async (dataUrl) => (await fetch(dataUrl)).blob()

export async function buildBackup({ withImages = false, state = usePuppyStore.getState() } = {}) {
  const data = pickData(state)
  const backup = { app: 'puppy-diary', schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), data }
  if (withImages) {
    backup.images = []
    for (const id of referencedImageIds(data)) {
      const blob = await getImage(id).catch(() => null)
      if (blob) backup.images.push({ id, dataUrl: await blobToDataUrl(blob) })
    }
  }
  return backup
}

export async function downloadBackup({ withImages = false } = {}) {
  const backup = await buildBackup({ withImages })
  const name = backup.data.profile?.name || '강아지'
  const stamp = toLocalDateString().replaceAll('-', '')
  const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' })
  downloadBlob(blob, `${name}_${withImages ? '전체' : ''}백업_${stamp}.json`)
  usePuppyStore.getState().markBackedUp(toLocalDateString())
}


/** 백업 파일 텍스트 검사 → { data, images }. 문제가 있으면 사용자에게 보여줄 메시지로 throw */
export function parseBackup(text) {
  let json
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error('JSON 파일이 아니에요. 앱에서 내보낸 백업 파일을 선택해 주세요.')
  }
  if (json?.app !== 'puppy-diary' || typeof json.data !== 'object' || json.data === null) {
    throw new Error('성장일기 백업 파일이 아니에요.')
  }
  if (json.schemaVersion > SCHEMA_VERSION) {
    throw new Error('더 새로운 버전의 앱에서 만든 백업이에요. 앱을 업데이트한 뒤 다시 시도해 주세요.')
  }
  if (typeof json.data.profile !== 'object' || json.data.profile === null) {
    throw new Error('백업 파일에 프로필 정보가 없어요.')
  }
  // 항목별 형식 검사: 화면을 깨뜨릴 항목은 버리고 개수를 알려준다
  const { data, dropped } = sanitizeData(json.data)
  return { data, dropped, images: Array.isArray(json.images) ? json.images : [] }
}

/** 이미지 복원 (같은 id로 저장). 복원한 개수 반환 */
export async function restoreImages(images) {
  let count = 0
  for (const img of images) {
    if (typeof img?.id !== 'string' || typeof img?.dataUrl !== 'string' || !img.dataUrl.startsWith('data:image/')) continue
    await putImage(img.id, await dataUrlToBlob(img.dataUrl))
    count += 1
  }
  return count
}
