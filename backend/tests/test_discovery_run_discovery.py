"""
Pinning tests for run_discovery (backend/app/discovery_service.py),
complexity 58 vs 15 allowed. Opens its own engine/session like _run_sync,
so tests commit against the real test Postgres DB and clean up afterward.
"""
from unittest.mock import patch

import pytest

from app import models, discovery_service
from tests.conftest import _TEST_DB_URL


@pytest.fixture
def real_db():
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    engine = create_engine(_TEST_DB_URL, pool_pre_ping=True)
    Session = sessionmaker(bind=engine)
    session = Session()
    try:
        yield session
    finally:
        session.rollback()
        session.query(models.DiscoveryResult).delete(synchronize_session=False)
        session.query(models.DiscoveryJob).delete(synchronize_session=False)
        session.query(models.Server).delete(synchronize_session=False)
        session.query(models.SSHCredential).delete(synchronize_session=False)
        session.commit()
        session.close()
        engine.dispose()


def _make_ssh_cred(session, is_default=True):
    from app.crypto import encrypt_str
    cred = models.SSHCredential(
        name="disc-cred", username="root", auth_method="password",
        password=encrypt_str("s3cr3t"), is_default=is_default,
    )
    session.add(cred)
    session.commit()
    session.refresh(cred)
    return cred


def _make_job(session, cidr="10.10.10.0/30"):
    job = models.DiscoveryJob(cidr=cidr, status="queued")
    session.add(job)
    session.commit()
    session.refresh(job)
    return job


def _scan_result(ip, status="success", facts=None, host_key_fp="fp-1"):
    return {
        "ip": ip,
        "port_open": status != "closed",
        "auth_ok": status == "success",
        "facts": facts,
        "host_key_fp": host_key_fp if status == "success" else None,
        "status": status,
        "error_message": "boom" if status == "error" else None,
    }


class TestRunDiscoveryValidation:
    def test_invalid_cidr_marks_job_failed(self, real_db):
        job = _make_job(real_db, cidr="not-a-cidr")
        _make_ssh_cred(real_db)

        with patch.object(discovery_service.manager, "broadcast"):
            discovery_service.run_discovery(job.id, "not-a-cidr", None, 4, 3, _TEST_DB_URL)

        real_db.refresh(job)
        assert job.status == "failed"
        assert job.error_message

    def test_no_ssh_credential_available_marks_job_failed(self, real_db):
        job = _make_job(real_db)

        with patch.object(discovery_service.manager, "broadcast"):
            discovery_service.run_discovery(job.id, job.cidr, None, 4, 3, _TEST_DB_URL)

        real_db.refresh(job)
        assert job.status == "failed"
        assert "SSH credential" in job.error_message

    def test_missing_job_returns_silently(self, real_db):
        with patch.object(discovery_service.manager, "broadcast") as mock_broadcast:
            discovery_service.run_discovery(999999, "10.0.0.0/30", None, 4, 3, _TEST_DB_URL)
        mock_broadcast.assert_not_called()


class TestRunDiscoveryScanning:
    def test_successful_scan_creates_new_server(self, real_db):
        job = _make_job(real_db, cidr="10.10.10.0/30")
        _make_ssh_cred(real_db)

        facts = {
            "hostname": "disc-host-1",
            "machine_id": "abc123machineid",
            "interfaces": [{"addresses": [{"address": "10.10.10.1", "scope": "global"}]}],
        }

        def fake_scan_ip(ip, ssh_cred, timeout):
            return _scan_result(ip, status="success", facts=facts)

        with patch.object(discovery_service, "_scan_ip", side_effect=fake_scan_ip), \
             patch.object(discovery_service.manager, "broadcast"):
            discovery_service.run_discovery(job.id, job.cidr, None, 4, 3, _TEST_DB_URL)

        real_db.refresh(job)
        assert job.status == "success"
        assert job.scanned_ips == job.total_ips
        assert job.servers_added >= 1

        results = real_db.query(models.DiscoveryResult).filter_by(job_id=job.id).all()
        assert len(results) == job.total_ips
        assert any(r.status == "success" for r in results)

    def test_same_machine_id_across_multiple_ips_dedupes_to_one_server(self, real_db):
        job = _make_job(real_db, cidr="10.10.10.0/30")
        _make_ssh_cred(real_db)

        shared_facts = {
            "hostname": "multi-homed-host",
            "machine_id": "same-machine-id-xyz",
            "interfaces": [{"addresses": [{"address": "10.10.10.1", "scope": "global"}]}],
        }

        def fake_scan_ip(ip, ssh_cred, timeout):
            return _scan_result(ip, status="success", facts=dict(shared_facts))

        with patch.object(discovery_service, "_scan_ip", side_effect=fake_scan_ip), \
             patch.object(discovery_service.manager, "broadcast"):
            discovery_service.run_discovery(job.id, job.cidr, None, 4, 3, _TEST_DB_URL)

        real_db.refresh(job)
        matching_servers = real_db.query(models.Server).filter_by(machine_id="same-machine-id-xyz").all()
        assert len(matching_servers) == 1
        assert job.duplicates_merged >= 1

    def test_auth_failed_increments_failed_counter_not_added(self, real_db):
        job = _make_job(real_db, cidr="10.10.10.0/30")
        _make_ssh_cred(real_db)

        def fake_scan_ip(ip, ssh_cred, timeout):
            return _scan_result(ip, status="auth_failed")

        with patch.object(discovery_service, "_scan_ip", side_effect=fake_scan_ip), \
             patch.object(discovery_service.manager, "broadcast"):
            discovery_service.run_discovery(job.id, job.cidr, None, 4, 3, _TEST_DB_URL)

        real_db.refresh(job)
        assert job.status == "success"  # the JOB succeeds even if individual hosts fail auth
        assert job.failed == job.total_ips
        assert job.servers_added == 0

    def test_stop_event_set_mid_scan_marks_job_stopped(self, real_db):
        job = _make_job(real_db, cidr="10.10.10.0/28")  # 14 usable IPs — enough to interleave a stop
        _make_ssh_cred(real_db)

        call_count = {"n": 0}

        def fake_scan_ip(ip, ssh_cred, timeout):
            call_count["n"] += 1
            if call_count["n"] == 2:
                discovery_service._stop_events[job.id].set()
            return _scan_result(ip, status="closed")

        with patch.object(discovery_service, "_scan_ip", side_effect=fake_scan_ip), \
             patch.object(discovery_service.manager, "broadcast"):
            discovery_service.run_discovery(job.id, job.cidr, None, 4, 3, _TEST_DB_URL)

        real_db.refresh(job)
        assert job.status == "stopped"

    def test_unhandled_exception_in_scan_loop_marks_job_failed(self, real_db):
        job = _make_job(real_db, cidr="10.10.10.0/30")
        _make_ssh_cred(real_db)

        with patch.object(discovery_service, "_scan_ip", side_effect=RuntimeError("thread pool exploded")), \
             patch.object(discovery_service.manager, "broadcast"):
            discovery_service.run_discovery(job.id, job.cidr, None, 4, 3, _TEST_DB_URL)

        real_db.refresh(job)
        assert job.status == "failed"
        assert "thread pool exploded" in job.error_message
