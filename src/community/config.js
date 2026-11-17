// 커뮤니티 서버(Supabase) 연결 정보 — COMMUNITY.md 3단계에서 채운다.
//
// 여기에는 "공개 키(publishable key, sb_publishable_...)"만 넣는다. 공개 저장소에 올려도 되는 키이고,
// 실제 권한은 supabase/schema.sql의 규칙(RLS)이 지킨다.
// ⚠️ secret 키(sb_secret_...)나 service_role 키는 절대 넣지 말 것.
//
// (테스트는 VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY 환경 변수로 덮어쓴다)
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''
export const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || ''

// 개인정보 처리방침에 적을 운영자 연락처 (이메일 등). 비어 있으면 '설정 필요'로 표시된다.
export const OPERATOR_CONTACT = '010-6682-1479'

export const isCommunityConfigured = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY)
