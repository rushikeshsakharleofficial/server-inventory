import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, Lock, ExternalLink } from 'lucide-react'
import { http } from '../api'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'

interface AppSetting {
  key: string
  value: string | number | boolean
}

const settingsApi = {
  list: () => http.get<AppSetting[]>('/api/settings').then(r => r.data),
  update: (key: string, value: string | number | boolean) =>
    http.put<AppSetting>(`/api/settings/${key}`, { value }).then(r => r.data),
}

function useSettingValue(settings: AppSetting[], key: string) {
  return settings.find(s => s.key === key)?.value
}

function SkeletonField() {
  return (
    <div className="space-y-1.5" aria-hidden="true">
      <div className="skeleton h-3 w-24 rounded" />
      <div className="skeleton h-9 w-full rounded-lg" />
    </div>
  )
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card-dark overflow-hidden">
      <div
        className="px-5 py-3.5 border-b"
        style={{ borderColor: 'var(--bd)', background: 'var(--bg-s2)' }}
      >
        <p className="text-sm font-semibold text-ink-primary">{title}</p>
      </div>
      <div className="p-5 space-y-5">{children}</div>
    </div>
  )
}

interface NumberFieldProps {
  label: string
  settingKey: string
  unit?: string
  readOnly?: boolean
  value: number
  onSave: (key: string, value: number) => void
  isPending: boolean
  pendingKey: string | null
}

function NumberField({
  label,
  settingKey,
  unit,
  readOnly = false,
  value,
  onSave,
  isPending,
  pendingKey,
}: NumberFieldProps) {
  const [local, setLocal] = useState(String(value))

  useEffect(() => {
    setLocal(String(value))
  }, [value])

  const isSaving = isPending && pendingKey === settingKey
  const isDirty  = local !== String(value)

  if (readOnly) {
    return (
      <div>
        <div className="flex items-center gap-1.5 mb-1.5">
          <label className="text-xs font-medium text-ink-secondary">{label}</label>
          <Lock size={11} className="text-ink-dim" aria-label="Read-only" />
        </div>
        <div
          className="rounded-lg px-3 py-2 text-sm text-ink-muted flex items-center justify-between"
          style={{ background: 'var(--bg-s2)', border: '1px solid var(--bd)' }}
        >
          <span className="font-mono tabular-nums">{value}</span>
          {unit && <span className="text-ink-dim text-xs">{unit}</span>}
        </div>
      </div>
    )
  }

  return (
    <div>
      <label className="block text-xs font-medium text-ink-secondary mb-1.5">{label}</label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="number"
            value={local}
            onChange={e => setLocal(e.target.value)}
            className="input-dark pr-14"
          />
          {unit && (
            <span
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs pointer-events-none"
              style={{ color: 'var(--tx3)' }}
            >
              {unit}
            </span>
          )}
        </div>
        <button
          onClick={() => {
            const n = parseFloat(local)
            if (!isNaN(n)) onSave(settingKey, n)
          }}
          disabled={!isDirty || isSaving}
          className="btn-primary px-3.5"
        >
          {isSaving ? (
            <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
          ) : (
            <Save size={14} />
          )}
          {isSaving ? 'Saving' : 'Save'}
        </button>
      </div>
    </div>
  )
}

interface ToggleFieldProps {
  label: string
  description?: string
  settingKey: string
  readOnly?: boolean
  checked: boolean
  onToggle: (key: string, value: boolean) => void
}

function ToggleField({
  label,
  description,
  settingKey,
  readOnly = false,
  checked,
  onToggle,
}: ToggleFieldProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium text-ink-secondary">{label}</p>
          {readOnly && <Lock size={11} className="text-ink-dim" aria-label="Read-only" />}
        </div>
        {description && (
          <p className="text-xs text-ink-muted mt-0.5">{description}</p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => { if (!readOnly) onToggle(settingKey, !checked) }}
        disabled={readOnly}
        className={`relative flex-shrink-0 w-10 h-6 rounded-full transition-colors duration-200 focus:outline-none disabled:cursor-not-allowed ${
          checked ? 'opacity-100' : 'opacity-80'
        }`}
        style={{ background: checked ? 'var(--ac)' : 'var(--bg-s3)', border: '1px solid var(--bd)' }}
      >
        <span
          className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200"
          style={{ transform: checked ? 'translateX(16px)' : 'translateX(0)' }}
        />
      </button>
    </div>
  )
}

const APP_VERSION = '1.0.0'

export default function SettingsPage() {
  const { user } = useAuth()
  const qc       = useQueryClient()
  const { toast } = useToast()

  const isAdmin = user?.role === 'admin'

  const [pendingKey, setPendingKey] = useState<string | null>(null)

  const { data: settings = [], isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: settingsApi.list,
    staleTime: 60_000,
  })

  const updateMutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string | number | boolean }) =>
      settingsApi.update(key, value),
    onSuccess: () => {
      toast.success('Setting saved')
      qc.invalidateQueries({ queryKey: ['settings'] })
      setPendingKey(null)
    },
    onError: () => {
      toast.error('Failed to save setting')
      setPendingKey(null)
    },
  })

  function handleSaveNumber(key: string, value: number) {
    setPendingKey(key)
    updateMutation.mutate({ key, value })
  }

  function handleToggle(key: string, value: boolean) {
    setPendingKey(key)
    updateMutation.mutate({ key, value })
  }

  const syncTimeout       = Number(useSettingValue(settings, 'sync_timeout')       ?? 30)
  const sshDefaultPort    = Number(useSettingValue(settings, 'ssh_default_port')    ?? 22)
  const appearanceCompact = Boolean(useSettingValue(settings, 'appearance_compact') ?? false)

  return (
    <div className="space-y-6 max-w-2xl animate-fade-in">
      <div>
        <h1 className="text-xl font-semibold text-ink-primary">Settings</h1>
        <p className="text-sm text-ink-muted mt-0.5">Configure application preferences</p>
      </div>

      {isLoading ? (
        <div className="space-y-6">
          {[0, 1, 2].map(i => (
            <div key={i} className="card-dark p-5 space-y-4">
              <div className="skeleton h-4 w-32 rounded" aria-hidden="true" />
              <SkeletonField />
              <SkeletonField />
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Sync Settings — editable by admin, read-only for others */}
          <SectionCard title="Sync Settings">
            <NumberField
              label="Sync Timeout"
              settingKey="sync_timeout"
              unit="seconds"
              value={syncTimeout}
              readOnly={!isAdmin}
              onSave={handleSaveNumber}
              isPending={updateMutation.isPending}
              pendingKey={pendingKey}
            />
            {!isAdmin && (
              <p className="text-xs text-ink-muted flex items-center gap-1.5 mt-1">
                <Lock size={11} />
                Admin-only settings are view-only
              </p>
            )}
          </SectionCard>

          {/* SSH Defaults */}
          <SectionCard title="SSH Defaults">
            <NumberField
              label="Default SSH Port"
              settingKey="ssh_default_port"
              value={sshDefaultPort}
              onSave={handleSaveNumber}
              isPending={updateMutation.isPending}
              pendingKey={pendingKey}
            />
          </SectionCard>

          {/* Appearance */}
          <SectionCard title="Appearance">
            <ToggleField
              label="Compact Mode"
              description="Reduce padding and font sizes for denser information display"
              settingKey="appearance_compact"
              checked={appearanceCompact}
              onToggle={handleToggle}
            />
          </SectionCard>

          {/* About */}
          <SectionCard title="About">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-ink-secondary">Version</p>
                <span
                  className="text-xs font-mono px-2 py-0.5 rounded"
                  style={{
                    background: 'var(--ac-bg)',
                    color:      'var(--ac)',
                    border:     '1px solid var(--ac-bd)',
                  }}
                >
                  v{APP_VERSION}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm text-ink-secondary">Source Code</p>
                <a
                  href="https://github.com/your-org/server-inventory"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
                >
                  GitHub
                  <ExternalLink size={12} />
                </a>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm text-ink-secondary">Logged in as</p>
                <span className="text-sm font-medium text-ink-primary">{user?.username}</span>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm text-ink-secondary">Role</p>
                <span
                  className="text-xs font-medium px-2 py-0.5 rounded-md capitalize"
                  style={{
                    background: 'var(--sgr-bg)',
                    color:      'var(--sgr)',
                    border:     '1px solid var(--sgr-bd)',
                  }}
                >
                  {user?.role}
                </span>
              </div>
            </div>
          </SectionCard>
        </>
      )}
    </div>
  )
}
