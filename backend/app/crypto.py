import json
import logging
import os
from pathlib import Path

from cryptography.fernet import Fernet, InvalidToken

from .config import _is_production

_log = logging.getLogger(__name__)

_DEV_CRED_KEY_FILE = Path(__file__).parent.parent / ".dev_cred_key"


def _load_fernet() -> Fernet:
    raw = os.getenv("CREDENTIAL_ENCRYPTION_KEY", "").strip()
    if raw:
        try:
            return Fernet(raw.encode())
        except Exception as exc:
            raise ValueError(
                "CREDENTIAL_ENCRYPTION_KEY is not a valid Fernet key"
            ) from exc

    if _is_production():
        raise RuntimeError(
            "CREDENTIAL_ENCRYPTION_KEY must be set to a Fernet key in production. "
            "Generate one with: python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
        )

    if _DEV_CRED_KEY_FILE.exists():
        stored = _DEV_CRED_KEY_FILE.read_text().strip()
        if stored:
            try:
                return Fernet(stored.encode())
            except Exception:
                pass

    new_key = Fernet.generate_key()
    try:
        _DEV_CRED_KEY_FILE.write_bytes(new_key)
    except OSError:
        pass
    return Fernet(new_key)


_fernet = _load_fernet()


def encrypt_str(value: str) -> str:
    return _fernet.encrypt(value.encode()).decode()


def decrypt_str(value: str) -> str:
    """Decrypt a Fernet-encrypted string. Returns raw value on failure and logs a warning."""
    try:
        return _fernet.decrypt(value.encode()).decode()
    except InvalidToken:
        _log.error("decrypt_str: InvalidToken — possible key mismatch or tampered ciphertext")
        return value
    except Exception as exc:
        _log.error("decrypt_str: unexpected decryption error: %s", exc)
        return value


def encrypt_config(cfg: dict) -> dict:
    """Serialize and encrypt a config dict. Returns {"_enc": "<ciphertext>"}."""
    serialized = json.dumps(cfg, separators=(",", ":"))
    return {"_enc": _fernet.encrypt(serialized.encode()).decode()}


def decrypt_config(cfg: dict) -> dict:
    """Decrypt a config dict encrypted by encrypt_config. Returns raw dict on failure and logs a warning."""
    if not isinstance(cfg, dict):
        return cfg
    if "_enc" in cfg:
        try:
            decrypted = _fernet.decrypt(cfg["_enc"].encode()).decode()
            return json.loads(decrypted)
        except InvalidToken:
            _log.error("decrypt_config: InvalidToken — possible key mismatch or tampered config")
            return cfg
        except Exception as exc:
            _log.error("decrypt_config: unexpected decryption error: %s", exc)
            return cfg
    return cfg
