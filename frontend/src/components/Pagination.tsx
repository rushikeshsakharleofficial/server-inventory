import { Flex, Button, Text } from './StitchUI'

export function Pagination({ page, total, pageSize, onPage }: {
  page: number
  total: number
  pageSize: number
  onPage: (p: number) => void
}) {
  const totalPages = Math.ceil(total / pageSize)
  if (totalPages <= 1) return null
  return (
    <Flex
      align="center"
      justify="between"
      style={{ padding: '12px 24px', borderTop: '1px solid var(--bd)', backgroundColor: 'var(--bg-s1)' }}
    >
      <Text variant="small" style={{ fontFamily: 'monospace' }}>
        Page {page} of {totalPages} · {total} total
      </Text>
      <Flex align="center" gap={1}>
        <Button
          intent="ghost"
          onClick={() => onPage(Math.max(1, page - 1))}
          disabled={page === 1}
          size="sm"
          style={{ padding: '6px 12px' }}
        >
          Prev
        </Button>
        {Array.from({ length: Math.min(totalPages, 7) }).map((_, i) => {
          const p = i + 1
          return (
            <button
              key={p}
              onClick={() => onPage(p)}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 600,
                transition: 'all 150ms ease',
                backgroundColor: page === p ? 'var(--ac)' : 'transparent',
                color: page === p ? 'var(--btn-primary-fg)' : 'var(--tx2)',
              }}
              onMouseEnter={e => {
                if (page !== p) {
                  e.currentTarget.style.backgroundColor = 'var(--bg-s3)'
                  e.currentTarget.style.color = 'var(--tx1)'
                }
              }}
              onMouseLeave={e => {
                if (page !== p) {
                  e.currentTarget.style.backgroundColor = 'transparent'
                  e.currentTarget.style.color = 'var(--tx2)'
                }
              }}
            >
              {p}
            </button>
          )
        })}
        <Button
          intent="ghost"
          onClick={() => onPage(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          size="sm"
          style={{ padding: '6px 12px' }}
        >
          Next
        </Button>
      </Flex>
    </Flex>
  )
}
