"""LDAP / Active Directory authentication and LDAP group -> IAM group sync."""
import ssl
from contextlib import contextmanager
from dataclasses import dataclass

from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from . import crypto, models

# busy, unavailable: the server could not judge the password
_RETRYABLE_BIND_CODES = {51, 52}


class LdapUnavailable(Exception):
    """Directory unreachable or misconfigured."""


class LdapInvalid(Exception):
    """Directory rejected this user or password."""


@dataclass
class LdapResult:
    dn: str
    username: str
    full_name: str | None
    group_dns: list[str]


def config_dict(row) -> dict:
    cfg = {c.name: getattr(row, c.name) for c in row.__table__.columns}
    cfg["bind_password"] = None
    if row.bind_password_enc:
        try:
            cfg["bind_password"] = crypto.decrypt_str(row.bind_password_enc)
        except Exception:
            pass  # logged by crypto; the service bind then fails as LdapUnavailable
    return cfg


def load_config(db) -> dict | None:
    row = db.get(models.LdapConfig, 1)
    if row is None or not row.enabled:
        return None
    return config_dict(row)


@contextmanager
def _errors():
    """Anything unexpected from the directory layer becomes LdapUnavailable."""
    try:
        yield
    except (LdapInvalid, LdapUnavailable):
        raise
    except Exception as exc:
        raise LdapUnavailable(f"LDAP error: {type(exc).__name__}: {exc}") from exc


@contextmanager
def _connection(cfg: dict, dn: str, password: str):
    """Open (and StartTLS) a connection; the caller binds."""
    import ldap3

    url = (cfg.get("server_url") or "").strip()
    scheme = url.lower().partition("://")[0]
    if scheme not in ("ldap", "ldaps"):
        raise LdapUnavailable("Server URL must start with ldap:// or ldaps://")
    use_ssl = scheme == "ldaps"
    start_tls = bool(cfg.get("start_tls")) and not use_ssl
    timeout = cfg.get("timeout_s") or 5
    tls = None
    if use_ssl or start_tls:
        tls = ldap3.Tls(validate=ssl.CERT_REQUIRED, ca_certs_data=cfg.get("ca_cert_pem") or None)
    server = ldap3.Server(url, use_ssl=use_ssl, tls=tls, connect_timeout=timeout, get_info=ldap3.NONE)
    conn = ldap3.Connection(server, user=dn, password=password, receive_timeout=timeout,
                            auto_referrals=False, raise_exceptions=False, read_only=True)
    try:
        conn.open()
        if start_tls and not conn.start_tls():
            raise LdapUnavailable("StartTLS failed")
        yield conn
    finally:
        try:
            conn.unbind()
        except Exception:
            pass


@contextmanager
def _service_connection(cfg: dict):
    if not cfg.get("bind_dn") or not cfg.get("bind_password"):
        raise LdapUnavailable("Bind DN and bind password are required")
    with _connection(cfg, cfg["bind_dn"], cfg["bind_password"]) as conn:
        if not conn.bind():
            raise LdapUnavailable(f"Service bind failed: {conn.result.get('description')}")
        yield conn


def _search(conn, base: str, search_filter: str, attributes, ok_codes=(0,)) -> list[dict]:
    # search() is falsy for zero hits too, so only the result code tells errors apart
    conn.search(base, search_filter, attributes=attributes)
    if conn.result["result"] not in ok_codes:
        raise LdapUnavailable(f"Search under '{base}' failed: {conn.result.get('description')}")
    return [e for e in conn.response if e["type"] == "searchResEntry"]


def _first(value) -> str | None:
    if isinstance(value, (list, tuple)):
        value = value[0] if value else None
    if isinstance(value, bytes):
        value = value.decode("utf-8", "replace")
    return str(value) if value else None


def authenticate(cfg: dict, username: str, password: str) -> LdapResult:
    # Must stay first: an empty password is an unauthenticated bind that servers accept.
    if not password or not username:
        raise LdapInvalid("Empty username or password")

    with _errors():
        from ldap3 import NO_ATTRIBUTES
        from ldap3.utils.conv import escape_filter_chars

        name_attr, full_attr = cfg["username_attr"], cfg["fullname_attr"]
        with _service_connection(cfg) as service:
            entries = _search(
                service,
                cfg["user_base_dn"],
                cfg["user_filter"].format(username=escape_filter_chars(username)),
                [name_attr, full_attr],
                ok_codes=(0, 4),  # 4 = size limit, still enough to detect ambiguity
            )
            # code 4 with a single entry means more matches may be hidden
            if len(entries) != 1 or service.result["result"] != 0:
                raise LdapInvalid("User not found or ambiguous")
            dn, attrs = entries[0]["dn"], entries[0]["attributes"]

            with _connection(cfg, dn, password) as user_conn:
                if not user_conn.bind():
                    if user_conn.result["result"] in _RETRYABLE_BIND_CODES:
                        raise LdapUnavailable("Directory busy or unavailable")
                    # includes locked/disabled accounts: must not fall back to the cache
                    raise LdapInvalid("Bind rejected")

            # shortcut: unpaged; a user over the server size limit fails, page when that happens
            groups = _search(
                service,
                cfg.get("group_base_dn") or cfg["user_base_dn"],
                cfg["group_filter"].format(user_dn=escape_filter_chars(dn)),
                NO_ATTRIBUTES,
            )

    return LdapResult(
        dn=dn,
        username=(_first(attrs.get(name_attr)) or username).lower(),
        full_name=_first(attrs.get(full_attr)),
        group_dns=[g["dn"] for g in groups],
    )


def test_connection(cfg: dict) -> None:
    with _errors(), _service_connection(cfg):
        pass


def mapped_group_ids(db, group_dns) -> set[int]:
    wanted = {dn.lower() for dn in group_dns}
    return {
        m.group_id
        for m in db.query(models.LdapGroupMapping).all()
        if m.ldap_group_dn.lower() in wanted
    }


def sync_ldap_groups(db, user, group_dns) -> None:
    db.flush()
    table = models.user_groups
    targets = mapped_group_ids(db, group_dns)
    db.execute(delete(table).where(
        table.c.user_id == user.id,
        table.c.source == "ldap",
        table.c.group_id.not_in(targets),
    ))
    if targets:
        db.execute(pg_insert(table).values(
            [{"user_id": user.id, "group_id": gid, "source": "ldap"} for gid in sorted(targets)]
        ).on_conflict_do_nothing())
    db.expire(user, ["groups"])


def ldap_group_ids(db, user_id) -> list[int]:
    table = models.user_groups
    return list(db.execute(
        select(table.c.group_id)
        .where(table.c.user_id == user_id, table.c.source == "ldap")
        .order_by(table.c.group_id)
    ).scalars())
