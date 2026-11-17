import { useState } from 'react'
import { getImage } from '../db/imageDB.js'
import { useImageUrl } from '../hooks/useImageUrl.js'
import { downloadBlob } from '../utils/image.js'
import { Button, Modal } from './ui.jsx'

/** IndexedDB 이미지 썸네일. 누르면 크게 보고 다운로드 */
export default function ImageThumb({ id, alt, fullId, filename = 'image.jpg', className = 'size-16' }) {
  const url = useImageUrl(id)
  const [open, setOpen] = useState(false)

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`${className} overflow-hidden rounded-xl bg-tint`}>
        {url ? <img src={url} alt={alt} className="size-full object-cover" /> : <span className="text-xs text-faint">…</span>}
      </button>
      {open && <ImageViewer id={fullId ?? id} alt={alt} filename={filename} onClose={() => setOpen(false)} />}
    </>
  )
}

export function ImageViewer({ id, alt, filename, onClose, children }) {
  const url = useImageUrl(id)
  const download = async () => {
    const blob = await getImage(id)
    if (blob) downloadBlob(blob, filename)
  }
  return (
    <Modal title={alt} onClose={onClose}>
      {url ? <img src={url} alt={alt} className="mb-3 w-full rounded-xl" /> : <p>불러오는 중…</p>}
      {children}
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={download}>
          다운로드
        </Button>
        <Button className="flex-1" onClick={onClose}>
          닫기
        </Button>
      </div>
    </Modal>
  )
}
