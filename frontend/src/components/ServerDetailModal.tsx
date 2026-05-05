import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X, RefreshCw } from 'lucide-react'
import { serversApi } from '../api'
import { useToast } from '../hooks/useToast'
import ProviderBadge from './ProviderBadge'
import type { Server, ServerStatus } from '../types'

interface Props {
  server: Server
  onClose: () => void
}

const STATUS_CFG: Record<
  ServerStatus,
  { bg: string; text: string; border: string }
> = {
  running:    { bg: 'var(--sg-bg)',  text: 'var(--sg)',  border: 'var(--sg-bd)'  },
  stopped:    { bg: 'var(--sr-bg)',  text: 'var(--sr)',  border: 'var(--sr-bd)'  },
  pending:    { bg: 'var(--sy-bg)',  text: 'var(--sy)',  border: 'var(--sy-bd)'  },
  terminated: { bg: 'var(--sgr-bg)', text: 'var(--sgr)', border: 'var(--sgr-bd)' },
  unknown:    { bg: 'var(--sgr-bg)', text: 'var(--sgr)', border: 'var(--sgr-bd)' },
}

function fmt(d?: string) {
  if (!d) return '—'
  return new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold text-ink-muted uppercase tracking-widest mb-3">
      {children}
    </p>
  )
}

function Field({ label, value, mono = false }: { label: string; value?: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <p className="text-[11px] text-ink-muted mb-0.5">{label}</p>
      <p
        className={`text-sm text-ink-primary break-all ${mono ? 'font-mono text-xs' : ''}`}
      >
        {value ?? <span className="text-ink-dim">—</span>}
      </p>
    </div>
  )
}

export default function ServerDetailModal({ server, onClose }: Props) {
  const qc = useQueryClient()
  const { toast } = useToast()

  const statusCfg = STATUS_CFG[server.status] ?? STATUS_CFG.unknown

  const sshSyncMutation = useMutation({
    mutationFn: () => (serversApi as unknown as { sshSync: (id: number) => Promise<unknown> }).sshSync(server.id),
    onSuccess: () => {
      toast.success('SSH sync triggered')
      qc.invalidateQueries({ queryKey: ['servers'] })
    },
    onError: () => toast.error('SSH sync failed'),
  })

  const hasTags  = Object.keys(server.tags ?? {}).length > 0
  const hasExtra = Object.keys(server.extra ?? {}).length > 0
  const sshInfo  = server.ssh_info as Record<string, unknown> | undefined

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)' }}
      role="dialog"
      aria-modal="true"
      aria-label={`Server details: ${server.name}`}
    >
      <div className="glass-modal w-full max-w-2xl max-h-[90vh] rounded-2xl flex flex-col animate-slide-up">

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-white/[0.07]">
          <div className="flex items-center gap-3 flex-wrap min-w-0">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-ink-primary truncate">{server.name}</h2>
              {server.hostname && (
                <p className="text-xs text-ink-muted font-mono mt-0.5">{server.hostname}</p>
              )}
            </div>
            <ProviderBadge provider={server.provider} />
            <span
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium"
              style={{ color: statusCfg.text, backgroundColor: statusCfg.bg, border: `1px solid ${statusCfg.border}` }}
            >
              {server.status === 'running' && (
                <span className="status-dot-running" aria-hidden="true" />
              )}
              {server.status}
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="ml-4 flex-shrink-0 p-1.5 text-ink-muted hover:text-ink-primary hover:bg-surface-3 rounded-lg transition-colors"
          >
            <X size={17} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Identity */}
          <div>
            <SectionLabel>Identity</SectionLabel>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <Field label="ID"        value={String(server.id)} />
              <Field label="Cloud ID"  value={server.cloud_id} />
              <Field label="Name"      value={server.name} />
              <Field label="Hostname"  value={server.hostname} />
              <Field label="Provider"  value={server.provider} />
              <Field label="Status"    value={server.status} />
            </div>
          </div>

          {/* Network */}
          <div>
            <SectionLabel>Network</SectionLabel>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <Field label="Public IP"  value={server.public_ip}  mono />
              <Field label="Private IP" value={server.private_ip} mono />
            </div>
          </div>

          {/* Resources */}
          <div>
            <SectionLabel>Resources</SectionLabel>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <Field label="vCPU"          value={server.vcpu != null ? String(server.vcpu) : undefined} />
              <Field label="Memory (GB)"   value={server.memory_gb  != null ? String(server.memory_gb)  : undefined} />
              <Field label="Storage (GB)"  value={server.storage_gb != null ? String(server.storage_gb) : undefined} />
              <Field label="OS"            value={server.os} />
              <Field label="Instance Type" value={server.instance_type} />
              <Field label="Region"        value={server.region} />
              <Field label="Zone"          value={server.zone} />
              <Field label="Datacenter"    value={server.datacenter} />
            </div>
          </div>

          {/* SSH Info */}
          {sshInfo && (
            <div>
              <SectionLabel>SSH Info</SectionLabel>
              <div className="rounded-xl border border-border bg-surface-2/50 p-4 space-y-3">
                {Array.isArray(sshInfo.ips) && (
                  <div>
                    <p className="text-[11px] text-ink-muted mb-1.5">IPs</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(sshInfo.ips as string[]).map(ip => (
                        <span
                          key={ip}
                          className="text-xs font-mono px-2 py-0.5 rounded"
                          style={{ background: 'var(--ac-bg)', color: 'var(--ac)', border: '1px solid var(--ac-bd)' }}
                        >
                          {ip}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                  {sshInfo.cpu_count != null && (
                    <Field label="CPU Count"    value={String(sshInfo.cpu_count)} />
                  )}
                  {sshInfo.memory_total != null && (
                    <Field label="Memory Total" value={String(sshInfo.memory_total)} />
                  )}
                  {sshInfo.kernel != null && (
                    <Field label="Kernel"       value={String(sshInfo.kernel)} mono />
                  )}
                  {sshInfo.os_release != null && (
                    <Field label="OS Release"   value={String(sshInfo.os_release)} />
                  )}
                  {sshInfo.last_ssh_sync != null && (
                    <Field label="Last SSH Sync" value={fmt(String(sshInfo.last_ssh_sync))} />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Tags */}
          {hasTags && (
            <div>
              <SectionLabel>Tags</SectionLabel>
              <div className="flex flex-wrap gap-2">
                {Object.entries(server.tags).map(([k, v]) => (
                  <span
                    key={k}
                    className="inline-flex items-center gap-1 text-xs font-mono px-2 py-1 rounded-md"
                    style={{ background: 'var(--ac-bg)', color: 'var(--ac)', border: '1px solid var(--ac-bd)' }}
                  >
                    <span style={{ opacity: 0.7 }}>{k}</span>
                    <span style={{ color: 'var(--tx3)' }}>=</span>
                    <span>{v}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Extra */}
          {hasExtra && (
            <div>
              <SectionLabel>Extra</SectionLabel>
              <pre
                className="rounded-xl p-3 text-xs font-mono text-ink-secondary overflow-x-auto leading-relaxed"
                style={{ background: 'var(--bg-s2)', border: '1px solid var(--bd)' }}
              >
                {JSON.stringify(server.extra, null, 2)}
              </pre>
            </div>
          )}

          {/* Notes */}
          {server.notes && (
            <div>
              <SectionLabel>Notes</SectionLabel>
              <p className="text-sm text-ink-secondary whitespace-pre-wrap leading-relaxed">
                {server.notes}
              </p>
            </div>
          )}

          {/* Timestamps */}
          <div>
            <SectionLabel>Timestamps</SectionLabel>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <Field label="Created"     value={fmt(server.created_at)}   />
              <Field label="Updated"     value={fmt(server.updated_at)}   />
              <Field label="Last Synced" value={fmt(server.last_synced)}  />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/[0.07]">
          {server.provider === 'custom_dc' && (
            <button
              onClick={() => sshSyncMutation.mutate()}
              disabled={sshSyncMutation.isPending}
              className="btn-primary"
            >
              <RefreshCw size={14} className={sshSyncMutation.isPending ? 'animate-spin' : ''} />
              {sshSyncMutation.isPending ? 'Syncing…' : 'SSH Sync'}
            </button>
          )}
          <button onClick={onClose} className="btn-ghost">Close</button>
        </div>
      </div>
    </div>
  )
}
