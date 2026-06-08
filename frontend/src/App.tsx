import { useState, useEffect, useRef } from 'react'
import { useQuery, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ToastProvider } from './hooks/useToast'
import { ThemeProvider } from './hooks/useTheme'
import { AuthProvider, useAuth } from './hooks/useAuth'
import ToastContainer from './components/Toast'
import LoginPage from './components/LoginPage'
import Layout from './components/Layout'
import ServerTable from './components/ServerTable'
import AddServerModal from './components/AddServerModal'
import ProvidersPage from './components/ProvidersPage'
import UsersPage from './components/UsersPage'
import SyncLogsPage from './components/SyncLogsPage'
import DashboardPage from './components/DashboardPage'
import DatabasesPage from './components/DatabasesPage'
import KubernetesPage from './components/KubernetesPage'
import BlockStoragePage from './components/BlockStoragePage'
import IpsPage from './components/IpsPage'
import SSHPage from './components/SSHPage'
import SettingsPage from './components/SettingsPage'
import CronsPage from './components/CronsPage'
import SetupPage from './components/SetupPage'
import MfaChallengePage from './components/MfaChallengePage'
import ServerDetailModal from './components/ServerDetailModal'
import ErrorBoundary from './components/ErrorBoundary'
import { GooeyFilter } from './components/Toggle'
import { ArrowLeft } from 'lucide-react'
import type { View, Server } from './types'
import { serversApi } from './api'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
  },
})

const PATH_TO_VIEW: Record<string, View> = {
  '/':                         'dashboard',
  '/dashboard':                'dashboard',
  '/inventory':                'servers',
  '/inventory/servers':        'servers',
  '/inventory/databases':      'databases',
  '/inventory/kubernetes':     'kubernetes',
  '/inventory/block-storage':  'block_storage',
  '/inventory/ips':            'ips',
  '/providers':                'providers',
  '/sync-logs':                'sync-logs',
  '/crons':                    'crons',
  '/ssh':                      'ssh',
  '/settings':                 'settings',
  '/users':                    'users',
  '/setup':                    'setup',
}

const VIEW_TO_PATH: Record<View, string> = {
  'dashboard':     '/dashboard',
  'servers':       '/inventory/servers',
  'databases':     '/inventory/databases',
  'kubernetes':    '/inventory/kubernetes',
  'block_storage': '/inventory/block-storage',
  'ips':           '/inventory/ips',
  'providers':     '/providers',
  'sync-logs':     '/sync-logs',
  'crons':         '/crons',
  'ssh':           '/ssh',
  'settings':      '/settings',
  'users':         '/users',
  'setup':         '/setup',
}

function parseLocation(): { view: View; serverId: number | null } {
  const path = window.location.pathname
  const m = path.match(/^\/inventory\/servers\/(\d+)$/)
  if (m) return { view: 'servers', serverId: parseInt(m[1]) }
  return { view: PATH_TO_VIEW[path] ?? 'servers', serverId: null }
}

function AppContent() {
  const { user, mfaChallenge } = useAuth()

  const [view, setView]                       = useState<View>(() => parseLocation().view)
  const [showAddServer, setShowAddServer]     = useState(false)
  const [selectedServer, setSelectedServer]   = useState<Server | null>(null)
  const [editingServer, setEditingServer]     = useState<Server | null>(null)
  const [currentServerId, setCurrentServerId] = useState<number | null>(() => parseLocation().serverId)

  // Load server by ID when navigating directly to /inventory/servers/:id (or browser refresh)
  const { data: serverFromId } = useQuery({
    queryKey: ['server', currentServerId],
    queryFn: () => serversApi.get(currentServerId!),
    enabled: currentServerId != null && selectedServer?.id !== currentServerId,
    staleTime: 30_000,
  })

  // Sync query result into selectedServer state
  const prevServerId = useRef<number | null>(null)
  useEffect(() => {
    if (serverFromId && serverFromId.id === currentServerId && prevServerId.current !== currentServerId) {
      prevServerId.current = currentServerId
      setSelectedServer(serverFromId)
    }
  }, [serverFromId, currentServerId])

  // Handle browser back / forward
  useEffect(() => {
    const handler = () => {
      const { view: v, serverId } = parseLocation()
      setView(v)
      setCurrentServerId(serverId)
      if (!serverId) setSelectedServer(null)
    }
    window.addEventListener('popstate', handler)
    return () => window.removeEventListener('popstate', handler)
  }, [])

  function navigate(v: View) {
    setView(v)
    setSelectedServer(null)
    setCurrentServerId(null)
    setEditingServer(null)
    window.history.pushState({}, '', VIEW_TO_PATH[v])
  }

  function openServer(server: Server) {
    setSelectedServer(server)
    setCurrentServerId(server.id)
    window.history.pushState({}, '', `/inventory/servers/${server.id}`)
  }

  function closeServer() {
    setSelectedServer(null)
    setCurrentServerId(null)
    window.history.pushState({}, '', VIEW_TO_PATH['servers'])
  }

  if (!user && mfaChallenge) return <MfaChallengePage />
  if (!user) return <LoginPage />

  const canWrite = user.role !== 'read'

  return (
    <Layout
      currentView={view}
      onViewChange={navigate}
      onAddServer={() => setShowAddServer(true)}
    >
      <div key={view} className="contents">
        {view === 'dashboard' && (
          <div className="animate-fade-in">
            <DashboardPage />
          </div>
        )}

        {view === 'servers' && (
          <div className="animate-fade-in">
            {selectedServer ? (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {/* Breadcrumb / back row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                  <button
                    onClick={closeServer}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '6px',
                      background: 'transparent', border: '1px solid var(--bd)', borderRadius: '6px',
                      padding: '5px 12px', fontSize: '12.5px', fontWeight: 500, color: 'var(--tx2)',
                      cursor: 'pointer', transition: 'all 150ms ease',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--bd-strong)'; e.currentTarget.style.color = 'var(--tx1)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--bd)'; e.currentTarget.style.color = 'var(--tx2)'; }}
                  >
                    <ArrowLeft size={13} />
                    Back to Servers
                  </button>
                  <span style={{ fontSize: '12px', color: 'var(--tx3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {selectedServer.name}
                  </span>
                </div>
                {/* Full-page detail */}
                <ServerDetailModal
                  server={selectedServer}
                  onClose={closeServer}
                  onServerUpdated={s => { setSelectedServer(s); queryClient.setQueryData(['server', s.id], s) }}
                  inline={true}
                />
              </div>
            ) : (
              <ServerTable
                onAddServer={() => setShowAddServer(true)}
                onServerClick={openServer}
                onEditServer={canWrite ? setEditingServer : undefined}
              />
            )}
          </div>
        )}

        {view === 'databases'     && <DatabasesPage />}
        {view === 'kubernetes'    && <KubernetesPage />}
        {view === 'block_storage' && <BlockStoragePage />}
        {view === 'ips'           && <IpsPage />}

        {view === 'providers' && (
          <div className="animate-fade-in"><ProvidersPage /></div>
        )}
        {view === 'users' && user.role === 'admin' && (
          <div className="animate-fade-in"><UsersPage /></div>
        )}
        {view === 'sync-logs' && (
          <div className="animate-fade-in"><SyncLogsPage /></div>
        )}
        {view === 'crons' && (
          <div className="animate-fade-in"><CronsPage /></div>
        )}
        {view === 'ssh' && (
          <div className="animate-fade-in"><SSHPage /></div>
        )}
        {view === 'settings' && (
          <div className="animate-fade-in"><SettingsPage /></div>
        )}
        {view === 'setup' && user.role === 'admin' && (
          <div className="animate-fade-in"><SetupPage /></div>
        )}
      </div>

      {showAddServer && canWrite && (
        <AddServerModal onClose={() => setShowAddServer(false)} />
      )}
      {editingServer && canWrite && (
        <AddServerModal server={editingServer} onClose={() => setEditingServer(null)} />
      )}
    </Layout>
  )
}

export default function App() {
  return (
    <>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <QueryClientProvider client={queryClient}>
              <ErrorBoundary>
                <AppContent />
              </ErrorBoundary>
            </QueryClientProvider>
          </AuthProvider>
          <ToastContainer />
        </ToastProvider>
      </ThemeProvider>
      <GooeyFilter />
    </>
  )
}
