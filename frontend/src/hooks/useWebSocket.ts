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

export function useWebSocket(onMessage: (e: SyncEvent) => void) {
  const wsRef       = useRef<WebSocket | null>(null)
  const reconnRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef  = useRef(true)
  const onMsgRef    = useRef(onMessage)
  onMsgRef.current  = onMessage   // always current without causing reconnect

  const connect = useCallback(() => {
    if (!mountedRef.current) return
    const token = localStorage.getItem('si_token')
    if (!token) return

    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const ws    = new WebSocket(`${proto}://${window.location.host}/ws?token=${encodeURIComponent(token)}`)
    wsRef.current = ws

    let ping: ReturnType<typeof setInterval> | null = null

    ws.onopen = () => {
      ping = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send('ping')
      }, 25_000)
    }

    ws.onmessage = (e) => {
      if (e.data === 'pong') return
      try {
        const data = JSON.parse(e.data) as SyncEvent
        if (data.type) onMsgRef.current(data)
      } catch { /* ignore non-JSON */ }
    }

    ws.onclose = () => {
      if (ping) clearInterval(ping)
      if (mountedRef.current) {
        reconnRef.current = setTimeout(connect, 3_000)
      }
    }

    ws.onerror = () => ws.close()
  }, [])  // stable — no deps that change

  useEffect(() => {
    mountedRef.current = true
    connect()
    return () => {
      mountedRef.current = false
      if (reconnRef.current) clearTimeout(reconnRef.current)
      wsRef.current?.close()
    }
  }, [connect])
}
