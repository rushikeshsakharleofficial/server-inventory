import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, Trash2, ToggleLeft, ToggleRight, Plus, Cloud, ChevronDown, ChevronRight } from 'lucide-react'
import { credentialsApi, syncApi } from '../api'
import { useToast } from '../hooks/useToast'
import ProviderBadge from './ProviderBadge'
import ProviderLogo from './ProviderLogo'

interface Props { onAddCredential: () => void }

const PROVIDER_DESC: Record<string, string> = {
  aws:          'Amazon EC2 — multi-region instance discovery',
  gcp:          'Google Compute Engine — all zones via service account',
  azure:        'Azure Virtual Machines — subscription-wide',
  linode:       'Akamai Cloud (Linode) — Nanode to Dedicated instances',
  digitalocean: 'DigitalOcean Droplets — all sizes and regions',
  ovh:          'OVH Cloud — bare metal, VPS and Public Cloud instances',
  custom_dc:    'Manually managed on-premise servers',
}

const SECRET_KEYS = new Set(['secret_access_key', 'client_secret', 'api_token', 'service_account_json', 'application_secret', 'consumer_key', 'private_key'])

export default function ProvidersPage({ onAddCredential }: Props) {
  const qc = useQueryClient()
  const { toast } = useToast()
  const [expanded, setExpanded] = useState<number | null>(null)
  const [confirmId, setConfirmId] = useState<number | null>(null)

  const { data: creds = [], isLoading } = useQuery({
    queryKey: ['credentials'],
    queryFn: credentialsApi.list,
  })

  const deleteMutation = useMutation({
    mutationFn: credentialsApi.delete,
    onSuccess: () => {
      toast.success('Credential removed')
      qc.invalidateQueries({ queryKey: ['credentials'] })
      setConfirmId(null)
    },
    onError: () => toast.error('Failed to delete'),
  })

  const toggleMutation = useMutation({
    mutationFn: credentialsApi.toggle,
    onSuccess: updated => {
      toast.info(updated.is_active ? 'Credential enabled' : 'Credential disabled')
      qc.invalidateQueries({ queryKey: ['credentials'] })
    },
  })

  const syncMutation = useMutation({
    mutationFn: (provider: string) => syncApi.trigger(provider),
    onSuccess: (_, provider) => {
      toast.success(`${provider.toUpperCase()} sync started`)
      setTimeout(() => {
        qc.invalidateQueries({ queryKey: ['servers'] })
        qc.invalidateQueries({ queryKey: ['stats'] })
        qc.invalidateQueries({ queryKey: ['sync-logs'] })
      }, 3000)
    },
    onError: () => toast.error('Sync failed'),
  })

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-ink-primary">
            {creds.length === 0 ? 'No credentials configured' : `${creds.length} credential${creds.length !== 1 ? 's' : ''}`}
          </p>
          <p className="text-xs text-ink-muted mt-0.5">
            {creds.filter(c => c.is_active).length} active · {creds.filter(c => !c.is_active).length} disabled
          </p>
        </div>
        <button onClick={onAddCredential} className="btn-primary">
          <Plus size={15} />
          Add Credential
        </button>
      </div>

      {/* Empty state */}
      {!isLoading && creds.length === 0 && (
        <div
          className="rounded-2xl p-16 text-center"
          style={{ border: '2px dashed var(--bd)' }}
        >
          <Cloud size={36} className="text-ink-dim mx-auto mb-4" />
          <p className="text-ink-secondary text-sm font-medium">No cloud providers configured</p>
          <p className="text-ink-muted text-xs mt-1 mb-4">
            Add credentials to start syncing servers from AWS, GCP, Azure, and more
          </p>
          <button onClick={onAddCredential} className="btn-primary mx-auto">
            <Plus size={14} />
            Add First Provider
          </button>
        </div>
      )}

      {/* Table */}
      {(isLoading || creds.length > 0) && (
        <div className="card-dark overflow-hidden">
          <table className="table-dark w-full" aria-label="Cloud provider credentials">
            <thead>
              <tr>
                <th className="w-8" />
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-ink-muted uppercase tracking-wider">Provider</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-ink-muted uppercase tracking-wider">Name</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-ink-muted uppercase tracking-wider hidden md:table-cell">Description</th>
                <th className="px-4 py-3 text-center text-[11px] font-semibold text-ink-muted uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold text-ink-muted uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i}>
                      {[...Array(6)].map((__, j) => (
                        <td key={j} className="px-4 py-4">
                          <div className="skeleton h-4 rounded" style={{ width: j === 0 ? 20 : j === 3 ? 140 : 80 }} />
                        </td>
                      ))}
                    </tr>
                  ))
                : creds.map(cred => (
                    <>
                      <tr
                        key={cred.id}
                        className={`transition-colors ${!cred.is_active ? 'opacity-50' : ''}`}
                        style={{ cursor: 'pointer' }}
                        onClick={() => setExpanded(expanded === cred.id ? null : cred.id)}
                      >
                        {/* Expand toggle */}
                        <td className="pl-3 pr-0 py-3.5 text-ink-dim">
                          {expanded === cred.id
                            ? <ChevronDown size={14} />
                            : <ChevronRight size={14} />
                          }
                        </td>

                        {/* Provider */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div
                              className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                              style={{ background: 'var(--bg-s2)', border: '1px solid var(--bd)' }}
                            >
                              <ProviderLogo provider={cred.provider} size={16} />
                            </div>
                            <ProviderBadge provider={cred.provider} />
                          </div>
                        </td>

                        {/* Name */}
                        <td className="px-4 py-3.5">
                          <span className="text-sm font-medium text-ink-primary">{cred.name}</span>
                        </td>

                        {/* Description */}
                        <td className="px-4 py-3.5 hidden md:table-cell">
                          <span className="text-xs text-ink-muted">
                            {PROVIDER_DESC[cred.provider] ?? cred.provider}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3.5 text-center" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => toggleMutation.mutate(cred.id)}
                            disabled={toggleMutation.isPending}
                            aria-label={cred.is_active ? 'Disable' : 'Enable'}
                            className="inline-flex items-center gap-1.5 transition-colors"
                          >
                            {cred.is_active
                              ? <>
                                  <ToggleRight size={18} className="text-status-green" />
                                  <span
                                    className="text-[11px] font-medium px-1.5 py-0.5 rounded"
                                    style={{ background: 'var(--sg-bg)', color: 'var(--sg)', border: '1px solid var(--sg-bd)' }}
                                  >
                                    Active
                                  </span>
                                </>
                              : <>
                                  <ToggleLeft size={18} className="text-ink-muted" />
                                  <span
                                    className="text-[11px] font-medium px-1.5 py-0.5 rounded"
                                    style={{ background: 'var(--sgr-bg)', color: 'var(--sgr)', border: '1px solid var(--sgr-bd)' }}
                                  >
                                    Disabled
                                  </span>
                                </>
                            }
                          </button>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3.5 text-right" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-1.5 justify-end">
                            <button
                              onClick={() => syncMutation.mutate(cred.provider)}
                              disabled={syncMutation.isPending || !cred.is_active}
                              className="btn-ghost px-2.5 py-1.5 text-xs"
                              title="Sync this provider"
                            >
                              <RefreshCw size={12} className={syncMutation.isPending ? 'animate-spin' : ''} />
                              Sync
                            </button>

                            {confirmId === cred.id ? (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => deleteMutation.mutate(cred.id)}
                                  disabled={deleteMutation.isPending}
                                  className="text-[11px] px-2 py-1 rounded-lg disabled:opacity-50"
                                  style={{ background: 'var(--sr-bg)', color: 'var(--sr)', border: '1px solid var(--sr-bd)' }}
                                >
                                  Confirm
                                </button>
                                <button
                                  onClick={() => setConfirmId(null)}
                                  className="text-[11px] px-2 py-1 rounded-lg border border-border text-ink-muted hover:bg-surface-3 transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setConfirmId(cred.id)}
                                aria-label={`Delete ${cred.name}`}
                                className="p-1.5 text-ink-muted hover:text-status-red rounded-lg transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Expanded config row */}
                      {expanded === cred.id && (
                        <tr key={`${cred.id}-detail`}>
                          <td />
                          <td colSpan={5} className="px-4 pb-4 pt-0">
                            <div
                              className="rounded-xl p-3 flex flex-wrap gap-x-6 gap-y-1.5"
                              style={{ background: 'var(--bg-s2)', border: '1px solid var(--bd)' }}
                            >
                              <span className="text-[11px] text-ink-dim font-mono w-full mb-0.5">
                                Configuration keys:
                              </span>
                              {Object.entries(cred.config ?? {})
                                .filter(([k]) => !SECRET_KEYS.has(k))
                                .map(([k, v]) => (
                                  <span key={k} className="text-[11px] font-mono">
                                    <span className="text-ink-muted">{k}:</span>{' '}
                                    <span className="text-ink-secondary">
                                      {Array.isArray(v) ? (v as string[]).join(', ') : String(v)}
                                    </span>
                                  </span>
                                ))}
                              {Object.keys(cred.config ?? {}).some(k => SECRET_KEYS.has(k)) && (
                                <span className="text-[11px] text-ink-dim italic font-mono">• secret fields hidden</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))
              }
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
