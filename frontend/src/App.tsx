import { useState, useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
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
import SSHPage from './components/SSHPage'
import SettingsPage from './components/SettingsPage'
import CronsPage from './components/CronsPage'
import ServerDetailModal from './components/ServerDetailModal'
import ErrorBoundary from './components/ErrorBoundary'
import { GooeyFilter } from './components/Toggle'
import type { View, Server } from './types'
import { styled } from './stitches.config'

const SplitPane = styled('div', {
  display: 'flex',
  flexDirection: 'column',
  gap: '$5',
  width: '100%',
  alignItems: 'stretch',
  '@lg': {
    flexDirection: 'row',
  },
});

const TablePane = styled('div', {
  flex: 1,
  minWidth: 0,
});

const DetailPane = styled('div', {
  width: '100%',
  flexShrink: 0,
  '@lg': {
    width: '450px',
    position: 'sticky',
    top: '0px',
    height: 'calc(100vh - 102px)',
    overflow: 'hidden',
  },
});


const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
  },
})

const PATH_TO_VIEW: Record<string, View> = {
  '/':                    'servers',
  '/dashboard':           'dashboard',
  '/inventory':           'servers',
  '/inventory/servers':   'servers',
  '/inventory/databases': 'databases',
  '/inventory/kubernetes':'kubernetes',
  '/inventory/block-storage': 'block_storage',
  '/providers':           'providers',
  '/sync-logs':           'sync-logs',
  '/crons':               'crons',
  '/ssh':                 'ssh',
  '/settings':            'settings',
  '/users':               'users',
}

const VIEW_TO_PATH: Record<View, string> = {
  'dashboard':      '/dashboard',
  'servers':        '/inventory/servers',
  'databases':      '/inventory/databases',
  'kubernetes':     '/inventory/kubernetes',
  'block_storage':  '/inventory/block-storage',
  'providers':      '/providers',
  'sync-logs':      '/sync-logs',
  'crons':          '/crons',
  'ssh':            '/ssh',
  'settings':       '/settings',
  'users':          '/users',
}

function AppContent() {
  const { user } = useAuth()

  const [view, setView] = useState<View>(
    () => PATH_TO_VIEW[window.location.pathname] ?? 'servers',
  )
  const [showAddServer, setShowAddServer]     = useState(false)
  const [selectedServer, setSelectedServer]   = useState<Server | null>(null)
  const [editingServer, setEditingServer]     = useState<Server | null>(null)

  useEffect(() => {
    const handler = () =>
      setView(PATH_TO_VIEW[window.location.pathname] ?? 'servers')
    window.addEventListener('popstate', handler)
    return () => window.removeEventListener('popstate', handler)
  }, [])

  function navigate(v: View) {
    setView(v)
    window.history.pushState({}, '', VIEW_TO_PATH[v])
  }

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
          <div className="space-y-5 animate-fade-in">
            {selectedServer ? (
              <SplitPane>
                <TablePane>
                  <ServerTable
                    onAddServer={() => setShowAddServer(true)}
                    onServerClick={setSelectedServer}
                    onEditServer={canWrite ? setEditingServer : undefined}
                    compact={true}
                    selectedServerId={selectedServer.id}
                  />
                </TablePane>
                <DetailPane>
                  <ServerDetailModal
                    server={selectedServer}
                    onClose={() => setSelectedServer(null)}
                    onServerUpdated={setSelectedServer}
                    inline={true}
                  />
                </DetailPane>
              </SplitPane>
            ) : (
              <ServerTable
                onAddServer={() => setShowAddServer(true)}
                onServerClick={setSelectedServer}
                onEditServer={canWrite ? setEditingServer : undefined}
              />
            )}
          </div>
        )}

        {view === 'databases' && <DatabasesPage />}
        {view === 'kubernetes' && <KubernetesPage />}
        {view === 'block_storage' && <BlockStoragePage />}

        {view === 'providers' && (
          <div className="animate-fade-in">
            <ProvidersPage />
          </div>
        )}

        {view === 'users' && user.role === 'admin' && (
          <div className="animate-fade-in">
            <UsersPage />
          </div>
        )}

        {view === 'sync-logs' && (
          <div className="animate-fade-in">
            <SyncLogsPage />
          </div>
        )}

        {view === 'crons' && (
          <div className="animate-fade-in">
            <CronsPage />
          </div>
        )}

        {view === 'ssh' && (
          <div className="animate-fade-in">
            <SSHPage />
          </div>
        )}

        {view === 'settings' && (
          <div className="animate-fade-in">
            <SettingsPage />
          </div>
        )}
      </div>

      {showAddServer  && canWrite  && <AddServerModal    onClose={() => setShowAddServer(false)}    />}
      {editingServer  && canWrite  && (
        <AddServerModal
          server={editingServer}
          onClose={() => setEditingServer(null)}
        />
      )}
      {selectedServer && view !== 'servers' && (
        <ServerDetailModal
          server={selectedServer}
          onClose={() => setSelectedServer(null)}
          onServerUpdated={setSelectedServer}
        />
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
