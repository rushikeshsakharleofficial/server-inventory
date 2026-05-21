import { useEffect, useRef, useCallback } from 'react'

export interface SyncEvent {
  type: 'sync_started' | 'sync_complete' | 'active_syncs' | 'sync_stopped'
  log_id?: number
  provider?: string
  status?: string
  servers_added?: number
  servers_updated?: number
  error_message?: string
  syncs?: Array<{ log_id: number; provider: string; status: string }>
}

// ── Reconnection tunables ────────────────────────────────────────────────────
const BASE_DELAY_MS  = 1_000   // first retry after 1 s
const MAX_DELAY_MS   = 30_000  // cap at 30 s
const JITTER_RATIO   = 0.3     // ±30 % random jitter on each delay
const MAX_ATTEMPTS   = 10      // give up after this many consecutive failures

// ── Heartbeat tunables ───────────────────────────────────────────────────────
// Client sends 'ping' every CLIENT_PING_MS; server also sends its own 'ping'
// which the client must reply to with 'pong' (record_pong on the server).
const CLIENT_PING_MS = 25_000

// ── Message queue cap ────────────────────────────────────────────────────────
// Outbound messages queued while the socket is disconnected are flushed on
// the next successful open.  The oldest message is evicted when the cap is hit.
const MAX_QUEUE_SIZE = 50

/** Compute the next reconnect delay with full-jitter exponential backoff. */
function backoffDelay(attempt: number): number {
  const exp    = Math.min(BASE_DELAY_MS * 2 ** attempt, MAX_DELAY_MS)
  const jitter = exp * JITTER_RATIO * (Math.random() * 2 - 1)  // [-jitter, +jitter]
  return Math.max(0, exp + jitter)
}

export interface UseWebSocketReturn {
  /** Send a raw text message; queued automatically if the socket is not open. */
  send: (msg: string) => void
}

export function useWebSocket(
  onMessage: (e: SyncEvent) => void,
): UseWebSocketReturn {
  const wsRef       = useRef<WebSocket | null>(null)
  const reconnRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef  = useRef(true)
  const attemptRef  = useRef(0)              // consecutive reconnect counter
  const onMsgRef    = useRef(onMessage)
  const msgQueue    = useRef<string[]>([])   // outbound queue during disconnect
  onMsgRef.current  = onMessage              // always current without causing reconnect

  /**
   * Queue a message with a ring-buffer cap to avoid unbounded memory growth.
   * If the socket is already open the message is sent immediately.
   */
  const send = useCallback((msg: string) => {
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(msg)
      return
    }
    // Socket not ready — queue for later, drop oldest if at cap
    if (msgQueue.current.length >= MAX_QUEUE_SIZE) {
      msgQueue.current.shift()
    }
    msgQueue.current.push(msg)
  }, [])

  /** Drain the outbound queue once the socket is open. */
  const flushQueue = useCallback((ws: WebSocket) => {
    while (msgQueue.current.length > 0 && ws.readyState === WebSocket.OPEN) {
      ws.send(msgQueue.current.shift()!)
    }
  }, [])

  const connect = useCallback(() => {
    if (!mountedRef.current) return

    const token = localStorage.getItem('si_token')
    if (!token) return

    // Abort if already open or connecting
    const existing = wsRef.current
    if (
      existing &&
      (existing.readyState === WebSocket.OPEN ||
       existing.readyState === WebSocket.CONNECTING)
    ) return

    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const ws    = new WebSocket(`${proto}://${window.location.host}/ws`)
    wsRef.current = ws

    let pingTimer: ReturnType<typeof setInterval> | null = null

    ws.onopen = () => {
      // Send auth token as first message — never in URL (avoids log exposure)
      ws.send(JSON.stringify({ type: 'auth', token }))

      attemptRef.current = 0
      flushQueue(ws)
      pingTimer = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send('ping')
      }, CLIENT_PING_MS)
    }

    ws.onmessage = (e) => {
      // Server-driven ping — reply so the server resets its dead-connection timer
      if (e.data === 'ping') {
        if (ws.readyState === WebSocket.OPEN) ws.send('pong')
        return
      }
      // Echo of our own client ping — ignore
      if (e.data === 'pong') return

      try {
        const data = JSON.parse(e.data) as SyncEvent
        if (data.type) onMsgRef.current(data)
      } catch {
        // Silently drop non-JSON frames; the server never sends malformed JSON
      }
    }

    ws.onclose = (ev) => {
      if (pingTimer) clearInterval(pingTimer)
      pingTimer = null

      if (!mountedRef.current) return

      // Server close-code 4001 = auth failure — do not retry (token is invalid)
      if (ev.code === 4001) return

      const attempt = attemptRef.current
      if (attempt >= MAX_ATTEMPTS) {
        // Stop reconnecting to avoid flooding the server.
        // A page refresh by the user resets the counter.
        console.warn('[WS] Max reconnect attempts reached; giving up.')
        return
      }

      attemptRef.current = attempt + 1
      const delay = backoffDelay(attempt)
      reconnRef.current = setTimeout(connect, delay)
    }

    ws.onerror = () => {
      // Delegate retry logic to onclose; just ensure the socket transitions to CLOSED
      ws.close()
    }
  }, [flushQueue])

  useEffect(() => {
    mountedRef.current = true
    attemptRef.current = 0
    connect()
    return () => {
      mountedRef.current = false
      if (reconnRef.current) clearTimeout(reconnRef.current)
      wsRef.current?.close()
    }
  }, [connect])

  return { send }
}
