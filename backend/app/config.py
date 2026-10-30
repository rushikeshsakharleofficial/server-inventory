"""Environment and production deployment guards."""
import os


def _is_production() -> bool:
    env = os.getenv("ENVIRONMENT") or os.getenv("APP_ENV") or os.getenv("ENV", "")
    return env.lower() in {"prod", "production"}


def validate_production_config() -> None:
    """Fail closed on absent/example deployment secrets."""
    if not _is_production():
        return

    for name, min_length in (("SECRET_KEY", 32), ("API_KEY_PEPPER", 32), ("POSTGRES_PASSWORD", 16)):
        value = os.getenv(name, "").strip()
        if (
            len(value) < min_length
            or value.upper().startswith(("REPLACE_ME", "CHANGE_ME", "EXAMPLE_", "YOUR_"))
            or value.lower() in {"password", "password123", "admin123", "inventory"}
        ):
            raise RuntimeError(
                f"{name} is missing, too short, or still an example value; "
                "generate a unique secret before running in production"
            )

    # CREDENTIAL_ENCRYPTION_KEY is additionally verified as a real Fernet key
    # by crypto.py during module initialization.
    if not os.getenv("CREDENTIAL_ENCRYPTION_KEY", "").strip():
        raise RuntimeError("CREDENTIAL_ENCRYPTION_KEY is required in production")
