import { useState } from 'react'
import { ShieldCheck, ArrowLeft } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import {
  Card,
  Flex,
  Heading,
  Text,
  Input,
  Button,
} from './StitchUI'

export default function MfaChallengePage() {
  const { completeMfa, cancelMfa, mfaChallenge } = useAuth()

  const [code, setCode]         = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    setError('')
    if (!/^\d{6}$/.test(code.trim())) {
      setError('Enter a valid 6-digit code')
      return
    }
    setLoading(true)
    try {
      await completeMfa(code.trim())
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(detail ?? 'Verification failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Flex
      align="center"
      justify="center"
      style={{ minHeight: '100vh', padding: '24px' }}
    >
      <Card style={{ padding: '32px', width: '100%', maxWidth: '400px' }}>
        <Flex direction="column" align="center" gap={4}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(99,102,241,0.12)',
              border: '1px solid rgba(99,102,241,0.25)',
              color: '#6366F1',
              flexShrink: 0,
            }}
          >
            <ShieldCheck size={28} aria-hidden="true" />
          </div>

          <div style={{ textAlign: 'center' }}>
            <Heading as="h1" style={{ marginBottom: '4px' }}>Two-Factor Authentication</Heading>
            {mfaChallenge?.username && (
              <Text variant="muted" style={{ marginBottom: '4px' }}>
                Signed in as {mfaChallenge.username}
              </Text>
            )}
            <Text variant="muted">Enter the 6-digit code from your authenticator app</Text>
          </div>

          <form onSubmit={handleSubmit} style={{ width: '100%' }}>
            <Flex direction="column" gap={4}>
              <Input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                autoFocus
                value={code}
                onChange={e => { setCode(e.target.value); setError('') }}
                style={{ textAlign: 'center', letterSpacing: '0.35em', fontSize: '20px' }}
              />

              {error && (
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
                  {error}
                </div>
              )}

              <Button type="submit" intent="primary" disabled={loading} style={{ width: '100%' }}>
                {loading ? 'Verifying…' : 'Verify'}
              </Button>
            </Flex>
          </form>

          <button
            type="button"
            onClick={cancelMfa}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--tx2)',
              fontSize: '13px',
              padding: '4px 0',
            }}
          >
            <ArrowLeft size={14} aria-hidden="true" />
            Back to login
          </button>
        </Flex>
      </Card>
    </Flex>
  )
}
