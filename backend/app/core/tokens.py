from datetime import UTC, datetime, timedelta
from uuid import uuid4

import jwt


def issue_access_token(
    *,
    subject: str,
    now: datetime,
    jwt_secret_key: str,
    jwt_algorithm: str = "HS256",
    access_token_exp_minutes: int = 60 * 24,
) -> str:
    issued_at = int(now.timestamp())
    expires_at = int((now + timedelta(minutes=access_token_exp_minutes)).timestamp())
    payload = {"sub": subject, "iat": issued_at, "exp": expires_at, "jti": uuid4().hex}
    return jwt.encode(payload, jwt_secret_key, algorithm=jwt_algorithm)


def decode_token(
    token: str,
    *,
    jwt_secret_key: str,
    jwt_algorithm: str = "HS256",
    verify_exp: bool = True,
) -> dict:
    options = {"verify_exp": verify_exp, "verify_iat": False}
    return jwt.decode(token, jwt_secret_key, algorithms=[jwt_algorithm], options=options)


def refresh_access_token(
    token: str,
    *,
    now: datetime,
    jwt_secret_key: str,
    jwt_algorithm: str = "HS256",
    access_token_exp_minutes: int = 60 * 24,
    refresh_window: timedelta = timedelta(days=7),
) -> str:
    payload = decode_token(
        token,
        jwt_secret_key=jwt_secret_key,
        jwt_algorithm=jwt_algorithm,
        verify_exp=False,
    )
    issued_at = datetime.fromtimestamp(int(payload["iat"]), tz=UTC)
    if now - issued_at >= refresh_window:
        raise ValueError("refresh window exceeded")
    return issue_access_token(
        subject=str(payload["sub"]),
        now=now,
        jwt_secret_key=jwt_secret_key,
        jwt_algorithm=jwt_algorithm,
        access_token_exp_minutes=access_token_exp_minutes,
    )
