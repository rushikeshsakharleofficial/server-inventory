/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // All reference CSS custom properties — both themes handled in index.css
        base: 'var(--bg-base)',
        surface: {
          1: 'var(--bg-s1)',
          2: 'var(--bg-s2)',
          3: 'var(--bg-s3)',
        },
        border: {
          DEFAULT: 'var(--bd)',
          strong:  'var(--bd-strong)',
          bright:  'var(--bd-strong)',
        },
        ink: {
          primary:   'var(--tx1)',
          secondary: 'var(--tx2)',
          muted:     'var(--tx3)',
          dim:       'var(--txd)',
        },
        accent: {
          DEFAULT: 'var(--ac)',
          hover:   'var(--ach)',
          subtle:  'var(--acs)',
        },
        status: {
          green:      'var(--sg)',
          'green-dim':'var(--sg-bg)',
          red:        'var(--sr)',
          'red-dim':  'var(--sr-bg)',
          yellow:     'var(--sy)',
          'yellow-dim':'var(--sy-bg)',
          gray:       'var(--sgr)',
          'gray-dim': 'var(--sgr-bg)',
        },
        // Provider brand colours stay fixed — not system colours
        provider: {
          aws:    '#FF9900',
          gcp:    '#4285F4',
          azure:  '#0078D4',
          linode: '#02B159',
          do:     '#0080FF',
          ovh:    '#123F6D',
          custom: '#8B5CF6',
        },
      },
      fontFamily: {
        sans:    ['"DM Sans"', 'system-ui', 'sans-serif'],
        display: ['Syne', 'system-ui', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        glass:        'var(--shadow-glass)',
        card:         'var(--shadow-card)',
        'accent-glow':'0 0 28px var(--ac-glow)',
        'green-glow': '0 0 16px var(--sg-glow)',
        modal:        'var(--shadow-modal)',
      },
      animation: {
        'pulse-ring':      'pulse-ring 2s ease-in-out infinite',
        'skeleton-shimmer':'skeleton-shimmer 1.8s ease-in-out infinite',
        'slide-up':        'slide-up 0.22s cubic-bezier(0.16,1,0.3,1)',
        'fade-in':         'fade-in 0.18s ease-out',
        'toast-in':        'toast-in 0.28s cubic-bezier(0.16,1,0.3,1)',
        'toast-out':       'toast-out 0.18s ease-in forwards',
      },
      keyframes: {
        'pulse-ring': {
          '0%':   { boxShadow: '0 0 0 0 var(--sg-glow)' },
          '70%':  { boxShadow: '0 0 0 8px transparent'  },
          '100%': { boxShadow: '0 0 0 0 transparent'    },
        },
        'skeleton-shimmer': {
          '0%':   { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition:  '400px 0' },
        },
        'slide-up': {
          '0%':   { opacity: '0', transform: 'translateY(14px) scale(0.97)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)'       },
        },
        'fade-in': {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'toast-in': {
          '0%':   { opacity: '0', transform: 'translateX(110%) scale(0.93)' },
          '100%': { opacity: '1', transform: 'translateX(0) scale(1)'       },
        },
        'toast-out': {
          '0%':   { opacity: '1', transform: 'translateX(0) scale(1)'       },
          '100%': { opacity: '0', transform: 'translateX(110%) scale(0.93)' },
        },
      },
    },
  },
  plugins: [],
}
