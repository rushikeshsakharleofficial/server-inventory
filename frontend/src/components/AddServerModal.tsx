import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X, Plus, Trash2 } from 'lucide-react'
import { serversApi } from '../api'
import { useToast } from '../hooks/useToast'

interface Props { onClose: () => void }
type TagRow = { key: string; value: string }

const FIELD_GROUPS = [
  {
    title: 'Identity',
    fields: [
      { id: 'name',          label: 'Server Name',            placeholder: 'web-01',               required: true  },
      { id: 'hostname',      label: 'Hostname / FQDN',        placeholder: 'web-01.example.com',   required: false },
    ],
  },
  {
    title: 'Network',
    fields: [
      { id: 'public_ip',     label: 'Public IP',              placeholder: '203.0.113.10',         required: false },
      { id: 'private_ip',    label: 'Private IP',             placeholder: '10.0.0.10',            required: false },
    ],
  },
  {
    title: 'Location',
    fields: [
      { id: 'datacenter',    label: 'Datacenter / Location',  placeholder: 'NYC-DC1',              required: false },
      { id: 'instance_type', label: 'Hardware Type',          placeholder: 'Dell PowerEdge R740',  required: false },
    ],
  },
  {
    title: 'Resources',
    fields: [
      { id: 'vcpu',          label: 'vCPU',                   placeholder: '16',  required: false, type: 'number' },
      { id: 'memory_gb',     label: 'Memory (GB)',            placeholder: '64',  required: false, type: 'number' },
      { id: 'storage_gb',    label: 'Storage (GB)',           placeholder: '1000',required: false, type: 'number' },
      { id: 'os',            label: 'Operating System',       placeholder: 'Ubuntu 22.04', required: false },
    ],
  },
] as const

type FieldId = 'name' | 'hostname' | 'public_ip' | 'private_ip' | 'datacenter' | 'instance_type' | 'vcpu' | 'memory_gb' | 'storage_gb' | 'os' | 'notes'

export default function AddServerModal({ onClose }: Props) {
  const qc = useQueryClient()
  const { toast } = useToast()

  const [form, setForm] = useState<Record<FieldId, string>>({
    name: '', hostname: '', public_ip: '', private_ip: '',
    datacenter: '', instance_type: '', vcpu: '', memory_gb: '',
    storage_gb: '', os: '', notes: '',
  })
  const [tags, setTags]     = useState<TagRow[]>([{ key: '', value: '' }])
  const [errors, setErrors] = useState<string[]>([])

  const mutation = useMutation({
    mutationFn: serversApi.create,
    onSuccess: () => {
      toast.success('Server added to inventory')
      qc.invalidateQueries({ queryKey: ['servers'] })
      qc.invalidateQueries({ queryKey: ['stats']   })
      onClose()
    },
    onError: () => toast.error('Failed to add server'),
  })

  function set(field: FieldId, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const errs: string[] = []
    if (!form.name.trim()) errs.push('Server name is required')
    if (errs.length) { setErrors(errs); return }
    setErrors([])

    const tagMap: Record<string, string> = {}
    tags.forEach(({ key, value }) => { if (key.trim()) tagMap[key.trim()] = value })

    mutation.mutate({
      provider:      'custom_dc',
      name:          form.name.trim(),
      hostname:      form.hostname      || undefined,
      public_ip:     form.public_ip     || undefined,
      private_ip:    form.private_ip    || undefined,
      datacenter:    form.datacenter    || undefined,
      instance_type: form.instance_type || undefined,
      vcpu:          form.vcpu          ? parseInt(form.vcpu)          : undefined,
      memory_gb:     form.memory_gb     ? parseFloat(form.memory_gb)   : undefined,
      storage_gb:    form.storage_gb    ? parseFloat(form.storage_gb)  : undefined,
      os:            form.os            || undefined,
      notes:         form.notes         || undefined,
      tags:          tagMap,
      status:        'unknown',
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)' }}
      role="dialog"
      aria-modal="true"
      aria-label="Add custom server"
    >
      <div className="glass-modal w-full max-w-2xl max-h-[90vh] rounded-2xl flex flex-col animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.07]">
          <div>
            <h2 className="text-base font-semibold text-ink-primary">Add Custom DC Server</h2>
            <p className="text-xs text-ink-muted mt-0.5">Manually register a bare-metal or on-prem server</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 text-ink-muted hover:text-ink-primary hover:bg-surface-3 rounded-lg transition-colors"
          >
            <X size={17} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={submit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {errors.map(e => (
            <div
              key={e}
              className="text-sm px-3 py-2 rounded-lg"
              style={{ background: 'var(--sr-bg)', color: 'var(--sr)', border: '1px solid var(--sr-bd)' }}
            >
              {e}
            </div>
          ))}

          {FIELD_GROUPS.map(group => (
            <div key={group.title}>
              <p className="text-[11px] text-ink-muted font-semibold uppercase tracking-widest mb-3">
                {group.title}
              </p>
              <div className="grid grid-cols-2 gap-3">
                {group.fields.map(f => (
                  <div key={f.id}>
                    <label className="block text-xs font-medium text-ink-secondary mb-1.5">
                      {f.label}
                      {f.required && <span className="text-status-red ml-1">*</span>}
                    </label>
                    <input
                      type={(f as { type?: string }).type ?? 'text'}
                      value={form[f.id as FieldId]}
                      onChange={e => set(f.id as FieldId, e.target.value)}
                      placeholder={f.placeholder}
                      className="input-dark"
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Tags */}
          <div>
            <p className="text-[11px] text-ink-muted font-semibold uppercase tracking-widest mb-3">Tags</p>
            <div className="space-y-2">
              {tags.map((tag, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={tag.key}
                    onChange={e => setTags(t => t.map((r, j) => j === i ? { ...r, key: e.target.value } : r))}
                    placeholder="Key"
                    className="input-dark flex-1"
                  />
                  <input
                    type="text"
                    value={tag.value}
                    onChange={e => setTags(t => t.map((r, j) => j === i ? { ...r, value: e.target.value } : r))}
                    placeholder="Value"
                    className="input-dark flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => setTags(t => t.filter((_, j) => j !== i))}
                    aria-label="Remove tag"
                    className="p-1.5 text-ink-muted hover:text-status-red transition-colors rounded-lg"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setTags(t => [...t, { key: '', value: '' }])}
                className="flex items-center gap-1.5 text-xs text-ink-muted hover:text-accent transition-colors"
              >
                <Plus size={13} />
                Add tag
              </button>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-ink-secondary mb-1.5">Notes</label>
            <textarea
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              rows={3}
              placeholder="Additional context about this server…"
              className="input-dark resize-none"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-white/[0.07]">
          <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
          <button
            onClick={submit}
            disabled={mutation.isPending}
            className="btn-primary"
          >
            {mutation.isPending ? 'Saving…' : 'Add Server'}
          </button>
        </div>
      </div>
    </div>
  )
}
