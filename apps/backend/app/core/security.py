import bcrypt

# bcrypt only considers the first 72 bytes of the password. Truncate explicitly
# so longer inputs don't raise (newer bcrypt refuses >72 bytes instead of truncating).
_MAX_BCRYPT_BYTES = 72


def _truncate(password: str) -> bytes:
    return password.encode("utf-8")[:_MAX_BCRYPT_BYTES]


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(_truncate(plain_password), hashed_password.encode("utf-8"))


def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(_truncate(password), bcrypt.gensalt()).decode("utf-8")
