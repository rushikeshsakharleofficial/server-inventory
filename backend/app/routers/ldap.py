"""
LDAP router — directory configuration, dry-run test, LDAP group → IAM group mappings.
"""
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, StringConstraints
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .. import crypto, ldap_auth, models
from ..auth import require_perm
from ..database import get_db
from ..event_log_utils import add_event_log

router = APIRouter(prefix="/api/ldap", tags=["ldap"])

_settings_admin = require_perm("settings", "admin")
_users_admin = require_perm("users", "admin")

Str512 = Annotated[str, StringConstraints(strip_whitespace=True, max_length=512)]
Filter = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)]
Attr = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=64)]


class LdapConfigBody(BaseModel):
    enabled: bool = False
    server_url: Str512 | None = None
    start_tls: bool = False
    ca_cert_pem: str | None = None
    bind_dn: Str512 | None = None
    user_base_dn: Str512 | None = None
    user_filter: Filter = "(uid={username})"
    group_base_dn: Str512 | None = None
    group_filter: Filter = "(member={user_dn})"
    username_attr: Attr = "uid"
    fullname_attr: Attr = "cn"
    default_role: Literal["read", "write"] = "read"
    cache_ttl_hours: int = Field(72, ge=0, le=720)
    timeout_s: int = Field(5, ge=1, le=30)


class LdapConfigUpdate(LdapConfigBody):
    bind_password: str | None = None


class LdapTestRequest(BaseModel):
    username: str | None = None
    password: str | None = None


class LdapMappingCreate(BaseModel):
    ldap_group_dn: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=512)]
    group_id: int


def _config_response(row: models.LdapConfig | None) -> dict:
    cfg = LdapConfigBody.model_validate(row, from_attributes=True) if row else LdapConfigBody()
    return {**cfg.model_dump(), "has_bind_password": bool(row and row.bind_password_enc)}


# ─── Configuration ────────────────────────────────────────────────────────────

@router.get("/config")
def get_config(
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[models.User, Depends(_settings_admin)],
):
    return _config_response(db.get(models.LdapConfig, 1))


@router.put("/config", dependencies=[Depends(_users_admin)])
def update_config(
    body: LdapConfigUpdate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(_settings_admin)],
):
    row = db.get(models.LdapConfig, 1)
    stored = row.bind_password_enc if row else None
    was_enabled = bool(row and row.enabled)
    data = body.model_dump(exclude={"bind_password"})
    for key in ("server_url", "ca_cert_pem", "bind_dn", "user_base_dn", "group_base_dn"):
        data[key] = data[key] or None

    url = data["server_url"]
    if url and not url.lower().startswith(("ldap://", "ldaps://")):
        raise HTTPException(422, detail="Server URL must start with ldap:// or ldaps://")
    if "{username}" not in body.user_filter:
        raise HTTPException(422, detail="User filter must contain {username}")
    if "{user_dn}" not in body.group_filter:
        raise HTTPException(422, detail="Group filter must contain {user_dn}")
    if body.enabled and not (url and data["bind_dn"] and data["user_base_dn"] and (stored or body.bind_password)):
        raise HTTPException(
            422, detail="Server URL, bind DN, user base DN and bind password are required to enable LDAP"
        )
    # The stored secret must never be sent to a different host, or newly in cleartext.
    if stored and not body.bind_password and (url != row.server_url or (row.start_tls and not body.start_tls)):
        raise HTTPException(
            422, detail="Re-enter the bind password when changing the server URL or turning off StartTLS"
        )

    if not row:
        row = models.LdapConfig(id=1)
        db.add(row)
    for key, value in data.items():
        setattr(row, key, value)
    if body.bind_password:
        row.bind_password_enc = crypto.encrypt_str(body.bind_password)
    row.updated_at = func.now()

    if body.enabled != was_enabled:
        event = "LDAP enabled" if body.enabled else "LDAP disabled"
    else:
        event = "LDAP config updated"
    add_event_log(db, source="ldap", resource="ldap", event=event, owner=user.username)
    db.commit()
    db.refresh(row)
    return _config_response(row)


@router.post("/test", dependencies=[Depends(_users_admin)])
def test_config(
    body: LdapTestRequest,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(_settings_admin)],
):
    """Dry run against the saved config (even if disabled): no user writes, no sync, no cache."""
    result = {"ok": False, "message": "", "group_dns": [], "iam_groups": []}
    row = db.get(models.LdapConfig, 1)
    if not row:
        result["message"] = "LDAP is not configured"
    else:
        try:
            cfg = ldap_auth.config_dict(row)
            if body.username:
                found = ldap_auth.authenticate(cfg, body.username, body.password or "")
                ids = ldap_auth.mapped_group_ids(db, found.group_dns)
                groups = db.query(models.Group).filter(models.Group.id.in_(ids)).order_by(models.Group.name).all()
                result.update(
                    ok=True,
                    message=f"Authenticated as {found.dn}",
                    group_dns=found.group_dns,
                    iam_groups=[{"id": g.id, "name": g.name} for g in groups],
                )
            else:
                ldap_auth.test_connection(cfg)
                result.update(ok=True, message="Service bind successful")
        except (ldap_auth.LdapUnavailable, ldap_auth.LdapInvalid) as exc:
            result["message"] = str(exc) or "LDAP test failed"
        except crypto.InvalidToken:
            result["message"] = "Stored bind password cannot be decrypted; enter it again"
    add_event_log(db, source="ldap", resource="ldap", event="LDAP connection tested", owner=user.username)
    db.commit()
    return result


# ─── Group mappings ───────────────────────────────────────────────────────────

def _mapping_item(mapping: models.LdapGroupMapping, group_name: str) -> dict:
    return {
        "id": mapping.id,
        "ldap_group_dn": mapping.ldap_group_dn,
        "group_id": mapping.group_id,
        "group_name": group_name,
    }


@router.get("/mappings")
def list_mappings(
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[models.User, Depends(_users_admin)],
):
    rows = (
        db.query(models.LdapGroupMapping, models.Group.name)
        .join(models.Group, models.Group.id == models.LdapGroupMapping.group_id)
        .order_by(models.LdapGroupMapping.ldap_group_dn, models.Group.name)
        .all()
    )
    return [_mapping_item(m, name) for m, name in rows]


@router.post(
    "/mappings",
    status_code=201,
    responses={404: {"description": "Group not found"}, 409: {"description": "Mapping already exists"}},
)
def create_mapping(
    body: LdapMappingCreate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(_users_admin)],
):
    group = db.get(models.Group, body.group_id)
    if not group:
        raise HTTPException(404, detail="Group not found")
    duplicate = db.query(models.LdapGroupMapping).filter(
        func.lower(models.LdapGroupMapping.ldap_group_dn) == body.ldap_group_dn.lower(),
        models.LdapGroupMapping.group_id == group.id,
    ).first()
    if duplicate:
        raise HTTPException(409, detail="Mapping already exists")
    mapping = models.LdapGroupMapping(ldap_group_dn=body.ldap_group_dn, group_id=group.id)
    db.add(mapping)
    add_event_log(db, source="ldap", resource=group.name, event="LDAP mapping added",
                  owner=user.username, message=f"dn={body.ldap_group_dn}")
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, detail="Mapping already exists")
    db.refresh(mapping)
    return _mapping_item(mapping, group.name)


@router.delete("/mappings/{mapping_id}", status_code=204, responses={404: {"description": "Mapping not found"}})
def delete_mapping(
    mapping_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(_users_admin)],
):
    mapping = db.get(models.LdapGroupMapping, mapping_id)
    if not mapping:
        raise HTTPException(404, detail="Mapping not found")
    add_event_log(db, source="ldap", resource=str(mapping.group_id), event="LDAP mapping removed",
                  owner=user.username, message=f"dn={mapping.ldap_group_dn}")
    db.delete(mapping)
    db.commit()
