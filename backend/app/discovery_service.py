"""On-prem network discovery orchestration.

Two-phase concurrency model (see plan): a ThreadPoolExecutor does network I/O
only (port probe, SSH auth, fact collection) per IP and returns a plain dict —
no DB access from worker threads. A single consumer thread (the
`as_completed` loop in `run_discovery`) owns the one DB session for the whole
job and performs all writes: identity matching, Server upsert,
ServerIpAddress upsert, counters, batch commits, WebSocket broadcasts. This
makes duplicate-server races structurally impossible without any locking.

Mirrors `routers/sync.py`'s `_run_sync` shape (own engine, module-global
`_stop_events`, batch commits, event log, broadcasts).
"""
import hashlib
import ipaddress
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import func
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from . import models
from .event_log_utils import add_event_log
from .ssh_utils import (
    _clean_identity_value,
    _open_ssh_client,
    collect_host_facts,
    probe_port,
)
from .ws_manager import manager

DISCOVERY_BATCH_SIZE: int = 25
DISCOVERY_BATCH_DELAY_S: float = 0.15

# Per-job cancellation events (process-local — single worker only, same
# constraint as sync.py's _stop_events).
_stop_events: dict[int, threading.Event] = {}

# Identity signals in priority order (highest first). Each entry maps a
# public signal name to the Server column that carries it (hostname+MAC is
# handled specially, not via a plain column lookup).
_IDENTITY_PRIORITY: tuple[str, ...] = (
    "machine_id",
    "product_uuid",
    "ssh_host_key_fp",
    "hostname_mac",
    "existing_ip",
)


# ─── Pure functions (no DB/network — unit-testable) ────────────────────────

def validate_cidr(cidr: str, max_ips: int = 4096) -> ipaddress.IPv4Network:
    """Parse + validate a scan CIDR. Raises ValueError with a clear message on:
    invalid syntax, IPv6 (rejected — scan input is IPv4-only per spec), or a
    range larger than max_ips.
    """
    try:
        net = ipaddress.ip_network(cidr, strict=False)
    except ValueError as exc:
        raise ValueError(f"Invalid CIDR '{cidr}': {exc}") from exc
    if not isinstance(net, ipaddress.IPv4Network):
        raise ValueError(f"IPv6 CIDR '{cidr}' is not supported for scanning — IPv4 only")
    if net.num_addresses > max_ips:
        raise ValueError(
            f"CIDR '{cidr}' has {net.num_addresses} addresses, exceeds max_ips limit of {max_ips}"
        )
    return net


def expand_cidr(net: ipaddress.IPv4Network) -> list[str]:
    """Host addresses only — excludes network/broadcast addresses."""
    return [str(ip) for ip in net.hosts()]


def compute_identity_hash(signal_name: str, value: str) -> str:
    """Audit trail only — stored on discovery_results.identity_hash, NEVER
    used as a join key. The real join key is the live DB query in
    resolve_server.
    """
    return hashlib.sha256(f"{signal_name}:{value}".encode()).hexdigest()


def extract_identity_signals(facts: dict[str, Any]) -> dict[str, str | None]:
    """Pull the matchable identity signals out of collect_host_facts() output.

    ssh_host_key_fp is NOT extracted here — it comes from the SSH connection
    itself (_open_ssh_client), not from facts, so callers pass it separately.
    """
    machine_id = _clean_identity_value(facts.get("machine_id") or "")
    product_uuid = _clean_identity_value(facts.get("product_uuid") or "")
    hostname = (facts.get("hostname") or "").strip().lower() or None

    primary_mac = None
    macs = []
    for iface in facts.get("interfaces") or []:
        mac = iface.get("mac")
        if not mac:
            continue
        addrs = iface.get("addresses") or []
        has_routable = any(a.get("scope") in ("public", "private") for a in addrs)
        if has_routable:
            macs.append(mac.lower())
    if macs:
        primary_mac = sorted(macs)[0]

    return {
        "machine_id": machine_id,
        "product_uuid": product_uuid,
        "hostname": hostname,
        "primary_mac": primary_mac,
    }


# ─── Identity resolution (DB reads — single consumer thread ONLY) ─────────

def resolve_server(
    db: Session,
    signals: dict[str, Any],
    ssh_host_key_fp: str | None,
    discovered_ips: list[str],
) -> tuple[models.Server | None, str | None]:
    """Match a discovered host to an existing Server row, or signal "new".

    MUST run only in the single consumer thread (the phase-2 as_completed
    loop in run_discovery) — never call this from a worker-pool thread.

    Priority order: machine_id -> product_uuid -> ssh_host_key_fp ->
    (hostname + primary_mac) -> existing-IP match. For each signal: 0 hits ->
    try next; exactly 1 hit -> return it; >1 hits (cloned VMs) -> ambiguous,
    fall through to next signal without treating it as a match. No match
    after all signals -> (None, None), caller creates a new Server.
    """
    machine_id = signals.get("machine_id")
    if machine_id:
        hits = db.query(models.Server).filter(models.Server.machine_id == machine_id).all()
        if len(hits) == 1:
            return hits[0], "machine_id"

    product_uuid = signals.get("product_uuid")
    if product_uuid:
        hits = db.query(models.Server).filter(models.Server.product_uuid == product_uuid).all()
        if len(hits) == 1:
            return hits[0], "product_uuid"

    if ssh_host_key_fp:
        hits = db.query(models.Server).filter(models.Server.ssh_host_key_fp == ssh_host_key_fp).all()
        if len(hits) == 1:
            return hits[0], "ssh_host_key_fp"

    hostname = signals.get("hostname")
    primary_mac = signals.get("primary_mac")
    if hostname and primary_mac:
        hits = (
            db.query(models.Server)
            .join(models.ServerIpAddress, models.ServerIpAddress.server_id == models.Server.id)
            .filter(
                models.Server.hostname == hostname,
                models.ServerIpAddress.mac_address == primary_mac,
            )
            .distinct()
            .all()
        )
        if len(hits) == 1:
            return hits[0], "hostname_mac"

    if discovered_ips:
        by_alias = (
            db.query(models.Server)
            .join(models.ServerIpAddress, models.ServerIpAddress.server_id == models.Server.id)
            .filter(models.ServerIpAddress.address.in_(discovered_ips))
            .all()
        )
        by_legacy = (
            db.query(models.Server)
            .filter(
                models.Server.public_ip.in_(discovered_ips)
                | models.Server.private_ip.in_(discovered_ips)
            )
            .all()
        )
        dedup: dict[int, models.Server] = {s.id: s for s in by_alias}
        for s in by_legacy:
            dedup[s.id] = s
        hits = list(dedup.values())
        if len(hits) == 1:
            return hits[0], "existing_ip"

    return None, None


def check_identity_conflict(
    db: Session,
    signals: dict[str, Any],
    matched_server: models.Server,
    matched_signal: str,
    ssh_host_key_fp: str | None = None,
) -> dict[str, Any] | None:
    """After resolve_server picks a winner via its highest-priority matching
    signal, check whether any OTHER (lower-priority) signal would have
    pointed to a DIFFERENT existing server. Detection + reporting only —
    never merges or modifies anything. Two real servers are never
    auto-merged; a conflict is flagged for manual review.

    ssh_host_key_fp is passed separately (not part of `signals`) since it
    comes from the SSH connection, not collect_host_facts — same split as
    resolve_server/extract_identity_signals.
    """
    remaining = _IDENTITY_PRIORITY[_IDENTITY_PRIORITY.index(matched_signal) + 1:]
    for signal_name in remaining:
        other = None
        if signal_name == "machine_id" and signals.get("machine_id"):
            other = db.query(models.Server).filter(models.Server.machine_id == signals["machine_id"]).first()
        elif signal_name == "product_uuid" and signals.get("product_uuid"):
            other = db.query(models.Server).filter(models.Server.product_uuid == signals["product_uuid"]).first()
        elif signal_name == "ssh_host_key_fp" and ssh_host_key_fp:
            other = db.query(models.Server).filter(models.Server.ssh_host_key_fp == ssh_host_key_fp).first()
        elif signal_name == "hostname_mac" and signals.get("hostname") and signals.get("primary_mac"):
            other = (
                db.query(models.Server)
                .join(models.ServerIpAddress, models.ServerIpAddress.server_id == models.Server.id)
                .filter(
                    models.Server.hostname == signals["hostname"],
                    models.ServerIpAddress.mac_address == signals["primary_mac"],
                )
                .first()
            )
        if other and other.id != matched_server.id:
            return {"other_signal": signal_name, "other_server_id": other.id}
    return None


# ─── Server + IP upsert (DB writes — single consumer thread ONLY) ─────────

def _iter_discovered_addresses(facts: dict[str, Any]):
    """Yields (iface, addr) for every non-loopback, non-link-local address
    across all interfaces in facts."""
    for iface in facts.get("interfaces") or []:
        for addr in iface.get("addresses") or []:
            if addr.get("scope") in ("loopback", "link-local"):
                continue
            yield iface, addr


def _update_existing_server_facts(server: models.Server, signals: dict[str, Any], ssh_host_key_fp: str | None, facts: dict[str, Any], now) -> None:
    """Identity columns are filled only when currently blank — never
    overwrite a populated value with a differing observed value, to avoid
    identity churn from re-scans/clones. OS/hostname/vcpu/memory are always
    refreshed since SSH facts are more current than whatever's stored."""
    if facts.get("os"):
        server.os = facts["os"]
    if facts.get("hostname"):
        server.hostname = facts["hostname"]
    if not server.machine_id and signals.get("machine_id"):
        server.machine_id = signals["machine_id"]
    if not server.product_uuid and signals.get("product_uuid"):
        server.product_uuid = signals["product_uuid"]
    if not server.ssh_host_key_fp and ssh_host_key_fp:
        server.ssh_host_key_fp = ssh_host_key_fp
    if facts.get("vcpu") is not None:
        server.vcpu = facts["vcpu"]
    if facts.get("memory_mb"):
        server.memory_gb = facts["memory_mb"] / 1024
    server.last_synced = now


def _create_new_server(db: Session, signals: dict[str, Any], ssh_host_key_fp: str | None, facts: dict[str, Any], network, discovered_ip: str, now) -> models.Server:
    server = models.Server(
        name=facts.get("hostname") or discovered_ip,
        provider="on-prem",
        status="running",
        datacenter=getattr(network, "datacenter", None) if network else None,
        hostname=facts.get("hostname"),
        os=facts.get("os"),
        vcpu=facts.get("vcpu"),
        memory_gb=(facts["memory_mb"] / 1024) if facts.get("memory_mb") else None,
        machine_id=signals.get("machine_id"),
        product_uuid=signals.get("product_uuid"),
        ssh_host_key_fp=ssh_host_key_fp,
        last_synced=now,
    )
    db.add(server)
    db.flush()  # need server.id before the IP upsert below
    return server


def _upsert_ip_address_rows(db: Session, server: models.Server, facts: dict[str, Any], discovered_ip: str) -> None:
    for iface, addr in _iter_discovered_addresses(facts):
        stmt = pg_insert(models.ServerIpAddress).values(
            server_id=server.id,
            address=addr["address"],
            cidr=addr.get("cidr"),
            ip_version=addr.get("ip_version"),
            interface_name=iface.get("name"),
            mac_address=iface.get("mac"),
            scope=addr.get("scope"),
            discovered_from_ip=discovered_ip,
            source="ssh_discovery",
            last_seen_at=func.now(),
        ).on_conflict_do_update(
            index_elements=["address"],
            set_={
                "server_id": server.id,
                "cidr": addr.get("cidr"),
                "interface_name": iface.get("name"),
                "mac_address": iface.get("mac"),
                "scope": addr.get("scope"),
                "ip_version": addr.get("ip_version"),
                "last_seen_at": func.now(),
                "discovered_from_ip": discovered_ip,
            },
        )
        db.execute(stmt)


def _recompute_legacy_ip_columns(db: Session, server: models.Server, facts: dict[str, Any]) -> None:
    """Backward-compat: recompute public_ip/private_ip/ssh_info.all_ips and
    the is_primary flag from the fresh interface list."""
    all_ips: list[str] = []
    public_ip = None
    private_ip = None
    for _iface, addr in _iter_discovered_addresses(facts):
        scope = addr.get("scope")
        all_ips.append(addr["address"])
        if scope == "public" and public_ip is None:
            public_ip = addr["address"]
        if scope == "private" and private_ip is None:
            private_ip = addr["address"]

    if public_ip:
        server.public_ip = public_ip
    if private_ip:
        server.private_ip = private_ip
    server.ssh_info = {**(server.ssh_info or {}), "all_ips": all_ips}

    primary_addr = private_ip or public_ip
    if primary_addr:
        db.query(models.ServerIpAddress).filter(
            models.ServerIpAddress.server_id == server.id
        ).update({"is_primary": False})
        db.query(models.ServerIpAddress).filter(
            models.ServerIpAddress.server_id == server.id,
            models.ServerIpAddress.address == primary_addr,
        ).update({"is_primary": True})


def upsert_server_and_ips(
    db: Session,
    matched_server: models.Server | None,
    signals: dict[str, Any],
    ssh_host_key_fp: str | None,
    facts: dict[str, Any],
    network: "models.DiscoveryNetwork | None",
    discovered_ip: str,
) -> tuple[models.Server, bool]:
    """Create or update the Server row, then upsert every discovered
    interface address into server_ip_addresses. Returns (server, was_new).
    """
    now = datetime.now(timezone.utc)
    was_new = matched_server is None

    if matched_server is not None:
        server = matched_server
        _update_existing_server_facts(server, signals, ssh_host_key_fp, facts, now)
    else:
        server = _create_new_server(db, signals, ssh_host_key_fp, facts, network, discovered_ip, now)

    _upsert_ip_address_rows(db, server, facts, discovered_ip)
    _recompute_legacy_ip_columns(db, server, facts)

    return server, was_new


# ─── Worker-pool function (network I/O ONLY — no db access) ───────────────

def _scan_ip(ip: str, ssh_cred: "models.SSHCredential", timeout: int) -> dict[str, Any]:
    """Runs in a worker thread. Never lets an exception escape — always
    returns a plain dict. Touches no DB session (the same ssh_cred ORM
    object, already queried once by the caller, is shared read-only across
    all workers).
    """
    result: dict[str, Any] = {
        "ip": ip,
        "port_open": False,
        "auth_ok": False,
        "facts": None,
        "host_key_fp": None,
        "status": "closed",
        "error_message": None,
    }
    try:
        if not probe_port(ip, 22, timeout=min(timeout, 3)):
            return result
        result["port_open"] = True
        result["status"] = "open"

        client = None
        jump_client = None
        try:
            client, jump_client, host_key_fp = _open_ssh_client(ip, ssh_cred, timeout)
            result["host_key_fp"] = host_key_fp
            result["facts"] = collect_host_facts(client)
            result["auth_ok"] = True
            result["status"] = "success"
        except Exception as exc:  # noqa: BLE001
            import paramiko
            if isinstance(exc, (paramiko.AuthenticationException, paramiko.BadAuthenticationType)):
                result["status"] = "auth_failed"
            else:
                result["status"] = "error"
                result["error_message"] = str(exc)
        finally:
            if client:
                try: client.close()
                except Exception: pass  # noqa: BLE001
            if jump_client:
                try: jump_client.close()
                except Exception: pass  # noqa: BLE001
    except Exception as exc:  # noqa: BLE001 — absolute last resort, never propagate
        result["status"] = "error"
        result["error_message"] = str(exc)
    return result


def _get_ssh_credential(db: Session, ssh_credential_id: int | None) -> "models.SSHCredential | None":
    if ssh_credential_id:
        return db.query(models.SSHCredential).filter(models.SSHCredential.id == ssh_credential_id).first()
    return db.query(models.SSHCredential).filter(models.SSHCredential.is_default.is_(True)).first()


def _fail_discovery_job(db, job, job_id: int, message: str) -> None:
    job.status = "failed"
    job.error_message = message
    job.completed_at = datetime.now(timezone.utc)
    db.commit()
    manager.broadcast({"type": "discovery_complete", "job_id": job_id, "status": "failed"})


def _discovery_progress_payload(job_id: int, job) -> dict:
    return {
        "type": "discovery_progress",
        "job_id": job_id,
        "scanned_ips": job.scanned_ips,
        "reachable_ssh": job.reachable_ssh,
        "authenticated": job.authenticated,
        "servers_added": job.servers_added,
        "servers_updated": job.servers_updated,
        "duplicates_merged": job.duplicates_merged,
        "failed": job.failed,
    }


def _process_successful_scan(db, job, job_id: int, network, result: dict, seen_servers_this_job: dict) -> None:
    job.authenticated += 1
    facts = result["facts"] or {}
    signals = extract_identity_signals(facts)
    discovered_ips = [
        a["address"]
        for iface in facts.get("interfaces") or []
        for a in iface.get("addresses") or []
        if a.get("scope") not in ("loopback", "link-local")
    ]
    matched_server, matched_signal = resolve_server(db, signals, result["host_key_fp"], discovered_ips)

    conflict = None
    if matched_server is not None and matched_signal is not None:
        conflict = check_identity_conflict(db, signals, matched_server, matched_signal, result["host_key_fp"])

    server, was_new = upsert_server_and_ips(
        db, matched_server, signals, result["host_key_fp"], facts, network, result["ip"]
    )
    if was_new:
        job.servers_added += 1
    else:
        job.servers_updated += 1

    repeat_count = seen_servers_this_job.get(server.id, 0)
    seen_servers_this_job[server.id] = repeat_count + 1
    is_duplicate_this_job = repeat_count > 0
    if is_duplicate_this_job:
        job.duplicates_merged += 1

    hash_signal = matched_signal or ("machine_id" if signals.get("machine_id") else None)
    hash_value = signals.get(hash_signal) if hash_signal else None
    raw_summary: dict[str, Any] = dict(facts)
    if conflict:
        raw_summary["identity_conflict"] = conflict

    db.add(models.DiscoveryResult(
        job_id=job_id,
        ip=result["ip"],
        status="duplicate" if is_duplicate_this_job else "success",
        server_id=server.id,
        identity_hash=compute_identity_hash(hash_signal, hash_value) if hash_value else None,
        hostname=facts.get("hostname"),
        raw_summary=raw_summary,
    ))


def _process_unsuccessful_scan(db, job, job_id: int, result: dict) -> None:
    if result["status"] in ("auth_failed", "error"):
        job.failed += 1
    db.add(models.DiscoveryResult(
        job_id=job_id,
        ip=result["ip"],
        status=result["status"],
        error_message=result["error_message"],
    ))


def _process_one_scan_result(db, job, job_id: int, network, result: dict, seen_servers_this_job: dict) -> None:
    job.scanned_ips += 1
    if result["port_open"]:
        job.reachable_ssh += 1
    if result["status"] == "success":
        _process_successful_scan(db, job, job_id, network, result, seen_servers_this_job)
    else:
        _process_unsuccessful_scan(db, job, job_id, result)


def _run_scan_loop(db, job, job_id: int, network, ips: list[str], ssh_cred, timeout_seconds: int, max_parallel: int, stop_event) -> bool:
    """Fans out IP scans across a thread pool; this thread is the sole
    consumer that writes to `db`. Returns True if the loop was stopped early."""
    seen_servers_this_job: dict[int, int] = {}
    stopped = False

    with ThreadPoolExecutor(max_workers=max_parallel or 32) as ex:
        futures = {ex.submit(_scan_ip, ip, ssh_cred, timeout_seconds): ip for ip in ips}
        since_commit = 0
        for future in as_completed(futures):
            if stop_event.is_set():
                stopped = True
                break

            result = future.result()
            _process_one_scan_result(db, job, job_id, network, result, seen_servers_this_job)

            since_commit += 1
            if since_commit >= DISCOVERY_BATCH_SIZE:
                db.commit()
                since_commit = 0
                manager.broadcast(_discovery_progress_payload(job_id, job))
                time.sleep(DISCOVERY_BATCH_DELAY_S)

        if since_commit:
            db.commit()
            manager.broadcast(_discovery_progress_payload(job_id, job))

    return stopped


def run_discovery(
    job_id: int,
    cidr: str,
    ssh_credential_id: int | None,
    max_parallel: int,
    timeout_seconds: int,
    db_url: str,
) -> None:
    """Main orchestration entry point — called via BackgroundTasks.add_task
    from the discovery router. Signature is a contract with that router;
    flag any change here.
    """
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    engine = create_engine(db_url, pool_pre_ping=True)
    db = sessionmaker(bind=engine)()

    stop_event = threading.Event()
    _stop_events[job_id] = stop_event

    try:
        job = db.query(models.DiscoveryJob).filter(models.DiscoveryJob.id == job_id).first()
        if not job:
            return

        ssh_cred = _get_ssh_credential(db, ssh_credential_id)
        network = (
            db.query(models.DiscoveryNetwork).filter(models.DiscoveryNetwork.id == job.network_id).first()
            if job.network_id else None
        )

        try:
            net = validate_cidr(cidr, max_ips=4096)
        except ValueError as exc:
            _fail_discovery_job(db, job, job_id, str(exc))
            return

        if not ssh_cred:
            _fail_discovery_job(
                db, job, job_id,
                "No SSH credential available (none specified and no default configured)",
            )
            return

        ips = expand_cidr(net)
        job.total_ips = len(ips)
        job.status = "running"
        job.started_at = datetime.now(timezone.utc)
        db.commit()

        manager.broadcast({"type": "discovery_started", "job_id": job_id, "total_ips": len(ips)})

        error: str | None = None
        stopped = False
        try:
            stopped = _run_scan_loop(db, job, job_id, network, ips, ssh_cred, timeout_seconds, max_parallel, stop_event)
        except Exception as exc:  # noqa: BLE001
            error = str(exc)
            db.rollback()

        if error:
            job.status = "failed"
            job.error_message = error
        elif stopped or stop_event.is_set():
            job.status = "stopped"
        else:
            job.status = "success"
        job.completed_at = datetime.now(timezone.utc)

        add_event_log(
            db,
            severity="error" if error else "info",
            source="discovery",
            resource=cidr,
            event="Discovery job failed" if error else "Discovery job completed",
            status="open" if error else "resolved",
            owner="system",
            message=error or f"scanned={job.scanned_ips}, added={job.servers_added}, updated={job.servers_updated}",
        )
        db.commit()

        manager.broadcast({
            "type": "discovery_complete",
            "job_id": job_id,
            "status": job.status,
            "scanned_ips": job.scanned_ips,
            "reachable_ssh": job.reachable_ssh,
            "authenticated": job.authenticated,
            "servers_added": job.servers_added,
            "servers_updated": job.servers_updated,
            "duplicates_merged": job.duplicates_merged,
            "failed": job.failed,
            "error_message": job.error_message,
        })
    finally:
        _stop_events.pop(job_id, None)
        db.close()


def stop_discovery(job_id: int) -> bool:
    """Signal a running job to stop. Only sets the in-memory threading.Event
    — does NOT mark the DiscoveryJob row itself.

    Router/DB split: the router's stop endpoint does the eager DB update
    (status="stopped", completed_at=now) in its own request-scoped session,
    since it already has Depends(get_db) and can respond immediately even if
    the background loop is blocked in a long paramiko call for many seconds.
    This function only flips the event so the phase-2 loop notices and stops
    processing further results on its next iteration.
    """
    ev = _stop_events.get(job_id)
    if ev:
        ev.set()
        return True
    return False
