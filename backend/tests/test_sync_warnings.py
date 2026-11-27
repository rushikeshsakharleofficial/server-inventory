"""Partial failures stay on the one completion event."""
from app import models
from app.database import DATABASE_URL, Base, SessionLocal, engine
from app.routers import sync, sync_utils
from app.ws_manager import manager


def test_partial_failure_makes_one_resolved_warning(monkeypatch):
    Base.metadata.create_all(bind=engine)
    monkeypatch.setattr(sync, "_fetch_provider_servers", lambda *a: ([], ["vps/x: boom"]))
    db = SessionLocal()
    db.query(models.EventLog).filter(models.EventLog.resource == "warn-test").delete()
    db.commit()
    sync._sync_one_credential(db, type("C", (), {"provider": "warn-test"})())
    events = db.query(models.EventLog).filter(models.EventLog.resource == "warn-test").all()
    assert [(e.severity, e.status) for e in events] == [("warning", "resolved")]
    assert "vps/x: boom" in events[0].message
    db.close()


def test_resource_sync_tells_clients_when_done(monkeypatch):
    Base.metadata.create_all(bind=engine)
    sent = []
    monkeypatch.setattr(manager, "broadcast", sent.append)
    monkeypatch.setattr(sync_utils, "_load_active_credentials", lambda *a: [])
    sync_utils._sync_resources(None, DATABASE_URL, models.DnsRecord, "fetch_domains")
    assert sent == [{"type": "resources_changed", "resource": "dns_records"}]
