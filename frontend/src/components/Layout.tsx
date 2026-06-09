import { useState, useCallback, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Server, Cloud, Activity, RefreshCw, Plus,
  Menu, X, Settings, Users, LogOut, Shield, PencilLine, Eye,
  CheckCircle2, XCircle, LayoutDashboard, Terminal, Square, SlidersHorizontal, Timer,
  Layers, Database, Box, ChevronDown, HardDrive, Network,
} from 'lucide-react'
import { syncApi, getErrorMessage } from '../api'
import { useToast } from '../hooks/useToast'
import { useAuth } from '../hooks/useAuth'
import { useWebSocket, type SyncEvent } from '../hooks/useWebSocket'
import ThemeToggle from './ThemeToggle'
import type { View } from '../types'
import { styled } from '../stitches.config'
import { Flex, Button, Heading } from './StitchUI'

interface LayoutProps {
  currentView: View
  onViewChange: (v: View) => void
  onAddServer: () => void
  children: React.ReactNode
}

const INVENTORY_VIEWS: View[] = ['servers', 'databases', 'kubernetes', 'block_storage', 'ips']

const INVENTORY_SUB: { id: View; label: string; Icon: React.ElementType }[] = [
  { id: 'servers',       label: 'Servers',       Icon: Server      },
  { id: 'databases',     label: 'Databases',     Icon: Database    },
  { id: 'kubernetes',    label: 'Kubernetes',    Icon: Box         },
  { id: 'block_storage', label: 'Block Storage', Icon: HardDrive   },
  { id: 'ips',           label: 'IP Addresses',  Icon: Network     },
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
  admin: '#6366F1',
  write: '#4285F4',
  read:  '#8B8AAE',
}

// ── Stitches Styled Shell ──────────────────────────────────────────────────

const Container = styled('div', {
  display: 'flex',
  height: '100vh',
  backgroundColor: '$bgBase',
  overflow: 'hidden',
});

const Sidebar = styled('aside', {
  display: 'flex',
  flexDirection: 'column',
  flexShrink: 0,
  borderRight: '1px solid $border',
  transition: 'width 200ms ease',
  background: 'linear-gradient(180deg, var(--sidebar-from) 0%, var(--sidebar-to) 100%)',
  variants: {
    open: {
      true: { width: '240px' },
      false: { width: '0px', overflow: 'hidden', borderRight: 'none' },
    },
  },
});

const LogoContainer = styled('div', {
  padding: '$6',
  display: 'flex',
  alignItems: 'center',
  gap: '$3',
});


const NavContainer = styled('nav', {
  flex: 1,
  padding: '0.75rem 0',
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '1px',
});

const NavSection = styled('div', {
  padding: '0 $4',
  marginTop: '16px',
  marginBottom: '4px',
  fontSize: '9px',
  fontFamily: "'JetBrains Mono', monospace",
  fontWeight: 600,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  color: 'var(--tx3)',
  opacity: 0.7,
  '&:first-child': { marginTop: '4px' },
});

const NavButton = styled('button', {
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  gap: '$3',
  padding: '0.625rem $4',
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: '10px',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: '$tx2',
  backgroundColor: 'transparent',
  border: 'none',
  borderLeft: '2px solid transparent',
  transition: 'all 150ms ease',
  cursor: 'pointer',
  textAlign: 'left',
  outline: 'none',
  '&:hover': {
    color: '$accent',
    backgroundColor: '$navActiveBg',
  },
  variants: {
    active: {
      true: {
        color: '$accent',
        fontWeight: 700,
        borderLeftColor: '$accent',
        backgroundColor: '$navActiveBg',
      },
    },
  },
});

const SubNavContainer = styled('div', {
  marginLeft: '$4',
  borderLeft: '1px solid $border',
  paddingLeft: '0.25rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
  paddingTop: '2px',
  paddingBottom: '2px',
});

const SubNavButton = styled('button', {
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  gap: '$3',
  padding: '0.5rem $3',
  fontSize: '13px',
  borderRadius: '$md',
  color: '$tx2',
  backgroundColor: 'transparent',
  border: 'none',
  transition: 'all 150ms ease',
  cursor: 'pointer',
  textAlign: 'left',
  outline: 'none',
  '&:hover': {
    color: '$accent',
    backgroundColor: '$navActiveBg',
  },
  variants: {
    active: {
      true: {
        color: '$accent',
        fontWeight: 700,
        backgroundColor: '$navActiveBg',
      },
    },
  },
});

const SidebarFooter = styled('div', {
  paddingBottom: '$4',
  borderTop: '1px solid $border',
  paddingTop: '$2',
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
});

const MainArea = styled('div', {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0,
  overflow: 'hidden',
});

const Header = styled('header', {
  height: '54px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 $5',
  borderBottom: '1px solid $border',
  backgroundColor: '$headerBg',
  backdropFilter: 'blur(20px)',
  webkitBackdropFilter: 'blur(20px)',
  flexShrink: 0,
});

export default function Layout({
  currentView, onViewChange, onAddServer, children,
}: LayoutProps) {
  const [open, setOpen] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 768 : true
  )
  useEffect(() => {
    function handleResize() {
      if (window.innerWidth < 768) setOpen(false)
      else setOpen(true)
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

    } else if (event.type === 'server_status_changed') {
      const prev = event.old_status ?? ''
      const next = event.new_status ?? ''
      const name = event.server_name ?? 'Server'
      if (next === 'running' && prev !== 'running') {
        toast.success(`${name} → online`)
      } else if ((next === 'stopped' || next === 'terminated') && prev === 'running') {
        toast.error(`${name} → offline`)
      }
      qc.invalidateQueries({ queryKey: ['servers'] })
      qc.invalidateQueries({ queryKey: ['stats']   })
    }

    // Broadcast all WS events to window so any component can subscribe
    window.dispatchEvent(new CustomEvent('ws:server-event', { detail: event }))
  }, [qc, toast])

  const { isConnected } = useWebSocket(handleWsEvent)

  const syncMutation = useMutation({
    mutationFn: () => syncApi.trigger(),
    onError: (error: unknown) => {
      setSyncStatus('error')
      const errorMsg = getErrorMessage(error)
      setSyncSummary(`Failed to start sync: ${errorMsg}`)
      toast.error(`Sync failed: ${errorMsg}`)
      setTimeout(() => setSyncStatus('idle'), 3000)
    },
  })

  const stopMutation = useMutation({
    mutationFn: () => syncApi.stop(),
    onSuccess: () => toast.info('Sync stopped'),
    onError: (error: unknown) => toast.error(`Failed to stop sync: ${getErrorMessage(error)}`),
  })

  const RoleIcon = user ? (ROLE_ICON[user.role] ?? Eye) : Eye
  const roleColor = user ? (ROLE_COLOR[user.role] ?? '#8B8AAE') : '#8B8AAE'

  return (
    <Container>
      {/* ── Sidebar ── */}
      <Sidebar open={open} aria-label="Sidebar navigation">
        {/* Logo */}
        <LogoContainer>
          <div className="overflow-hidden">
            <p style={{ fontSize: '15px', fontFamily: "'DM Sans', system-ui, sans-serif", fontStyle: 'normal', fontWeight: 800, color: 'var(--ac)', margin: 0, letterSpacing: '-0.015em', lineHeight: 1 }}>ServerInventory</p>
            <p style={{ fontSize: '8px', color: 'var(--tx3)', fontFamily: "'JetBrains Mono', monospace", margin: '4px 0 0 0', letterSpacing: '0.2em', textTransform: 'uppercase' }}>INFRASTRUCTURE CONSOLE</p>
          </div>
        </LogoContainer>

        {/* Nav */}
        <NavContainer role="navigation">
          {/* ── Main ── */}
          <NavSection>Main</NavSection>
          <NavButton
            onClick={() => onViewChange('dashboard')}
            active={currentView === 'dashboard'}
            aria-current={currentView === 'dashboard' ? 'page' : undefined}
          >
            <LayoutDashboard size={15} className="shrink-0" />
            <span className="truncate">Dashboard</span>
          </NavButton>

          {/* ── Inventory group ── */}
          <NavSection>Inventory</NavSection>
          <div>
            <NavButton
              onClick={() => setInventoryOpen(o => !o)}
              active={isInventoryView}
            >
              <Layers size={15} className="shrink-0" />
              <span className="flex-1 text-left truncate">All Resources</span>
              <ChevronDown
                size={12}
                className={`shrink-0 transition-transform duration-150 ${inventoryOpen ? 'rotate-180' : ''}`}
              />
            </NavButton>

            {inventoryOpen && (
              <SubNavContainer>
                {INVENTORY_SUB.map(({ id, label, Icon }) => (
                  <SubNavButton
                    key={id}
                    onClick={() => onViewChange(id)}
                    active={currentView === id}
                    aria-current={currentView === id ? 'page' : undefined}
                  >
                    <Icon size={13} className="shrink-0" />
                    <span className="truncate">{label}</span>
                  </SubNavButton>
                ))}
              </SubNavContainer>
            )}
          </div>

          {/* ── Operations ── */}
          <NavSection>Operations</NavSection>
          {NAV.slice(0, 4).map(({ id, label, Icon }) => (
            <NavButton
              key={id}
              onClick={() => onViewChange(id)}
              active={currentView === id}
              aria-current={currentView === id ? 'page' : undefined}
            >
              <Icon size={15} className="shrink-0" />
              <span className="truncate">{label}</span>
            </NavButton>
          ))}

          {/* ── Config ── */}
          <NavSection>Config</NavSection>
          {NAV.slice(4).map(({ id, label, Icon }) => (
            <NavButton
              key={id}
              onClick={() => onViewChange(id)}
              active={currentView === id}
              aria-current={currentView === id ? 'page' : undefined}
            >
              <Icon size={15} className="shrink-0" />
              <span className="truncate">{label}</span>
            </NavButton>
          ))}
        </NavContainer>

        {/* Footer */}
        <SidebarFooter>
          {isAdmin && (
            <>
              <NavSection style={{ marginTop: '8px' }}>Account</NavSection>
              <NavButton
                onClick={() => onViewChange('users')}
                active={currentView === 'users'}
              >
                <Users size={15} className="shrink-0" />
                <span className="truncate">Manage Users</span>
              </NavButton>
              <NavButton
                onClick={() => onViewChange('setup')}
                active={currentView === 'setup'}
              >
                <SlidersHorizontal size={15} className="shrink-0" />
                <span className="truncate">Admin Setup</span>
              </NavButton>
            </>
          )}

          {/* User card */}
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
              {/* Avatar initials */}
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
                <p style={{ margin: 0, fontSize: '12px', fontWeight: 600, color: 'var(--tx1)', fontFamily: "'DM Sans', system-ui, sans-serif", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
                style={{
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  padding: '4px', borderRadius: '4px', display: 'flex',
                  alignItems: 'center', color: 'var(--tx3)', flexShrink: 0,
                  transition: 'color 150ms ease',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--sr)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--tx3)' }}
              >
                <LogOut size={13} />
              </button>
            </div>
          )}
        </SidebarFooter>
      </Sidebar>

      {/* ── Main ── */}
      <MainArea>
        {/* Header */}
        <Header>
          <Flex align="center" gap={3}>
            <button
              onClick={() => setOpen(o => !o)}
              aria-label={open ? 'Close sidebar' : 'Open sidebar'}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                color: 'var(--tx2)',
                transition: 'all 150ms ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)';
                e.currentTarget.style.color = 'var(--tx1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = 'var(--tx2)';
              }}
            >
              {open ? <X size={17} /> : <Menu size={17} />}
            </button>
            <Heading as="h1" style={{ fontSize: '15px', color: 'var(--tx1)' }}>
              {VIEW_TITLE[currentView]}
            </Heading>
          </Flex>

          <Flex align="center" gap={2}>
            {/* WS connection indicator */}
            <div
              title={isConnected ? 'Live — WebSocket connected' : 'Reconnecting…'}
              style={{
                width: '7px', height: '7px', borderRadius: '50%', flexShrink: 0,
                backgroundColor: isConnected ? 'var(--sg)' : 'var(--sy)',
                boxShadow: isConnected ? '0 0 6px var(--sg-glow)' : 'none',
                transition: 'all 300ms ease',
              }}
            />
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
              <Button intent="primary" onClick={onAddServer}>
                <Plus size={14} />
                <span className="hidden sm:inline">Add Server</span>
              </Button>
            )}

            {canWrite && (
              <Flex align="center" gap={2}>
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
                    {syncStatus === 'done'  && <CheckCircle2 size={11} className="shrink-0" />}
                    {syncStatus === 'error' && <XCircle      size={11} className="shrink-0" />}
                    <span className="truncate">{syncSummary}</span>
                  </div>
                )}

                {/* Stop sync button */}
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
        </Header>

        {/* Content */}
        <main style={{ flex: 1, overflow: 'auto', padding: '24px', backgroundColor: 'var(--bg-base)' }} role="main">
          {children}
        </main>
      </MainArea>
    </Container>
  )
}

