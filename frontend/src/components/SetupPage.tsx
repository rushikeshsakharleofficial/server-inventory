import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Shield, Key, CheckCircle2 } from 'lucide-react'
import { authApi } from '../api'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import {
  Card,
  Flex,
  Heading,
  Text,
  Input,
  Button,
  Badge,
} from './StitchUI'

export default function SetupPage() {
  const { user } = useAuth()
  const { toast } = useToast()

  const [currentPw, setCurrentPw]   = useState('')
  const [newPw, setNewPw]           = useState('')
  const [confirmPw, setConfirmPw]   = useState('')
  const [fieldError, setFieldError] = useState('')

  const changePwMutation = useMutation({
    mutationFn: authApi.changePassword,
    onSuccess: () => {
      toast.success('Password updated')
      setCurrentPw(''); setNewPw(''); setConfirmPw(''); setFieldError('')
    },
    onError: (e: unknown) => {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setFieldError(detail ?? 'Failed to update password')
    },
  })

  function submitChangePw(ev: React.FormEvent) {
    ev.preventDefault()
    setFieldError('')
    if (newPw.length < 6) { setFieldError('New password must be at least 6 characters'); return }
    if (newPw !== confirmPw) { setFieldError('New passwords do not match'); return }
    changePwMutation.mutate({ current_password: currentPw, new_password: newPw })
  }

  return (
    <Flex direction="column" gap={5} className="animate-fade-in">
      <div>
        <Heading as="h1">Admin Setup</Heading>
        <Text variant="muted" style={{ marginTop: '4px' }}>Manage your admin account credentials.</Text>
      </div>

      {/* Profile card */}
      <Card style={{ padding: '24px' }}>
        <Flex align="center" gap={4}>
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              fontWeight: 700,
              backgroundColor: 'rgba(99,102,241,0.12)',
              color: '#6366F1',
              border: '1px solid rgba(99,102,241,0.25)',
              flexShrink: 0,
            }}
          >
            {user?.username?.slice(0, 1).toUpperCase() ?? 'A'}
          </div>
          <div style={{ flex: 1 }}>
            <Flex align="center" gap={2} style={{ marginBottom: '4px' }}>
              <Heading level="h3" style={{ fontFamily: 'monospace' }}>{user?.username}</Heading>
              <Badge
                status="primary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  color: '#6366F1',
                  backgroundColor: 'rgba(99,102,241,0.1)',
                  borderColor: 'rgba(99,102,241,0.25)',
                }}
              >
                <Shield size={10} aria-hidden="true" />
                Admin
              </Badge>
            </Flex>
            <Flex align="center" gap={2}>
              <CheckCircle2 size={13} style={{ color: 'var(--sg)' }} />
              <Text variant="smallMuted">Account active</Text>
            </Flex>
          </div>
        </Flex>
      </Card>

      {/* Change password */}
      <Card style={{ padding: '24px' }}>
        <Flex align="center" gap={2} style={{ marginBottom: '20px', borderBottom: '1px solid var(--bd)', paddingBottom: '12px' }}>
          <Key size={14} style={{ color: 'var(--tx2)' }} />
          <Heading
            level="h3"
            style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '12px' }}
          >
            Change Password
          </Heading>
        </Flex>

        <form onSubmit={submitChangePw}>
          <Flex direction="column" gap={4}>
            <div>
              <Text variant="label" style={{ marginBottom: '6px', display: 'block' }}>
                Current Password <span style={{ color: 'var(--sr)' }}>*</span>
              </Text>
              <Input
                type="password"
                value={currentPw}
                onChange={e => { setCurrentPw(e.target.value); setFieldError('') }}
                placeholder="Enter current password"
                autoComplete="current-password"
                required
              />
            </div>

            <div>
              <Text variant="label" style={{ marginBottom: '6px', display: 'block' }}>
                New Password <span style={{ color: 'var(--sr)' }}>*</span>
              </Text>
              <Input
                type="password"
                value={newPw}
                onChange={e => { setNewPw(e.target.value); setFieldError('') }}
                placeholder="Min. 6 characters"
                autoComplete="new-password"
                required
              />
            </div>

            <div>
              <Text variant="label" style={{ marginBottom: '6px', display: 'block' }}>
                Confirm New Password <span style={{ color: 'var(--sr)' }}>*</span>
              </Text>
              <Input
                type="password"
                value={confirmPw}
                onChange={e => { setConfirmPw(e.target.value); setFieldError('') }}
                placeholder="Repeat new password"
                autoComplete="new-password"
                required
              />
            </div>

            {fieldError && (
              <div
                role="alert"
                style={{
                  fontSize: '13px',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  background: 'var(--sr-bg)',
                  color: 'var(--sr)',
                  border: '1px solid var(--sr-bd)',
                }}
              >
                {fieldError}
              </div>
            )}

            <Flex style={{ borderTop: '1px solid var(--bd)', paddingTop: '16px' }}>
              <Button type="submit" intent="primary" disabled={changePwMutation.isPending}>
                {changePwMutation.isPending ? 'Saving…' : 'Update Password'}
              </Button>
            </Flex>
          </Flex>
        </form>
      </Card>
    </Flex>
  )
}
