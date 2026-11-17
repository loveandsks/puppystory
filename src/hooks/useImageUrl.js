import { useEffect, useState } from 'react'
import { getImage } from '../db/imageDB.js'

/** IndexedDB 이미지 id → object URL (언마운트 시 해제). 없으면 null */
export function useImageUrl(id) {
  const [url, setUrl] = useState(null)

  useEffect(() => {
    if (!id) return undefined
    let objectUrl = null
    let cancelled = false
    getImage(id)
      .then((blob) => {
        if (cancelled || !blob) return
        objectUrl = URL.createObjectURL(blob)
        setUrl(objectUrl)
      })
      .catch(() => setUrl(null))
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
      setUrl(null)
    }
  }, [id])

  return url
}
