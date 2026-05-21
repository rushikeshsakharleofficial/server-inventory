"""
Singleton WebSocket connection manager.
Broadcasts sync events from background threads to all connected clients.

Design notes:
- Per-connection metadata tracks last_pong so the ping task can evict dead sockets.
- Rate limiting: max MAX_MSG_PER_WINDOW messages per client per RATE_WINDOW_SECS window.
- No per-connection in-memory message queue is needed server-side because this app
  only broadcasts fire-and-forget sync events; persistent delivery is handled by the
  client re-fetching active_syncs on reconnect.
- For horizontal scaling a Redis pub/sub layer would replace self._meta; left as a
  TODO because that requires infrastructure changes.
"""
import asyncio
import time
from dataclasses import dataclass, field
from typing import Any
from fastapi import WebSocket

# ── rate-limiting tunables ────────────────────────────────────────────────────
MAX_MSG_PER_WINDOW: int = 30   # max client→server messages per window
RATE_WINDOW_SECS:  int = 10   # sliding window length in seconds

# ── heartbeat tunables ────────────────────────────────────────────────────────
PING_INTERVAL_SECS:  int = 20   # server sends a ping every N seconds
PING_TIMEOUT_SECS:   int = 60   # evict if no pong received within this many seconds


@dataclass
class _ConnMeta:
    username:       str
    last_pong:      float  = field(default_factory=time.monotonic)
    # rate-limiting state
    msg_count:      int   = 0
    window_start:   float = field(default_factory=time.monotonic)


class ConnectionManager:
    def __init__(self) -> None:
        # _meta is the single source of truth for active connections
        self._meta: dict[WebSocket, _ConnMeta] = {}
        self._loop: asyncio.AbstractEventLoop | None = None
        self._ping_task: asyncio.Task[None] | None = None

    @property
    def active(self) -> list[WebSocket]:
        """Read-only view — kept for backward compatibility with broadcast callers."""
        return list(self._meta.keys())

    def set_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        self._loop = loop
        # Kick off the server-driven heartbeat loop
        if self._ping_task is None or self._ping_task.done():
            self._ping_task = loop.create_task(self._heartbeat_loop())

    async def connect(self, ws: WebSocket, username: str) -> None:
        # ws.accept() is called by the endpoint before auth — do not accept again
        self._meta[ws] = _ConnMeta(username=username)

    def disconnect(self, ws: WebSocket) -> None:
        """Remove all state for this connection — no leaked metadata."""
        self._meta.pop(ws, None)

    def record_pong(self, ws: WebSocket) -> None:
        """Call when the client sends 'pong' (or any keep-alive reply)."""
        meta = self._meta.get(ws)
        if meta:
            meta.last_pong = time.monotonic()

    def is_rate_limited(self, ws: WebSocket) -> bool:
        """
        Sliding-window rate limiter.  Returns True if the client has exceeded
        MAX_MSG_PER_WINDOW messages in the last RATE_WINDOW_SECS seconds.
        """
        meta = self._meta.get(ws)
        if meta is None:
            return True  # unknown socket — deny
        now = time.monotonic()
        if now - meta.window_start >= RATE_WINDOW_SECS:
            meta.msg_count   = 0
            meta.window_start = now
        meta.msg_count += 1
        return meta.msg_count > MAX_MSG_PER_WINDOW

    # ── internal helpers ──────────────────────────────────────────────────────

    async def _heartbeat_loop(self) -> None:
        """
        Server-driven ping: send 'ping' to every live socket every PING_INTERVAL_SECS
        and evict any socket that has not replied within PING_TIMEOUT_SECS.
        """
        while True:
            await asyncio.sleep(PING_INTERVAL_SECS)
            now  = time.monotonic()
            dead: list[WebSocket] = []

            for ws, meta in list(self._meta.items()):
                if now - meta.last_pong > PING_TIMEOUT_SECS:
                    dead.append(ws)
                    continue
                try:
                    await ws.send_text("ping")
                except Exception:
                    dead.append(ws)

            for ws in dead:
                self.disconnect(ws)
                try:
                    await ws.close()
                except Exception:
                    pass

    async def _send(self, message: dict[str, Any]) -> None:
        dead: list[WebSocket] = []
        for ws in list(self._meta.keys()):
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)

    def broadcast(self, message: dict[str, Any]) -> None:
        """Safe to call from any thread."""
        if self._loop and not self._loop.is_closed() and self._meta:
            asyncio.run_coroutine_threadsafe(self._send(message), self._loop)


manager = ConnectionManager()

# ── TODO (requires infra changes) ────────────────────────────────────────────
# For multi-worker / multi-host deployments replace self._meta + broadcast() with
# a Redis pub/sub channel (e.g. via aioredis).  Each worker subscribes to the
# channel and relays messages to its own local sockets.  The current in-process
# dict means only clients connected to the same worker process receive broadcasts.
