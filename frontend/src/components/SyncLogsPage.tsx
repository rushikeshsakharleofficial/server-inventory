import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, XCircle, Loader, RefreshCw, Square } from 'lucide-react'
import { syncApi } from '../api'
import { useToast } from '../hooks/useToast'
import ProviderBadge from './ProviderBadge'
import type { SyncLog } from '../types'
import {
  Card,
  Flex,
  Heading,
  Text,
  Button,
  Badge,
  TableContainer,
  Table,
  THead,
  TBody,
  TH,
  TD,
} from './StitchUI'

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
  { Icon: React.ElementType; label: string; status: 'green' | 'red' | 'yellow' | 'gray' }
> = {
  success: { Icon: CheckCircle2, label: 'Success', status: 'green' },
  failed:  { Icon: XCircle, label: 'Failed', status: 'red' },
  running: { Icon: Loader, label: 'Running', status: 'yellow' },
}

export default function SyncLogsPage() {
  const qc = useQueryClient()
  const { toast } = useToast()

  const { data: logs = [], isLoading, isError, refetch, isFetching } = useQuery({
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
    <Card style={{ padding: 0, overflow: 'hidden' }} className="animate-fade-in">
      <Flex
        justify="between"
        align="center"
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--bd)',
          backgroundColor: 'var(--bg-s1)',
        }}
      >
        <div>
          <Heading level="h3" style={{ fontSize: '14px', fontWeight: 700 }}>Sync History</Heading>
          <Text variant="smallMuted" style={{ marginTop: '2px' }}>
            {logs.length} recent runs · auto-refreshes every 10s
          </Text>
        </div>
        <Button
          intent="ghost"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw size={13} className={isFetching ? 'animate-spin' : ''} />
          Refresh
        </Button>
      </Flex>

      {isError ? (
        <div style={{ padding: '64px 20px', textAlign: 'center' }}>
          <Text variant="muted" style={{ color: 'var(--sr)' }}>Failed to load sync history.</Text>
          <button onClick={() => refetch()} style={{ marginTop: '8px', color: 'var(--ac)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', textDecoration: 'underline', display: 'block', margin: '8px auto 0' }}>
            Retry
          </button>
        </div>
      ) : isLoading ? (
        <div style={{ padding: '64px 20px', textAlign: 'center' }}>
          <Text variant="muted">Loading sync runs…</Text>
        </div>
      ) : logs.length === 0 ? (
        <div style={{ padding: '64px 20px', textAlign: 'center' }}>
          <Heading level="h4" style={{ marginBottom: '4px' }}>No sync runs yet</Heading>
          <Text variant="muted">Click "Sync All" in the header or add credentials first</Text>
        </div>
      ) : (
        <TableContainer style={{ border: 'none', borderRadius: 0, boxShadow: 'none' }}>
          <Table aria-label="Sync history">
            <THead>
              <tr>
                <TH>Provider</TH>
                <TH>Status</TH>
                <TH style={{ textAlign: 'center' }}>Added</TH>
                <TH style={{ textAlign: 'center' }}>Updated</TH>
                <TH>Started</TH>
                <TH>Duration</TH>
                <TH>Error</TH>
                <TH style={{ width: '80px' }} />
              </tr>
            </THead>
            <TBody>
              {logs.map(log => {
                const cfg = STATUS_CFG[log.status] ?? STATUS_CFG.failed
                const Icon = cfg.Icon
                const dur = duration(log.started_at, log.completed_at)

                return (
                  <tr key={log.id}>
                    <TD>
                      {log.provider ? (
                        <ProviderBadge provider={log.provider} />
                      ) : (
                        <Text variant="smallMuted" style={{ fontStyle: 'italic' }}>
                          All
                        </Text>
                      )}
                    </TD>

                    <TD>
                      <Badge
                        status={cfg.status}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <Icon size={12} className={log.status === 'running' ? 'animate-spin' : ''} />
                        {cfg.label}
                      </Badge>
                    </TD>

                    <TD style={{ textAlign: 'center' }}>
                      {log.servers_added > 0 ? (
                        <Text style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--sg)', fontSize: '13px' }}>
                          +{log.servers_added}
                        </Text>
                      ) : (
                        <Text variant="smallMuted" style={{ fontFamily: 'monospace' }}>0</Text>
                      )}
                    </TD>

                    <TD style={{ textAlign: 'center' }}>
                      {log.servers_updated > 0 ? (
                        <Text style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--ac)', fontSize: '13px' }}>
                          {log.servers_updated}
                        </Text>
                      ) : (
                        <Text variant="smallMuted" style={{ fontFamily: 'monospace' }}>0</Text>
                      )}
                    </TD>

                    <TD>
                      <Text style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                        {fmt(log.started_at)}
                      </Text>
                    </TD>

                    <TD>
                      {dur ? (
                        <span
                          style={{
                            fontFamily: 'monospace',
                            fontSize: '11px',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            backgroundColor: 'var(--bg-s2)',
                            border: '1px solid var(--bd)',
                            color: 'var(--tx2)',
                          }}
                        >
                          {dur}
                        </span>
                      ) : (
                        <Text variant="smallMuted">—</Text>
                      )}
                    </TD>

                    <TD style={{ maxWidth: '220px' }}>
                      {log.error_message ? (
                        <Text
                          style={{
                            fontFamily: 'monospace',
                            fontSize: '12px',
                            color: 'var(--sr)',
                            textOverflow: 'ellipsis',
                            overflow: 'hidden',
                            whiteSpace: 'nowrap',
                            display: 'block',
                          }}
                          title={log.error_message}
                        >
                          {log.error_message}
                        </Text>
                      ) : (
                        <Text variant="smallMuted">—</Text>
                      )}
                    </TD>

                    <TD>
                      {log.status === 'running' && (
                        <Button
                          size="sm"
                          intent="danger"
                          onClick={() => stopMutation.mutate(log.id)}
                          disabled={stopMutation.isPending}
                          style={{
                            fontSize: '11px',
                            padding: '4px 8px',
                          }}
                        >
                          <Square size={10} style={{ marginRight: '4px' }} />
                          Stop
                        </Button>
                      )}
                    </TD>
                  </tr>
                )
              })}
            </TBody>
          </Table>
        </TableContainer>
      )}
    </Card>
  )
}
