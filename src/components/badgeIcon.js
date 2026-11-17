// 🪮(빗, Emoji 15)은 Windows 등 일부 기기에서 빈 네모로 보인다.
// 배지 데이터(utils/grooming.js)는 그대로 두고, 화면에 그릴 때만 널리 지원되는 이모지로 바꾼다.
const FALLBACK = { '🪮': '🐩' }

export const badgeIcon = (icon) => FALLBACK[icon] ?? icon
