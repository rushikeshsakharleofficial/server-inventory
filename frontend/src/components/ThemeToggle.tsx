import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../hooks/useTheme'

export default function ThemeToggle() {
  const { theme, toggle } = useTheme()
  const isDark = theme === 'dark'

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Light mode' : 'Dark mode'}
      className="relative w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors duration-150"
      style={{
        background: 'var(--nav-active-bg)',
        border: '1px solid var(--bd)',
      }}
    >
      <Sun
        size={15}
        aria-hidden="true"
        style={{
          position: 'absolute',
          color: '#EAB308',
          opacity: isDark ? 0 : 1,
          transform: isDark ? 'rotate(-90deg) scale(0.4)' : 'rotate(0deg) scale(1)',
          transition: 'opacity 250ms ease, transform 250ms ease',
        }}
      />
      <Moon
        size={15}
        aria-hidden="true"
        style={{
          position: 'absolute',
          color: 'var(--tx2)',
          opacity: isDark ? 1 : 0,
          transform: isDark ? 'rotate(0deg) scale(1)' : 'rotate(90deg) scale(0.4)',
          transition: 'opacity 250ms ease, transform 250ms ease',
        }}
      />
    </button>
  )
}
