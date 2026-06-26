const LOGO_FILES: Record<string, string> = {
  aws:          '/logos/aws.svg',
  gcp:          '/logos/gcp.svg',
  azure:        '/logos/azure.svg',
  linode:       '/logos/linode.svg',
  digitalocean: '/logos/digitalocean.svg',
  ovh:          '/logos/ovh.svg',
  hivelocity:   '/logos/hivelocity.svg',
}

const FALLBACK_COLORS: Record<string, string> = {
  custom_dc: '#8B5CF6',
}

export function ProviderLogo({ provider, size = 20, className = '' }: {
  provider: string
  size?: number
  className?: string
}) {
  const src = LOGO_FILES[provider]
  if (src) {
    return (
      <img
        src={src}
        alt={provider}
        width={size}
        height={size}
        className={`object-contain shrink-0 ${className}`}
        style={{ maxWidth: size, maxHeight: size }}
        loading="lazy"
        decoding="async"
      />
    )
  }
  const color = FALLBACK_COLORS[provider] ?? '#8B8AAE'
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-label={provider}
      className={`shrink-0 ${className}`}
    >
      <rect x="3" y="4"  width="18" height="5" rx="1.5" stroke={color} strokeWidth="1.4"/>
      <rect x="3" y="10" width="18" height="5" rx="1.5" stroke={color} strokeWidth="1.4"/>
      <rect x="3" y="16" width="18" height="4" rx="1.5" stroke={color} strokeWidth="1.4"/>
      <circle cx="18.5" cy="6.5"  r="0.9" fill="#22C55E"/>
      <circle cx="18.5" cy="12.5" r="0.9" fill="#22C55E"/>
      <circle cx="18.5" cy="18"   r="0.9" fill="#EAB308"/>
    </svg>
  )
}

const BADGE_CFG: Record<string, { label: string; color: string }> = {
  aws:          { label: 'AWS',          color: '#FF9900' },
  gcp:          { label: 'GCP',          color: '#4285F4' },
  azure:        { label: 'Azure',        color: '#0078D4' },
  linode:       { label: 'Linode',       color: '#02B159' },
  digitalocean: { label: 'DigitalOcean', color: '#0080FF' },
  ovh:          { label: 'OVH',          color: '#123F6D' },
  hivelocity:   { label: 'Hivelocity',   color: '#E84545' },
  custom_dc:    { label: 'Custom DC',    color: '#8B5CF6' },
}

export default function ProviderBadge({ provider, showLogo = true }: {
  provider: string
  showLogo?: boolean
}) {
  const cfg    = BADGE_CFG[provider] ?? { label: provider, color: '#8B8AAE' }
  const bg     = cfg.color + '14'
  const border = cfg.color + '30'

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-[10px] font-bold uppercase whitespace-nowrap tracking-tight"
      style={{ color: cfg.color, backgroundColor: bg, border: `1px solid ${border}` }}
    >
      {showLogo && <ProviderLogo provider={provider} size={11} />}
      {cfg.label}
    </span>
  )
}
