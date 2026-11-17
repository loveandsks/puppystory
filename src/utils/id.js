// crypto.randomUUID는 보안 컨텍스트(https, localhost)에서만 있다.
// 폰에서 http://192.168.x.x 로 접속해 테스트할 때도 깨지지 않도록 대체 구현을 둔다.
export function makeId(prefix = '') {
  const raw =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  return prefix ? `${prefix}_${raw}` : raw
}
