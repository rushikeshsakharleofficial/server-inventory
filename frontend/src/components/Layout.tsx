import { useState, useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Server, Cloud, Activity, RefreshCw, Plus,
  Menu, X, Settings, Wifi, Users, LogOut, Shield, PencilLine, Eye,
  CheckCircle2, XCircle, LayoutDashboard, Terminal, Square, SlidersHorizontal,
} from 'lucide-react'
import { syncApi } from '../api'
import { useToast } from '../hooks/useToast'
import { useAuth } from '../hooks/useAuth'
import { useWebSocket, type SyncEvent } from '../hooks/useWebSocket'
import ThemeToggle from './ThemeToggle'
import type { View } from '../types'

interface LayoutProps {
  currentView: View
  onViewChange: (v: View) => void
  onAddServer: () => void
  onManageCredentials: () => void
  onManageUsers: () => void
  children: React.ReactNode
}

const NAV: { id: View; label: string; Icon: React.ElementType }[] = [
  { id: 'dashboard',  label: 'Dashboard',      Icon: LayoutDashboard },
  { id: 'servers',    label: 'Servers',         Icon: Server          },
  { id: 'providers',  label: 'Cloud Providers', Icon: Cloud           },
  { id: 'sync-logs',  label: 'Sync Logs',       Icon: Activity        },
  { id: 'ssh',        label: 'SSH',             Icon: Terminal        },
  { id: 'settings',   label: 'Settings',        Icon: SlidersHorizontal },
]

const VIEW_TITLE: Record<View, string> = {
  dashboard:   'Dashboard',
  servers:     'Server Inventory',
  providers:   'Cloud Providers',
  'sync-logs': 'Sync Logs',
  ssh:         'SSH Credentials',
  settings:    'Settings',
}

const ROLE_ICON: Record<string, React.ElementType> = {
  admin: Shield,
  write: PencilLine,
  read:  Eye,
}

const ROLE_COLOR: Record<string, string> = {
  admin: '#6366F1',
  write: '#4285F4',
  read:  '#8B8AAE',
}

export default function Layout({
  currentView, onViewChange, onAddServer,
  onManageCredentials, onManageUsers, children,
}: LayoutProps) {
  const [open, setOpen] = useState(true)
  const qc = useQueryClient()
  const { toast } = useToast()
  const { user, logout } = useAuth()

  const canWrite = user?.role !== 'read'
  const isAdmin  = user?.role === 'admin'

  const [activeSyncs, setActiveSyncs] = useState<Map<number, string>>(new Map())
  const [syncStatus, setSyncStatus]   = useState<'idle' | 'done' | 'error'>('idle')
  const [syncSummary, setSyncSummary] = useState('')

  const isSyncing = activeSyncs.size > 0

  const handleWsEvent = useCallback((event: SyncEvent) => {
    if (event.type === 'active_syncs') {
      const m = new Map<number, string>()
      for (const s of event.syncs ?? []) {
        if (s.status === 'running') m.set(s.log_id, s.provider ?? 'unknown')
      }
      setActiveSyncs(m)

    } else if (event.type === 'sync_started') {
      setActiveSyncs(prev => new Map(prev).set(event.log_id!, event.provider ?? 'unknown'))
      setSyncStatus('idle')

    } else if (event.type === 'sync_stopped') {
      setActiveSyncs(prev => {
        const next = new Map(prev)
        next.delete(event.log_id!)
        return next
      })
      setSyncStatus('idle')
      qc.invalidateQueries({ queryKey: ['sync-logs'] })

    } else if (event.type === 'sync_complete') {
      setActiveSyncs(prev => {
        const next = new Map(prev)
        next.delete(event.log_id!)
        return next
      })

      if (event.status === 'success') {
        const added   = event.servers_added   ?? 0
        const updated = event.servers_updated ?? 0
        setSyncStatus('done')
        setSyncSummary(`+${added} added · ${updated} updated`)
        toast.success(`${event.provider?.toUpperCase() ?? 'Sync'} complete — ${added} added, ${updated} updated`)
        qc.invalidateQueries({ queryKey: ['servers']   })
        qc.invalidateQueries({ queryKey: ['stats']     })
        qc.invalidateQueries({ queryKey: ['sync-logs'] })
      } else {
        setSyncStatus('error')
        setSyncSummary(event.error_message ?? 'Sync failed')
        toast.error(`Sync failed: ${event.error_message ?? 'unknown error'}`)
      }
      setTimeout(() => setSyncStatus('idle'), 5000)
    }
  }, [qc, toast])

  useWebSocket(handleWsEvent)

  const syncMutation = useMutation({
    mutationFn: () => syncApi.trigger(),
    onError: () => {
      setSyncStatus('error')
      setSyncSummary('Failed to start sync')
      toast.error('Sync failed — check credentials in Cloud Providers')
      setTimeout(() => setSyncStatus('idle'), 3000)
    },
  })

  const stopMutation = useMutation({
    mutationFn: () => syncApi.stop(),
    onSuccess: () => toast.info('Sync stopped'),
    onError: () => toast.error('Failed to stop sync'),
  })

  const RoleIcon = user ? (ROLE_ICON[user.role] ?? Eye) : Eye
  const roleColor = user ? (ROLE_COLOR[user.role] ?? '#8B8AAE') : '#8B8AAE'

  return (
    <div className="flex h-screen bg-base overflow-hidden">
      {/* ── Sidebar ── */}
      <aside
        className={`flex-shrink-0 flex flex-col border-r border-border transition-all duration-200 ${
          open ? 'w-60' : 'w-0 overflow-hidden'
        }`}
        style={{ background: 'linear-gradient(180deg, var(--sidebar-from) 0%, var(--sidebar-to) 100%)' }}
        aria-label="Sidebar navigation"
      >
        {/* Logo */}
        <div className="px-4 py-5 flex items-center gap-3 border-b border-border">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--ac-bg)', border: '1px solid var(--ac-bd)' }}
          >
            <Wifi size={16} className="text-accent" />
          </div>
          <div className="overflow-hidden">
            <p className="text-sm font-display font-bold text-ink-primary tracking-tight truncate">ServerInventory</p>
            <p className="text-[10px] text-ink-muted font-mono truncate mt-0.5 tracking-widest uppercase">Infra Manager</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2.5 space-y-0.5 overflow-y-auto" role="navigation">
          {NAV.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => onViewChange(id)}
              aria-current={currentView === id ? 'page' : undefined}
              className={`relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm
                         transition-colors duration-150 ${
                           currentView === id
                             ? 'text-accent font-medium'
                             : 'text-ink-secondary hover:text-ink-primary hover:bg-surface-3'
                         }`}
              style={currentView === id
                ? { background: 'var(--nav-active-bg)', border: '1px solid var(--nav-active-bd)' }
                : {}}
            >
              {currentView === id && (
                <span className="absolute left-0 inset-y-0 flex items-center">
                  <span className="w-0.5 h-5 rounded-r-full bg-accent" />
                </span>
              )}
              <Icon size={16} className="flex-shrink-0" />
              <span className="truncate">{label}</span>
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-2.5 border-t border-border space-y-0.5">
          <button
            onClick={onManageCredentials}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm
                       text-ink-secondary hover:text-ink-primary hover:bg-surface-3 transition-colors"
          >
            <Settings size={16} className="flex-shrink-0" />
            <span className="truncate">Manage Credentials</span>
          </button>

          {isAdmin && (
            <button
              onClick={onManageUsers}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm
                         text-ink-secondary hover:text-ink-primary hover:bg-surface-3 transition-colors"
            >
              <Users size={16} className="flex-shrink-0" />
              <span className="truncate">Manage Users</span>
            </button>
          )}
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header
          className="flex-shrink-0 h-[54px] flex items-center justify-between px-5 border-b border-border"
          style={{ background: 'var(--header-bg)', backdropFilter: 'blur(20px)' }}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={() => setOpen(o => !o)}
              aria-label={open ? 'Close sidebar' : 'Open sidebar'}
              className="p-1.5 rounded-lg text-ink-muted hover:text-ink-primary hover:bg-surface-3 transition-colors"
            >
              {open ? <X size={17} /> : <Menu size={17} />}
            </button>
            <h1 className="text-[15px] font-display font-semibold text-ink-primary tracking-tight">
              {VIEW_TITLE[currentView]}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {/* Role badge */}
            {user && (
              <div
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium"
                style={{ color: roleColor, background: roleColor + '15', border: `1px solid ${roleColor}25` }}
              >
                <RoleIcon size={11} aria-hidden="true" />
                <span className="font-mono">{user.username}</span>
              </div>
            )}

            <ThemeToggle />

            {/* Action buttons */}
            {currentView === 'servers' && canWrite && (
              <button onClick={onAddServer} className="btn-primary">
                <Plus size={14} />
                <span className="hidden sm:inline">Add Server</span>
              </button>
            )}

            {canWrite && (
              <div className="flex items-center gap-2">
                {/* Live sync status pill */}
                {syncStatus !== 'idle' && (
                  <div
                    className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono max-w-[220px] truncate"
                    style={
                      syncStatus === 'error'
                        ? { background: 'var(--sr-bg)', color: 'var(--sr)', border: '1px solid var(--sr-bd)' }
                        : syncStatus === 'done'
                        ? { background: 'var(--sg-bg)', color: 'var(--sg)', border: '1px solid var(--sg-bd)' }
                        : { background: 'var(--ac-bg)', color: 'var(--ac)', border: '1px solid var(--ac-bd)' }
                    }
                  >
                    {syncStatus === 'done'  && <CheckCircle2 size={11} className="flex-shrink-0" />}
                    {syncStatus === 'error' && <XCircle      size={11} className="flex-shrink-0" />}
                    <span className="truncate">{syncSummary}</span>
                  </div>
                )}

                {/* Stop sync button */}
                {isSyncing && (
                  <button
                    onClick={() => stopMutation.mutate()}
                    disabled={stopMutation.isPending}
                    className="btn-ghost px-2.5 py-2 text-xs"
                    style={{ color: 'var(--sr)' }}
                    aria-label="Stop all syncs"
                    title="Stop all syncs"
                  >
                    <Square size={13} />
                    <span className="hidden sm:inline">Stop</span>
                  </button>
                )}

                <button
                  onClick={() => syncMutation.mutate()}
                  disabled={isSyncing || syncMutation.isPending}
                  className="btn-ghost"
                  aria-label="Sync all cloud providers"
                >
                  <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} aria-hidden="true" />
                  <span className="hidden sm:inline">
                    {isSyncing ? `Syncing${activeSyncs.size > 1 ? ` (${activeSyncs.size})` : ''}…` : 'Sync All'}
                  </span>
                </button>
              </div>
            )}

            {/* Logout */}
            <button
              onClick={logout}
              aria-label="Sign out"
              title="Sign out"
              className="p-2 rounded-lg text-ink-muted hover:text-status-red hover:bg-status-red/10 transition-colors"
            >
              <LogOut size={16} />
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-6 bg-base" role="main">
          {children}
        </main>
      </div>
    </div>
  )
}
