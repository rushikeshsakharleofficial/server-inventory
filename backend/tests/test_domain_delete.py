"""Deleting a DNS credential removes the records it synced, and only those."""
from app import models
from app.database import Base, SessionLocal, engine
from app.routers import credentials, sync_utils


def test_deleting_credential_deletes_only_its_records():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    ours = db.query(models.DnsRecord).filter(models.DnsRecord.zone.in_(["a.test", "b.test"]))
    ours.delete()
    creds = [models.Credential(name=n, provider="generic-dns", cred_type="api", config={}) for n in ("a.test", "b.test")]
    db.add_all(creds)
    db.commit()
    def sync(cred):
        item = {"cloud_id": name[cred], "name": name[cred], "provider": "generic-dns", "zone": name[cred]}
        sync_utils._apply_one_credential_result(db, models.DnsRecord, "dns_records", cred, [item], None)

    name = {c: c.name for c in creds}
    for cred in creds:
        sync(cred)
    deleted = type("C", (), {"id": creds[0].id, "name": "a.test", "provider": "generic-dns"})()
    name[deleted] = "a.test"

    credentials.delete_credential(creds[0].id, db, type("U", (), {"username": "t"})())

    sync(deleted)  # a fetch that was already running when the credential was deleted

    assert [r.name for r in ours.all()] == ["b.test"]
    db.close()
