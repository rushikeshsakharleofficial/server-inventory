"""
Public API authentication and permission enforcement for user-created API keys.

Core invariant (never relax this): an API key can never grant more than its
owner currently has. Effective permission for any request is always

    api_key.scopes ∩ user_effective_permissions

recomputed from the database on *every* request — never cached, never stored
on the key row, never derived from anything but a fresh call to
permissions.has_perm() (which itself recomputes from role + group + user
overlays on every call). If the owner loses a permission, every key they own
loses it on their very next request, with zero additional code required here.

Token handling: only the HMAC-SHA256 hash of the full raw token is ever
stored or compared. The raw token is generated once, returned once (create/
rotate response), and never persisted, logged, or reconstructable from the
hash. hmac.compare_digest is used for the comparison to avoid timing leaks.
"""

from __future__ import annotations

import hashlib
import hmac
import ipaddress
import os
import secrets
from datetime import datetime, timezone
from typing import Optional

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from . import models
from .database import get_db
from .permissions import has_perm

TOKEN_PREFIX = "si_live"

# Public scope string -> (feature, action) in the existing IAM vocabulary.
# Verified against permissions.FEATURE_ACTIONS — every target below is a real,
# already-guarded (feature, action) pair. This is the security-critical
# artifact: get an entry wrong here and a scope silently always denies (safe
# but broken) or, if a target were ever wrong in the *permissive* direction,
# a key could gain more than intended. Keep entries 1:1 with
# permissions.FEATURE_ACTIONS; do not invent new actions here.
SCOPE_MAP: dict[str, tuple[str, str]] = {
    "servers:read":       ("servers",        "read"),
    "ip_inventory:read":  ("servers",        "read"),
    "databases:read":     ("databases",      "read"),
    "kubernetes:read":    ("kubernetes",     "read"),
    "block_storage:read": ("block-storages", "read"),
    "discovery:read":     ("discovery",      "read"),
    "discovery:run":      ("discovery",      "write"),
    "sync:trigger":       ("sync",           "write"),
}


class ApiKeyAuthError(Exception):
    """Raised internally to carry a denied_reason through to the audit log
    before being converted into an HTTPException."""

    def __init__(self, reason: str, status_code: int = status.HTTP_401_UNAUTHORIZED):
        self.reason = reason
        self.status_code = status_code
        super().__init__(reason)


# ─── Token generation / hashing ────────────────────────────────────────────────

def generate_api_token() -> tuple[str, str]:
    """Returns (raw_token, key_prefix). raw_token is shown to the user exactly
    once and never stored; key_prefix is stored in the clear for fast lookup."""
    key_prefix = secrets.token_hex(4)  # 8 hex chars, non-secret
    secret = secrets.token_urlsafe(32)
    raw_token = f"{TOKEN_PREFIX}_{key_prefix}_{secret}"
    return raw_token, key_prefix


def _get_pepper() -> str:
    pepper = os.environ.get("API_KEY_PEPPER")
    if not pepper:
        raise RuntimeError(
            "API_KEY_PEPPER environment variable must be set to create or "
            "verify API keys — refusing to hash/compare tokens without it."
        )
    return pepper


def hash_api_token(raw_token: str) -> str:
    pepper = _get_pepper()
    return hmac.new(pepper.encode("utf-8"), raw_token.encode("utf-8"), hashlib.sha256).hexdigest()


def verify_api_token(raw_token: str, stored_hash: str) -> bool:
    return hmac.compare_digest(hash_api_token(raw_token), stored_hash)


# ─── IP allowlist ───────────────────────────────────────────────────────────────

def _client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def _ip_allowed(client_ip: str, allowed_ips: Optional[list[str]]) -> bool:
    if not allowed_ips:
        return True
    try:
        addr = ipaddress.ip_address(client_ip)
    except ValueError:
        return False
    for entry in allowed_ips:
        try:
            if "/" in entry:
                if addr in ipaddress.ip_network(entry, strict=False):
                    return True
            elif addr == ipaddress.ip_address(entry):
                return True
        except ValueError:
            continue
    return False


# ─── Audit logging ──────────────────────────────────────────────────────────────

def write_api_audit_log(
    db: Session,
    *,
    request: Request,
    decision: str,
    api_key_id: int | None = None,
    user_id: int | None = None,
    status_code: int | None = None,
    denied_reason: str | None = None,
) -> models.ApiKeyAuditLog:
    row = models.ApiKeyAuditLog(
        api_key_id=api_key_id,
        user_id=user_id,
        request_id=request.headers.get("x-request-id"),
        method=request.method,
        path=request.url.path,
        ip_address=_client_ip(request),
        user_agent=request.headers.get("user-agent"),
        status_code=status_code,
        decision=decision,
        denied_reason=denied_reason,
    )
    db.add(row)
    db.commit()
    return row


# ─── Principal resolution ───────────────────────────────────────────────────────

class ApiPrincipal:
    """The authenticated (user, api_key) pair for a Public API request."""

    def __init__(self, user: models.User, api_key: models.ApiKey):
        self.user = user
        self.api_key = api_key

    def effective_scopes(self) -> set[str]:
        """Recomputed on every access — never cache this set across requests."""
        return {scope for scope in (self.api_key.scopes or []) if self.has_scope(scope)}

    def has_scope(self, scope: str) -> bool:
        """True only if the key itself was granted `scope` AND the owner
        currently has the underlying IAM permission — checking has_perm alone
        (without the key.scopes membership test) would let a key act on any
        scope its owner can, ignoring what the key was actually restricted to."""
        return (
            scope in (self.api_key.scopes or [])
            and scope in SCOPE_MAP
            and has_perm(self.user, *SCOPE_MAP[scope])
        )


def _parse_bearer_token(request: Request) -> str:
    header = request.headers.get("authorization", "")
    if not header.lower().startswith("bearer "):
        raise ApiKeyAuthError("missing_or_malformed_bearer_header")
    token = header[7:].strip()
    if not token:
        raise ApiKeyAuthError("missing_or_malformed_bearer_header")
    return token


def get_current_api_principal(
    request: Request,
    db: Session = Depends(get_db),
) -> ApiPrincipal:
    api_key: models.ApiKey | None = None
    user: models.User | None = None
    try:
        raw_token = _parse_bearer_token(request)

        # Token shape: si_live_<key_prefix>_<secret>. Strip the constant
        # "si_live_" head, then the remainder's first "_"-delimited segment
        # is the (non-secret) key_prefix used for the DB lookup.
        head = TOKEN_PREFIX + "_"
        if not raw_token.startswith(head):
            raise ApiKeyAuthError("malformed_token")
        remainder = raw_token[len(head):]
        if "_" not in remainder:
            raise ApiKeyAuthError("malformed_token")
        key_prefix, _secret = remainder.split("_", 1)
        if not key_prefix:
            raise ApiKeyAuthError("malformed_token")

        api_key = (
            db.query(models.ApiKey)
            .filter(models.ApiKey.key_prefix == key_prefix, models.ApiKey.is_active.is_(True))
            .first()
        )
        if not api_key or not verify_api_token(raw_token, api_key.token_hash):
            raise ApiKeyAuthError("invalid_token")

        if api_key.expires_at is not None:
            expires_at = api_key.expires_at
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if expires_at < datetime.now(timezone.utc):
                raise ApiKeyAuthError("key_expired")

        user = db.query(models.User).filter(models.User.id == api_key.user_id).first()
        if not user or not user.is_active:
            raise ApiKeyAuthError("user_inactive")

        client_ip = _client_ip(request)
        if not _ip_allowed(client_ip, api_key.allowed_ips):
            raise ApiKeyAuthError("ip_not_allowed", status_code=status.HTTP_403_FORBIDDEN)

    except ApiKeyAuthError as e:
        write_api_audit_log(
            db,
            request=request,
            decision="denied",
            status_code=e.status_code,
            denied_reason=e.reason,
            api_key_id=api_key.id if api_key else None,
            user_id=user.id if user else None,
        )
        raise HTTPException(
            status_code=e.status_code,
            detail="Invalid or unauthorized API key",
            headers={"WWW-Authenticate": "Bearer"},
        )

    api_key.last_used_at = datetime.now(timezone.utc)
    api_key.last_used_ip = client_ip
    db.commit()

    principal = ApiPrincipal(user=user, api_key=api_key)
    # Stashed during dependency resolution (i.e. before slowapi's rate-limit
    # wrapper runs its key_func) so per-route rate limiting can key on the
    # API key id instead of the caller's IP. See public_api._api_key_id_key_func.
    request.state.api_principal = principal
    return principal


def require_api_permission(feature: str, action: str):
    """Dependency factory mirroring auth.require_perm, but for API-key
    principals. Resolves the public scope(s) that map onto (feature, action)
    and checks the live intersection — recomputed every call, never cached."""

    matching_scopes = [s for s, fa in SCOPE_MAP.items() if fa == (feature, action)]

    def _dep(
        request: Request,
        principal: ApiPrincipal = Depends(get_current_api_principal),
        db: Session = Depends(get_db),
    ) -> ApiPrincipal:
        if not any(principal.has_scope(s) for s in matching_scopes):
            write_api_audit_log(
                db,
                request=request,
                decision="denied",
                status_code=status.HTTP_403_FORBIDDEN,
                denied_reason=f"missing_scope:{feature}:{action}",
                api_key_id=principal.api_key.id,
                user_id=principal.user.id,
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"API key missing required scope for {feature}:{action}",
            )
        return principal

    _dep.__name__ = f"require_api_permission_{feature}_{action}"
    return _dep
