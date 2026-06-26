import type { ButtonHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost'
}

export function Button({ className, variant = 'default', ...props }: ButtonProps) {
  const base = 'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus:outline-none disabled:opacity-50 disabled:pointer-events-none'
  const variants = {
    default: 'bg-[var(--ac)] text-white hover:bg-[var(--ach)] px-3 py-1.5',
    outline: 'border border-[var(--bd)] bg-transparent text-[var(--tx1)] hover:bg-[var(--bg-s2)] px-3 py-1.5',
    ghost: 'bg-transparent text-[var(--tx2)] hover:bg-[var(--bg-s2)] hover:text-[var(--tx1)] px-2 py-1',
  }
  return <button className={cn(base, variants[variant], className)} {...props} />
}
