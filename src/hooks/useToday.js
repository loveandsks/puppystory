import { useEffect, useState } from 'react'
import { toLocalDateString } from '../utils/date.js'

/**
 * 오늘 날짜('YYYY-MM-DD'). 앱을 켠 채로 자정이 지나면 자동으로 바뀐다.
 * 폰에서 탭이 백그라운드에 있으면 타이머가 멈출 수 있어서, 다시 보일 때도 확인한다.
 */
export function useToday() {
  const [today, setToday] = useState(() => toLocalDateString())

  useEffect(() => {
    let timer
    const refresh = () => setToday(toLocalDateString())
    const scheduleMidnight = () => {
      const now = new Date()
      const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1)
      timer = setTimeout(() => {
        refresh()
        scheduleMidnight()
      }, next - now)
    }
    const onVisible = () => document.visibilityState === 'visible' && refresh()

    scheduleMidnight()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', refresh)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', refresh)
    }
  }, [])

  return today
}

/** 현재 시각 Date. intervalMs마다 갱신 (산책 타이머, 급여일 계산용) */
export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}
