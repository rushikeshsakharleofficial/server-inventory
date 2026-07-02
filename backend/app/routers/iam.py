"""
IAM router — groups, per-user direct permissions, effective permission resolution.
All write endpoints require admin permission; reads require an authenticated user.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..auth import get_current_user, require_perm
from .. import models, schemas
from ..permissions import (
    FEATURES, ACTIONS, FEATURE_ACTIONS, ROLE_BASELINE, effective_permissions
)
from ..event_log_utils import add_event_log

router = APIRouter(prefix="/api/iam", tags=["iam"])

_require_admin = require_perm("users", "admin")


# ─── Permission catalog ────────────────────────────────────────────────────────

@router.get("/catalog", response_model=schemas.PermissionCatalog)
def get_catalog(_user=Depends(get_current_user)):
    """Return the feature/action vocabulary so the UI can render the matrix."""
    return schemas.PermissionCatalog(
        features=FEATURES,
        actions=ACTIONS,
        feature_actions=FEATURE_ACTIONS,
        role_baseline={r: {f: list(acts) for f, acts in bl.items()} for r, bl in ROLE_BASELINE.items()},
    )


# ─── Groups CRUD ──────────────────────────────────────────────────────────────

@router.get("/groups", response_model=list[schemas.GroupResponse])
def list_groups(db: Session = Depends(get_db), _user=Depends(get_current_user)):
    groups = db.query(models.Group).order_by(models.Group.name).all()
    result = []
    for g in groups:
        d = schemas.GroupResponse.model_validate(g)
        d.member_count = len(g.members)
        result.append(d)
    return result


@router.post("/groups", response_model=schemas.GroupResponse, status_code=201)
def create_group(
    body: schemas.GroupCreate,
    db: Session = Depends(get_db),
    user=Depends(_require_admin),
):
    if db.query(models.Group).filter_by(name=body.name).first():
        raise HTTPException(400, detail="Group name already exists")
    g = models.Group(
        name=body.name,
        description=body.description,
        permissions=body.permissions,
    )
    db.add(g)
    add_event_log(db, source="iam", resource=g.name, event="Group created", owner=user.username)
    db.commit()
    db.refresh(g)
    d = schemas.GroupResponse.model_validate(g)
    d.member_count = 0
    return d


@router.put("/groups/{group_id}", response_model=schemas.GroupResponse)
def update_group(
    group_id: int,
    body: schemas.GroupUpdate,
    db: Session = Depends(get_db),
    user=Depends(_require_admin),
):
    g = db.get(models.Group, group_id)
    if not g:
        raise HTTPException(404, detail="Group not found")
    if body.name is not None:
        existing = db.query(models.Group).filter(
            models.Group.name == body.name, models.Group.id != group_id
        ).first()
        if existing:
            raise HTTPException(400, detail="Group name already exists")
        g.name = body.name
    if body.description is not None:
        g.description = body.description
    if body.permissions is not None:
        g.permissions = body.permissions
    add_event_log(db, source="iam", resource=g.name, event="Group updated", owner=user.username)
    db.commit()
    db.refresh(g)
    d = schemas.GroupResponse.model_validate(g)
    d.member_count = len(g.members)
    return d


@router.delete("/groups/{group_id}", status_code=204)
def delete_group(
    group_id: int,
    db: Session = Depends(get_db),
    user=Depends(_require_admin),
):
    g = db.get(models.Group, group_id)
    if not g:
        raise HTTPException(404, detail="Group not found")
    add_event_log(db, source="iam", resource=g.name, event="Group removed", owner=user.username)
    db.delete(g)
    db.commit()


@router.put("/groups/{group_id}/members", response_model=schemas.GroupResponse)
def set_group_members(
    group_id: int,
    body: schemas.UserGroupsUpdate,
    db: Session = Depends(get_db),
    user=Depends(_require_admin),
):
    """Replace group membership with the supplied user_id list."""
    g = db.get(models.Group, group_id)
    if not g:
        raise HTTPException(404, detail="Group not found")
    users = db.query(models.User).filter(models.User.id.in_(body.group_ids)).all()
    g.members = users
    add_event_log(db, source="iam", resource=g.name, event="Group members updated",
                  owner=user.username, message=f"members={[u.username for u in users]}")
    db.commit()
    db.refresh(g)
    d = schemas.GroupResponse.model_validate(g)
    d.member_count = len(g.members)
    return d


# ─── Per-user IAM ─────────────────────────────────────────────────────────────

@router.put("/users/{user_id}/permissions", response_model=schemas.UserResponse)
def set_user_permissions(
    user_id: int,
    body: schemas.UserPermissionsUpdate,
    db: Session = Depends(get_db),
    user=Depends(_require_admin),
):
    u = db.get(models.User, user_id)
    if not u:
        raise HTTPException(404, detail="User not found")
    u.permissions = body.permissions
    add_event_log(db, source="iam", resource=u.username, event="User permissions changed", owner=user.username)
    db.commit()
    db.refresh(u)
    resp = schemas.UserResponse.model_validate(u)
    resp.group_ids = [g.id for g in u.groups]
    return resp


@router.put("/users/{user_id}/groups", response_model=schemas.UserResponse)
def set_user_groups(
    user_id: int,
    body: schemas.UserGroupsUpdate,
    db: Session = Depends(get_db),
    user=Depends(_require_admin),
):
    u = db.get(models.User, user_id)
    if not u:
        raise HTTPException(404, detail="User not found")
    groups = db.query(models.Group).filter(models.Group.id.in_(body.group_ids)).all()
    u.groups = groups
    add_event_log(db, source="iam", resource=u.username, event="User groups changed",
                  owner=user.username, message=f"groups={[g.name for g in groups]}")
    db.commit()
    db.refresh(u)
    resp = schemas.UserResponse.model_validate(u)
    resp.group_ids = [g.id for g in u.groups]
    return resp


@router.get("/users/{user_id}/effective")
def get_effective_permissions(
    user_id: int,
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
):
    u = db.get(models.User, user_id)
    if not u:
        raise HTTPException(404, detail="User not found")
    return {f: sorted(acts) for f, acts in effective_permissions(u).items()}
