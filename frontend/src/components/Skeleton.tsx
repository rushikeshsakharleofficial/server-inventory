export function SkeletonText({
  width = 'w-full',
  height = 'h-4',
}: {
  width?: string
  height?: string
}) {
  return <span className={`skeleton block ${width} ${height}`} aria-hidden="true" />
}

export function SkeletonCard() {
  return (
    <div className="card-dark p-5 flex items-center gap-4" aria-hidden="true">
      <div className="skeleton w-11 h-11 rounded-xl flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <SkeletonText width="w-16" height="h-3" />
        <SkeletonText width="w-20" height="h-7" />
        <SkeletonText width="w-28" height="h-3" />
      </div>
    </div>
  )
}

export function SkeletonTableRow() {
  const widths = [140, 80, 72, 96, 76, 108, 108, 36, 48, 80, 112, 32]
  return (
    <tr className="border-b border-border" aria-hidden="true">
      {widths.map((w, i) => (
        <td key={i} className="px-4 py-3.5">
          <span className="skeleton block h-4" style={{ width: w }} />
        </td>
      ))}
    </tr>
  )
}

export function SkeletonTableRows({ count = 8 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonTableRow key={i} />
      ))}
    </>
  )
}
