from app import main


def test_auto_seed_does_not_crash(monkeypatch):
    monkeypatch.setenv("AUTO_SEED_ADMIN", "true")
    monkeypatch.setenv("ADMIN_PASSWORD", "")
    main._seed_admin()
