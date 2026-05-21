interface Props {
  provider: string
  size?: number
  className?: string
}

const LOGO_FILES: Record<string, string> = {
  aws:          '/logos/aws.svg',
  gcp:          '/logos/gcp.svg',
  azure:        '/logos/azure.svg',
  linode:       '/logos/linode.svg',
  digitalocean: '/logos/digitalocean.svg',
  ovh:          '/logos/ovh.svg',
}

export default function ProviderLogo({ provider, size = 20, className = '' }: Props) {
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

  // Fallback for custom_dc and unknown providers — inline SVG server icon
  const color = provider === 'custom_dc' ? '#8B5CF6' : '#8B8AAE'
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
