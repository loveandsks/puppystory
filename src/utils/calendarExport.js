import { usePuppyStore } from '../store/usePuppyStore.js'
import { buildIcs } from './ics.js'
import { toLocalDateString } from './date.js'
import { downloadBlob } from './image.js'

/** 급여·접종 일정을 .ics로 내려받기 (폰 캘린더 알림용) */
export function downloadCalendar() {
  const state = usePuppyStore.getState()
  const ics = buildIcs(state, toLocalDateString())
  downloadBlob(new Blob([ics], { type: 'text/calendar;charset=utf-8' }), `${state.profile.name}_일정.ics`)
}
