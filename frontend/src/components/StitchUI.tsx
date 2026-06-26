import React from 'react'

const GAP: Record<number, string> = {
  1: '4px', 2: '8px', 3: '12px', 4: '16px', 5: '20px', 6: '24px', 8: '32px',
}

// ── Layout ───────────────────────────────────────────────────────────────────

interface FlexProps extends React.HTMLAttributes<HTMLDivElement> {
  direction?: 'row' | 'column'
  align?: 'start' | 'center' | 'end' | 'stretch'
  justify?: 'start' | 'center' | 'end' | 'between'
  gap?: 1 | 2 | 3 | 4 | 5 | 6 | 8
  wrap?: boolean | string
}
export function Flex({ direction = 'row', align = 'stretch', justify = 'start', gap, wrap, style, ...props }: FlexProps) {
  const alignMap = { start: 'flex-start', center: 'center', end: 'flex-end', stretch: 'stretch' }
  const justifyMap = { start: 'flex-start', center: 'center', end: 'flex-end', between: 'space-between' }
  const doWrap = wrap === true || wrap === 'true'
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: direction,
        alignItems: alignMap[align],
        justifyContent: justifyMap[justify],
        gap: gap ? GAP[gap] : undefined,
        flexWrap: doWrap ? 'wrap' : 'nowrap',
        ...style,
      }}
      {...props}
    />
  )
}

type ResponsiveColumns = 1 | 2 | 3 | 4 | 'auto' | Record<string, number>
interface GridProps extends React.HTMLAttributes<HTMLDivElement> {
  columns?: ResponsiveColumns
  gap?: 1 | 2 | 3 | 4 | 5 | 6 | 8
}
export function Grid({ columns = 1, gap = 4, style, ...props }: GridProps) {
  const colMap: Record<string | number, string> = {
    1: 'repeat(1, minmax(0, 1fr))',
    2: 'repeat(2, minmax(0, 1fr))',
    3: 'repeat(3, minmax(0, 1fr))',
    4: 'repeat(4, minmax(0, 1fr))',
    auto: 'repeat(auto-fit, minmax(280px, 1fr))',
  }
  const resolvedCols: string | number = typeof columns === 'object'
    ? (columns['@initial'] ?? Object.values(columns)[0] ?? 1)
    : columns
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: colMap[resolvedCols] ?? colMap[1],
        gap: GAP[gap],
        ...style,
      }}
      {...props}
    />
  )
}

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean
  glass?: boolean
  modal?: boolean
}
export function Card({ hoverable, glass, modal, style, ...props }: CardProps) {
  const isGlass = glass || modal
  return (
    <div
      style={{
        backgroundColor: isGlass ? 'var(--glass-bg)' : 'var(--bg-s1)',
        border: `1px solid ${isGlass ? 'var(--glass-bd)' : 'var(--bd)'}`,
        borderRadius: '4px',
        boxShadow: modal ? 'var(--shadow-modal)' : isGlass ? 'var(--shadow-glass)' : 'var(--shadow-card)',
        padding: '20px',
        transition: 'border-color 180ms ease, box-shadow 180ms ease',
        backdropFilter: isGlass ? 'blur(24px) saturate(160%)' : undefined,
        ...(hoverable ? { cursor: 'pointer' } : {}),
        ...style,
      }}
      {...props}
    />
  )
}

// ── Typography ───────────────────────────────────────────────────────────────

interface HeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
  level?: 'h1' | 'h2' | 'h3' | 'h4'
  as?: 'h1' | 'h2' | 'h3' | 'h4'
}
const HEADING_SIZE = { h1: '2rem', h2: '1.4rem', h3: '1.15rem', h4: '1rem' }
export function Heading({ level = 'h2', as, style, ...props }: HeadingProps) {
  const Tag = (as ?? level) as React.ElementType
  return (
    <Tag
      style={{
        fontFamily: "'Inter', system-ui, sans-serif",
        color: 'var(--tx1)',
        margin: 0,
        fontWeight: 600,
        fontSize: HEADING_SIZE[level],
        letterSpacing: '-0.01em',
        ...style,
      }}
      {...props}
    />
  )
}

interface TextProps extends React.HTMLAttributes<HTMLParagraphElement> {
  variant?: 'body' | 'muted' | 'small' | 'smallMuted' | 'label'
}
export function Text({ variant = 'body', style, ...props }: TextProps) {
  const variantStyle: React.CSSProperties =
    variant === 'body'       ? { fontSize: '14px', color: 'var(--tx1)' } :
    variant === 'muted'      ? { fontSize: '14px', color: 'var(--tx2)' } :
    variant === 'small'      ? { fontSize: '12px', color: 'var(--tx2)' } :
    variant === 'smallMuted' ? { fontSize: '12px', color: 'var(--tx3)' } :
    /* label */                {
      fontSize: '10px', color: 'var(--tx3)', fontWeight: 600,
      textTransform: 'uppercase', letterSpacing: '0.10em',
      fontFamily: "'JetBrains Mono', monospace",
    }
  return <p style={{ margin: 0, fontFamily: "'Inter', system-ui, sans-serif", ...variantStyle, ...style }} {...props} />
}

// ── Form Elements ────────────────────────────────────────────────────────────

const INPUT_BASE: React.CSSProperties = {
  width: '100%',
  backgroundColor: 'var(--bg-s2)',
  border: '1px solid var(--bd)',
  borderRadius: '4px',
  padding: '0.5rem 0.75rem',
  fontSize: '14px',
  color: 'var(--tx1)',
  transition: 'all 150ms ease',
  outline: 'none',
  fontFamily: "'Inter', system-ui, sans-serif",
}

export function Input({ style, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      style={{ ...INPUT_BASE, ...style }}
      onFocus={e => { e.currentTarget.style.borderColor = 'var(--ac)'; e.currentTarget.style.boxShadow = '0 0 0 2px var(--ac-bg)' }}
      onBlur={e => { e.currentTarget.style.borderColor = 'var(--bd)'; e.currentTarget.style.boxShadow = 'none' }}
      {...props}
    />
  )
}

export function Select({ style, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      style={{ ...INPUT_BASE, cursor: 'pointer', ...style }}
      onFocus={e => { e.currentTarget.style.borderColor = 'var(--ac)'; e.currentTarget.style.boxShadow = '0 0 0 2px var(--ac-bg)' }}
      onBlur={e => { e.currentTarget.style.borderColor = 'var(--bd)'; e.currentTarget.style.boxShadow = 'none' }}
      {...props}
    />
  )
}

export function Textarea({ style, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      style={{ ...INPUT_BASE, ...style }}
      onFocus={e => { e.currentTarget.style.borderColor = 'var(--ac)'; e.currentTarget.style.boxShadow = '0 0 0 2px var(--ac-bg)' }}
      onBlur={e => { e.currentTarget.style.borderColor = 'var(--bd)'; e.currentTarget.style.boxShadow = 'none' }}
      {...props}
    />
  )
}

// ── Buttons ──────────────────────────────────────────────────────────────────

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  intent?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'glass'
  size?: 'sm' | 'md' | 'lg'
}
export function Button({ intent = 'secondary', size = 'md', style, disabled, ...props }: ButtonProps) {
  const sizeStyle: React.CSSProperties =
    size === 'sm' ? { padding: '0.3rem 0.65rem', fontSize: '12px' } :
    size === 'lg' ? { padding: '0.65rem 1.4rem', fontSize: '16px' } :
    /* md */        { padding: '0.45rem 0.9rem',  fontSize: '14px' }

  const intentStyle: React.CSSProperties =
    intent === 'primary'   ? { backgroundColor: 'var(--ac)', color: 'var(--btn-primary-fg)' } :
    intent === 'danger'    ? { backgroundColor: 'var(--sr)', color: '#fff' } :
    intent === 'ghost'     ? { backgroundColor: 'transparent', color: 'var(--tx2)', border: '1px solid var(--bd)' } :
    intent === 'glass'     ? { backgroundColor: 'var(--ac-bg)', border: '1px solid var(--ac-bd)', color: 'var(--ac)' } :
    /* secondary */          { backgroundColor: 'var(--bg-s2)', color: 'var(--tx1)', border: '1px solid var(--bd)' }

  return (
    <button
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        borderRadius: '4px',
        fontWeight: 600,
        letterSpacing: '0.02em',
        transition: 'all 140ms ease',
        cursor: disabled ? 'not-allowed' : 'pointer',
        border: 'none',
        outline: 'none',
        fontFamily: "'Inter', system-ui, sans-serif",
        opacity: disabled ? 0.38 : 1,
        ...sizeStyle,
        ...intentStyle,
        ...style,
      }}
      {...props}
    />
  )
}

// ── Badges & Status ──────────────────────────────────────────────────────────

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status?: 'green' | 'red' | 'yellow' | 'gray' | 'primary'
}
export function Badge({ status = 'gray', style, ...props }: BadgeProps) {
  const statusStyle: React.CSSProperties =
    status === 'green'   ? { backgroundColor: 'var(--sg-bg)', color: 'var(--sg)', border: '1px solid var(--sg-bd)' } :
    status === 'red'     ? { backgroundColor: 'var(--sr-bg)', color: 'var(--sr)', border: '1px solid var(--sr-bd)' } :
    status === 'yellow'  ? { backgroundColor: 'var(--sy-bg)', color: 'var(--sy)', border: '1px solid var(--sy-bd)' } :
    status === 'primary' ? { backgroundColor: 'var(--ac-bg)', color: 'var(--ac)', border: '1px solid var(--ac-bd)' } :
    /* gray */             { backgroundColor: 'var(--sgr-bg)', color: 'var(--sgr)', border: '1px solid var(--sgr-bd)' }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0.1rem 0.45rem',
        borderRadius: '2px',
        fontSize: '10px',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        fontFamily: "'JetBrains Mono', monospace",
        ...statusStyle,
        ...style,
      }}
      {...props}
    />
  )
}

interface StatusDotProps extends React.HTMLAttributes<HTMLDivElement> {
  running?: boolean
}
export function StatusDot({ running, style, ...props }: StatusDotProps) {
  return (
    <div
      style={{
        width: '7px',
        height: '7px',
        borderRadius: '50%',
        flexShrink: 0,
        backgroundColor: running ? 'var(--sg)' : 'var(--sgr)',
        animation: running ? 'pulse-ring 2.5s ease-in-out infinite' : undefined,
        ...style,
      }}
      {...props}
    />
  )
}

// ── Tables ───────────────────────────────────────────────────────────────────

export function TableContainer({ style, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      style={{
        width: '100%',
        overflowX: 'auto',
        borderRadius: '4px',
        border: '1px solid var(--bd)',
        boxShadow: 'var(--shadow-card)',
        backgroundColor: 'var(--bg-s1)',
        ...style,
      }}
      {...props}
    />
  )
}

export function Table({ style, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', ...style }} {...props} />
}

export function THead({ style, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead style={{ backgroundColor: 'var(--bg-s2)', borderBottom: '1px solid var(--bd)', ...style }} {...props} />
}

export function TH({ style, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      style={{
        padding: '0.625rem 1.25rem',
        fontSize: '10px',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.10em',
        color: 'var(--tx3)',
        whiteSpace: 'nowrap',
        fontFamily: "'JetBrains Mono', monospace",
        ...style,
      }}
      {...props}
    />
  )
}

export function TBody({ style, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody style={style} {...props} />
}

export function TD({ style, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      style={{
        padding: '0.75rem 1.25rem',
        fontSize: '14px',
        color: 'var(--tx1)',
        borderBottom: '1px solid var(--bd)',
        ...style,
      }}
      {...props}
    />
  )
}
