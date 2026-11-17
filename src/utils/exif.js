// JPEG EXIF에서 촬영일(DateTimeOriginal, 0x9003)만 읽는 가벼운 파서 (PRD F-5.1, 라이브러리 없음)

const TAG_EXIF_IFD = 0x8769
const TAG_DATETIME_ORIGINAL = 0x9003
const TAG_DATETIME = 0x0132 // IFD0의 수정 시각 — 원본 촬영일이 없을 때 대체

/** "2026:11:16 10:30:00" → '2026-11-16' */
function exifDateToString(s) {
  const m = /^(\d{4}):(\d{2}):(\d{2})/.exec(s)
  if (!m || m[1] === '0000') return null
  return `${m[1]}-${m[2]}-${m[3]}`
}

function readAscii(view, offset, count) {
  let s = ''
  for (let i = 0; i < count && offset + i < view.byteLength; i++) {
    const c = view.getUint8(offset + i)
    if (c === 0) break
    s += String.fromCharCode(c)
  }
  return s
}

/** IFD에서 태그를 찾아 { type, count, valueOffset } 반환 */
function findTag(view, tiff, ifdOffset, tag, little) {
  const start = tiff + ifdOffset
  if (start + 2 > view.byteLength) return null
  const entries = view.getUint16(start, little)
  for (let i = 0; i < entries; i++) {
    const entry = start + 2 + i * 12
    if (entry + 12 > view.byteLength) return null
    if (view.getUint16(entry, little) === tag) {
      return {
        type: view.getUint16(entry + 2, little),
        count: view.getUint32(entry + 4, little),
        valueOffset: view.getUint32(entry + 8, little),
        entry,
      }
    }
  }
  return null
}

function readDateTag(view, tiff, ifdOffset, tag, little) {
  const t = findTag(view, tiff, ifdOffset, tag, little)
  if (!t || t.type !== 2) return null // ASCII
  const at = t.count <= 4 ? t.entry + 8 : tiff + t.valueOffset
  return exifDateToString(readAscii(view, at, t.count))
}

/** ArrayBuffer(JPEG 앞부분) → 'YYYY-MM-DD' 또는 null */
export function parseExifDate(buffer) {
  try {
    const view = new DataView(buffer)
    if (view.getUint16(0) !== 0xffd8) return null // JPEG 아님
    let offset = 2
    while (offset + 4 <= view.byteLength) {
      const marker = view.getUint16(offset)
      if ((marker & 0xff00) !== 0xff00) return null
      const size = view.getUint16(offset + 2)
      if (marker === 0xffe1 && readAscii(view, offset + 4, 4) === 'Exif') {
        const tiff = offset + 10
        const little = view.getUint16(tiff) === 0x4949 // 'II'
        if (view.getUint16(tiff + 2, little) !== 42) return null
        const ifd0 = view.getUint32(tiff + 4, little)
        const exifPtr = findTag(view, tiff, ifd0, TAG_EXIF_IFD, little)
        const original = exifPtr && readDateTag(view, tiff, exifPtr.valueOffset, TAG_DATETIME_ORIGINAL, little)
        return original || readDateTag(view, tiff, ifd0, TAG_DATETIME, little)
      }
      if (marker === 0xffda) return null // 이미지 데이터 시작 — EXIF 없음
      offset += 2 + size
    }
  } catch {
    /* 손상된 파일은 EXIF 없음으로 처리 */
  }
  return null
}

/**
 * 파일의 촬영일과 출처.
 * EXIF 촬영일 → 없으면 File.lastModified → 사용자가 언제든 수정 (PRD F-5.1)
 */
export async function extractPhotoDate(file, toLocalDateString) {
  const head = await file.slice(0, 256 * 1024).arrayBuffer()
  const exif = parseExifDate(head)
  if (exif) return { date: exif, source: 'exif' }
  return { date: toLocalDateString(new Date(file.lastModified || Date.now())), source: 'file' }
}

/** 테스트용: 촬영일 EXIF만 들어 있는 최소 JPEG 헤더 바이트 (자가 진단·Playwright에서 사용) */
export function buildExifSegment(dateStr) {
  const ascii = `${dateStr.replaceAll('-', ':')} 10:00:00\0` // 20바이트
  // TIFF(II) + IFD0(엔트리 1: ExifIFD 포인터) + ExifIFD(엔트리 1: DateTimeOriginal) + 문자열
  const tiff = new Uint8Array(8 + 18 + 18 + 20)
  const v = new DataView(tiff.buffer)
  v.setUint16(0, 0x4949)
  v.setUint16(2, 42, true)
  v.setUint32(4, 8, true)
  v.setUint16(8, 1, true) // IFD0 엔트리 수
  v.setUint16(10, TAG_EXIF_IFD, true)
  v.setUint16(12, 4, true) // LONG
  v.setUint32(14, 1, true)
  v.setUint32(18, 26, true) // ExifIFD 위치
  v.setUint32(22, 0, true) // 다음 IFD 없음
  v.setUint16(26, 1, true)
  v.setUint16(28, TAG_DATETIME_ORIGINAL, true)
  v.setUint16(30, 2, true) // ASCII
  v.setUint32(32, 20, true)
  v.setUint32(36, 44, true) // 문자열 위치
  v.setUint32(40, 0, true)
  for (let i = 0; i < 20; i++) tiff[44 + i] = ascii.charCodeAt(i)

  const header = new TextEncoder().encode('Exif\0\0')
  const size = 2 + header.length + tiff.length
  const seg = new Uint8Array(4 + header.length + tiff.length)
  seg.set([0xff, 0xe1, size >> 8, size & 0xff])
  seg.set(header, 4)
  seg.set(tiff, 4 + header.length)
  return seg
}

/** 기존 JPEG 바이트(SOI 뒤)에 EXIF 세그먼트를 끼워 넣는다 */
export function injectExif(jpegBytes, dateStr) {
  const seg = buildExifSegment(dateStr)
  const out = new Uint8Array(jpegBytes.length + seg.length)
  out.set(jpegBytes.subarray(0, 2))
  out.set(seg, 2)
  out.set(jpegBytes.subarray(2), 2 + seg.length)
  return out
}
