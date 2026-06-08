import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { X, RefreshCw, Map } from 'lucide-react'
import { styled } from '../stitches.config'
import { serversApi, sshCredentialsApi, getErrorMessage } from '../api'
import { useToast } from '../hooks/useToast'
import ProviderBadge from './ProviderBadge'
import ResourceMapModal from './ResourceMapModal'
import type { Server, ServerStatus } from '../types'
import { Card, Button, Flex, Grid, Heading, Text, Select, Badge, StatusDot } from './StitchUI'

interface Props {
  server: Server
  onClose: () => void
  onServerUpdated?: (server: Server) => void
  inline?: boolean
}

function fmt(d?: string) {
  if (!d) return '-'
  return new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

function getStatusVariant(status: ServerStatus): 'green' | 'red' | 'yellow' | 'gray' {
  if (status === 'running') return 'green';
  if (status === 'stopped') return 'red';
  if (status === 'pending') return 'yellow';
  return 'gray';
}

const ModalBackdrop = styled('div', {
  position: 'fixed',
  inset: 0,
  zIndex: 50,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '$4',
  backgroundColor: 'rgba(0, 0, 0, 0.72)',
  backdropFilter: 'blur(8px)',
  animation: 'fadeIn 200ms ease-out',
  '@keyframes fadeIn': {
    from: { opacity: 0 },
    to: { opacity: 1 },
  },
});

const ModalContent = styled(Card, {
  width: '100%',
  maxWidth: '640px',
  maxHeight: '90vh',
  display: 'flex',
  flexDirection: 'column',
  padding: 0,
  overflow: 'hidden',
  boxShadow: '$modal',
  animation: 'slideUp 250ms cubic-bezier(0.16, 1, 0.3, 1)',
  '@keyframes slideUp': {
    from: { transform: 'translateY(16px)', opacity: 0 },
    to: { transform: 'translateY(0)', opacity: 1 },
  },
  variants: {
    inline: {
      true: {
        maxWidth: 'none',
        maxHeight: 'none',
        boxShadow: 'none',
        border: '1px solid $border',
        animation: 'fadeIn 200ms ease-out',
      },
    },
  },
});

const ModalHeader = styled(Flex, {
  padding: '$4 $6',
  borderBottom: '1px solid $border',
});

const ScrollableContent = styled('div', {
  overflowY: 'visible',
  padding: '$6',
  display: 'flex',
  flexDirection: 'column',
  gap: '$5',
});

const ModalFooter = styled(Flex, {
  padding: '$4 $6',
  borderTop: '1px solid $border',
  backgroundColor: '$bgS2',
});

const DetailSection = styled('div', {
  border: '1px solid $border',
  borderRadius: '$lg',
  padding: '$5',
  backgroundColor: '$bgS1',
  display: 'flex',
  flexDirection: 'column',
  gap: '$4',
  transition: 'border-color 200ms ease',
  '&:hover': {
    borderColor: '$cardHoverBorder',
  },
});

const FieldWrapper = styled('div', {
  display: 'flex',
  flexDirection: 'column',
  gap: '$0.5',
});

const FieldLabel = styled(Text, {
  fontSize: '10px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: '$tx3',
});

const FieldValue = styled(Text, {
  fontSize: '$sm',
  color: '$tx1',
  wordBreak: 'break-all',
  variants: {
    mono: {
      true: {
        fontFamily: 'monospace',
        fontSize: '0.75rem',
      },
    },
  },
});

const SSHInfoPanel = styled('div', {
  backgroundColor: '$bgS2',
  border: '1px solid $border',
  borderRadius: '$md',
  padding: '$4',
  display: 'flex',
  flexDirection: 'column',
  gap: '$3',
});

const TagBadge = styled('span', {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '$1',
  fontSize: '0.75rem',
  fontFamily: 'monospace',
  padding: '$1 $2',
  borderRadius: '$md',
  backgroundColor: '$accentBg',
  color: '$accent',
  border: '1px solid $accentBorder',
});

function Field({ label, value, mono = false }: { label: string; value?: React.ReactNode; mono?: boolean }) {
  return (
    <FieldWrapper>
      <FieldLabel>{label}</FieldLabel>
      <FieldValue mono={mono}>
        {value ?? <span style={{ color: 'var(--tx3)' }}>-</span>}
      </FieldValue>
    </FieldWrapper>
  )
}

export default function ServerDetailModal({ server, onClose, onServerUpdated, inline = false }: Props) {
  const qc = useQueryClient()
  const { toast } = useToast()
  const [selectedCredentialId, setSelectedCredentialId] = useState('')
  const [showMap, setShowMap] = useState(false)
  const [sshError, setSshError] = useState<string | null>(null)

  const { data: sshCredentials = [], isLoading: isLoadingSshCredentials } = useQuery({
    queryKey: ['ssh-credentials'],
    queryFn: sshCredentialsApi.list,
    enabled: server.provider === 'custom_dc',
  })

  useEffect(() => {
    if (selectedCredentialId || sshCredentials.length === 0) return
    const preferred = sshCredentials.find(cred => cred.is_default) ?? sshCredentials[0]
    if (preferred) setSelectedCredentialId(String(preferred.id))
  }, [selectedCredentialId, sshCredentials])

  useEffect(() => {
    setSshError(null)
  }, [selectedCredentialId])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const sshSyncMutation = useMutation({
    mutationFn: () => serversApi.sshSync(server.id, Number(selectedCredentialId)),
    onSuccess: updatedServer => {
      setSshError(null)
      toast.success('SSH sync complete')
      qc.invalidateQueries({ queryKey: ['servers'] })
      onServerUpdated?.(updatedServer)
    },
    onError: (error: unknown) => {
      const msg = getErrorMessage(error)
      setSshError(msg)
      toast.error(`SSH sync failed: ${msg}`)
    },
  })

  const trustMutation = useMutation({
    mutationFn: () =>
      serversApi.trustHostKey(server.id, Number(selectedCredentialId)),
    onSuccess: () => {
      setSshError(null)
      toast.success('Host key trusted — retrying SSH sync…')
      setTimeout(() => sshSyncMutation.mutate(), 500)
    },
    onError: (error: unknown) => {
      toast.error(`Failed to trust host: ${getErrorMessage(error)}`)
    },
  })

  const hasTags = Object.keys(server.tags ?? {}).length > 0
  const hasExtra = Object.keys(server.extra ?? {}).length > 0
  const sshInfo = server.ssh_info as Record<string, unknown> | undefined
  const sshIps = Array.isArray(sshInfo?.all_ips)
    ? sshInfo.all_ips as string[]
    : Array.isArray(sshInfo?.ips)
      ? sshInfo.ips as string[]
      : []

  const renderContent = (
    <ModalContent modal={!inline} inline={inline} onClick={e => e.stopPropagation()}>
      {/* Header */}
      <ModalHeader align="center" justify="between">
        <Flex align="center" gap={3} style={{ flexWrap: 'wrap', minWidth: 0 }}>
          <Flex direction="column" gap={1} style={{ minWidth: 0 }}>
            <Heading level="h2" style={{ fontSize: '1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {server.name}
            </Heading>
            {server.hostname && (
              <Text variant="small" style={{ fontFamily: 'monospace', color: 'var(--tx3)' }}>
                {server.hostname}
              </Text>
            )}
          </Flex>
          <ProviderBadge provider={server.provider} />
          <Badge status={getStatusVariant(server.status)}>
            {server.status === 'running' && (
              <StatusDot running style={{ marginRight: '6px' }} />
            )}
            {server.status}
          </Badge>
        </Flex>
        {!inline && (
          <Button intent="ghost" size="sm" onClick={onClose} aria-label="Close" style={{ padding: '0.375rem', borderRadius: '8px' }}>
            <X size={16} />
          </Button>
        )}
      </ModalHeader>

      {/* Scrollable Content */}
      <ScrollableContent>
        {/* Identity */}
        <DetailSection>
          <Text variant="label" style={{ color: 'var(--tx3)' }}>Identity</Text>
          <Grid columns={2} gap={3}>
            <Field label="ID" value={String(server.id)} />
            <Field label="Cloud ID" value={server.cloud_id} />
            <Field label="Name" value={server.name} />
            <Field label="Hostname" value={server.hostname} />
            <Field label="Provider" value={server.provider} />
            <Field label="Status" value={server.status} />
          </Grid>
        </DetailSection>

        {/* Network */}
        <DetailSection>
          <Text variant="label" style={{ color: 'var(--tx3)' }}>Network</Text>
          <Grid columns={2} gap={3}>
            <Field label="Public IP" value={server.public_ip} mono />
            <Field label="Private IP" value={server.private_ip} mono />
          </Grid>
          {sshIps.length > 0 && (
            <div style={{ marginTop: '10px' }}>
              <Text variant="label" style={{ fontSize: '11px', color: 'var(--tx3)', marginBottom: '6px', display: 'block' }}>All Interfaces</Text>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {sshIps.map((ip, i) => (
                  <span key={i} style={{ fontSize: '11px', fontFamily: 'monospace', background: 'var(--bg-s2)', border: '1px solid var(--bd)', borderRadius: '4px', padding: '2px 6px', color: 'var(--tx2)' }}>
                    {ip}
                  </span>
                ))}
              </div>
            </div>
          )}
        </DetailSection>

        {/* Resources */}
        <DetailSection>
          <Text variant="label" style={{ color: 'var(--tx3)' }}>Resources</Text>
          <Grid columns={2} gap={3}>
            <Field label="vCPU" value={server.vcpu != null ? String(server.vcpu) : undefined} />
            <Field label="Memory (GB)" value={server.memory_gb != null ? String(server.memory_gb) : undefined} />
            <Field label="Storage (GB)" value={server.storage_gb != null ? String(server.storage_gb) : undefined} />
            <Field label="OS" value={server.os} />
            <Field label="Instance Type" value={server.instance_type} />
            <Field label="Region" value={server.region} />
            <Field label="Zone" value={server.zone} />
            <Field label="Datacenter" value={server.datacenter} />
          </Grid>
        </DetailSection>

        {/* SSH Info */}
        {sshInfo && (
          <DetailSection>
            <Text variant="label" style={{ color: 'var(--tx3)' }}>SSH Info</Text>
            <SSHInfoPanel>
              {sshIps.length > 0 && (
                <div>
                  <Text variant="label" style={{ fontSize: '10px', color: 'var(--tx3)', marginBottom: '6px' }}>IPs</Text>
                  <Flex gap={2} wrap>
                    {sshIps.map(ip => (
                      <TagBadge key={ip}>{ip}</TagBadge>
                    ))}
                  </Flex>
                </div>
              )}
              <Grid columns={2} gap={3}>
                {sshInfo.cpu_count != null && (
                  <Field label="CPU Count" value={String(sshInfo.cpu_count)} />
                )}
                {sshInfo.memory_mb != null && (
                  <Field label="Memory (MB)" value={String(sshInfo.memory_mb)} />
                )}
                {sshInfo.credential_name != null && (
                  <Field label="SSH Credential" value={String(sshInfo.credential_name)} />
                )}
                {sshInfo.kernel != null && (
                  <Field label="Kernel" value={String(sshInfo.kernel)} mono />
                )}
                {sshInfo.os_release != null && (
                  <Field label="OS Release" value={String(sshInfo.os_release)} />
                )}
                {sshInfo.last_ssh_sync != null && (
                  <Field label="Last SSH Sync" value={fmt(String(sshInfo.last_ssh_sync))} />
                )}
              </Grid>
            </SSHInfoPanel>
          </DetailSection>
        )}

        {/* Tags */}
        {hasTags && (
          <DetailSection>
            <Text variant="label" style={{ color: 'var(--tx3)' }}>Tags</Text>
            <Flex gap={2} wrap>
              {Object.entries(server.tags).map(([k, v]) => (
                <TagBadge key={k}>
                  <span style={{ opacity: 0.7 }}>{k}</span>
                  <span style={{ color: 'var(--tx3)' }}>=</span>
                  <span>{v}</span>
                </TagBadge>
              ))}
            </Flex>
          </DetailSection>
        )}

        {/* Extra */}
        {hasExtra && (
          <DetailSection>
            <Text variant="label" style={{ color: 'var(--tx3)' }}>Extra</Text>
            <pre
              style={{
                margin: 0,
                borderRadius: '12px',
                padding: '12px',
                fontSize: '0.75rem',
                fontFamily: 'monospace',
                color: 'var(--tx2)',
                overflowX: 'auto',
                lineHeight: 1.5,
                background: 'var(--bg-s2)',
                border: '1px solid var(--bd)',
              }}
            >
              {JSON.stringify(server.extra, null, 2)}
            </pre>
          </DetailSection>
        )}

        {server.notes && (
          <DetailSection>
            <Text variant="label" style={{ color: 'var(--tx3)' }}>Notes</Text>
            <Text variant="body" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
              {server.notes}
            </Text>
          </DetailSection>
        )}

        {/* Timestamps */}
        <DetailSection>
          <Text variant="label" style={{ color: 'var(--tx3)' }}>Timestamps</Text>
          <Grid columns={2} gap={3}>
            <Field label="Created" value={fmt(server.created_at)} />
            <Field label="Updated" value={fmt(server.updated_at)} />
            <Field label="Last Synced" value={fmt(server.last_synced)} />
          </Grid>
        </DetailSection>
      </ScrollableContent>

      {/* Footer */}
      <ModalFooter justify="end" gap={3} align="center" wrap>
        {server.provider === 'custom_dc' && (
          <>
            <Select
              value={selectedCredentialId}
              onChange={e => setSelectedCredentialId(e.target.value)}
              disabled={isLoadingSshCredentials || sshSyncMutation.isPending}
              style={{ maxWidth: '240px' }}
              aria-label="SSH credential"
            >
              <option value="">
                {isLoadingSshCredentials ? 'Loading credentials' : 'Select SSH credential'}
              </option>
              {sshCredentials.map(cred => (
                <option key={cred.id} value={cred.id}>
                  {cred.name}{cred.is_default ? ' (default)' : ''}
                </option>
              ))}
            </Select>
            <Button
              onClick={() => sshSyncMutation.mutate()}
              disabled={sshSyncMutation.isPending || !selectedCredentialId}
              intent="primary"
            >
              <RefreshCw size={14} className={sshSyncMutation.isPending ? 'animate-spin' : ''} />
              {sshSyncMutation.isPending ? 'Syncing...' : 'SSH Sync'}
            </Button>
            {sshError && sshError.toLowerCase().includes('host key') && selectedCredentialId && (
              <Button
                onClick={() => trustMutation.mutate()}
                disabled={trustMutation.isPending}
                intent="danger"
                size="sm"
              >
                {trustMutation.isPending ? 'Trusting…' : 'Trust Host Key'}
              </Button>
            )}
          </>
        )}
        <Button
          onClick={() => setShowMap(true)}
          intent="secondary"
        >
          <Map size={14} />
          Resource Map
        </Button>
        {!inline && <Button onClick={onClose} intent="ghost">Close</Button>}
      </ModalFooter>
    </ModalContent>
  );

  return (
    <>
      {inline ? (
        renderContent
      ) : (
        <ModalBackdrop
          role="dialog"
          aria-modal="true"
          aria-label={`Server details: ${server.name}`}
          onClick={onClose}
        >
          {renderContent}
        </ModalBackdrop>
      )}

      {showMap && (
        <ResourceMapModal
          resourceId={server.id}
          resourceType="server"
          resourceName={server.name}
          provider={server.provider}
          region={server.region}
          onClose={() => setShowMap(false)}
        />
      )}
    </>
  )
}

