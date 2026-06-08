import ProviderLogo from './ProviderLogo'

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

interface Props {
  provider: string
  showLogo?: boolean
}

export default function ProviderBadge({ provider, showLogo = true }: Props) {
  const cfg     = BADGE_CFG[provider] ?? { label: provider, color: '#8B8AAE' }
  const bg      = cfg.color + '14'
  const border  = cfg.color + '30'

  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap"
      style={{
        color: cfg.color, backgroundColor: bg, border: `1px solid ${border}`,
        padding: '3px 8px', borderRadius: '99px',
        fontSize: '11px', fontWeight: 500, letterSpacing: '0.01em',
      }}
    >
      {showLogo && <ProviderLogo provider={provider} size={11} />}
      {cfg.label}
    </span>
  )
}
