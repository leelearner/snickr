"""Password hashing and verification.

bcrypt is used directly (not via passlib) because passlib's compatibility
shim warns on bcrypt >= 4.1. The API we need is just two functions.
"""

import bcrypt


def hash_password(plain: str) -> str:
    """Return a bcrypt hash of the given plaintext password (60-char string)."""
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    """Constant-time comparison of plaintext against a stored bcrypt hash."""
    if not hashed:
        return False
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except ValueError:
        # Stored value is not a valid bcrypt hash (e.g. legacy plaintext seed data).
        return False
