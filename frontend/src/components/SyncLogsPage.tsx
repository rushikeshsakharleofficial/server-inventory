import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, XCircle, Loader, RefreshCw, Square } from 'lucide-react'
import { syncApi } from '../api'
import { useToast } from '../hooks/useToast'
import ProviderBadge from './ProviderBadge'
import type { SyncLog } from '../types'

function fmt(d?: string) {
  if (!d) return '—'
  return new Date(d).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'medium' })
}

function duration(start?: string, end?: string) {
  if (!start || !end) return null
  const ms = new Date(end).getTime() - new Date(start).getTime()
  if (ms < 0) return null
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(1)}s`
  return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`
}

const STATUS_CFG: Record<
  SyncLog['status'],
  { Icon: React.ElementType; color: string; bg: string; border: string; label: string }
> = {
  success: {
    Icon: CheckCircle2, label: 'Success',
    color: 'var(--sg)', bg: 'var(--sg-bg)', border: 'var(--sg-bd)',
  },
  failed: {
    Icon: XCircle, label: 'Failed',
    color: 'var(--sr)', bg: 'var(--sr-bg)', border: 'var(--sr-bd)',
  },
  running: {
    Icon: Loader, label: 'Running',
    color: 'var(--sy)', bg: 'var(--sy-bg)', border: 'var(--sy-bd)',
  },
}

export default function SyncLogsPage() {
  const qc = useQueryClient()
  const { toast } = useToast()

  const { data: logs = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['sync-logs'],
    queryFn: () => syncApi.logs(50),
    refetchInterval: 10_000,
  })

  const stopMutation = useMutation({
    mutationFn: (logId: number) => syncApi.stop(logId),
    onSuccess: () => {
      toast.info('Sync stopped')
      qc.invalidateQueries({ queryKey: ['sync-logs'] })
    },
    onError: () => toast.error('Failed to stop sync'),
  })

  return (
    <div className="card-dark overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-surface-1">
        <div>
          <p className="text-sm font-medium text-ink-primary">Sync History</p>
          <p className="text-xs text-ink-muted mt-0.5">{logs.length} recent runs · auto-refreshes every 10s</p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="btn-ghost px-3 py-1.5 text-xs"
          aria-label="Refresh sync logs"
        >
          <RefreshCw size={13} className={isFetching ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-ink-muted text-sm">Loading…</div>
      ) : logs.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-ink-secondary text-sm font-medium">No sync runs yet</p>
          <p className="text-ink-muted text-xs mt-1">Click "Sync All" in the header or add credentials first</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="table-dark min-w-[700px]" aria-label="Sync history">
            <thead>
              <tr>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-ink-muted uppercase tracking-wider">Provider</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-ink-muted uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-center text-[11px] font-semibold text-ink-muted uppercase tracking-wider">Added</th>
                <th className="px-4 py-3 text-center text-[11px] font-semibold text-ink-muted uppercase tracking-wider">Updated</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-ink-muted uppercase tracking-wider">Started</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-ink-muted uppercase tracking-wider">Duration</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-ink-muted uppercase tracking-wider">Error</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {logs.map(log => {
                const cfg = STATUS_CFG[log.status] ?? STATUS_CFG.failed
                const Icon = cfg.Icon
                const dur = duration(log.started_at, log.completed_at)

                return (
                  <tr key={log.id}>
                    <td className="px-4 py-3.5">
                      {log.provider
                        ? <ProviderBadge provider={log.provider} />
                        : <span className="text-xs text-ink-muted italic">All</span>
                      }
                    </td>

                    <td className="px-4 py-3.5">
                      <span
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium"
                        style={{ color: cfg.color, backgroundColor: cfg.bg, border: `1px solid ${cfg.border}` }}
                      >
                        <Icon size={12} className={log.status === 'running' ? 'animate-spin' : ''} aria-hidden="true" />
                        {cfg.label}
                      </span>
                    </td>

                    <td className="px-4 py-3.5 text-center">
                      {log.servers_added > 0
                        ? <span className="text-sm font-mono font-semibold text-status-green tabular-nums">+{log.servers_added}</span>
                        : <span className="text-sm text-ink-dim tabular-nums">0</span>
                      }
                    </td>

                    <td className="px-4 py-3.5 text-center">
                      {log.servers_updated > 0
                        ? <span className="text-sm font-mono font-semibold text-accent tabular-nums">{log.servers_updated}</span>
                        : <span className="text-sm text-ink-dim tabular-nums">0</span>
                      }
                    </td>

                    <td className="px-4 py-3.5">
                      <span className="text-xs text-ink-secondary tabular-nums">{fmt(log.started_at)}</span>
                    </td>

                    <td className="px-4 py-3.5">
                      {dur ? (
                        <span
                          className="text-xs font-mono px-2 py-0.5 rounded text-ink-secondary"
                          style={{ background: 'var(--bg-s2)', border: '1px solid var(--bd)' }}
                        >
                          {dur}
                        </span>
                      ) : (
                        <span className="text-xs text-ink-dim">—</span>
                      )}
                    </td>

                    <td className="px-4 py-3.5 max-w-[220px]">
                      {log.error_message
                        ? <span className="text-xs text-status-red font-mono truncate block" title={log.error_message}>{log.error_message}</span>
                        : <span className="text-xs text-ink-dim">—</span>
                      }
                    </td>

                    <td className="px-4 py-3.5">
                      {log.status === 'running' && (
                        <button
                          onClick={() => stopMutation.mutate(log.id)}
                          disabled={stopMutation.isPending}
                          className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg transition-colors disabled:opacity-50"
                          style={{ background: 'var(--sr-bg)', color: 'var(--sr)', border: '1px solid var(--sr-bd)' }}
                          title="Stop this sync"
                        >
                          <Square size={10} />
                          Stop
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
