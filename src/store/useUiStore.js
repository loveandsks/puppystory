// 저장하지 않는 화면 상태 (토스트, 놓친 일정)
import { create } from 'zustand'
import { makeId } from '../utils/id.js'

export const useUiStore = create((set) => ({
  toasts: [],
  missed: [],
  // 저장 실패: null | 'quota'(용량 초과) | 'blocked'(localStorage 사용 불가) | 'unknown'
  saveError: null,
  setSaveError: (saveError) => set({ saveError }),
  toast: (title, body = '') => {
    const id = makeId('t')
    set((s) => ({ toasts: [...s.toasts, { id, title, body }] }))
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 6000)
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  addMissed: (events) => set((s) => ({ missed: [...s.missed, ...events] })),
  clearMissed: () => set({ missed: [] }),
}))
