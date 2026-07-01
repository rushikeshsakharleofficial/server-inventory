"""
Permission vocabulary and RBAC helpers for the additive-overlay IAM system.

The legacy `role` string (read/write/admin) is expanded to a per-feature permission
map via ROLE_BASELINE. Group and per-user permission JSON overlays are then merged on
top. Existing role checks (require_write / require_admin) in other routers continue
to work unchanged — this module only powers the IAM router and require_perm().
"""
from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .models import User

# ─── Vocabulary ───────────────────────────────────────────────────────────────

FEATURES: list[str] = [
    "servers",
    "credentials",
    "ssh-credentials",
    "sync",
    "stats",
    "settings",
    "crons",
    "databases",
    "kubernetes",
    "block-storages",
    "resource-map",
    "users",
]

ACTIONS: list[str] = ["read", "write", "delete", "sync", "admin"]

# Actions each feature actually supports (for UI — only these checkboxes appear).
FEATURE_ACTIONS: dict[str, list[str]] = {
    "servers":         ["read", "write", "delete", "sync"],
    "credentials":     ["read", "write", "delete", "admin"],
    "ssh-credentials": ["read", "write", "delete"],
    "sync":            ["read", "write"],
    "stats":           ["read", "write"],
    "settings":        ["read", "admin"],
    "crons":           ["read", "write", "delete"],
    "databases":       ["read", "sync"],
    "kubernetes":      ["read", "sync"],
    "block-storages":  ["read", "sync"],
    "resource-map":    ["read"],
    "users":           ["read", "admin"],
}

# ─── Role baseline ─────────────────────────────────────────────────────────────
# Mirrors the existing hardcoded guards exactly so switching to require_perm()
# doesn't change who can do what for users with no overlay.

def _all_feature_read() -> dict[str, list[str]]:
    return {f: ["read"] for f in FEATURES}


def _all_feature_write() -> dict[str, list[str]]:
    """
    write role gets read+write+delete+sync on all features, but NOT admin-action
    items (settings update, credential delete, user management) — mirrors require_write.
    """
    result: dict[str, list[str]] = {}
    for f in FEATURES:
        fa = FEATURE_ACTIONS[f]
        result[f] = [a for a in fa if a != "admin"]
    return result


def _all_feature_admin() -> dict[str, list[str]]:
    return {f: list(FEATURE_ACTIONS[f]) for f in FEATURES}


ROLE_BASELINE: dict[str, dict[str, list[str]]] = {
    "read":  _all_feature_read(),
    "write": _all_feature_write(),
    "admin": _all_feature_admin(),
}

# ─── Effective permission resolver ─────────────────────────────────────────────

def effective_permissions(user: "User") -> dict[str, set[str]]:
    """
    Returns feature → set of actions the user is permitted to perform.
    Resolution order:
      1. ROLE_BASELINE for user.role (coarse fallback, guarantees back-compat)
      2. user.permissions (direct per-user JSON overlay)
      3. each group's permissions the user belongs to
    All sources are unioned — additive only; no deny rules.
    """
    role = user.role or "read"
    baseline = ROLE_BASELINE.get(role, ROLE_BASELINE["read"])

    perms: dict[str, set[str]] = {f: set(acts) for f, acts in baseline.items()}

    # Direct user overlay
    user_perms: dict[str, list[str]] = user.permissions or {}
    for feature, actions in user_perms.items():
        perms.setdefault(feature, set()).update(actions)

    # Group overlays
    for group in (user.groups or []):
        group_perms: dict[str, list[str]] = group.permissions or {}
        for feature, actions in group_perms.items():
            perms.setdefault(feature, set()).update(actions)

    # admin action on a feature implies all other actions for that feature
    for feature, acts in perms.items():
        if "admin" in acts:
            acts.update(FEATURE_ACTIONS.get(feature, []))

    return perms


def has_perm(user: "User", feature: str, action: str) -> bool:
    return action in effective_permissions(user).get(feature, set())
