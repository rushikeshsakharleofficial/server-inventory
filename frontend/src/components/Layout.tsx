import { useState, useCallback, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Server, Cloud, Activity, RefreshCw, Plus,
  Menu, X, Users, LogOut, Shield, PencilLine, Eye,
  CheckCircle2, XCircle, LayoutDashboard, Terminal, Square, SlidersHorizontal, Timer,
  Layers, Database, Box, ChevronDown, HardDrive, Network,
} from 'lucide-react'
import { syncApi, getErrorMessage } from '../api'
import { useToast } from '../hooks/useToast'
import { useAuth } from '../hooks/useAuth'
import { useWebSocket, type SyncEvent } from '../hooks/useWebSocket'
import ThemeToggle from './ThemeToggle'
import type { View } from '../types'
import { Flex, Button, Heading } from './StitchUI'

interface LayoutProps {
  currentView: View
  onViewChange: (v: View) => void
  onAddServer: () => void
  children: React.ReactNode
}

const INVENTORY_VIEWS: View[] = ['servers', 'databases', 'kubernetes', 'block_storage', 'ips']

const INVENTORY_SUB: { id: View; label: string; Icon: React.ElementType }[] = [
  { id: 'servers',       label: 'Servers',       Icon: Server    },
  { id: 'databases',     label: 'Databases',     Icon: Database  },
  { id: 'kubernetes',    label: 'Kubernetes',    Icon: Box       },
  { id: 'block_storage', label: 'Block Storage', Icon: HardDrive },
  { id: 'ips',           label: 'IP Addresses',  Icon: Network   },
]

const NAV: { id: View; label: string; Icon: React.ElementType }[] = [
  { id: 'providers',  label: 'Cloud Providers', Icon: Cloud             },
  { id: 'sync-logs',  label: 'Sync Logs',       Icon: Activity          },
  { id: 'crons',      label: 'Cron Jobs',       Icon: Timer             },
  { id: 'ssh',        label: 'SSH',             Icon: Terminal          },
  { id: 'settings',   label: 'Settings',        Icon: SlidersHorizontal },
]

const VIEW_TITLE: Record<View, string> = {
  dashboard:       'Dashboard',
  servers:         'Server Inventory',
  databases:       'Databases',
  kubernetes:      'Kubernetes',
  block_storage:   'Block Storage',
  ips:             'IP Addresses',
  providers:       'Cloud Providers',
  'sync-logs':     'Sync Logs',
  crons:           'Cron Jobs',
  ssh:             'SSH Credentials',
  settings:        'Settings',
  users:           'User Management',
  setup:           'Admin Setup',
}

const ROLE_ICON: Record<string, React.ElementType> = {
  admin: Shield,
  write: PencilLine,
  read:  Eye,
}

const ROLE_COLOR: Record<string, string> = {
  admin: '#F6821F',
  write: '#4285F4',
  read:  '#6B7280',
}

function navBtnStyle(active: boolean): React.CSSProperties {
  return {
    width: 'calc(100% - 16px)',
    margin: '0 8px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '7px 12px',
    fontFamily: "'Inter', system-ui, sans-serif",
    fontSize: '13px',
    letterSpacing: 0,
    textTransform: 'none',
    color: active ? 'var(--ac)' : 'var(--tx2)',
    backgroundColor: active ? 'rgba(246,130,31,0.12)' : 'transparent',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    textAlign: 'left',
    outline: 'none',
    fontWeight: active ? 600 : 400,
    transition: 'all 120ms ease',
  }
}

function subNavBtnStyle(active: boolean): React.CSSProperties {
  return {
    width: 'calc(100% - 8px)',
    margin: '0 4px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 10px',
    fontSize: '12px',
    borderRadius: '6px',
    color: active ? 'var(--ac)' : 'var(--tx2)',
    backgroundColor: active ? 'rgba(246,130,31,0.10)' : 'transparent',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
    outline: 'none',
    fontWeight: active ? 600 : 400,
    transition: 'all 120ms ease',
    fontFamily: "'Inter', system-ui, sans-serif",
  }
}

function NavBtn({ id, label, Icon, currentView, onViewChange }: {
  id: View; label: string; Icon: React.ElementType
  currentView: View; onViewChange: (v: View) => void
}) {
  const active = currentView === id
  return (
    <button
      style={navBtnStyle(active)}
      onClick={() => onViewChange(id)}
      aria-current={active ? 'page' : undefined}
      onMouseEnter={e => { if (!active) { e.currentTarget.style.color = 'var(--tx1)'; e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)' } }}
      onMouseLeave={e => { if (!active) { e.currentTarget.style.color = 'var(--tx2)'; e.currentTarget.style.backgroundColor = 'transparent' } }}
    >
      <Icon size={15} style={{ flexShrink: 0 }} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
    </button>
  )
}

const NAV_SECTION: React.CSSProperties = {
  padding: '0 20px',
  marginTop: '20px',
  marginBottom: '2px',
  fontSize: '10px',
  fontFamily: "'Inter', system-ui, sans-serif",
  fontWeight: 600,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--tx3)',
}

export default function Layout({ currentView, onViewChange, onAddServer, children }: LayoutProps) {
  const [open, setOpen] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 768 : true
  )
  useEffect(() => {
    function handleResize() {
      setOpen(window.innerWidth >= 768)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const isInventoryView = INVENTORY_VIEWS.includes(currentView)
  const [inventoryOpen, setInventoryOpen] = useState(() => INVENTORY_VIEWS.includes(currentView))
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
      setSyncSummary('')
    } else if (event.type === 'sync_stopped') {
      setActiveSyncs(prev => { const next = new Map(prev); next.delete(event.log_id!); return next })
      setSyncStatus('idle')
      qc.invalidateQueries({ queryKey: ['sync-logs'] })
    } else if (event.type === 'sync_progress') {
      setSyncSummary(`${event.provider?.toUpperCase()} ${event.processed}/${event.total}`)
    } else if (event.type === 'sync_complete') {
      setActiveSyncs(prev => { const next = new Map(prev); next.delete(event.log_id!); return next })
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
    } else if (event.type === 'server_status_changed') {
      const prev = event.old_status ?? ''
      const next = event.new_status ?? ''
      const name = event.server_name ?? 'Server'
      if (next === 'running' && prev !== 'running') toast.success(`${name} → online`)
      else if ((next === 'stopped' || next === 'terminated') && prev === 'running') toast.error(`${name} → offline`)
      qc.invalidateQueries({ queryKey: ['servers'] })
      qc.invalidateQueries({ queryKey: ['stats']   })
    }
    window.dispatchEvent(new CustomEvent('ws:server-event', { detail: event }))
  }, [qc, toast])

  const { isConnected } = useWebSocket(handleWsEvent)

  const syncMutation = useMutation({
    mutationFn: () => syncApi.trigger(),
    onError: (error: unknown) => {
      setSyncStatus('error')
      const msg = getErrorMessage(error)
      setSyncSummary(`Failed to start sync: ${msg}`)
      toast.error(`Sync failed: ${msg}`)
      setTimeout(() => setSyncStatus('idle'), 3000)
    },
  })

  const stopMutation = useMutation({
    mutationFn: () => syncApi.stop(),
    onSuccess: () => toast.info('Sync stopped'),
    onError: (error: unknown) => toast.error(`Failed to stop sync: ${getErrorMessage(error)}`),
  })

  const RoleIcon = user ? (ROLE_ICON[user.role] ?? Eye) : Eye
  const roleColor = user ? (ROLE_COLOR[user.role] ?? '#6B7280') : '#6B7280'

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: 'var(--bg-base)', overflow: 'hidden' }}>
      {/* ── Sidebar ── */}
      <aside
        aria-label="Sidebar navigation"
        style={{
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          width: open ? '220px' : '0px',
          overflow: open ? undefined : 'hidden',
          borderRight: open ? '1px solid var(--bd)' : 'none',
          transition: 'width 200ms ease',
          backgroundColor: 'var(--bg-base)',
        }}
      >
        {/* Logo */}
        <div style={{ padding: '20px 16px 16px', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--bd)' }}>
          <div style={{
            width: '34px', height: '34px', borderRadius: '9px', flexShrink: 0,
            background: 'linear-gradient(135deg, var(--ac) 0%, #c45f0a 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '13px', fontWeight: 800, color: '#fff',
            fontFamily: "'Inter', system-ui, sans-serif",
            boxShadow: '0 2px 8px rgba(246,130,31,0.35)',
          }}>SI</div>
          <div style={{ overflow: 'hidden' }}>
            <p style={{ fontSize: '14px', fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 700, color: 'var(--tx1)', margin: 0, letterSpacing: '-0.01em', lineHeight: 1.2 }}>ServerInventory</p>
            <p style={{ fontSize: '9px', color: 'var(--tx3)', fontFamily: "'JetBrains Mono', monospace", margin: '3px 0 0 0', letterSpacing: '0.12em', textTransform: 'uppercase' }}>INFRA CONSOLE</p>
          </div>
        </div>

        {/* Nav */}
        <nav role="navigation" style={{ flex: 1, padding: '0.75rem 0', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1px' }}>
          <div style={{ ...NAV_SECTION, marginTop: '4px' }}>Main</div>
          <NavBtn id="dashboard" label="Dashboard" Icon={LayoutDashboard} currentView={currentView} onViewChange={onViewChange} />

          <div style={NAV_SECTION}>Inventory</div>
          <button
            style={navBtnStyle(isInventoryView)}
            onClick={() => setInventoryOpen(o => !o)}
            onMouseEnter={e => { if (!isInventoryView) { e.currentTarget.style.color = 'var(--tx1)'; e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)' } }}
            onMouseLeave={e => { if (!isInventoryView) { e.currentTarget.style.color = 'var(--tx2)'; e.currentTarget.style.backgroundColor = 'transparent' } }}
          >
            <Layers size={15} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>All Resources</span>
            <ChevronDown size={12} style={{ flexShrink: 0, transition: 'transform 150ms', transform: inventoryOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} />
          </button>

          {inventoryOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', paddingLeft: '8px' }}>
              {INVENTORY_SUB.map(({ id, label, Icon }) => {
                const active = currentView === id
                return (
                  <button
                    key={id}
                    style={subNavBtnStyle(active)}
                    onClick={() => onViewChange(id)}
                    aria-current={active ? 'page' : undefined}
                    onMouseEnter={e => { if (!active) { e.currentTarget.style.color = 'var(--tx1)'; e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)' } }}
                    onMouseLeave={e => { if (!active) { e.currentTarget.style.color = 'var(--tx2)'; e.currentTarget.style.backgroundColor = 'transparent' } }}
                  >
                    <Icon size={13} style={{ flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
                  </button>
                )
              })}
            </div>
          )}

          <div style={NAV_SECTION}>Operations</div>
          {NAV.slice(0, 4).map(({ id, label, Icon }) => (
            <NavBtn key={id} id={id} label={label} Icon={Icon} currentView={currentView} onViewChange={onViewChange} />
          ))}

          <div style={NAV_SECTION}>Config</div>
          {NAV.slice(4).map(({ id, label, Icon }) => (
            <NavBtn key={id} id={id} label={label} Icon={Icon} currentView={currentView} onViewChange={onViewChange} />
          ))}
        </nav>

        {/* Footer */}
        <div style={{ paddingBottom: '16px', borderTop: '1px solid var(--bd)', paddingTop: '8px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {isAdmin && (
            <>
              <div style={{ ...NAV_SECTION, marginTop: '8px' }}>Account</div>
              <NavBtn id="users" label="Manage Users" Icon={Users} currentView={currentView} onViewChange={onViewChange} />
              <NavBtn id="setup" label="Admin Setup" Icon={SlidersHorizontal} currentView={currentView} onViewChange={onViewChange} />
            </>
          )}

          {user && (
            <div style={{
              margin: '8px 12px 4px',
              padding: '10px 12px',
              borderRadius: '6px',
              background: 'var(--bg-s2)',
              border: '1px solid var(--bd)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}>
              <div style={{
                width: '28px', height: '28px',
                borderRadius: '6px',
                backgroundColor: roleColor + '20',
                border: `1px solid ${roleColor}35`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <RoleIcon size={13} style={{ color: roleColor }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: '12px', fontWeight: 600, color: 'var(--tx1)', fontFamily: "'Inter', system-ui, sans-serif", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user.username}
                </p>
                <p style={{ margin: 0, fontSize: '9px', fontFamily: "'JetBrains Mono', monospace", color: roleColor, letterSpacing: '0.12em', textTransform: 'uppercase', opacity: 0.85 }}>
                  {user.role}
                </p>
              </div>
              <button
                onClick={logout}
                aria-label="Sign out"
                title="Sign out"
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: '4px', display: 'flex', alignItems: 'center', color: 'var(--tx3)', flexShrink: 0, transition: 'color 150ms ease' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--sr)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--tx3)' }}
              >
                <LogOut size={13} />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ── Main ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        {/* Header */}
        <header style={{
          height: '54px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px',
          borderBottom: '1px solid var(--bd)',
          backgroundColor: 'var(--header-bg)',
          backdropFilter: 'blur(20px)',
          flexShrink: 0,
        }}>
          <Flex align="center" gap={3}>
            <button
              onClick={() => setOpen(o => !o)}
              aria-label={open ? 'Close sidebar' : 'Open sidebar'}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: '8px', display: 'flex', alignItems: 'center', color: 'var(--tx2)', transition: 'all 150ms ease' }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--bg-s2)'; e.currentTarget.style.color = 'var(--tx1)' }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--tx2)' }}
            >
              {open ? <X size={17} /> : <Menu size={17} />}
            </button>
            <Heading as="h1" style={{ fontSize: '15px', color: 'var(--tx1)', fontStyle: 'normal' }}>
              {VIEW_TITLE[currentView]}
            </Heading>
          </Flex>

          <Flex align="center" gap={2}>
            <div
              title={isConnected ? 'Live — WebSocket connected' : 'Reconnecting…'}
              style={{ width: '7px', height: '7px', borderRadius: '50%', flexShrink: 0, backgroundColor: isConnected ? 'var(--sg)' : 'var(--sy)', boxShadow: isConnected ? '0 0 6px var(--sg-glow)' : 'none', transition: 'all 300ms ease' }}
            />
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

            {currentView === 'servers' && canWrite && (
              <Button intent="primary" onClick={onAddServer}>
                <Plus size={14} />
                <span className="hidden sm:inline">Add Server</span>
              </Button>
            )}

            {canWrite && (
              <Flex align="center" gap={2}>
                {(syncStatus !== 'idle' || (isSyncing && syncSummary !== '')) && (
                  <div
                    className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono max-w-[220px] truncate"
                    style={
                      !isSyncing && syncStatus === 'error'
                        ? { background: 'var(--sr-bg)', color: 'var(--sr)', border: '1px solid var(--sr-bd)' }
                        : !isSyncing && syncStatus === 'done'
                        ? { background: 'var(--sg-bg)', color: 'var(--sg)', border: '1px solid var(--sg-bd)' }
                        : { background: 'var(--ac-bg)', color: 'var(--ac)', border: '1px solid var(--ac-bd)' }
                    }
                  >
                    {syncStatus === 'done'  && <CheckCircle2 size={11} className="shrink-0" />}
                    {syncStatus === 'error' && <XCircle      size={11} className="shrink-0" />}
                    <span className="truncate">{syncSummary}</span>
                  </div>
                )}

                {isSyncing && (
                  <Button
                    intent="ghost"
                    onClick={() => stopMutation.mutate()}
                    disabled={stopMutation.isPending}
                    size="sm"
                    style={{ color: 'var(--sr)', borderColor: 'var(--sr-bd)' }}
                    aria-label="Stop all syncs"
                    title="Stop all syncs"
                  >
                    <Square size={13} />
                    <span className="hidden sm:inline">Stop</span>
                  </Button>
                )}

                <Button
                  intent="primary"
                  onClick={() => syncMutation.mutate()}
                  disabled={isSyncing || syncMutation.isPending}
                  aria-label="Sync all cloud providers"
                >
                  <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} aria-hidden="true" />
                  <span className="hidden sm:inline">
                    {isSyncing ? `Syncing${activeSyncs.size > 1 ? ` (${activeSyncs.size})` : ''}…` : 'Sync All'}
                  </span>
                </Button>
              </Flex>
            )}
          </Flex>
        </header>

        <main style={{ flex: 1, overflow: 'auto', padding: '24px', backgroundColor: 'var(--bg-base)', backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='98'%3E%3Cpath d='M55.98 34.5l-28-16-28 16v31l28 16 28-16zm-28 42l-24-13.86V38.36l24-13.86 24 13.86v24.28z' fill='%23F6821F' fill-opacity='0.05' stroke='%23F6821F' stroke-opacity='0.2' stroke-width='1'/%3E%3C/svg%3E\")", backgroundSize: '56px 98px' }} role="main">
          {children}
        </main>
      </div>
    </div>
  )
}
