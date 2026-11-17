// 앱 아이콘 PNG를 만든다 (홈 화면 설치·PWA용). 한 번 만들어 public/에 넣어 두었으므로 아이콘을 바꿀 때만 다시 실행한다.
//   npm run icons
// 설치된 Playwright Chromium으로 SVG를 그려 PNG로 저장한다. 이모지 모양은 실행한 OS의 이모지 글꼴을 따른다.
import { writeFileSync } from 'node:fs'
import { chromium } from '@playwright/test'

const BG = '#fdba74' // --c-peach
const OUT = new URL('../public/', import.meta.url)

/** size: 출력 픽셀, emojiRatio: 이모지 크기 비율, rounded: 모서리 둥글게(일반 아이콘) / 꽉 찬 사각형(maskable·iOS) */
function svg(size, { emojiRatio, rounded }) {
  const r = rounded ? size * 0.22 : 0
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${r}" fill="${BG}"/>
  <text x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-size="${size * emojiRatio}"
    font-family="Segoe UI Emoji, Apple Color Emoji, Noto Color Emoji, sans-serif">🐶</text>
</svg>`
}

const targets = [
  { file: 'icon-192.png', size: 192, emojiRatio: 0.66, rounded: true },
  { file: 'icon-512.png', size: 512, emojiRatio: 0.66, rounded: true },
  // maskable: 안드로이드가 원·물방울 등으로 잘라내므로 가운데 80% 안전 영역 안에 그린다
  { file: 'icon-maskable-512.png', size: 512, emojiRatio: 0.5, rounded: false },
  // iOS는 투명 영역을 검게 채우고 모서리를 스스로 둥글게 깎으므로 꽉 찬 사각형
  { file: 'apple-touch-icon.png', size: 180, emojiRatio: 0.62, rounded: false },
]

const browser = await chromium.launch()
const page = await browser.newPage({ deviceScaleFactor: 1 })
for (const t of targets) {
  await page.setViewportSize({ width: t.size, height: t.size })
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg(t.size, t)}</body></html>`)
  const png = await page.locator('svg').screenshot({ omitBackground: true })
  writeFileSync(new URL(t.file, OUT), png)
  console.log(`public/${t.file} (${t.size}px)`)
}
await browser.close()
