"""Every route is guarded by a feature permission, and roles keep their old access."""
import json
from pathlib import Path

from app import models
from app.permissions import effective_permissions, has_perm
from tests.route_matrix import matrix

# Login-only on purpose: own account, own API keys (ownership-checked), event log triage.
LOGIN_ONLY_PREFIXES = ("/api/auth/me", "/api/auth/change-password", "/api/auth/mfa", "/api/api-keys",
                       "/api/event-logs", "/api/iam/catalog", "/api/iam/me")


def test_roles_without_overlays_keep_their_access():
    expected = json.loads((Path(__file__).parent / "route_matrix.json").read_text())
    now = matrix()
    assert {k: (v, now.get(k)) for k, v in expected.items() if k in now and now[k] != v} == {}


def test_no_route_relies_on_login_alone():
    from app.main import app
    from fastapi.routing import APIRoute
    from tests.route_matrix import guards
    loose = [
        route.path for route in app.routes
        if isinstance(route, APIRoute) and route.path.startswith("/api")
        and not route.path.startswith(LOGIN_ONLY_PREFIXES)
        and [c.__name__ for c in guards(route.dependant)] in (["get_current_user"], ["require_write"], ["require_admin"])
    ]
    assert loose == []


def test_group_grant_widens_a_read_user():
    group = models.Group(name="g", permissions={"servers": ["write"]})
    user = models.User(username="u", role="read", permissions={}, groups=[group])
    assert has_perm(user, "servers", "write") and "write" not in effective_permissions(user)["crons"]
