import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { QRCodeSVG } from 'qrcode.react'
import { mfaApi } from '../api'
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

type ViewState = 'idle' | 'setup' | 'disable'

export default function MfaSetupSection() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [view, setView] = useState<ViewState>('idle')
  const [code, setCode] = useState('')
  const [fieldError, setFieldError] = useState('')
  const [setupData, setSetupData] = useState<{ secret: string; uri: string } | null>(null)

  const { data: statusData } = useQuery({
    queryKey: ['mfa-status'],
    queryFn: () => mfaApi.status().then(r => r.data),
  })

  const setupMutation = useMutation({
    mutationFn: () => mfaApi.setup().then(r => r.data),
    onSuccess: (data) => {
      setSetupData(data)
      setCode('')
      setFieldError('')
      setView('setup')
    },
    onError: (e: unknown) => {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setFieldError(detail ?? 'Failed to start MFA setup')
    },
  })

  const enableMutation = useMutation({
    mutationFn: () => mfaApi.enable(code),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mfa-status'] })
      toast.success('Two-factor authentication enabled')
      setView('idle')
      setCode('')
      setSetupData(null)
      setFieldError('')
    },
    onError: (e: unknown) => {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setFieldError(detail ?? 'Invalid code — please try again')
    },
  })

  const disableMutation = useMutation({
    mutationFn: () => mfaApi.disable(code),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mfa-status'] })
      toast.success('Two-factor authentication disabled')
      setView('idle')
      setCode('')
      setFieldError('')
    },
    onError: (e: unknown) => {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setFieldError(detail ?? 'Invalid code — please try again')
    },
  })

  const mfaEnabled = statusData?.enabled ?? false

  function handleCancel() {
    setView('idle')
    setCode('')
    setFieldError('')
    setSetupData(null)
  }

  return (
    <Card style={{ padding: '24px' }}>
      <Flex
        align="center"
        gap={2}
        style={{ marginBottom: '20px', borderBottom: '1px solid var(--bd)', paddingBottom: '12px' }}
      >
        <Heading
          level="h3"
          style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '12px', flex: 1 }}
        >
          Two-Factor Authentication
        </Heading>
        <Badge status={mfaEnabled ? 'green' : 'gray'}>
          {mfaEnabled ? 'Enabled' : 'Disabled'}
        </Badge>
      </Flex>

      {/* Idle + disabled */}
      {view === 'idle' && !mfaEnabled && (
        <Flex direction="column" gap={4}>
          <Text variant="muted">
            Add an extra layer of security by requiring a time-based one-time password on login.
          </Text>
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
          <Flex>
            <Button
              intent="primary"
              disabled={setupMutation.isPending}
              onClick={() => { setFieldError(''); setupMutation.mutate() }}
            >
              {setupMutation.isPending ? 'Starting…' : 'Enable 2FA'}
            </Button>
          </Flex>
        </Flex>
      )}

      {/* Setup state */}
      {view === 'setup' && setupData && (
        <Flex direction="column" gap={4}>
          <Text variant="muted">
            Scan this QR code with your authenticator app, then enter the 6-digit code to confirm.
          </Text>

          <Flex justify="center">
            <div
              style={{
                background: '#fff',
                padding: '12px',
                borderRadius: '8px',
                display: 'inline-flex',
              }}
            >
              <QRCodeSVG value={setupData.uri} size={180} level="M" />
            </div>
          </Flex>

          <details style={{ fontSize: '13px', color: 'var(--tx2)' }}>
            <summary style={{ cursor: 'pointer', userSelect: 'none' }}>
              Can't scan? Enter key manually
            </summary>
            <div
              style={{
                marginTop: '8px',
                padding: '10px 14px',
                borderRadius: '8px',
                background: 'var(--bg2)',
                border: '1px solid var(--bd)',
                fontFamily: 'monospace',
                wordBreak: 'break-all',
                letterSpacing: '0.05em',
              }}
            >
              {setupData.secret}
            </div>
          </details>

          <div>
            <Text variant="label" style={{ marginBottom: '6px', display: 'block' }}>
              Verification Code <span style={{ color: 'var(--sr)' }}>*</span>
            </Text>
            <Input
              value={code}
              onChange={e => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setFieldError('') }}
              placeholder="000000"
              inputMode="numeric"
              maxLength={6}
              style={{ textAlign: 'center', letterSpacing: '0.25em', fontSize: '20px' }}
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

          <Flex gap={2} style={{ borderTop: '1px solid var(--bd)', paddingTop: '16px' }}>
            <Button
              intent="primary"
              disabled={code.length !== 6 || enableMutation.isPending}
              onClick={() => enableMutation.mutate()}
            >
              {enableMutation.isPending ? 'Verifying…' : 'Confirm & Enable'}
            </Button>
            <Button intent="ghost" onClick={handleCancel} disabled={enableMutation.isPending}>
              Cancel
            </Button>
          </Flex>
        </Flex>
      )}

      {/* Idle + enabled */}
      {view === 'idle' && mfaEnabled && (
        <Flex direction="column" gap={4}>
          <Text variant="muted">
            Two-factor authentication is active on your account.
          </Text>
          <Flex>
            <Button
              intent="danger"
              onClick={() => { setFieldError(''); setCode(''); setView('disable') }}
            >
              Disable 2FA
            </Button>
          </Flex>
        </Flex>
      )}

      {/* Disable state */}
      {view === 'disable' && (
        <Flex direction="column" gap={4}>
          <Text variant="muted">
            Enter the 6-digit code from your authenticator app to disable two-factor authentication.
          </Text>

          <div>
            <Text variant="label" style={{ marginBottom: '6px', display: 'block' }}>
              Verification Code <span style={{ color: 'var(--sr)' }}>*</span>
            </Text>
            <Input
              value={code}
              onChange={e => { setCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setFieldError('') }}
              placeholder="000000"
              inputMode="numeric"
              maxLength={6}
              style={{ textAlign: 'center', letterSpacing: '0.25em', fontSize: '20px' }}
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

          <Flex gap={2} style={{ borderTop: '1px solid var(--bd)', paddingTop: '16px' }}>
            <Button
              intent="danger"
              disabled={code.length !== 6 || disableMutation.isPending}
              onClick={() => disableMutation.mutate()}
            >
              {disableMutation.isPending ? 'Disabling…' : 'Disable 2FA'}
            </Button>
            <Button intent="ghost" onClick={handleCancel} disabled={disableMutation.isPending}>
              Cancel
            </Button>
          </Flex>
        </Flex>
      )}
    </Card>
  )
}
