import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Save, Lock, Github, RefreshCw } from 'lucide-react'
import { settingsApi } from '../api'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import Toggle from './Toggle'

function SkeletonField() {
  return (
    <div className="space-y-1.5" aria-hidden="true">
      <div className="skeleton h-3 w-28 rounded" />
      <div className="skeleton h-9 w-full rounded-lg" />
    </div>
  )
}

function SectionCard({ title, description, children }: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="card-dark overflow-hidden">
      <div className="px-5 py-3.5 border-b border-border bg-surface-2">
        <p className="text-sm font-semibold text-ink-primary">{title}</p>
        {description && <p className="text-xs text-ink-muted mt-0.5">{description}</p>}
      </div>
      <div className="p-5 space-y-5">{children}</div>
    </div>
  )
}

function NumberField({ label, description, settingKey, unit, min, max, readOnly, currentValue, onSave, isSaving }: {
  label: string; description?: string; settingKey: string; unit?: string
  min?: number; max?: number; readOnly: boolean; currentValue: string
  onSave: (key: string, val: string) => void; isSaving: boolean
}) {
  const [local, setLocal] = useState(currentValue)
  const dirty = local !== currentValue

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-ink-secondary">{label}</p>
          {description && <p className="text-[11px] text-ink-muted mt-0.5">{description}</p>}
        </div>
        {readOnly && <Lock size={12} className="text-ink-dim" />}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={local}
          onChange={e => setLocal(e.target.value)}
          disabled={readOnly}
          min={min}
          max={max}
          className="input-dark w-36 tabular-nums disabled:opacity-60"
        />
        {unit && <span className="text-xs text-ink-muted">{unit}</span>}
        {!readOnly && dirty && (
          <button onClick={() => onSave(settingKey, local)} disabled={isSaving} className="btn-primary px-3 py-2 text-xs">
            {isSaving ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />}
            Save
          </button>
        )}
        {readOnly && <span className="text-[11px] text-ink-dim italic">Admin only</span>}
      </div>
    </div>
  )
}

function ToggleField({ label, description, settingKey, readOnly, checked, onSave }: {
  label: string; description?: string; settingKey: string
  readOnly: boolean; checked: boolean; onSave: (key: string, val: string) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-xs font-medium text-ink-secondary">{label}</p>
        {description && <p className="text-[11px] text-ink-muted mt-0.5">{description}</p>}
      </div>
      <Toggle
        checked={checked}
        onChange={() => onSave(settingKey, checked ? 'false' : 'true')}
        disabled={readOnly}
        aria-label={label}
      />
    </div>
  )
}

export default function SettingsPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const isAdmin = user?.role === 'admin'
  const [pendingKey, setPendingKey] = useState<string | null>(null)

  const { data: settings = {}, isLoading, refetch } = useQuery({
    queryKey: ['settings'],
    queryFn: settingsApi.list,      // returns Record<string,string>
  })

  const updateMutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) =>
      settingsApi.update(key, value),
    onSuccess: () => {
      toast.success('Setting saved')
      refetch()
      setPendingKey(null)
    },
    onError: () => {
      toast.error('Failed to save setting')
      setPendingKey(null)
    },
  })

  function handleSave(key: string, value: string) {
    setPendingKey(key)
    updateMutation.mutate({ key, value })
  }

  if (isLoading) {
    return (
      <div className="space-y-5 max-w-2xl">
        {[0, 1, 2].map(i => (
          <div key={i} className="card-dark overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border bg-surface-2">
              <div className="skeleton h-4 w-32 rounded" />
            </div>
            <div className="p-5 space-y-5">
              <SkeletonField />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-5 max-w-2xl animate-fade-in">
      <SectionCard title="Sync Settings" description="Controls how cloud provider syncs behave">
        <NumberField
          label="Sync Timeout"
          description="Maximum seconds a single provider sync may run before being aborted"
          settingKey="sync_timeout"
          unit="seconds"
          min={30} max={3600}
          readOnly={!isAdmin}
          currentValue={settings['sync_timeout'] ?? '300'}
          onSave={handleSave}
          isSaving={updateMutation.isPending && pendingKey === 'sync_timeout'}
        />
      </SectionCard>

      <SectionCard title="SSH Defaults" description="Default values used when creating SSH credentials">
        <NumberField
          label="Default SSH Port"
          description="Port used when no port is specified on an SSH credential"
          settingKey="ssh_default_port"
          unit="TCP port"
          min={1} max={65535}
          readOnly={!isAdmin}
          currentValue={settings['ssh_default_port'] ?? '22'}
          onSave={handleSave}
          isSaving={updateMutation.isPending && pendingKey === 'ssh_default_port'}
        />
      </SectionCard>

      <SectionCard title="Appearance">
        <ToggleField
          label="Compact Mode"
          description="Reduces padding in tables and cards for higher information density"
          settingKey="appearance_compact"
          readOnly={false}
          checked={settings['appearance_compact'] === 'true'}
          onSave={handleSave}
        />
      </SectionCard>

      <SectionCard title="About">
        <div className="space-y-2 text-xs text-ink-secondary">
          {[
            ['Application', 'ServerInventory v1.0.0'],
            ['Logged in as', `${user?.username} (${user?.role})`],
          ].map(([k, v]) => (
            <div key={k} className="flex items-center justify-between">
              <span className="text-ink-muted">{k}</span>
              <span className="font-mono">{v}</span>
            </div>
          ))}
          <div className="flex items-center justify-between">
            <span className="text-ink-muted">Source</span>
            <a
              href="https://github.com/rushikeshsakharleofficial/server-inventory"
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-accent hover:underline"
            >
              <Github size={12} />
              GitHub
            </a>
          </div>
        </div>
      </SectionCard>
    </div>
  )
}
