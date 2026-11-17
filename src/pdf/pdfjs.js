// PDF 뷰어 엔진 (pdf.js). 가이드 화면에서만 import()로 불러와 앱 첫 로딩에는 포함되지 않는다.
// legacy 빌드: 최신 빌드는 아주 최근 브라우저 기능(Map.getOrInsertComputed 등)을 써서 예전 폰에서 열리지 않는다.
import { GlobalWorkerOptions, VerbosityLevel, getDocument } from 'pdfjs-dist/legacy/build/pdf.min.mjs'
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'

GlobalWorkerOptions.workerSrc = workerUrl

/**
 * PDF 열기. 부분 요청(Range)을 끄고 파일 전체를 한 번에 받는다:
 * Service Worker가 통째로 저장해 두어야 오프라인에서도 다시 열 수 있다.
 */
export function openPdf(url) {
  return getDocument({
    url: new URL(url, location.href).href,
    disableRange: true,
    disableStream: true,
    isEvalSupported: false,
    verbosity: VerbosityLevel.ERRORS,
  })
}
