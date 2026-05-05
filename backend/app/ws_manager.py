"""
Singleton WebSocket connection manager.
Broadcasts sync events from background threads to all connected clients.
"""
import asyncio
from typing import List, Optional, Dict, Any
from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        self.active: List[WebSocket] = []
        self._loop: Optional[asyncio.AbstractEventLoop] = None

    def set_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        self._loop = loop

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self.active.append(ws)

    def disconnect(self, ws: WebSocket) -> None:
        if ws in self.active:
            self.active.remove(ws)

    async def _send(self, message: Dict[str, Any]) -> None:
        dead: List[WebSocket] = []
        for ws in list(self.active):
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)

    def broadcast(self, message: Dict[str, Any]) -> None:
        """Safe to call from any thread."""
        if self._loop and not self._loop.is_closed() and self.active:
            asyncio.run_coroutine_threadsafe(self._send(message), self._loop)


manager = ConnectionManager()
