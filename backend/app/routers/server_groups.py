"""
Server groups router — custom user-managed groups plus auto-maintained
per-provider groups, with group-level SSH-key bulk assignment.
"""
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..auth import get_current_user, require_write
from ..event_log_utils import add_event_log
from .servers import apply_ssh_assignment

router = APIRouter(prefix="/api/server-groups", tags=["server-groups"])

_GROUP_NOT_FOUND = "Server group not found"
_AUTO_GROUP_READONLY = "Provider auto-groups are read-only"


def _sync_provider_groups(db: Session) -> None:
    """Maintain one auto-group per distinct provider actually present in servers."""
    providers = {p for (p,) in db.query(models.Server.provider).distinct() if p}
    custom_names = {g.name for g in db.query(models.ServerGroup).filter_by(is_auto=False)}
    providers -= custom_names  # a custom group can't be shadowed by an auto-group

    existing = {g.name: g for g in db.query(models.ServerGroup).filter_by(is_auto=True)}
    for p in providers - existing.keys():
        db.add(models.ServerGroup(name=p, is_auto=True))
    for name, g in existing.items():
        if name not in providers:
            db.delete(g)
    db.flush()

    for g in db.query(models.ServerGroup).filter_by(is_auto=True):
        g.members = db.query(models.Server).filter(models.Server.provider == g.name).all()
    db.commit()


def _to_response(g: models.ServerGroup) -> schemas.ServerGroupResponse:
    d = schemas.ServerGroupResponse.model_validate(g)
    d.server_count = len(g.members)
    return d


@router.get("", response_model=list[schemas.ServerGroupResponse])
def list_server_groups(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[models.User, Depends(get_current_user)],
):
    _sync_provider_groups(db)
    groups = db.query(models.ServerGroup).order_by(
        models.ServerGroup.is_auto, models.ServerGroup.name
    ).all()
    return [_to_response(g) for g in groups]


@router.post(
    "",
    response_model=schemas.ServerGroupResponse,
    status_code=201,
    responses={400: {"description": "Group name already exists"}},
)
def create_server_group(
    body: schemas.ServerGroupCreate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(require_write)],
):
    if db.query(models.ServerGroup).filter_by(name=body.name).first():
        raise HTTPException(400, detail="Group name already exists")
    g = models.ServerGroup(name=body.name, description=body.description, is_auto=False)
    db.add(g)
    add_event_log(db, source="server-groups", resource=g.name, event="Server group created", owner=user.username)
    db.commit()
    db.refresh(g)
    return _to_response(g)


@router.put(
    "/{group_id}",
    response_model=schemas.ServerGroupResponse,
    responses={
        404: {"description": "Server group not found"},
        400: {"description": "Auto-group is read-only or name already exists"},
    },
)
def update_server_group(
    group_id: int,
    body: schemas.ServerGroupUpdate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(require_write)],
):
    g = db.get(models.ServerGroup, group_id)
    if not g:
        raise HTTPException(404, detail=_GROUP_NOT_FOUND)
    if g.is_auto:
        raise HTTPException(400, detail=_AUTO_GROUP_READONLY)
    if body.name is not None:
        existing = db.query(models.ServerGroup).filter(
            models.ServerGroup.name == body.name, models.ServerGroup.id != group_id
        ).first()
        if existing:
            raise HTTPException(400, detail="Group name already exists")
        g.name = body.name
    if body.description is not None:
        g.description = body.description
    add_event_log(db, source="server-groups", resource=g.name, event="Server group updated", owner=user.username)
    db.commit()
    db.refresh(g)
    return _to_response(g)


@router.delete(
    "/{group_id}",
    status_code=204,
    responses={
        404: {"description": "Server group not found"},
        400: {"description": "Auto-group is read-only"},
    },
)
def delete_server_group(
    group_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(require_write)],
):
    g = db.get(models.ServerGroup, group_id)
    if not g:
        raise HTTPException(404, detail=_GROUP_NOT_FOUND)
    if g.is_auto:
        raise HTTPException(400, detail=_AUTO_GROUP_READONLY)
    add_event_log(db, source="server-groups", resource=g.name, event="Server group removed", owner=user.username)
    db.delete(g)
    db.commit()


@router.get(
    "/{group_id}/members",
    responses={404: {"description": "Server group not found"}},
)
def get_server_group_members(
    group_id: int,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[models.User, Depends(get_current_user)],
) -> list[int]:
    g = db.get(models.ServerGroup, group_id)
    if not g:
        raise HTTPException(404, detail=_GROUP_NOT_FOUND)
    return [m.id for m in g.members]


@router.put(
    "/{group_id}/members",
    response_model=schemas.ServerGroupResponse,
    responses={
        404: {"description": "Server group not found"},
        400: {"description": "Auto-group is read-only"},
    },
)
def set_server_group_members(
    group_id: int,
    body: schemas.ServerMembersUpdate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(require_write)],
):
    g = db.get(models.ServerGroup, group_id)
    if not g:
        raise HTTPException(404, detail=_GROUP_NOT_FOUND)
    if g.is_auto:
        raise HTTPException(400, detail=_AUTO_GROUP_READONLY)
    servers = db.query(models.Server).filter(models.Server.id.in_(body.server_ids)).all()
    g.members = servers
    add_event_log(db, source="server-groups", resource=g.name, event="Server group membership updated",
                  owner=user.username, message=f"count={len(servers)}")
    db.commit()
    db.refresh(g)
    return _to_response(g)


@router.post(
    "/{group_id}/assign-ssh",
    responses={404: {"description": "Server group not found"}},
)
def assign_ssh_to_group(
    group_id: int,
    body: schemas.GroupAssignSSHRequest,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(require_write)],
) -> dict:
    g = db.get(models.ServerGroup, group_id)
    if not g:
        raise HTTPException(404, detail=_GROUP_NOT_FOUND)
    server_ids = [m.id for m in g.members]
    updated = apply_ssh_assignment(db, server_ids, body.ssh_credential_id, body.ssh_group)
    add_event_log(db, source="server-groups", resource=g.name, event="SSH key assigned to group",
                  owner=user.username, message=f"servers_updated={updated}")
    return {"updated": updated}
