"""Object store users/quota API on in-memory SQLite (no Postgres needed)."""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.pool import StaticPool
@compiles(JSONB,"sqlite")
def _j(t,c,**k): return "JSON"
from fastapi import FastAPI
from fastapi.testclient import TestClient
from app.database import Base, get_db
from app import models
from app.auth import get_current_user
from app.routers.object_storages import router
e=create_engine("sqlite://",connect_args={"check_same_thread":False},poolclass=StaticPool)
Base.metadata.create_all(e); S=sessionmaker(bind=e)
app=FastAPI(); app.include_router(router)
def db():
    s=S()
    try: yield s
    finally: s.close()
app.dependency_overrides[get_db]=db
role={"r":"admin"}
app.dependency_overrides[get_current_user]=lambda: models.User(username="x",role=role["r"])
s=S(); s.add(models.ObjectStorage(name="o",provider="nutanix")); s.commit()
c = TestClient(app)


def test_object_storage_users_roundtrip_validation_and_permissions():
    u=[{"username":"a","access":"write","quota_gb":10,"used_gb":9.5},{"username":"b"}]
    assert c.put("/api/object-storages/1/users",json=u).status_code==200
    r=c.get("/api/object-storages/1/users").json(); assert len(r)==2 and r[0]["quota_gb"]==10 and r[1]["quota_gb"] is None
    assert c.get("/api/object-storages").json()["items"][0]["user_count"] == 2
    assert c.put("/api/object-storages/1/users",json=[u[0],u[0]]).status_code==422
    assert c.put("/api/object-storages/1/users",json=[{"username":"a","access":"bogus"}]).status_code==422
    assert c.get("/api/object-storages/9/users").status_code==404
    role["r"]="read"
    assert c.put("/api/object-storages/1/users",json=[]).status_code==403
    assert len(c.get("/api/object-storages/1/users").json())==2
