import { useRef, useState } from 'react'
import { ImageViewer } from '../components/ImageThumb.jsx'
import PageTitle from '../components/PageTitle.jsx'
import { Button, Card, Empty, Field, inputClass } from '../components/ui.jsx'
import { deleteImage, getImage, saveImage } from '../db/imageDB.js'
import { useImageUrl } from '../hooks/useImageUrl.js'
import { usePuppyInfo } from '../hooks/usePuppyInfo.js'
import { usePuppyStore } from '../store/usePuppyStore.js'
import { isValidDateString, toLocalDateString } from '../utils/date.js'
import { ageTag, getDayCount, getMonthOrdinal } from '../utils/dday.js'
import { extractPhotoDate } from '../utils/exif.js'
import { compressImage, downloadBlob, watermarkImage } from '../utils/image.js'

export default function GalleryPage() {
  const { profile } = usePuppyInfo()
  const photos = usePuppyStore((s) => s.photos)
  const vaccines = usePuppyStore((s) => s.vaccines)
  const [pending, setPending] = useState([]) // 업로드 확인 대기 [{ key, file, date, source, memo }]
  const [viewing, setViewing] = useState(null)
  const fileRef = useRef(null)

  // 첫 접종일 (마일스톤 표시용)
  const firstVaccineDate = vaccines
    .flatMap((v) => v.doses.map((d) => d.doneDate))
    .filter(Boolean)
    .sort()[0]

  const onFiles = async (e) => {
    const files = [...e.target.files]
    e.target.value = ''
    const items = await Promise.all(
      files.map(async (file, i) => {
        const { date, source } = await extractPhotoDate(file, toLocalDateString)
        return { key: `${Date.now()}-${i}`, file, date, source, memo: '' }
      }),
    )
    setPending((p) => [...p, ...items])
  }

  // 촬영일 최신순, 개월차별 묶음
  const sorted = [...photos].sort((a, b) => b.takenAt.localeCompare(a.takenAt) || b.id.localeCompare(a.id))
  const groups = []
  for (const p of sorted) {
    const ord = getMonthOrdinal(profile.birthDate, p.takenAt)
    const label = ord > 0 ? `${ord}개월차 (${p.takenAt.slice(0, 7).replace('-', '.')})` : '태어나기 전'
    if (groups.at(-1)?.label !== label) groups.push({ label, items: [] })
    groups.at(-1).items.push(p)
  }

  return (
    <div className="space-y-4">
      <PageTitle sub="사진마다 생후 일수가 자동으로 붙어요">🖼️ 앨범</PageTitle>

      <label className="flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-3xl bg-peach text-base font-extrabold text-on-peach shadow-soft focus-within:outline-2 focus-within:outline-peach-strong">
        <span aria-hidden>📷</span> 사진 올리기
        <input ref={fileRef} type="file" accept="image/*" multiple onChange={onFiles} className="sr-only" aria-label="사진 선택" />
      </label>
      <p className="-mt-2 px-1 text-xs text-faint">촬영일은 사진 정보(EXIF)에서 읽어요. 없으면 파일 날짜를 쓰고, 직접 고칠 수 있어요.</p>

      {pending.length > 0 && <UploadQueue items={pending} setItems={setPending} />}

      {groups.length === 0 ? (
        <Card>
          <Empty icon="📸" actionLabel="첫 사진 올리기" onAction={() => fileRef.current?.click()}>
            사진을 올리면 &ldquo;생후 OO일차 {profile.name}&rdquo; 태그가 붙은 성장 앨범이 만들어져요.
          </Empty>
        </Card>
      ) : (
        groups.map((g) => (
          <section key={g.label}>
            <h2 className="mb-2 flex items-center gap-2 font-extrabold text-cocoa">
              <span className="rounded-full bg-peach/40 px-3 py-1 text-sm">{g.label}</span>
              <span className="text-xs font-medium text-faint">{g.items.length}장</span>
            </h2>
            <ul className="grid grid-cols-2 gap-2">
              {g.items.map((p) => (
                <li key={p.id}>
                  <PhotoTile photo={p} profile={profile} firstVaccineDate={firstVaccineDate} onOpen={() => setViewing(p)} />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      {viewing && <PhotoDetail photo={viewing} profile={profile} onClose={() => setViewing(null)} />}
    </div>
  )
}

/** 마일스톤: 생후 100일, 매달 생일 날짜, 첫 접종일 */
function milestone(photo, profile, firstVaccineDate) {
  const days = getDayCount(profile.birthDate, photo.takenAt)
  if (days === 100) return '생후 100일'
  if (days > 0 && photo.takenAt.slice(8) === profile.birthDate.slice(8)) return `${getMonthOrdinal(profile.birthDate, photo.takenAt) - 1}개월`
  if (photo.takenAt === firstVaccineDate) return '첫 접종'
  return null
}

function PhotoTile({ photo, profile, firstVaccineDate, onOpen }) {
  const url = useImageUrl(photo.thumbId ?? photo.imageId)
  const tag = ageTag(profile.birthDate, photo.takenAt, profile.name)
  const ms = milestone(photo, profile, firstVaccineDate)
  return (
    <button type="button" onClick={onOpen} className="relative block aspect-square w-full overflow-hidden rounded-3xl bg-tint shadow-soft">
      {url && <img src={url} alt={tag} className="size-full object-cover" />}
      {ms && <span className="absolute top-2 right-2 rounded-full bg-card/90 px-2 py-0.5 text-xs font-bold text-cocoa">🎉 {ms}</span>}
      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent px-2.5 pt-6 pb-2 text-left text-xs font-bold text-white" data-testid="photo-tag">
        {tag}
      </span>
    </button>
  )
}

function UploadQueue({ items, setItems }) {
  const { profile } = usePuppyInfo()
  const addPhoto = usePuppyStore((s) => s.addPhoto)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const today = toLocalDateString()

  const update = (key, patch) => setItems((list) => list.map((it) => (it.key === key ? { ...it, ...patch } : it)))

  const saveAll = async () => {
    if (items.some((it) => !isValidDateString(it.date) || it.date > today)) return setError('촬영일을 확인해 주세요.')
    setSaving(true)
    setError(null)
    const failed = []
    for (const it of items) {
      const saved = []
      try {
        const { blob, thumb } = await compressImage(it.file, { maxSide: 1600, quality: 0.8, thumbSide: 300 })
        const imageId = await saveImage(blob, { kind: 'photo' })
        saved.push(imageId)
        const thumbId = await saveImage(thumb, { kind: 'thumb' })
        saved.push(thumbId)
        addPhoto({ imageId, thumbId, takenAt: it.date, dateSource: it.source, memo: it.memo })
      } catch (err) {
        // 반쯤 저장된 이미지는 지워서 고아 이미지가 남지 않게
        await Promise.all(saved.map((id) => deleteImage(id).catch(() => {})))
        failed.push(it)
        setError(err.message)
      }
    }
    setItems(failed)
    setSaving(false)
  }

  return (
    <Card title={`올릴 사진 ${items.length}장`}>
      <ul className="space-y-3">
        {items.map((it) => (
          <li key={it.key} className="text-sm">
            <p className="truncate text-xs text-muted">{it.file.name}</p>
            <div className="flex items-end gap-2">
              <Field label={`촬영일 (${it.source === 'exif' ? '사진 정보' : '파일 날짜'})`} className="flex-1">
                <input type="date" max={today} value={it.date} onChange={(e) => update(it.key, { date: e.target.value, source: 'manual' })} className={inputClass} />
              </Field>
              <Button variant="ghost" onClick={() => setItems((l) => l.filter((x) => x.key !== it.key))}>
                빼기
              </Button>
            </div>
            <p className="mt-1 text-xs font-bold text-cocoa" data-testid="upload-tag">
              {ageTag(profile.birthDate, it.date, profile.name)}
            </p>
            <input placeholder="한 줄 메모" value={it.memo} onChange={(e) => update(it.key, { memo: e.target.value })} className={`${inputClass} mt-1`} />
          </li>
        ))}
      </ul>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      <Button className="mt-3 w-full" disabled={saving} onClick={saveAll}>
        {saving ? '저장 중…' : '앨범에 저장'}
      </Button>
    </Card>
  )
}

function PhotoDetail({ photo, profile, onClose }) {
  const updatePhoto = usePuppyStore((s) => s.updatePhoto)
  const deletePhoto = usePuppyStore((s) => s.deletePhoto)
  const tag = ageTag(profile.birthDate, photo.takenAt, profile.name)
  const today = toLocalDateString()

  const downloadWatermarked = async () => {
    const blob = await getImage(photo.imageId)
    if (blob) downloadBlob(await watermarkImage(blob, tag), `${tag}.jpg`)
  }

  return (
    <ImageViewer id={photo.imageId} alt={tag} filename={`${profile.name}_${photo.takenAt}.jpg`} onClose={onClose}>
      <div className="mb-3 space-y-2">
        <p className="font-bold text-cocoa">{tag}</p>
        <div className="grid grid-cols-2 gap-2">
          <Field label="촬영일">
            <input
              type="date"
              max={today}
              defaultValue={photo.takenAt}
              onChange={(e) => isValidDateString(e.target.value) && e.target.value <= today && updatePhoto(photo.id, { takenAt: e.target.value, dateSource: 'manual' })}
              className={inputClass}
            />
          </Field>
          <Field label="메모">
            <input defaultValue={photo.memo} onBlur={(e) => updatePhoto(photo.id, { memo: e.target.value })} className={inputClass} />
          </Field>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={downloadWatermarked}>
            태그 넣어 저장
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              if (window.confirm('이 사진을 삭제할까요?')) {
                deletePhoto(photo.id)
                onClose()
              }
            }}
          >
            삭제
          </Button>
        </div>
      </div>
    </ImageViewer>
  )
}
