from __future__ import annotations

from typing import Any

from . import models


def add_event_log(
    db,
    *,
    severity: str = "info",
    source: str | None = "dashboard",
    resource: str | None = None,
    event: str,
    status: str = "resolved",
    owner: str | None = None,
    message: str | None = None,
    tags: list[str] | None = None,
    extra: dict[str, Any] | None = None,
) -> models.EventLog:
    row = models.EventLog(
        severity=severity,
        source=source,
        resource=resource,
        event=event,
        status=status,
        owner=owner,
        message=message,
        tags=tags or [],
        extra=extra or {},
    )
    db.add(row)
    return row
