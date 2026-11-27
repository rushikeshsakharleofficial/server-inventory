"""LDAP login, group mapping and IAM interaction. The directory itself is faked."""
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from app import auth, ldap_auth, models
from app.database import SessionLocal
from app.limiter import limiter
from app.main import app
from app.permissions import has_perm

PW = "ldap-Passw0rd!x"


def _headers(user):
    return {"Authorization": f"Bearer {auth.create_access_token({'sub': user.username})}"}


@pytest.fixture
def env(monkeypatch):
    monkeypatch.setattr(limiter, "enabled", False)
    tag = uuid.uuid4().hex[:8]
    with TestClient(app) as client:
        db = SessionLocal()
        db.query(models.LdapConfig).delete()
        admin = models.User(username=f"adm-{tag}", hashed_password=auth.hash_password(PW), role="admin")
        ops = models.Group(name=f"ops-{tag}", permissions={"servers": ["write"]})
        dev = models.Group(name=f"dev-{tag}", permissions={})
        manual = models.Group(name=f"man-{tag}", permissions={})
        db.add_all([admin, ops, dev, manual])
        db.commit()
        db.add_all([
            models.LdapGroupMapping(ldap_group_dn=f"cn=ops,dc={tag}", group_id=ops.id),
            models.LdapGroupMapping(ldap_group_dn=f"cn=dev,dc={tag}", group_id=dev.id),
            models.LdapConfig(id=1, enabled=True, server_url="ldap://x", bind_dn="cn=svc",
                              user_base_dn="dc=x"),
        ])
        db.commit()

        state = {"groups": [f"CN=OPS,dc={tag}"], "error": None, "calls": 0}
        name = f"alice-{tag}"

        def fake(cfg, username, password):
            state["calls"] += 1
            if state["error"]:
                raise state["error"]
            return ldap_auth.LdapResult(f"uid={name}", name, "Alice", state["groups"])

        monkeypatch.setattr(ldap_auth, "authenticate", fake)

        class E:
            pass

        e = E()
        e.client, e.db, e.state, e.name, e.admin = client, db, state, name, admin
        e.ops, e.dev, e.manual = ops, dev, manual
        e.login = lambda u=name, p=PW: client.post("/api/auth/login", data={"username": u, "password": p})

        def user():
            db.expire_all()
            return db.query(models.User).filter_by(username=name).first()

        e.user = user
        e.groups = lambda: {g.name for g in user().groups}
        yield e
        db.rollback()
        db.query(models.LdapConfig).delete()
        db.query(models.User).filter(models.User.username.like(f"%{tag}")).delete(synchronize_session=False)
        db.query(models.Group).filter(models.Group.name.like(f"%{tag}")).delete(synchronize_session=False)
        db.commit()
        db.close()


def test_first_login_provisions_user_with_mapped_policy(env):
    assert env.login().status_code == 200
    u = env.user()
    assert (u.auth_source, u.role) == ("ldap", "read")
    assert env.groups() == {env.ops.name}
    assert has_perm(u, "servers", "write")


def test_resync_removes_stale_ldap_group_and_keeps_manual(env):
    env.login()
    uid = env.user().id
    r = env.client.put(f"/api/iam/users/{uid}/groups", json={"group_ids": [env.manual.id]},
                       headers=_headers(env.admin))
    assert r.status_code == 200
    assert env.groups() == {env.manual.name, env.ops.name}  # LDAP row survives manual edit
    assert r.json()["ldap_group_ids"] == [env.ops.id]
    r = env.client.put(f"/api/iam/groups/{env.ops.id}/members", json={"group_ids": []},
                       headers=_headers(env.admin))
    assert r.status_code == 200
    assert env.ops.name in env.groups()  # ... and a group-members edit
    env.state["groups"] = [env.state["groups"][0].replace("OPS", "dev")]
    env.login()
    assert env.groups() == {env.manual.name, env.dev.name}


def test_cache_only_when_directory_unreachable(env):
    env.login()
    env.state["error"] = ldap_auth.LdapUnavailable("down")
    assert env.login().status_code == 200
    assert env.login(p="wrong-password-123").status_code == 503
    env.state["error"] = ldap_auth.LdapInvalid("bad")
    assert env.login().status_code == 401
    env.state["error"] = ldap_auth.LdapUnavailable("down")
    u = env.user()
    u.ldap_cached_at = datetime.now(timezone.utc) - timedelta(hours=73)
    env.db.commit()
    assert env.login().status_code == 503


def test_disabled_ldap_blocks_ldap_users_and_never_calls_directory(env):
    env.login()
    env.db.query(models.LdapConfig).update({"enabled": False})
    env.db.commit()
    calls = env.state["calls"]
    assert env.login().status_code == 401
    assert env.state["calls"] == calls


def test_local_user_never_sent_to_ldap(env):
    assert env.login(env.admin.username).status_code == 200
    assert env.login(env.admin.username, "wrong-password-123").status_code == 401
    assert env.login(env.admin.username.upper()).status_code == 401
    assert env.state["calls"] == 0


def test_ldap_cannot_take_over_local_account(env):
    env.db.add(models.User(username=env.name, hashed_password=auth.hash_password("local-Passw0rd!"), role="read"))
    env.db.commit()
    assert env.login(env.name.upper()).status_code == 401
    assert env.user().auth_source == "local"


def test_admin_switches_user_to_local(env):
    env.login()
    uid = env.user().id
    r = env.client.patch(f"/api/users/{uid}", json={"auth_source": "local"}, headers=_headers(env.admin))
    assert r.status_code == 200 and r.json()["auth_source"] == "local"
    calls = env.state["calls"]
    assert env.login().status_code == 200  # same credentials, no directory
    assert env.state["calls"] == calls
    assert env.groups() == {env.ops.name}
    r = env.client.patch(f"/api/users/{env.admin.id}", json={"auth_source": "ldap"}, headers=_headers(env.admin))
    assert r.status_code == 400


def test_ldap_user_cannot_change_password(env):
    env.login()
    r = env.client.put("/api/auth/change-password", headers=_headers(env.user()),
                       json={"current_password": PW, "new_password": "another-Passw0rd!"})
    assert r.status_code == 400


def test_config_api(env):
    h = _headers(env.admin)
    env.db.query(models.LdapConfig).delete()
    env.db.commit()
    assert env.client.get("/api/ldap/config", headers=h).json()["enabled"] is False
    body = {"enabled": True, "server_url": "ldaps://dir", "bind_dn": "cn=svc", "user_base_dn": "dc=x"}
    assert env.client.put("/api/ldap/config", json=body, headers=h).status_code == 422
    r = env.client.put("/api/ldap/config", json={**body, "bind_password": "s3cret"}, headers=h)
    assert r.status_code == 200 and r.json()["has_bind_password"] is True
    assert "s3cret" not in r.text and "bind_password_enc" not in r.text
    assert env.client.put("/api/ldap/config", json=body, headers=h).status_code == 200
    moved = {**body, "server_url": "ldaps://elsewhere"}
    assert env.client.put("/api/ldap/config", json=moved, headers=h).status_code == 422


def test_empty_password_rejected_before_bind():
    with pytest.raises(ldap_auth.LdapInvalid):
        ldap_auth.authenticate({"server_url": "ldap://nowhere.invalid"}, "bob", "")


def test_password_rejected_by_directory_is_dropped_from_cache(env):
    env.login()
    env.state["error"] = ldap_auth.LdapInvalid("changed")
    assert env.login(p="some-typo-Passw0rd").status_code == 401
    assert env.user().ldap_cached_at is not None  # a typo must not wipe the cache
    assert env.login().status_code == 401
    env.state["error"] = ldap_auth.LdapUnavailable("down")
    assert env.login().status_code == 503


def test_ldap_user_cannot_be_renamed(env):
    env.login()
    uid = env.user().id
    r = env.client.patch(f"/api/users/{uid}", json={"username": f"other-{env.name}"}, headers=_headers(env.admin))
    assert r.status_code == 400
    r = env.client.patch(f"/api/users/{uid}", json={"username": env.name, "full_name": "A"}, headers=_headers(env.admin))
    assert r.status_code == 200


def test_disabling_start_tls_requires_bind_password_again(env):
    h = _headers(env.admin)
    body = {"enabled": True, "server_url": "ldap://dir", "start_tls": True, "bind_dn": "cn=svc", "user_base_dn": "dc=x"}
    assert env.client.put("/api/ldap/config", json={**body, "bind_password": "s3cret"}, headers=h).status_code == 200
    r = env.client.put("/api/ldap/config", json={**body, "start_tls": False}, headers=h)
    assert r.status_code == 422
