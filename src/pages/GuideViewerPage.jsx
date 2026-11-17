import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Banner, Chip, Disclaimer } from '../components/ui.jsx'
import { guideUrl } from '../utils/guides.js'
import { useGuides } from './GuidesPage.jsx'

const ZOOMS = [
  [1, '맞춤'],
  [1.5, '1.5배'],
  [2, '2배'],
]

export default function GuideViewerPage() {
  const { file } = useParams()
  const { guides, error, loading } = useGuides()
  const guide = guides.find((g) => g.file === file)

  return (
    <div className="space-y-3">
      <Link to="/guides" className="inline-flex min-h-11 items-center text-sm font-bold text-muted">
        ‹ 가이드 목록
      </Link>
      {loading ? (
        <p className="py-6 text-center text-sm text-muted">불러오는 중…</p>
      ) : !guide ? (
        <Banner tone="warn" icon="📄">
          {error ?? '이 가이드를 찾을 수 없어요. 목록에서 다시 골라 주세요.'}
        </Banner>
      ) : (
        <>
          <h1 className="px-1 text-xl font-extrabold break-keep text-cocoa">{guide.title}</h1>
          <PdfViewer url={guideUrl(guide)} title={guide.title} />
          <a href={guideUrl(guide)} download={guide.file} className="block min-h-11 text-center text-sm text-faint underline">
            PDF 파일로 저장하기
          </a>
          <Disclaimer />
        </>
      )}
    </div>
  )
}

/** pdf.js로 페이지를 캔버스에 그린다. 화면에 가까워진 페이지만 그려서 메모리를 아낀다 */
function PdfViewer({ url, title }) {
  const [doc, setDoc] = useState(null)
  const [error, setError] = useState(null)
  const [zoom, setZoom] = useState(1)
  const [ratio, setRatio] = useState(1.414) // 첫 페이지 세로/가로 비율 (그리기 전 자리 잡기용, 기본 A4)

  useEffect(() => {
    let task = null
    let alive = true
    import('../pdf/pdfjs.js')
      .then(({ openPdf }) => {
        if (!alive) return
        task = openPdf(url)
        return task.promise
      })
      .then(async (pdf) => {
        if (!alive || !pdf) return
        const first = await pdf.getPage(1)
        const vp = first.getViewport({ scale: 1 })
        if (!alive) return
        setRatio(vp.height / vp.width)
        setDoc(pdf)
      })
      .catch((err) => {
        if (!alive) return
        console.warn('[가이드] PDF 열기 실패', err)
        setError(navigator.onLine ? 'PDF를 열지 못했어요. 잠시 후 다시 시도해 주세요.' : '처음 여는 가이드는 인터넷 연결이 필요해요.')
      })
    return () => {
      alive = false
      task?.destroy()
    }
  }, [url])

  if (error) return <Banner tone="warn" icon="📡">{error}</Banner>
  if (!doc) return <p className="py-10 text-center text-sm text-muted">PDF 여는 중…</p>

  return (
    <div>
      <div className="mb-2 flex items-center gap-2" role="group" aria-label="확대">
        {ZOOMS.map(([z, label]) => (
          <Chip key={z} active={zoom === z} onClick={() => setZoom(z)}>
            {label}
          </Chip>
        ))}
        <span className="ml-auto text-xs text-faint">총 {doc.numPages}쪽</span>
      </div>
      {/* 확대하면 이 상자 안에서만 가로로 밀린다 (화면 전체 가로 스크롤 방지) */}
      <div className="-mx-4 overflow-x-auto bg-tint px-2 py-2" data-testid="pdf-pages">
        <div className="space-y-2" style={{ width: `${zoom * 100}%` }}>
          {Array.from({ length: doc.numPages }, (_, i) => (
            <PdfPage key={i} doc={doc} pageNumber={i + 1} ratio={ratio} zoom={zoom} label={`${title} ${i + 1}쪽`} />
          ))}
        </div>
      </div>
    </div>
  )
}

function PdfPage({ doc, pageNumber, ratio, zoom, label }) {
  const boxRef = useRef(null)
  const canvasRef = useRef(null)
  const [visible, setVisible] = useState(false)
  const [rendered, setRendered] = useState(false)
  const [pageRatio, setPageRatio] = useState(null) // 이 페이지의 실제 세로/가로 비율 (페이지마다 다를 수 있다)

  // 화면 근처(위아래 한 화면)에 오면 그리기 시작
  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const io = new IntersectionObserver(([entry]) => entry.isIntersecting && setVisible(true), { rootMargin: '100% 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (!visible) return
    let alive = true
    let task = null
    doc.getPage(pageNumber).then((page) => {
      const box = boxRef.current
      const canvas = canvasRef.current
      if (!alive || !box || !canvas) return
      const base = page.getViewport({ scale: 1 })
      setPageRatio(base.height / base.width)
      const cssWidth = box.clientWidth
      const dpr = Math.min(window.devicePixelRatio || 1, 2) // 너무 크게 그리면 폰 메모리가 모자란다
      const viewport = page.getViewport({ scale: (cssWidth / base.width) * dpr })
      canvas.width = Math.floor(viewport.width)
      canvas.height = Math.floor(viewport.height)
      task = page.render({ canvas, viewport })
      task.promise.then(
        () => alive && setRendered(true),
        (err) => err?.name !== 'RenderingCancelledException' && console.warn('[가이드] 페이지 그리기 실패', err),
      )
    })
    return () => {
      alive = false
      task?.cancel()
    }
  }, [visible, doc, pageNumber, zoom])

  return (
    <div ref={boxRef} className="relative w-full overflow-hidden rounded-lg bg-white shadow-soft" style={{ aspectRatio: `1 / ${pageRatio ?? ratio}` }}>
      <canvas ref={canvasRef} role="img" aria-label={label} className="block h-full w-full" data-rendered={rendered || undefined} />
    </div>
  )
}
