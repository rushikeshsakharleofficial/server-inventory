import { useEffect, useRef } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { API_BASE, tokenStore } from "./api";

const WS_BASE = API_BASE.replace(/^https/, "wss").replace(/^http/, "ws");

const RECONNECT_DELAY_MS = 3_000;
const MAX_RECONNECT_DELAY_MS = 30_000;

// Fix 5 — live indicator
type ConnectListener = (connected: boolean) => void;
let _wsListener: ConnectListener | null = null;
export function onWsConnectChange(fn: ConnectListener): void { _wsListener = fn; }

// Fix 3 — debounce helper
const _dbt = new Map<string, ReturnType<typeof setTimeout>>();
function debInvalidate(qc: QueryClient, key: unknown[], ms = 800) {
  const k = JSON.stringify(key);
  clearTimeout(_dbt.get(k));
  _dbt.set(k, setTimeout(() => { qc.invalidateQueries({ queryKey: key }); _dbt.delete(k); }, ms));
}

// Fix 2 — Zod schema
const WsMessage = z.discriminatedUnion("type", [
  z.object({ type: z.literal("active_syncs"), syncs: z.array(z.object({ log_id: z.number(), provider: z.string().nullable(), status: z.string(), started_at: z.string().nullable().optional() })) }),
  z.object({ type: z.literal("sync_started"), log_id: z.number(), provider: z.string() }),
  z.object({ type: z.literal("sync_progress"), log_id: z.number(), provider: z.string(), processed: z.number(), total: z.number(), added: z.number(), updated: z.number() }),
  z.object({ type: z.literal("sync_complete"), log_id: z.number(), provider: z.string(), status: z.string(), servers_added: z.number(), servers_updated: z.number(), error_message: z.string().nullable() }),
  z.object({ type: z.literal("sync_stopped"), log_id: z.number(), provider: z.string() }),
  z.object({ type: z.literal("server_status_changed"), server_id: z.number(), server_name: z.string(), provider: z.string(), old_status: z.string(), new_status: z.string() }),
  z.object({ type: z.literal("discovery_started"), job_id: z.number(), total_ips: z.number() }),
  z.object({ type: z.literal("discovery_progress"), job_id: z.number(), scanned_ips: z.number(), reachable_ssh: z.number(), authenticated: z.number(), servers_added: z.number(), servers_updated: z.number(), duplicates_merged: z.number(), failed: z.number() }),
  z.object({ type: z.literal("discovery_complete"), job_id: z.number(), status: z.string(), scanned_ips: z.number(), reachable_ssh: z.number(), authenticated: z.number(), servers_added: z.number(), servers_updated: z.number(), duplicates_merged: z.number(), failed: z.number(), error_message: z.string().nullable().optional() }),
  z.object({ type: z.literal("discovery_stopped"), job_id: z.number() }),
]);
type WsMessage = z.infer<typeof WsMessage>;

export function useAppWebSocket() {
  const qc = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const delayRef = useRef(RECONNECT_DELAY_MS);
  const unmountedRef = useRef(false);
  const genRef = useRef(0); // Fix 6

  useEffect(() => {
    unmountedRef.current = false;
    genRef.current += 1; // Fix 6
    const gen = genRef.current;

    function connect(gen: number) {
      const token = tokenStore.get();
      if (!token || unmountedRef.current) return;

      const ws = new WebSocket(`${WS_BASE}/ws`); // Fix 1 — no token in URL
      wsRef.current = ws;

      ws.onopen = () => {
        _wsListener?.(true); // Fix 5
        delayRef.current = RECONNECT_DELAY_MS;
        ws.send(JSON.stringify({ type: "auth", token })); // Fix 1
        qc.invalidateQueries({ queryKey: ["syncLogs"] });
        qc.invalidateQueries({ queryKey: ["stats"] });
      };

      ws.onmessage = (ev) => {
        if (typeof ev.data !== "string") return; // Fix 2
        if (ev.data === "ping") { ws.send("pong"); return; }
        if (ev.data === "pong") return;

        let raw: unknown;
        try { raw = JSON.parse(ev.data); } catch { return; }
        const result = WsMessage.safeParse(raw); // Fix 2
        if (!result.success) return;
        const msg = result.data;

        switch (msg.type) {
          case "active_syncs":
          case "sync_started":
          case "sync_stopped":
            qc.invalidateQueries({ queryKey: ["syncLogs"] });
            qc.invalidateQueries({ queryKey: ["stats"] });
            qc.invalidateQueries({ queryKey: ["crons"] });
            break;
          case "sync_progress": // Fix 3 — debounced
            debInvalidate(qc, ["syncLogs"]);
            debInvalidate(qc, ["stats"]);
            break;
          case "sync_complete": // Fix 4 — stats-history
            qc.invalidateQueries({ queryKey: ["syncLogs"] });
            qc.invalidateQueries({ queryKey: ["stats"] });
            qc.invalidateQueries({ queryKey: ["stats-history"] });
            qc.invalidateQueries({ queryKey: ["crons"] });
            break;
          case "server_status_changed":
            qc.invalidateQueries({ queryKey: ["servers"] });
            qc.invalidateQueries({ queryKey: ["stats"] });
            break;
          case "discovery_started":
          case "discovery_stopped":
            qc.invalidateQueries({ queryKey: ["discoveryJobs"] });
            break;
          case "discovery_progress": // debounced — mirrors sync_progress
            debInvalidate(qc, ["discoveryJobs"]);
            debInvalidate(qc, ["discoveryResults"]);
            break;
          case "discovery_complete":
            qc.invalidateQueries({ queryKey: ["discoveryJobs"] });
            qc.invalidateQueries({ queryKey: ["discoveryResults"] });
            qc.invalidateQueries({ queryKey: ["servers"] });
            qc.invalidateQueries({ queryKey: ["stats"] });
            break;
        }
      };

      ws.onclose = () => {
        _wsListener?.(false); // Fix 5
        wsRef.current = null;
        if (unmountedRef.current || gen !== genRef.current) return; // Fix 6
        setTimeout(() => {
          if (!unmountedRef.current && gen === genRef.current) connect(gen); // Fix 6
        }, delayRef.current);
        delayRef.current = Math.min(delayRef.current * 2, MAX_RECONNECT_DELAY_MS);
      };

      ws.onerror = () => ws.close();
    }

    connect(gen);

    return () => {
      unmountedRef.current = true;
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [qc]);
}
