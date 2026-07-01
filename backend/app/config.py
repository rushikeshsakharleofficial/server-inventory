import os


def _is_production() -> bool:
    env = os.getenv("ENVIRONMENT") or os.getenv("APP_ENV") or os.getenv("ENV", "")
    return env.lower() in {"prod", "production"}
