// 이미지 압축·썸네일·워터마크 (Canvas, 라이브러리 없음)

async function loadBitmap(file) {
  // createImageBitmap은 EXIF 회전 정보를 반영해서 그린다
  if ('createImageBitmap' in globalThis) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' })
    } catch {
      /* 아래 <img> 방식으로 재시도 */
    }
  }
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    return img
  } finally {
    URL.revokeObjectURL(url)
  }
}

function canvasToBlob(canvas, quality) {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('이미지를 저장하지 못했어요.'))), 'image/jpeg', quality),
  )
}

function drawScaled(source, maxSide) {
  const w = source.width
  const h = source.height
  const scale = Math.min(1, maxSide / Math.max(w, h))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(w * scale)
  canvas.height = Math.round(h * scale)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#fff' // 투명 PNG가 JPEG에서 검게 나오지 않도록
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
  return canvas
}

/**
 * 긴 변 maxSide 이하 JPEG로 압축. 원본 + 썸네일을 한 번의 디코딩으로 만든다.
 * HEIC 등 브라우저가 못 여는 형식이면 안내 메시지와 함께 throw
 */
export async function compressImage(file, { maxSide = 1600, quality = 0.8, thumbSide = 0 } = {}) {
  let bitmap
  try {
    bitmap = await loadBitmap(file)
  } catch {
    const heic = /heic|heif/i.test(file.type) || /\.hei[cf]$/i.test(file.name)
    throw new Error(
      heic
        ? '이 브라우저에서는 HEIC 사진을 열 수 없어요. JPEG로 변환해 올려주세요.'
        : `'${file.name}' 파일을 열 수 없어요. 사진 파일인지 확인해 주세요.`,
    )
  }
  const blob = await canvasToBlob(drawScaled(bitmap, maxSide), quality)
  const thumb = thumbSide ? await canvasToBlob(drawScaled(bitmap, thumbSide), 0.75) : null
  bitmap.close?.()
  return { blob, thumb }
}

/** 사진 하단에 태그 문구를 합성한 JPEG Blob (PRD F-5.2 워터마크 저장) */
export async function watermarkImage(blob, text) {
  const bitmap = await loadBitmap(blob)
  const canvas = drawScaled(bitmap, 4000)
  const ctx = canvas.getContext('2d')
  const fontSize = Math.max(16, Math.round(canvas.width / 22))
  const pad = Math.round(fontSize * 0.6)
  ctx.font = `bold ${fontSize}px "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`
  const textWidth = ctx.measureText(text).width
  const boxH = fontSize + pad * 2
  const x = pad
  const y = canvas.height - boxH - pad
  ctx.fillStyle = 'rgba(124, 74, 45, 0.75)'
  ctx.beginPath()
  if (ctx.roundRect) ctx.roundRect(x, y, textWidth + pad * 2, boxH, boxH / 2)
  else ctx.rect(x, y, textWidth + pad * 2, boxH)
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x + pad, y + boxH / 2)
  bitmap.close?.()
  return canvasToBlob(canvas, 0.9)
}

/** Blob 다운로드 */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
