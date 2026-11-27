"""Partial failures stay on the one completion event."""
from app import models
from app.database import Base, SessionLocal, engine
from app.routers import sync


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
