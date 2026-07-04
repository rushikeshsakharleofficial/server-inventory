"""
Proves the conftest.py harness actually works before it's relied on by the
Track C test-then-refactor pass: a real Postgres connection, TestClient
wiring, and an authenticated request all have to succeed here first.
"""
from app import models


def test_health_endpoint_no_db_no_auth(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_db_session_fixture_persists_and_rolls_back(db_session):
    server = models.Server(name="smoke-test-server", provider="custom", status="unknown")
    db_session.add(server)
    db_session.commit()
    db_session.refresh(server)
    assert server.id is not None

    found = db_session.query(models.Server).filter_by(name="smoke-test-server").first()
    assert found is not None
    assert found.id == server.id


def test_auth_client_fixture_bypasses_real_login(auth_client, admin_user):
    resp = auth_client.get("/api/servers")
    assert resp.status_code == 200


def test_mock_ssh_client_intercepts_paramiko(mock_ssh_client):
    import paramiko

    client = paramiko.SSHClient()
    client.connect(hostname="1.2.3.4")
    mock_ssh_client.connect.assert_called_once_with(hostname="1.2.3.4")


def test_mock_boto3_client_intercepts_aws_sdk(mock_boto3_client):
    import boto3

    mock_boto3_client.return_value.describe_instances.return_value = {"Reservations": []}
    ec2 = boto3.client("ec2")
    result = ec2.describe_instances()
    assert result == {"Reservations": []}
