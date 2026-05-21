import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Save, Lock, GitFork, RefreshCw } from 'lucide-react'
import { settingsApi } from '../api'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import Toggle from './Toggle'
import {
  Card,
  Flex,
  Heading,
  Text,
  Input,
  Button,
} from './StitchUI'

function SkeletonField() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }} aria-hidden="true">
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
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <Flex
        direction="column"
        style={{
          padding: '14px 20px',
          borderBottom: '1px solid var(--bd)',
          backgroundColor: 'var(--bg-s2)',
        }}
      >
        <Heading level="h3" style={{ fontSize: '14px', fontWeight: 700 }}>{title}</Heading>
        {description && <Text variant="smallMuted" style={{ marginTop: '2px' }}>{description}</Text>}
      </Flex>
      <Flex direction="column" gap={4} style={{ padding: '20px' }}>
        {children}
      </Flex>
    </Card>
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
    <Flex direction="column" gap={2}>
      <Flex justify="between" align="center">
        <div>
          <Text style={{ fontSize: '13px', fontWeight: 600, color: 'var(--tx2)' }}>{label}</Text>
          {description && <Text variant="smallMuted" style={{ marginTop: '2px' }}>{description}</Text>}
        </div>
        {readOnly && <Lock size={12} style={{ color: 'var(--tx3)' }} />}
      </Flex>
      <Flex align="center" gap={3}>
        <Input
          type="number"
          value={local}
          onChange={e => setLocal(e.target.value)}
          disabled={readOnly}
          min={min}
          max={max}
          style={{ width: '144px', fontVariantNumeric: 'tabular-nums', opacity: readOnly ? 0.6 : 1 }}
        />
        {unit && <Text variant="smallMuted">{unit}</Text>}
        {!readOnly && dirty && (
          <Button
            intent="primary"
            onClick={() => onSave(settingKey, local)}
            disabled={isSaving}
            style={{ fontSize: '12px', padding: '6px 12px' }}
          >
            {isSaving ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />}
            Save
          </Button>
        )}
        {readOnly && <Text variant="smallMuted" style={{ fontStyle: 'italic' }}>Admin only</Text>}
      </Flex>
    </Flex>
  )
}

function ToggleField({ label, description, settingKey, readOnly, checked, onSave }: {
  label: string; description?: string; settingKey: string
  readOnly: boolean; checked: boolean; onSave: (key: string, val: string) => void
}) {
  return (
    <Flex justify="between" align="center" gap={4}>
      <div>
        <Text style={{ fontSize: '13px', fontWeight: 600, color: 'var(--tx2)' }}>{label}</Text>
        {description && <Text variant="smallMuted" style={{ marginTop: '2px' }}>{description}</Text>}
      </div>
      <Toggle
        checked={checked}
        onChange={() => onSave(settingKey, checked ? 'false' : 'true')}
        disabled={readOnly}
        aria-label={label}
      />
    </Flex>
  )
}

export default function SettingsPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const isAdmin = user?.role === 'admin'
  const [pendingKey, setPendingKey] = useState<string | null>(null)

  const { data: settings = {}, isLoading, refetch } = useQuery({
    queryKey: ['settings'],
    queryFn: settingsApi.list,
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
      <Flex direction="column" gap={5} style={{ maxWidth: '640px' }}>
        {[0, 1, 2].map(i => (
          <Card key={i} style={{ padding: 0, overflow: 'hidden' }}>
            <Flex style={{ padding: '14px 20px', borderBottom: '1px solid var(--bd)', backgroundColor: 'var(--bg-s2)' }}>
              <div className="skeleton h-4 w-32 rounded" />
            </Flex>
            <Flex style={{ padding: '20px' }}>
              <SkeletonField />
            </Flex>
          </Card>
        ))}
      </Flex>
    )
  }

  return (
    <Flex direction="column" gap={5} style={{ maxWidth: '640px' }} className="animate-fade-in">
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
        <Flex direction="column" gap={2} style={{ fontSize: '12px' }}>
          {[
            ['Application', 'ServerInventory v1.0.0'],
            ['Logged in as', `${user?.username} (${user?.role})`],
          ].map(([k, v]) => (
            <Flex key={k} justify="between" align="center">
              <Text variant="smallMuted">{k}</Text>
              <Text style={{ fontFamily: 'monospace', fontWeight: 600 }}>{v}</Text>
            </Flex>
          ))}
          <Flex justify="between" align="center">
            <Text variant="smallMuted">Source</Text>
            <a
              href="https://github.com/rushikeshsakharleofficial/server-inventory"
              target="_blank" rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                color: 'var(--ac)',
                textDecoration: 'none',
              }}
              onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
              onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
            >
              <GitFork size={12} />
              <span style={{ fontWeight: 600 }}>GitHub</span>
            </a>
          </Flex>
        </Flex>
      </SectionCard>
    </Flex>
  )
}
