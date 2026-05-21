import { styled, pulseRing } from '../stitches.config';

// ── Layout & Structure ───────────────────────────────────────────────────────

export const Flex = styled('div', {
  display: 'flex',
  variants: {
    direction: {
      row: { flexDirection: 'row' },
      column: { flexDirection: 'column' },
    },
    align: {
      start: { alignItems: 'flex-start' },
      center: { alignItems: 'center' },
      end: { alignItems: 'flex-end' },
      stretch: { alignItems: 'stretch' },
    },
    justify: {
      start: { justifyContent: 'flex-start' },
      center: { justifyContent: 'center' },
      end: { justifyContent: 'flex-end' },
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
      true: { flexWrap: 'wrap' },
      false: { flexWrap: 'nowrap' },
    },
  },
  defaultVariants: {
    direction: 'row',
    align: 'stretch',
    justify: 'start',
    wrap: 'false',
  },
});

export const Grid = styled('div', {
  display: 'grid',
  variants: {
    columns: {
      1: { gridTemplateColumns: 'repeat(1, minmax(0, 1fr))' },
      2: { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' },
      3: { gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' },
      4: { gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' },
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
  transition: 'border-color 200ms ease, box-shadow 200ms ease',
  variants: {
    hoverable: {
      true: {
        '&:hover': {
          borderColor: '$cardHoverBorder',
        },
      },
    },
    glass: {
      true: {
        backgroundColor: '$glassBg',
        backdropFilter: 'blur(32px) saturate(180%)',
        webkitBackdropFilter: 'blur(32px) saturate(180%)',
        border: '1px solid $glassBorder',
        boxShadow: '$glass',
      },
    },
    modal: {
      true: {
        backgroundColor: '$glassBg',
        backdropFilter: 'blur(32px) saturate(180%)',
        webkitBackdropFilter: 'blur(32px) saturate(180%)',
        border: '1px solid $glassBorder',
        boxShadow: '$modal',
      },
    },
  },
});

// ── Typography ───────────────────────────────────────────────────────────────

export const Heading = styled('h2', {
  fontFamily: '$sans',
  color: '$tx1',
  margin: 0,
  variants: {
    level: {
      h1: { fontSize: '$2xl', fontWeight: 800, tracking: '-0.025em' },
      h2: { fontSize: '$xl', fontWeight: 700, tracking: '-0.02em' },
      h3: { fontSize: '$lg', fontWeight: 600 },
      h4: { fontSize: '$base', fontWeight: 600 },
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
      body: { fontSize: '$sm', color: '$tx1', fontWeight: 400 },
      muted: { fontSize: '$sm', color: '$tx2', fontWeight: 400 },
      small: { fontSize: '$xs', color: '$tx2', fontWeight: 400 },
      smallMuted: { fontSize: '$xs', color: '$tx3', fontWeight: 400 },
      label: { fontSize: '$xs', color: '$tx3', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' },
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
  borderRadius: '$md',
  padding: '0.5rem 0.75rem',
  fontSize: '$sm',
  color: '$tx1',
  transition: 'all 150ms ease',
  outline: 'none',
  '&::placeholder': {
    color: '$tx3',
  },
  '&:focus': {
    borderColor: '$accent',
    boxShadow: '0 0 0 1px var(--ac)',
  },
});

export const Select = styled('select', {
  width: '100%',
  backgroundColor: '$bgS2',
  border: '1px solid $border',
  borderRadius: '$md',
  padding: '0.5rem 0.75rem',
  fontSize: '$sm',
  color: '$tx1',
  transition: 'all 150ms ease',
  outline: 'none',
  cursor: 'pointer',
  '&:focus': {
    borderColor: '$accent',
    boxShadow: '0 0 0 1px var(--ac)',
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
  borderRadius: '$md',
  padding: '0.5rem 0.75rem',
  fontSize: '$sm',
  color: '$tx1',
  transition: 'all 150ms ease',
  outline: 'none',
  fontFamily: '$sans',
  '&::placeholder': {
    color: '$tx3',
  },
  '&:focus': {
    borderColor: '$accent',
    boxShadow: '0 0 0 1px var(--ac)',
  },
});

// ── Buttons & Clickables ─────────────────────────────────────────────────────

export const Button = styled('button', {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '$2',
  borderRadius: '$md',
  fontSize: '$sm',
  fontWeight: 700,
  transition: 'all 150ms ease',
  cursor: 'pointer',
  border: 'none',
  outline: 'none',
  '&:disabled': {
    opacity: 0.4,
    cursor: 'not-allowed',
  },
  variants: {
    intent: {
      primary: {
        backgroundColor: '$accent',
        color: '$btnFg',
        '&:hover:not(:disabled)': {
          backgroundColor: '$accentHover',
        },
      },
      secondary: {
        backgroundColor: '$bgS2',
        color: '$tx1',
        border: '1px solid $border',
        '&:hover:not(:disabled)': {
          backgroundColor: '$bgS3',
        },
      },
      danger: {
        backgroundColor: '$statusRed',
        color: '#ffffff',
        '&:hover:not(:disabled)': {
          opacity: 0.9,
        },
      },
      ghost: {
        backgroundColor: 'transparent',
        color: '$tx2',
        border: '1px solid $border',
        '&:hover:not(:disabled)': {
          backgroundColor: '$bgS3',
          color: '$tx1',
        },
      },
      glass: {
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid $border',
        color: '$tx1',
        backdropFilter: 'blur(8px)',
        '&:hover:not(:disabled)': {
          backgroundColor: 'rgba(255, 255, 255, 0.08)',
          borderColor: '$accent',
        },
      },
    },
    size: {
      sm: {
        padding: '0.375rem 0.75rem',
        fontSize: '$xs',
      },
      md: {
        padding: '0.5rem 1rem',
        fontSize: '$sm',
      },
      lg: {
        padding: '0.75rem 1.5rem',
        fontSize: '$base',
      },
    },
  },
  defaultVariants: {
    intent: 'secondary',
    size: 'md',
  },
});

// ── Badges & Status Indicators ───────────────────────────────────────────────

export const Badge = styled('span', {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0.125rem 0.5rem',
  borderRadius: '$full',
  fontSize: '$xs',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
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
  width: '8px',
  height: '8px',
  borderRadius: '$full',
  flexShrink: 0,
  variants: {
    running: {
      true: {
        backgroundColor: '$statusGreen',
        animation: `${pulseRing} 2s ease-in-out infinite`,
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
  padding: '$3 $5',
  fontSize: '10px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  color: '$tx3',
  whiteSpace: 'nowrap',
});

export const TBody = styled('tbody', {
  '& tr': {
    borderBottom: '1px solid $border',
    transition: 'background-color 150ms ease',
    '&:hover': {
      backgroundColor: '$bgS2',
    },
    '&:last-child': {
      borderBottom: 'none',
    },
  },
});

export const TD = styled('td', {
  padding: '$4 $5',
  fontSize: '$sm',
  color: '$tx1',
});
