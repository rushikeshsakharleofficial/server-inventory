import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X, Plus, Trash2 } from 'lucide-react'
import { styled } from '../stitches.config'
import { serversApi, getErrorMessage } from '../api'
import { useToast } from '../hooks/useToast'
import type { Server, ServerStatus } from '../types'
import { Card, Input, Button, Flex, Grid, Heading, Text, Select, Textarea } from './StitchUI'

interface Props {
  server?: Server
  onClose: () => void
}

type TagRow = { key: string; value: string }
type FieldType = 'text' | 'number' | 'select'
type FieldId =
  | 'name'
  | 'hostname'
  | 'status'
  | 'public_ip'
  | 'private_ip'
  | 'datacenter'
  | 'instance_type'
  | 'vcpu'
  | 'memory_gb'
  | 'storage_gb'
  | 'os'
  | 'notes'

const STATUSES: ServerStatus[] = ['running', 'stopped', 'pending', 'terminated', 'unknown']

const FIELD_GROUPS = [
  {
    title: 'Identity',
    fields: [
      { id: 'name', label: 'Server Name', placeholder: 'web-01', required: true },
      { id: 'hostname', label: 'Hostname / FQDN', placeholder: 'web-01.example.com', required: false },
      { id: 'status', label: 'Status', placeholder: '', required: false, type: 'select' },
    ],
  },
  {
    title: 'Network',
    fields: [
      { id: 'public_ip', label: 'Public IP', placeholder: '203.0.113.10', required: false },
      { id: 'private_ip', label: 'Private IP', placeholder: '10.0.0.10', required: false },
    ],
  },
  {
    title: 'Location',
    fields: [
      { id: 'datacenter', label: 'Datacenter / Location', placeholder: 'NYC-DC1', required: false },
      { id: 'instance_type', label: 'Hardware Type', placeholder: 'Dell PowerEdge R740', required: false },
    ],
  },
  {
    title: 'Resources',
    fields: [
      { id: 'vcpu', label: 'vCPU', placeholder: '16', required: false, type: 'number' },
      { id: 'memory_gb', label: 'Memory (GB)', placeholder: '64', required: false, type: 'number' },
      { id: 'storage_gb', label: 'Storage (GB)', placeholder: '1000', required: false, type: 'number' },
      { id: 'os', label: 'Operating System', placeholder: 'Ubuntu 22.04', required: false },
    ],
  },
] as const

const ModalBackdrop = styled('div', {
  position: 'fixed',
  inset: 0,
  zIndex: 50,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '$4',
  backgroundColor: 'rgba(0, 0, 0, 0.72)',
  backdropFilter: 'blur(8px)',
  animation: 'fadeIn 200ms ease-out',
  '@keyframes fadeIn': {
    from: { opacity: 0 },
    to: { opacity: 1 },
  },
});

const ModalContent = styled(Card, {
  width: '100%',
  maxWidth: '640px',
  maxHeight: '90vh',
  display: 'flex',
  flexDirection: 'column',
  padding: 0,
  overflow: 'hidden',
  boxShadow: '$modal',
  animation: 'slideUp 250ms cubic-bezier(0.16, 1, 0.3, 1)',
  '@keyframes slideUp': {
    from: { transform: 'translateY(16px)', opacity: 0 },
    to: { transform: 'translateY(0)', opacity: 1 },
  },
});

const ModalHeader = styled(Flex, {
  padding: '$4 $6',
  borderBottom: '1px solid $border',
});

const ScrollableForm = styled('form', {
  flex: 1,
  overflowY: 'auto',
  padding: '$6',
  display: 'flex',
  flexDirection: 'column',
  gap: '$5',
});

const ModalFooter = styled(Flex, {
  padding: '$4 $6',
  borderTop: '1px solid $border',
  backgroundColor: '$bgS2',
});

const FormGroup = styled('div', {
  border: '1px solid $border',
  borderRadius: '$lg',
  padding: '$5',
  backgroundColor: '$bgS1',
  display: 'flex',
  flexDirection: 'column',
  gap: '$4',
  transition: 'border-color 200ms ease',
  '&:hover': {
    borderColor: '$cardHoverBorder',
  },
});

const FieldWrapper = styled('div', {
  display: 'flex',
  flexDirection: 'column',
  gap: '$1.5',
});

const RequiredAsterisk = styled('span', {
  color: '$statusRed',
  marginLeft: '$1',
});

const TagRowContainer = styled(Flex, {
  backgroundColor: '$bgS2',
  padding: '$2',
  borderRadius: '$md',
  border: '1px solid $border',
  gap: '$2',
  alignItems: 'center',
});

function valueOf(value: string | number | undefined | null) {
  return value == null ? '' : String(value)
}

function initialTags(server?: Server): TagRow[] {
  const rows = Object.entries(server?.tags ?? {}).map(([key, value]) => ({
    key,
    value: String(value),
  }))
  return rows.length ? rows : [{ key: '', value: '' }]
}

export default function AddServerModal({ server, onClose }: Props) {
  const qc = useQueryClient()
  const { toast } = useToast()
  const isEditing = Boolean(server)

  const [form, setForm] = useState<Record<FieldId, string>>({
    name: valueOf(server?.name),
    hostname: valueOf(server?.hostname),
    status: server?.status ?? 'unknown',
    public_ip: valueOf(server?.public_ip),
    private_ip: valueOf(server?.private_ip),
    datacenter: valueOf(server?.datacenter),
    instance_type: valueOf(server?.instance_type),
    vcpu: valueOf(server?.vcpu),
    memory_gb: valueOf(server?.memory_gb),
    storage_gb: valueOf(server?.storage_gb),
    os: valueOf(server?.os),
    notes: valueOf(server?.notes),
  })
  const [tags, setTags] = useState<TagRow[]>(() => initialTags(server))
  const [errors, setErrors] = useState<string[]>([])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const mutation = useMutation({
    mutationFn: (payload: Partial<Server>) =>
      server ? serversApi.update(server.id, payload) : serversApi.create(payload),
    onSuccess: () => {
      toast.success(isEditing ? 'Server updated' : 'Server added to inventory')
      qc.invalidateQueries({ queryKey: ['servers'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
      onClose()
    },
    onError: (error: unknown) =>
      toast.error((isEditing ? 'Failed to update server: ' : 'Failed to add server: ') + getErrorMessage(error)),
  })

  function set(field: FieldId, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const errs: string[] = []
    if (!form.name.trim()) errs.push('Server name is required')

    // Validate positive integer vcpu
    if (form.vcpu.trim()) {
      const vcpuVal = Number(form.vcpu)
      if (isNaN(vcpuVal) || vcpuVal <= 0 || !Number.isInteger(vcpuVal)) {
        errs.push('vCPU must be a positive integer')
      }
    }

    // Validate positive float memory_gb
    if (form.memory_gb.trim()) {
      const memVal = Number(form.memory_gb)
      if (isNaN(memVal) || memVal <= 0) {
        errs.push('Memory must be a positive number')
      }
    }

    // Validate positive float storage_gb
    if (form.storage_gb.trim()) {
      const storageVal = Number(form.storage_gb)
      if (isNaN(storageVal) || storageVal <= 0) {
        errs.push('Storage must be a positive number')
      }
    }

    // Validate IP/Hostname format
    const ipOrHostRegex = /^([a-zA-Z0-9-]+\.)*[a-zA-Z0-9-]+$/
    const ipv4Regex = /^((25[0-5]|(2[0-4]|1\d|[1-9]|)\d)\.?\b){4}$/
    
    if (form.public_ip.trim()) {
      const ip = form.public_ip.trim()
      const isIpv4 = ipv4Regex.test(ip)
      const isIpv6 = ip.includes(':') && ip.length > 2
      const isDomain = ipOrHostRegex.test(ip)
      if (!isIpv4 && !isIpv6 && !isDomain) {
        errs.push('Public IP / Hostname format is invalid')
      }
    }

    if (form.private_ip.trim()) {
      const ip = form.private_ip.trim()
      const isIpv4 = ipv4Regex.test(ip)
      const isIpv6 = ip.includes(':') && ip.length > 2
      const isDomain = ipOrHostRegex.test(ip)
      if (!isIpv4 && !isIpv6 && !isDomain) {
        errs.push('Private IP / Hostname format is invalid')
      }
    }

    if (errs.length) {
      setErrors(errs)
      return
    }
    setErrors([])

    const tagMap: Record<string, string> = {}
    tags.forEach(({ key, value }) => {
      if (key.trim()) tagMap[key.trim()] = value
    })

    const payload: Partial<Server> = {
      name: form.name.trim(),
      hostname: form.hostname || undefined,
      status: form.status as ServerStatus,
      public_ip: form.public_ip || undefined,
      private_ip: form.private_ip || undefined,
      datacenter: form.datacenter || undefined,
      instance_type: form.instance_type || undefined,
      vcpu: form.vcpu ? parseInt(form.vcpu) : undefined,
      memory_gb: form.memory_gb ? parseFloat(form.memory_gb) : undefined,
      storage_gb: form.storage_gb ? parseFloat(form.storage_gb) : undefined,
      os: form.os || undefined,
      notes: form.notes || undefined,
      tags: tagMap,
    }

    if (!server) payload.provider = 'custom_dc'
    mutation.mutate(payload)
  }

  return (
    <ModalBackdrop
      role="dialog"
      aria-modal="true"
      aria-label={isEditing ? 'Edit server' : 'Add custom server'}
    >
      <ModalContent modal>
        {/* Header */}
        <ModalHeader align="center" justify="between">
          <Flex direction="column" gap={1}>
            <Heading level="h2" style={{ fontSize: '1rem' }}>
              {isEditing ? 'Edit Custom DC Server' : 'Add Custom DC Server'}
            </Heading>
            <Text variant="smallMuted">
              {isEditing ? server?.name : 'Manually register a bare-metal or on-prem server'}
            </Text>
          </Flex>
          <Button
            intent="ghost"
            size="sm"
            onClick={onClose}
            aria-label="Close"
            style={{ padding: '0.375rem', borderRadius: '8px' }}
          >
            <X size={16} />
          </Button>
        </ModalHeader>

        {/* Scrollable Form */}
        <ScrollableForm onSubmit={submit}>
          {errors.map(e => (
            <div
              key={e}
              style={{
                fontSize: '0.875rem',
                padding: '0.5rem 0.75rem',
                borderRadius: '8px',
                background: 'var(--sr-bg)',
                color: 'var(--sr)',
                border: '1px solid var(--sr-bd)',
              }}
            >
              {e}
            </div>
          ))}

          {FIELD_GROUPS.map(group => (
            <FormGroup key={group.title}>
              <Text variant="label" style={{ color: 'var(--tx3)' }}>
                {group.title}
              </Text>
              <Grid columns={2} gap={3}>
                {group.fields.map(f => (
                  <FieldWrapper key={f.id}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--tx2)' }}>
                      {f.label}
                      {f.required && <RequiredAsterisk>*</RequiredAsterisk>}
                    </label>
                    {(f as { type?: FieldType }).type === 'select' ? (
                      <Select
                        value={form[f.id as FieldId]}
                        onChange={e => set(f.id as FieldId, e.target.value)}
                      >
                        {STATUSES.map(status => (
                          <option key={status} value={status}>
                            {status.charAt(0).toUpperCase() + status.slice(1)}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <Input
                        type={(f as { type?: string }).type ?? 'text'}
                        value={form[f.id as FieldId]}
                        onChange={e => set(f.id as FieldId, e.target.value)}
                        placeholder={f.placeholder}
                      />
                    )}
                  </FieldWrapper>
                ))}
              </Grid>
            </FormGroup>
          ))}

          {/* Tags Section */}
          <FormGroup>
            <Text variant="label" style={{ color: 'var(--tx3)' }}>Tags</Text>
            <Flex direction="column" gap={2}>
              {tags.map((tag, i) => (
                <TagRowContainer key={i}>
                  <Input
                    type="text"
                    value={tag.key}
                    onChange={e => setTags(t => t.map((r, j) => j === i ? { ...r, key: e.target.value } : r))}
                    placeholder="Key"
                    style={{ flex: 1 }}
                  />
                  <Input
                    type="text"
                    value={tag.value}
                    onChange={e => setTags(t => t.map((r, j) => j === i ? { ...r, value: e.target.value } : r))}
                    placeholder="Value"
                    style={{ flex: 1 }}
                  />
                  <Button
                    type="button"
                    intent="ghost"
                    size="sm"
                    onClick={() => setTags(t => t.filter((_, j) => j !== i))}
                    aria-label="Remove tag"
                    style={{ color: 'var(--sr)', borderColor: 'transparent' }}
                  >
                    <Trash2 size={14} />
                  </Button>
                </TagRowContainer>
              ))}
              <Button
                type="button"
                intent="ghost"
                size="sm"
                onClick={() => setTags(t => [...t, { key: '', value: '' }])}
                style={{ width: 'fit-content', borderStyle: 'dashed' }}
              >
                <Plus size={13} />
                Add Tag
              </Button>
            </Flex>
          </FormGroup>

          {/* Notes Section */}
          <FormGroup>
            <label style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--tx2)' }}>Notes</label>
            <Textarea
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              rows={3}
              placeholder="Additional context about this server..."
              style={{ resize: 'none' }}
            />
          </FormGroup>
        </ScrollableForm>

        {/* Footer */}
        <ModalFooter justify="end" gap={3}>
          <Button type="button" intent="ghost" onClick={onClose}>Cancel</Button>
          <Button
            onClick={submit}
            disabled={mutation.isPending}
            intent="primary"
          >
            {mutation.isPending ? 'Saving...' : isEditing ? 'Save Changes' : 'Add Server'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </ModalBackdrop>
  )
}

