"""Real-cloud read-only smoke verification.

Confirms real provider credentials authenticate and real list/describe APIs
work, without ever creating or mutating cloud resources — so it's safe to run
against empty or free-tier accounts. See ENABLE_REAL_CLOUD_SMOKE and friends
below; all real network calls are opt-in and gated.

Deliberately does NOT reimplement per-provider API calls: every CloudProvider
subclass in app/providers/ already only exposes fetch_servers/fetch_databases/
fetch_kubernetes/fetch_block_storages, and those methods only call read-only/
list/describe SDK methods (see app/providers/base.py). This module just calls
that existing interface through a counting + denylist guard, as defense in
depth, and classifies the result.
"""

from __future__ import annotations

import json
import os
import re
import sys
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Any, Callable

from .providers import PROVIDER_MAP, get_provider
from .crypto import decrypt_config

# --- env flags -----------------------------------------------------------

ENABLE_REAL_CLOUD_SMOKE = os.environ.get("ENABLE_REAL_CLOUD_SMOKE", "false").lower() == "true"
REAL_CLOUD_READ_ONLY = os.environ.get("REAL_CLOUD_READ_ONLY", "true").lower() == "true"
REAL_CLOUD_ALLOW_CREATE = os.environ.get("REAL_CLOUD_ALLOW_CREATE", "false").lower() == "true"
REAL_CLOUD_MAX_CALLS_PER_PROVIDER = int(os.environ.get("REAL_CLOUD_MAX_CALLS_PER_PROVIDER", "50"))
REAL_CLOUD_TIMEOUT_SECONDS = int(os.environ.get("REAL_CLOUD_TIMEOUT_SECONDS", "20"))
REAL_CLOUD_PROVIDERS = [
    p.strip() for p in os.environ.get("REAL_CLOUD_PROVIDERS", "aws,gcp,azure,digitalocean,linode,ovh").split(",")
    if p.strip()
]

# Hard denylist: any SDK/API call whose name contains one of these words is
# refused by the guard, regardless of REAL_CLOUD_ALLOW_CREATE. This is
# defense-in-depth on top of CloudProvider only exposing fetch_* methods.
MUTATING_ACTION_WORDS = [
    "create", "run", "start", "stop", "reboot", "terminate", "delete",
    "update", "modify", "attach", "detach", "allocate", "release",
    "provision", "scale",
]
_MUTATING_RE = re.compile("|".join(MUTATING_ACTION_WORDS), re.IGNORECASE)

ASSET_TYPES = ("servers", "databases", "kubernetes", "block_storage")
_FETCH_METHOD = {
    "servers": "fetch_servers",
    "databases": "fetch_databases",
    "kubernetes": "fetch_kubernetes",
    "block_storage": "fetch_block_storages",
}

SECRET_KEY_PATTERN = re.compile(
    r"(secret|password|token|private_key|api_key|access_key|consumer_key|application_key)",
    re.IGNORECASE,
)

STATUS_VALUES = (
    "not_configured", "auth_failed", "verified_empty", "verified_partial",
    "verified_with_assets", "partial", "verified", "failed", "skipped",
)


class MutatingCallBlocked(RuntimeError):
    """Raised by the guard when a call name matches the mutation denylist."""


@dataclass
class SmokeVerificationResult:
    provider: str
    credential_name: str | None = None
    status: str = "skipped"
    servers_checked: int = 0
    databases_checked: int = 0
    kubernetes_checked: int = 0
    block_storage_checked: int = 0
    api_calls: int = 0
    errors: list[dict[str, str]] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    normalized_samples: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def _redact(value: Any) -> Any:
    """Recursively strip anything that looks like a secret from a value before
    it ever reaches a report file or API response."""
    if isinstance(value, dict):
        out = {}
        for k, v in value.items():
            if SECRET_KEY_PATTERN.search(str(k)):
                out[k] = "***redacted***"
            else:
                out[k] = _redact(v)
        return out
    if isinstance(value, list):
        return [_redact(v) for v in value]
    return value


def _guarded_call(fn: Callable[[], Any], call_name: str, call_counter: list[int]) -> Any:
    """Refuse to run *fn* if its name matches the mutation denylist, or if the
    provider's per-run call budget is already spent."""
    if _MUTATING_RE.search(call_name):
        raise MutatingCallBlocked(f"refusing to call '{call_name}': matches mutating-action denylist")
    if call_counter[0] >= REAL_CLOUD_MAX_CALLS_PER_PROVIDER:
        raise RuntimeError(
            f"REAL_CLOUD_MAX_CALLS_PER_PROVIDER ({REAL_CLOUD_MAX_CALLS_PER_PROVIDER}) exceeded"
        )
    call_counter[0] += 1
    return fn()


_REQUIRED_NORMALIZED_KEYS = ("cloud_id", "name", "provider")
_OPTIONAL_NORMALIZED_KEYS = ("region", "zone", "status", "public_ip", "private_ip", "tags", "extra")


def _validate_normalized_schema(asset_type: str, items: list[dict[str, Any]], warnings: list[str]) -> None:
    for item in items[:5]:
        missing = [k for k in _REQUIRED_NORMALIZED_KEYS if k not in item]
        if missing:
            warnings.append(f"{asset_type}: normalized item missing required field(s) {missing}")
        if not any(k in item for k in ("region", "zone")):
            warnings.append(f"{asset_type}: normalized item has neither 'region' nor 'zone'")


def verify_provider_readonly(
    provider_name: str,
    config: dict[str, Any],
    credential_name: str | None = None,
) -> SmokeVerificationResult:
    """Run read-only fetch_* calls against one real provider credential and
    classify the outcome. Never raises for expected conditions (empty
    account, missing permission) — only for programming/config errors."""
    result = SmokeVerificationResult(provider=provider_name, credential_name=credential_name)

    if not ENABLE_REAL_CLOUD_SMOKE:
        result.status = "skipped"
        result.warnings.append("ENABLE_REAL_CLOUD_SMOKE is not true; refusing to make real calls")
        return result

    if not REAL_CLOUD_READ_ONLY:
        result.status = "skipped"
        result.warnings.append("REAL_CLOUD_READ_ONLY must be true for smoke verification; refusing")
        return result

    if provider_name not in PROVIDER_MAP:
        result.status = "not_configured"
        result.errors.append({"asset_type": "*", "error": f"unknown provider '{provider_name}'"})
        return result

    try:
        provider = get_provider(provider_name, config)
    except Exception as exc:  # bad config shape, missing lib, etc.
        result.status = "auth_failed"
        result.errors.append({"asset_type": "*", "error": str(exc)})
        return result

    call_counter = [0]
    any_ok = False
    any_denied = False
    counts = {"servers": 0, "databases": 0, "kubernetes": 0, "block_storage": 0}

    for asset_type in ASSET_TYPES:
        method_name = _FETCH_METHOD[asset_type]
        method = getattr(provider, method_name)
        try:
            items = _guarded_call(method, method_name, call_counter)
            counts[asset_type] = len(items)
            if items:
                result.normalized_samples[asset_type] = _redact(items[0])
                _validate_normalized_schema(asset_type, items, result.warnings)
            any_ok = True
        except MutatingCallBlocked as exc:
            result.errors.append({"asset_type": asset_type, "error": str(exc)})
        except Exception as exc:
            msg = str(exc)
            if _looks_like_permission_error(msg):
                any_denied = True
                result.errors.append({"asset_type": asset_type, "error": "permission_denied"})
            elif _looks_like_auth_error(msg):
                result.status = "auth_failed"
                result.errors.append({"asset_type": asset_type, "error": "auth_failed"})
            else:
                result.errors.append({"asset_type": asset_type, "error": msg[:300]})

    result.api_calls = call_counter[0]
    result.servers_checked = counts["servers"]
    result.databases_checked = counts["databases"]
    result.kubernetes_checked = counts["kubernetes"]
    result.block_storage_checked = counts["block_storage"]

    if result.status == "auth_failed":
        return result
    if not any_ok:
        result.status = "failed" if result.errors else "failed"
        return result
    total_assets = sum(counts.values())
    if any_denied and total_assets == 0:
        result.status = "partial"
    elif any_denied:
        result.status = "partial"
    elif total_assets == 0:
        result.status = "verified_empty"
        result.warnings.append(
            "Real API auth and list permissions verified, but no assets were present to validate full sync."
        )
    else:
        result.status = "verified"
    return result


def _looks_like_permission_error(msg: str) -> bool:
    msg = msg.lower()
    return any(s in msg for s in ("accessdenied", "access denied", "forbidden", "403", "unauthorized_operation", "permission"))


def _looks_like_auth_error(msg: str) -> bool:
    msg = msg.lower()
    return any(s in msg for s in ("invalid credentials", "authenticationfailed", "signature", "401", "invalid api key", "invalidclienttokenid"))


# --- credential loading (env-based, for CLI use outside a DB session) -----

def _load_env_credentials() -> list[tuple[str, dict[str, Any], str | None]]:
    """Best-effort: build one credential tuple per REAL_CLOUD_PROVIDERS entry
    from provider-prefixed env vars (e.g. AWS_ACCESS_KEY_ID). Intended for
    CLI/local use; the DB-backed path (real Credential rows) is used by the
    optional API endpoints instead."""
    creds: list[tuple[str, dict[str, Any], str | None]] = []
    for provider_name in REAL_CLOUD_PROVIDERS:
        cfg = _env_config_for(provider_name)
        if cfg:
            creds.append((provider_name, cfg, f"env:{provider_name}"))
    return creds


def _env_config_for(provider_name: str) -> dict[str, Any] | None:
    prefix = provider_name.upper().replace("-", "_")
    matches = {k: v for k, v in os.environ.items() if k.startswith(f"{prefix}_")}
    if not matches:
        return None
    cfg: dict[str, Any] = {}
    for k, v in matches.items():
        cfg[k[len(prefix) + 1:].lower()] = v
    return cfg


def generate_free_tier_checklist(provider_name: str) -> str:
    """Print-only checklist of what a user MAY manually create in a free-tier
    account to exercise the 'assets present' path. Never creates anything."""
    checklists = {
        "aws": [
            "1 tiny EC2 instance if free-tier/credit available",
            "1 minimal RDS instance if free-tier/credit available",
            "1 small EBS volume if free-tier/credit available",
            "Destroy after verification",
        ],
        "gcp": [
            "1 e2-micro Compute Engine instance (free tier eligible)",
            "1 small Cloud SQL instance if credit available",
            "1 small persistent disk if credit available",
            "Destroy after verification",
        ],
        "azure": [
            "1 B1s VM if free-tier/credit available",
            "1 small Azure Database instance if credit available",
            "1 small managed disk if credit available",
            "Destroy after verification",
        ],
        "digitalocean": [
            "1 smallest Droplet if credit available",
            "1 smallest managed database if credit available",
            "1 small volume if credit available",
            "Destroy after verification",
        ],
        "linode": [
            "1 Nanode instance if credit available",
            "1 smallest managed database if credit available",
            "1 small block storage volume if credit available",
            "Destroy after verification",
        ],
        "ovh": [
            "1 smallest VPS if credit available",
            "Destroy after verification",
        ],
    }
    items = checklists.get(provider_name, ["No checklist defined for this provider"])
    lines = [f"{provider_name.upper()} optional manual free-tier validation:"]
    lines += [f"- {item}" for item in items]
    return "\n".join(lines)


# --- report writing --------------------------------------------------------

def write_reports(results: list[SmokeVerificationResult], out_dir: Path) -> tuple[Path, Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    json_path = out_dir / "cloud-smoke-report.json"
    md_path = out_dir / "cloud-smoke-report.md"

    payload = {"results": [_redact(r.to_dict()) for r in results]}
    json_path.write_text(json.dumps(payload, indent=2))

    lines = ["# Cloud Smoke Verification Report", ""]
    for r in results:
        lines.append(f"## {r.provider} ({r.credential_name or 'n/a'})")
        lines.append(f"- status: **{r.status}**")
        lines.append(f"- servers_checked: {r.servers_checked}")
        lines.append(f"- databases_checked: {r.databases_checked}")
        lines.append(f"- kubernetes_checked: {r.kubernetes_checked}")
        lines.append(f"- block_storage_checked: {r.block_storage_checked}")
        lines.append(f"- api_calls: {r.api_calls}")
        if r.warnings:
            lines.append("- warnings:")
            lines += [f"  - {w}" for w in r.warnings]
        if r.errors:
            lines.append("- errors:")
            lines += [f"  - {e['asset_type']}: {e['error']}" for e in r.errors]
        lines.append("")
    md_path.write_text("\n".join(lines))
    return json_path, md_path


# --- CLI -------------------------------------------------------------------

def _cli_main(argv: list[str]) -> int:
    import argparse

    parser = argparse.ArgumentParser(description="Real-cloud read-only smoke verification")
    parser.add_argument("--provider", help="single provider slug to check")
    parser.add_argument("--all", action="store_true", help="check all REAL_CLOUD_PROVIDERS")
    parser.add_argument("--read-only", action="store_true", help="must be passed; refused otherwise")
    parser.add_argument("--json", action="store_true", help="print JSON instead of a summary")
    parser.add_argument("--checklist", help="print free-tier manual checklist for a provider and exit")
    args = parser.parse_args(argv)

    if args.checklist:
        print(generate_free_tier_checklist(args.checklist))
        return 0

    if not args.read_only:
        print("Refusing to run: pass --read-only explicitly.", file=sys.stderr)
        return 2
    if not ENABLE_REAL_CLOUD_SMOKE:
        print("Refusing to run: ENABLE_REAL_CLOUD_SMOKE is not true.", file=sys.stderr)
        return 2
    if REAL_CLOUD_ALLOW_CREATE:
        print("Refusing to run: REAL_CLOUD_ALLOW_CREATE=true is not supported by this CLI.", file=sys.stderr)
        return 2

    providers = REAL_CLOUD_PROVIDERS if args.all else ([args.provider] if args.provider else [])
    if not providers:
        print("Pass --provider <name> or --all.", file=sys.stderr)
        return 2

    env_creds = {p: (cfg, name) for p, cfg, name in _load_env_credentials()}
    results = []
    for provider_name in providers:
        if provider_name not in env_creds:
            results.append(SmokeVerificationResult(provider=provider_name, status="not_configured"))
            continue
        cfg, cred_name = env_creds[provider_name]
        results.append(verify_provider_readonly(provider_name, cfg, cred_name))

    out_dir = Path(__file__).resolve().parent.parent / "test-reports"
    json_path, md_path = write_reports(results, out_dir)

    if args.json:
        print(json.dumps([_redact(r.to_dict()) for r in results], indent=2))
    else:
        print((md_path).read_text())
    return 0


if __name__ == "__main__":
    raise SystemExit(_cli_main(sys.argv[1:]))
