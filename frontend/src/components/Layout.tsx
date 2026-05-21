import { useState, useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Server, Cloud, Activity, RefreshCw, Plus,
  Menu, X, Settings, Wifi, Users, LogOut, Shield, PencilLine, Eye,
  CheckCircle2, XCircle, LayoutDashboard, Terminal, Square, SlidersHorizontal, Timer,
  Layers, Database, Box, ChevronDown, HardDrive,
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

const INVENTORY_VIEWS: View[] = ['servers', 'databases', 'kubernetes', 'block_storage']

const INVENTORY_SUB: { id: View; label: string; Icon: React.ElementType }[] = [
  { id: 'servers',       label: 'Servers',       Icon: Server      },
  { id: 'databases',     label: 'Databases',     Icon: Database    },
  { id: 'kubernetes',    label: 'Kubernetes',    Icon: Box         },
  { id: 'block_storage', label: 'Block Storage', Icon: HardDrive   },
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
  providers:       'Cloud Providers',
  'sync-logs':     'Sync Logs',
  crons:           'Cron Jobs',
  ssh:             'SSH Credentials',
  settings:        'Settings',
  users:           'User Management',
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

const LogoIconWrap = styled('div', {
  width: '32px',
  height: '32px',
  borderRadius: '$md',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '$accent',
  flexShrink: 0,
});

const NavContainer = styled('nav', {
  flex: 1,
  padding: '0.5rem 0',
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
});

const NavButton = styled('button', {
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  gap: '$3',
  padding: '0.625rem $4',
  fontSize: '$sm',
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
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
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
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
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
  const [open, setOpen] = useState(true)
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
    }
  }, [qc, toast])

  useWebSocket(handleWsEvent)

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
          <LogoIconWrap>
            <Wifi size={15} className="text-black" />
          </LogoIconWrap>
          <div className="overflow-hidden">
            <p style={{ fontSize: '15px', fontFamily: 'DM Sans', fontWeight: 800, color: 'var(--ac)', margin: 0, letterSpacing: '-0.015em' }}>ServerInventory</p>
            <p style={{ fontSize: '9px', color: 'var(--tx3)', fontFamily: 'monospace', margin: '2px 0 0 0', letterSpacing: '0.2em', textTransform: 'uppercase' }}>INFRASTRUCTURE CONSOLE</p>
          </div>
        </LogoContainer>

        {/* Nav */}
        <NavContainer role="navigation">
          {/* Dashboard */}
          <NavButton
            onClick={() => onViewChange('dashboard')}
            active={currentView === 'dashboard'}
            aria-current={currentView === 'dashboard' ? 'page' : undefined}
          >
            <LayoutDashboard size={16} className="shrink-0" />
            <span className="truncate">Dashboard</span>
          </NavButton>

          {/* ── Inventory group ── */}
          <div>
            <NavButton
              onClick={() => setInventoryOpen(o => !o)}
              active={isInventoryView}
            >
              <Layers size={16} className="shrink-0" />
              <span className="flex-1 text-left truncate">Inventory</span>
              <ChevronDown
                size={13}
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
                    <Icon size={14} className="shrink-0" />
                    <span className="truncate">{label}</span>
                  </SubNavButton>
                ))}
              </SubNavContainer>
            )}
          </div>

          {/* Rest of nav */}
          {NAV.map(({ id, label, Icon }) => (
            <NavButton
              key={id}
              onClick={() => onViewChange(id)}
              active={currentView === id}
              aria-current={currentView === id ? 'page' : undefined}
            >
              <Icon size={16} className="shrink-0" />
              <span className="truncate">{label}</span>
            </NavButton>
          ))}
        </NavContainer>

        {/* Footer */}
        <SidebarFooter>
          <NavButton
            onClick={() => onViewChange('providers')}
            active={currentView === 'providers'}
          >
            <Settings size={16} className="shrink-0" />
            <span className="truncate">Manage Credentials</span>
          </NavButton>

          {isAdmin && (
            <NavButton
              onClick={() => onViewChange('users')}
              active={currentView === 'users'}
            >
              <Users size={16} className="shrink-0" />
              <span className="truncate">Manage Users</span>
            </NavButton>
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
            <Heading level="h1" style={{ fontSize: '15px', color: 'var(--tx1)' }}>
              {VIEW_TITLE[currentView]}
            </Heading>
          </Flex>

          <Flex align="center" gap={2}>
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

            {/* Logout */}
            <button
              onClick={logout}
              aria-label="Sign out"
              title="Sign out"
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '8px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                color: 'var(--tx2)',
                transition: 'all 150ms ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                e.currentTarget.style.color = 'var(--sr)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = 'var(--tx2)';
              }}
            >
              <LogOut size={16} />
            </button>
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

