import React, { useEffect } from 'react'

function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(' ')
}

const styles = {
  switch: `relative block cursor-pointer h-6 w-[44px]
    [--c-active:#00D4FF]
    [--c-active-inner:#ffffff]
    [--c-default:#1A1A28]
    [--c-default-dark:#252540]
    [-webkit-transform:translateZ(0)]
    [transform:translateZ(0)]
    [-webkit-backface-visibility:hidden]
    [backface-visibility:hidden]
    [-webkit-perspective:1000]
    [perspective:1000]`,
  input: `h-full w-full cursor-pointer appearance-none rounded-full
    bg-[--c-default] outline-none transition-colors duration-500
    hover:bg-[--c-default-dark]
    [-webkit-transform:translate3d(0,0,0)]
    [transform:translate3d(0,0,0)]
    data-[checked=true]:bg-[--c-background]
    disabled:opacity-40 disabled:cursor-not-allowed`,
  svg: `pointer-events-none absolute inset-0 fill-white
    [-webkit-transform:translate3d(0,0,0)]
    [transform:translate3d(0,0,0)]`,
  circle: `transform-gpu transition-transform duration-500
    [-webkit-transform:translate3d(0,0,0)]
    [transform:translate3d(0,0,0)]
    [-webkit-backface-visibility:hidden]
    [backface-visibility:hidden]`,
  dropCircle: `transform-gpu transition-transform duration-700
    [-webkit-transform:translate3d(0,0,0)]
    [transform:translate3d(0,0,0)]`,
}

const variantStyles = {
  default: '[--c-background:var(--c-active)]',
  success: '[--c-background:#22C55E]',
  warning: '[--c-background:#EAB308]',
  danger:  '[--c-background:#EF4444]',
}

interface ToggleProps {
  checked?: boolean
  onChange?: () => void
  onCheckedChange?: (checked: boolean) => void
  disabled?: boolean
  'aria-label'?: string
  className?: string
  variant?: 'default' | 'success' | 'warning' | 'danger'
}

export default function Toggle({
  checked = false,
  onChange,
  onCheckedChange,
  disabled,
  'aria-label': ariaLabel,
  className,
  variant = 'default',
}: ToggleProps) {
  const [isChecked, setIsChecked] = React.useState(checked)

  useEffect(() => { setIsChecked(checked) }, [checked])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (disabled) return
    const next = e.target.checked
    setIsChecked(next)
    onChange?.()
    onCheckedChange?.(next)
  }

  // Scale factors for 44×24 viewBox
  const leftCx = 13, rightCx = 31, cy = 12, r = 8

  return (
    <label className={cn(styles.switch, className)} aria-label={ariaLabel}>
      <input
        type="checkbox"
        checked={isChecked}
        onChange={handleChange}
        disabled={disabled}
        data-checked={isChecked}
        className={cn(styles.input, variantStyles[variant])}
        role="switch"
        aria-checked={isChecked}
      />
      <svg viewBox="0 0 44 24" filter="url(#goo)" className={styles.svg}>
        {/* Left circle — visible when OFF */}
        <circle
          className={styles.circle}
          cx={leftCx}
          cy={cy}
          r={r}
          style={{
            transformOrigin: `${leftCx}px ${cy}px`,
            transform: isChecked ? 'translateX(10px) scale(0)' : 'translateX(0px) scale(1)',
          }}
        />
        {/* Right circle — visible when ON */}
        <circle
          className={styles.circle}
          cx={rightCx}
          cy={cy}
          r={r}
          style={{
            transformOrigin: `${rightCx}px ${cy}px`,
            transform: isChecked ? 'translateX(0px) scale(1)' : 'translateX(-10px) scale(0)',
          }}
        />
        {/* Drip drop when ON */}
        {isChecked && (
          <circle
            className={styles.dropCircle}
            cx={rightCx - 1}
            cy={-1}
            r={2}
          />
        )}
      </svg>
    </label>
  )
}

export function GooeyFilter() {
  return (
    <svg className="fixed w-0 h-0 pointer-events-none" aria-hidden="true">
      <defs>
        <filter id="goo">
          <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
          <feColorMatrix
            in="blur"
            mode="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7"
            result="goo"
          />
          <feComposite in="SourceGraphic" in2="goo" operator="atop" />
        </filter>
      </defs>
    </svg>
  )
}
