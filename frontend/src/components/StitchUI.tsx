import { styled, pulseRing } from '../stitches.config';

// ── Layout & Structure ───────────────────────────────────────────────────────

export const Flex = styled('div', {
  display: 'flex',
  variants: {
    direction: {
      row:    { flexDirection: 'row' },
      column: { flexDirection: 'column' },
    },
    align: {
      start:   { alignItems: 'flex-start' },
      center:  { alignItems: 'center' },
      end:     { alignItems: 'flex-end' },
      stretch: { alignItems: 'stretch' },
    },
    justify: {
      start:   { justifyContent: 'flex-start' },
      center:  { justifyContent: 'center' },
      end:     { justifyContent: 'flex-end' },
      between: { justifyContent: 'space-between' },
    },
    gap: {
      1: { gap: '$1' },
      2: { gap: '$2' },
      3: { gap: '$3' },
      4: { gap: '$4' },
      5: { gap: '$5' },
      6: { gap: '$6' },
      8: { gap: '$8' },
    },
    wrap: {
      true:  { flexWrap: 'wrap' },
      false: { flexWrap: 'nowrap' },
    },
  },
  defaultVariants: {
    direction: 'row',
    align:     'stretch',
    justify:   'start',
    wrap:      'false',
  },
});

export const Grid = styled('div', {
  display: 'grid',
  variants: {
    columns: {
      1:    { gridTemplateColumns: 'repeat(1, minmax(0, 1fr))' },
      2:    { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' },
      3:    { gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' },
      4:    { gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' },
      auto: { gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' },
    },
    gap: {
      1: { gap: '$1' },
      2: { gap: '$2' },
      3: { gap: '$3' },
      4: { gap: '$4' },
      5: { gap: '$5' },
      6: { gap: '$6' },
      8: { gap: '$8' },
    },
  },
  defaultVariants: {
    columns: 1,
    gap: 4,
  },
});

export const Card = styled('div', {
  backgroundColor: '$bgS1',
  border: '1px solid $border',
  borderRadius: '$lg',
  boxShadow: '$card',
  padding: '$5',
  transition: 'border-color 180ms ease, box-shadow 180ms ease',
  variants: {
    hoverable: {
      true: {
        '&:hover': {
          borderColor: '$cardHoverBorder',
          boxShadow: '0 2px 12px rgba(0,0,0,0.3), 0 0 0 1px var(--ac-bd)',
        },
      },
    },
    glass: {
      true: {
        backgroundColor: '$glassBg',
        backdropFilter: 'blur(24px) saturate(160%)',
        webkitBackdropFilter: 'blur(24px) saturate(160%)',
        border: '1px solid $glassBorder',
        boxShadow: '$glass',
      },
    },
    modal: {
      true: {
        backgroundColor: '$glassBg',
        backdropFilter: 'blur(24px) saturate(160%)',
        webkitBackdropFilter: 'blur(24px) saturate(160%)',
        border: '1px solid $glassBorder',
        boxShadow: '$modal',
      },
    },
  },
});

// ── Typography ───────────────────────────────────────────────────────────────

export const Heading = styled('h2', {
  fontFamily: '$display',
  color: '$tx1',
  margin: 0,
  fontStyle: 'italic',
  variants: {
    level: {
      h1: { fontSize: '2rem',   fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.1 },
      h2: { fontSize: '1.4rem', fontWeight: 600, letterSpacing: '-0.015em', lineHeight: 1.2 },
      h3: { fontSize: '1.15rem', fontWeight: 600, lineHeight: 1.3 },
      h4: { fontSize: '1rem',   fontWeight: 600, lineHeight: 1.4 },
    },
  },
  defaultVariants: {
    level: 'h2',
  },
});

export const Text = styled('p', {
  fontFamily: '$sans',
  margin: 0,
  variants: {
    variant: {
      body:       { fontSize: '$sm',  color: '$tx1', fontWeight: 400 },
      muted:      { fontSize: '$sm',  color: '$tx2', fontWeight: 400 },
      small:      { fontSize: '$xs',  color: '$tx2', fontWeight: 400 },
      smallMuted: { fontSize: '$xs',  color: '$tx3', fontWeight: 400 },
      label: {
        fontSize: '10px',
        color: '$tx3',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.10em',
        fontFamily: "'JetBrains Mono', monospace",
        fontStyle: 'normal',
      },
    },
  },
  defaultVariants: {
    variant: 'body',
  },
});

// ── Form Elements ────────────────────────────────────────────────────────────

export const Input = styled('input', {
  width: '100%',
  backgroundColor: '$bgS2',
  border: '1px solid $border',
  borderRadius: '$sm',
  padding: '0.5rem 0.75rem',
  fontSize: '$sm',
  color: '$tx1',
  transition: 'all 150ms ease',
  outline: 'none',
  fontFamily: '$sans',
  '&::placeholder': { color: '$tx3' },
  '&:focus': {
    borderColor: '$accent',
    boxShadow: '0 0 0 2px var(--ac-bg)',
  },
});

export const Select = styled('select', {
  width: '100%',
  backgroundColor: '$bgS2',
  border: '1px solid $border',
  borderRadius: '$sm',
  padding: '0.5rem 0.75rem',
  fontSize: '$sm',
  color: '$tx1',
  transition: 'all 150ms ease',
  outline: 'none',
  cursor: 'pointer',
  '&:focus': {
    borderColor: '$accent',
    boxShadow: '0 0 0 2px var(--ac-bg)',
  },
  '& option': {
    backgroundColor: 'var(--select-bg)',
    color: '$tx1',
  },
});

export const Textarea = styled('textarea', {
  width: '100%',
  backgroundColor: '$bgS2',
  border: '1px solid $border',
  borderRadius: '$sm',
  padding: '0.5rem 0.75rem',
  fontSize: '$sm',
  color: '$tx1',
  transition: 'all 150ms ease',
  outline: 'none',
  fontFamily: '$sans',
  '&::placeholder': { color: '$tx3' },
  '&:focus': {
    borderColor: '$accent',
    boxShadow: '0 0 0 2px var(--ac-bg)',
  },
});

// ── Buttons ──────────────────────────────────────────────────────────────────

export const Button = styled('button', {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '$2',
  borderRadius: '$sm',
  fontSize: '$sm',
  fontWeight: 600,
  letterSpacing: '0.02em',
  transition: 'all 140ms ease',
  cursor: 'pointer',
  border: 'none',
  outline: 'none',
  fontFamily: '$sans',
  '&:disabled': {
    opacity: 0.38,
    cursor: 'not-allowed',
  },
  variants: {
    intent: {
      primary: {
        backgroundColor: '$accent',
        color: '$btnFg',
        '&:hover:not(:disabled)': {
          backgroundColor: '$accentHover',
          boxShadow: '0 2px 8px var(--ac-glow)',
        },
      },
      secondary: {
        backgroundColor: '$bgS2',
        color: '$tx1',
        border: '1px solid $border',
        '&:hover:not(:disabled)': {
          backgroundColor: '$bgS3',
          borderColor: '$borderStrong',
        },
      },
      danger: {
        backgroundColor: '$statusRed',
        color: '#ffffff',
        '&:hover:not(:disabled)': { opacity: 0.88 },
      },
      ghost: {
        backgroundColor: 'transparent',
        color: '$tx2',
        border: '1px solid $border',
        '&:hover:not(:disabled)': {
          backgroundColor: '$bgS3',
          color: '$tx1',
          borderColor: '$borderStrong',
        },
      },
      glass: {
        backgroundColor: 'rgba(200, 136, 58, 0.04)',
        border: '1px solid var(--ac-bd)',
        color: '$accent',
        '&:hover:not(:disabled)': {
          backgroundColor: 'var(--ac-bg)',
          boxShadow: '0 0 12px var(--ac-glow)',
        },
      },
    },
    size: {
      sm: { padding: '0.3rem 0.65rem', fontSize: '$xs' },
      md: { padding: '0.45rem 0.9rem', fontSize: '$sm' },
      lg: { padding: '0.65rem 1.4rem', fontSize: '$base' },
    },
  },
  defaultVariants: {
    intent: 'secondary',
    size:   'md',
  },
});

// ── Badges & Status ──────────────────────────────────────────────────────────

export const Badge = styled('span', {
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
  variants: {
    status: {
      green: {
        backgroundColor: '$statusGreenBg',
        color: '$statusGreen',
        border: '1px solid $statusGreenBorder',
      },
      red: {
        backgroundColor: '$statusRedBg',
        color: '$statusRed',
        border: '1px solid $statusRedBorder',
      },
      yellow: {
        backgroundColor: '$statusYellowBg',
        color: '$statusYellow',
        border: '1px solid $statusYellowBorder',
      },
      gray: {
        backgroundColor: '$statusGrayBg',
        color: '$statusGray',
        border: '1px solid $statusGrayBorder',
      },
      primary: {
        backgroundColor: '$accentBg',
        color: '$accent',
        border: '1px solid $accentBorder',
      },
    },
  },
  defaultVariants: {
    status: 'gray',
  },
});

export const StatusDot = styled('div', {
  width: '7px',
  height: '7px',
  borderRadius: '$full',
  flexShrink: 0,
  variants: {
    running: {
      true: {
        backgroundColor: '$statusGreen',
        animation: `${pulseRing} 2.5s ease-in-out infinite`,
      },
      false: {
        backgroundColor: '$statusGray',
      },
    },
  },
});

// ── Tables ───────────────────────────────────────────────────────────────────

export const TableContainer = styled('div', {
  width: '100%',
  overflowX: 'auto',
  borderRadius: '$lg',
  border: '1px solid $border',
  boxShadow: '$card',
  backgroundColor: '$bgS1',
});

export const Table = styled('table', {
  width: '100%',
  borderCollapse: 'collapse',
  textAlign: 'left',
});

export const THead = styled('thead', {
  backgroundColor: '$bgS2',
  borderBottom: '1px solid $border',
});

export const TH = styled('th', {
  padding: '0.625rem 1.25rem',
  fontSize: '10px',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  color: '$tx3',
  whiteSpace: 'nowrap',
  fontFamily: "'JetBrains Mono', monospace",
});

export const TBody = styled('tbody', {
  '& tr': {
    borderBottom: '1px solid $border',
    transition: 'background-color 120ms ease',
    '&:hover': { backgroundColor: '$bgS2' },
    '&:last-child': { borderBottom: 'none' },
  },
});

export const TD = styled('td', {
  padding: '0.75rem 1.25rem',
  fontSize: '$sm',
  color: '$tx1',
});
