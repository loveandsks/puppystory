// 공통 UI 조각 — 색은 index.css의 토큰(cream, card, tint, cocoa, peach, ok/warn/danger)만 쓴다
import { useEffect } from 'react'
import { DISCLAIMER } from '../data/emergencyGuide.js'

export function Card({ title, icon, action, children, className = '', ...rest }) {
  return (
    <section className={`rounded-3xl bg-card p-4 shadow-soft ${className}`} {...rest}>
      {(title || action) && (
        <div className="mb-3 flex min-h-11 items-center justify-between gap-2">
          {title && (
            <h2 className="flex items-center gap-1.5 font-extrabold text-cocoa">
              {icon && <span aria-hidden>{icon}</span>}
              {title}
            </h2>
          )}
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

const BUTTON = {
  primary: 'bg-peach text-on-peach font-bold shadow-soft active:translate-y-px',
  outline: 'border-2 border-peach text-cocoa font-bold',
  ghost: 'text-muted',
  danger: 'border-2 border-danger/40 text-danger font-bold',
}

export function Button({ variant = 'primary', className = '', type = 'button', ...rest }) {
  return (
    <button
      type={type}
      className={`min-h-11 rounded-2xl px-4 text-sm transition disabled:opacity-40 ${BUTTON[variant]} ${className}`}
      {...rest}
    />
  )
}

export function Field({ label, error, children, className = '' }) {
  return (
    <label className={`block text-sm ${className}`}>
      <span className="mb-1 block font-medium text-muted">{label}</span>
      {children}
      {error && (
        <span role="alert" className="mt-1 block text-xs text-danger">
          {error}
        </span>
      )}
    </label>
  )
}

export const inputClass =
  'w-full min-h-11 rounded-2xl border-2 border-line bg-card px-3 py-2 text-base text-ink placeholder:text-faint focus:border-peach focus:outline-none'

export function Disclaimer({ className = '' }) {
  return <p className={`text-center text-xs text-faint ${className}`}>⚕️ {DISCLAIMER}</p>
}

export function ProgressBar({ value, max, label, tone = 'peach' }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  const fill = { peach: 'bg-peach', ok: 'bg-ok', warn: 'bg-warn' }[tone]
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      className="h-3 w-full overflow-hidden rounded-full bg-tint"
    >
      <div className={`h-full rounded-full ${fill} transition-[width] duration-500`} style={{ width: `${pct}%` }} />
    </div>
  )
}

export function Chip({ active, children, className = '', ...rest }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={`min-h-11 rounded-full px-4 text-sm font-medium transition ${
        active ? 'bg-cocoa text-card shadow-soft' : 'bg-tint text-muted'
      } ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}

/** 빈 상태: 안내 문구 + 첫 기록 버튼 */
export function Empty({ icon = '🐾', children, actionLabel, onAction }) {
  return (
    <div className="flex flex-col items-center gap-2 py-6 text-center">
      <span aria-hidden className="text-4xl opacity-80">
        {icon}
      </span>
      <p className="text-sm text-muted">{children}</p>
      {actionLabel && (
        <Button variant="outline" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  )
}

/** 상태 배너: tone = warn | danger | ok | info */
export function Banner({ tone = 'warn', icon, children, className = '', ...rest }) {
  const style = {
    warn: 'bg-warn-bg text-warn border-warn/30',
    danger: 'bg-danger-bg text-danger border-danger/40',
    ok: 'bg-ok-bg text-ok border-ok/30',
    info: 'bg-tint text-ink border-line',
  }[tone]
  return (
    <div className={`flex gap-2 rounded-2xl border p-3 text-sm ${style} ${className}`} {...rest}>
      {icon && <span aria-hidden>{icon}</span>}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

export function Modal({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-card p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-soft sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line sm:hidden" aria-hidden />
        <h2 className="mb-3 text-lg font-extrabold text-cocoa">{title}</h2>
        {children}
      </div>
    </div>
  )
}

/** Yes/No 토글 */
export function YesNo({ value, onChange, name }) {
  return (
    <div role="group" aria-label={name} className="flex gap-2">
      {[
        [true, '예'],
        [false, '아니요'],
      ].map(([v, label]) => (
        <Chip key={label} active={value === v} onClick={() => onChange(value === v ? null : v)} className="flex-1">
          {label}
        </Chip>
      ))}
    </div>
  )
}

/** 신호등 상태 표시 — 색과 글자를 함께 (색만으로 구분하지 않기) */
export function StatusPill({ status, children, ...rest }) {
  const style = {
    green: 'bg-ok-bg text-ok',
    yellow: 'bg-warn-bg text-warn',
    red: 'bg-danger-bg text-danger',
    unknown: 'bg-tint text-faint',
  }[status]
  const emoji = { green: '🟢', yellow: '🟡', red: '🔴', unknown: '⚪' }[status]
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${style}`} {...rest}>
      <span aria-hidden>{emoji}</span>
      {children}
    </span>
  )
}
