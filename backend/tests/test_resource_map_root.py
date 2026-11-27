"""Cloud maps must still get IP nodes hung off the server."""
from app import models
from app.routers import resource_map as rm


def test_cloud_map_gets_root_first(monkeypatch):
    asg = rm._node("asg-a", "autoscaling_group", "compute", "a", {})
    monkeypatch.setattr(rm, "_aws_server_map", lambda s, c: {"nodes": [asg], "edges": []})
    server = models.Server(id=7, name="s", provider="aws", public_ip="1.2.3.4")
    out = rm._build_map("server", server, "aws", {})
    assert out["nodes"][0]["id"] == "server-7"
    assert any(e.get("from", e.get("source")) == "server-7" for e in out["edges"])
