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
import time
from datetime import datetime, timezone
from typing import Optional

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from starlette.middleware.base import BaseHTTPMiddleware

from . import models
from .database import get_db
from .permissions import has_perm

TOKEN_PREFIX = "si_live"

# ip_inventory has no feature of its own — GET /public/v1/ip-inventory is an
# alias onto the "servers" feature (it's a servers.py-owned query), so a key
# needs ("servers", "read") to use it, same as GET /public/v1/servers.
IP_INVENTORY_FEATURE = "servers"


class ApiKeyAuthError(Exception):
    """Raised internally to carry a denied_reason through to the audit log
    before being converted into an HTTPException."""

    def __init__(self, reason: str, status_code: int = status.HTTP_401_UNAUTHORIZED):
        self.reason = reason
        self.status_code = status_code
        super().__init__(reason)


def _stash_denied_reason(request: Request, reason: str) -> None:
    """PublicApiAuditMiddleware (main.py) writes exactly one audit row per
    request after call_next returns — it knows the response status code but
    not *why* a denial happened, since that's only known here, inside
    request handling. Stashing it on request.state lets the middleware pick
    it up without every call site needing to write its own audit row."""
    request.state.api_denied_reason = reason


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
    response_time_ms: int | None = None,
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
        response_time_ms=response_time_ms,
    )
    db.add(row)
    db.commit()
    return row


# ─── Principal resolution ───────────────────────────────────────────────────────

class ApiPrincipal:
    """The authenticated (user, api_key) pair for a Public API request.

    api_key.scopes is a plain {feature: [actions]} dict — the exact same
    shape and vocabulary as User.permissions / Group.permissions in the IAM
    system (permissions.FEATURES / permissions.ACTIONS). No separate scope
    string or mapping table: a key's picker IS the IAM feature×action grid."""

    def __init__(self, user: models.User, api_key: models.ApiKey):
        self.user = user
        self.api_key = api_key

    def has_perm(self, feature: str, action: str) -> bool:
        """True only if the key itself was granted (feature, action) AND the
        owner currently has that IAM permission right now — checking
        has_perm(user, ...) alone (without the key.scopes membership test)
        would let a key act on anything its owner can, ignoring what the key
        was actually restricted to at creation."""
        key_scopes: dict[str, list[str]] = self.api_key.scopes or {}
        return action in key_scopes.get(feature, []) and has_perm(self.user, feature, action)


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
        # PublicApiAuditMiddleware writes the actual audit row after the
        # response is built — it knows the request/response but not *why* a
        # denial happened, so the reason (and whatever identity was resolved
        # before the failure) is stashed here for it to pick up.
        _stash_denied_reason(request, e.reason)
        if api_key:
            request.state.api_key_id = api_key.id
        if user:
            request.state.api_user_id = user.id
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
    # Plain ints, stashed separately from api_principal: PublicApiAuditMiddleware
    # runs its own DB session *after* call_next returns, by which point the
    # request-scoped session behind `user`/`api_key` (from Depends(get_db)) is
    # already closed — touching principal.user.id there would lazy-load
    # against a dead session (DetachedInstanceError). Reading plain ints
    # avoids touching the ORM objects at all outside their own session.
    request.state.api_key_id = api_key.id
    request.state.api_user_id = user.id
    return principal


def require_api_permission(feature: str, action: str):
    """Dependency factory mirroring auth.require_perm, but for API-key
    principals — checks the live intersection of the key's own
    {feature: [actions]} grant and the owner's current IAM permission,
    recomputed every call, never cached."""

    def _dep(
        request: Request,
        principal: ApiPrincipal = Depends(get_current_api_principal),
    ) -> ApiPrincipal:
        if not principal.has_perm(feature, action):
            _stash_denied_reason(request, f"missing_scope:{feature}:{action}")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"API key missing required scope for {feature}:{action}",
            )
        return principal

    _dep.__name__ = f"require_api_permission_{feature}_{action}"
    return _dep


# ─── Audit middleware ───────────────────────────────────────────────────────────

class PublicApiAuditMiddleware(BaseHTTPMiddleware):
    """Writes exactly one ApiKeyAuditLog row per /public/v1/* request,
    allowed or denied, with real response_time_ms and status_code — the
    single place this is logged, replacing the old pattern of scattering
    write_api_audit_log() calls through every handler and auth dependency
    (which only ever covered denials + the 2 write endpoints, silently
    missing every successful read). Denial reason and identity, when known
    before the response is built, are stashed on request.state above; this
    middleware only reads them.

    session_factory defaults to the real app's SessionLocal but is
    overridable (app.add_middleware(PublicApiAuditMiddleware,
    session_factory=...)) so tests can point it at an isolated test DB —
    middleware isn't a FastAPI dependency, so app.dependency_overrides can't
    reach it. Lives here rather than in main.py because main.py imports
    app.database.engine at module scope and connects to real Postgres
    immediately on import — importing this class from main.py would defeat
    the whole point of the standalone test app in tests/conftest.py."""

    def __init__(self, app, session_factory):
        super().__init__(app)
        self.session_factory = session_factory

    async def dispatch(self, request: Request, call_next):
        if not request.url.path.startswith("/public/v1"):
            return await call_next(request)

        start = time.monotonic()
        response = await call_next(request)
        elapsed_ms = int((time.monotonic() - start) * 1000)

        # Plain ints only — never touch principal.user/.api_key here, that
        # ORM object's session (Depends(get_db), scoped to the request) is
        # already closed by the time call_next returns.
        api_key_id = getattr(request.state, "api_key_id", None)
        user_id = getattr(request.state, "api_user_id", None)
        decision = "allowed" if response.status_code < 400 else "denied"
        denied_reason = getattr(request.state, "api_denied_reason", None)
        if decision == "denied" and denied_reason is None:
            # No handler/dependency stashed a specific reason — e.g. a 429
            # from the @limiter.limit decorator, which never touches this
            # module's denial paths at all.
            denied_reason = "rate_limited" if response.status_code == 429 else f"http_{response.status_code}"

        db = self.session_factory()
        try:
            write_api_audit_log(
                db,
                request=request,
                decision=decision,
                status_code=response.status_code,
                denied_reason=denied_reason,
                response_time_ms=elapsed_ms,
                api_key_id=api_key_id,
                user_id=user_id,
            )
        finally:
            db.close()

        return response
