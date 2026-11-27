"""Which roles (with no IAM overlay) may call each route."""
from fastapi import HTTPException
from fastapi.routing import APIRoute

from app import auth, models
from app.main import app

GUARDS = ("require_", "_require", "get_current_user")


def guards(dependant):
    for d in dependant.dependencies:
        if getattr(d.call, "__name__", "").startswith(GUARDS):
            yield d.call
        else:
            yield from guards(d)


def matrix() -> dict[str, str]:
    out = {}
    for route in app.routes:
        if not isinstance(route, APIRoute) or not route.path.startswith("/api"):
            continue
        calls = list(guards(route.dependant))
        roles = []
        for role in ("read", "write", "admin"):
            user = models.User(username="u", role=role, permissions={})
            try:
                for call in calls:
                    if call is not auth.get_current_user:
                        call(user)
                roles.append(role)
            except HTTPException:
                pass
        key = f"{sorted(route.methods)[0]} {route.path}"
        out[key] = "public" if not calls else ",".join(roles)
    return out


if __name__ == "__main__":
    import json
    print(json.dumps(matrix(), indent=1, sort_keys=True))
