import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { API_BASE, tokenStore } from "./api";

// Derive ws:// or wss:// from the HTTP base URL
const WS_BASE = API_BASE.replace(/^https/, "wss").replace(/^http/, "ws");

const RECONNECT_DELAY_MS = 3_000;
const MAX_RECONNECT_DELAY_MS = 30_000;

export function useAppWebSocket() {
  const qc = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const delayRef = useRef(RECONNECT_DELAY_MS);
  const unmountedRef = useRef(false);

  useEffect(() => {
    unmountedRef.current = false;

    function connect() {
      const token = tokenStore.get();
      if (!token || unmountedRef.current) return;

      const ws = new WebSocket(`${WS_BASE}/ws?token=${encodeURIComponent(token)}`);
      wsRef.current = ws;

      ws.onopen = () => {
        delayRef.current = RECONNECT_DELAY_MS; // reset backoff on success
      };

      ws.onmessage = (ev) => {
        if (ev.data === "ping") { ws.send("pong"); return; }
        if (ev.data === "pong") return;

        let msg: Record<string, unknown>;
        try { msg = JSON.parse(ev.data); } catch { return; }

        const type = msg.type as string | undefined;
        switch (type) {
          case "active_syncs":
          case "sync_started":
          case "sync_progress":
          case "sync_complete":
          case "sync_stopped":
            qc.invalidateQueries({ queryKey: ["syncLogs"] });
            qc.invalidateQueries({ queryKey: ["stats"] });
            qc.invalidateQueries({ queryKey: ["crons"] });
            break;
          case "server_status_changed":
            qc.invalidateQueries({ queryKey: ["servers"] });
            qc.invalidateQueries({ queryKey: ["stats"] });
            break;
          default:
            // Unknown message type — invalidate broadly
            qc.invalidateQueries({ queryKey: ["servers"] });
            qc.invalidateQueries({ queryKey: ["syncLogs"] });
            qc.invalidateQueries({ queryKey: ["stats"] });
        }
      };

      ws.onclose = () => {
        wsRef.current = null;
        if (unmountedRef.current) return;
        // Exponential backoff reconnect
        setTimeout(() => {
          if (!unmountedRef.current) connect();
        }, delayRef.current);
        delayRef.current = Math.min(delayRef.current * 2, MAX_RECONNECT_DELAY_MS);
      };

      ws.onerror = () => ws.close(); // triggers onclose → reconnect
    }

    connect();

    return () => {
      unmountedRef.current = true;
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [qc]);
}
