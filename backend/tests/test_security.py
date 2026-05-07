import re
from datetime import UTC, datetime, timedelta

import pytest

from app.core.security import hash_password, verify_password
from app.core.tokens import decode_token, issue_access_token, refresh_access_token

JWT_SECRET = "dev-secret-dev-secret-dev-secret-dev-secret"


def test_hash_password_uses_bcrypt_cost_at_least_12() -> None:
    hashed = hash_password("S3cr3t-P4ssw0rd!")
    match = re.match(r"^\$2[aby]\$(\d\d)\$", hashed)
    assert match is not None
    assert int(match.group(1)) >= 12


def test_verify_password_accepts_correct_password() -> None:
    hashed = hash_password("S3cr3t-P4ssw0rd!")
    assert verify_password("S3cr3t-P4ssw0rd!", hashed) is True


def test_verify_password_rejects_wrong_password() -> None:
    hashed = hash_password("S3cr3t-P4ssw0rd!")
    assert verify_password("wrong", hashed) is False


def test_issue_access_token_sets_exp_to_24h_after_iat() -> None:
    now = datetime(2026, 5, 6, 12, 0, 0, tzinfo=UTC)
    token = issue_access_token(subject="hersheys", now=now, jwt_secret_key=JWT_SECRET)
    payload = decode_token(token, jwt_secret_key=JWT_SECRET, verify_exp=False)

    assert payload["sub"] == "hersheys"
    assert payload["iat"] == int(now.timestamp())
    assert payload["exp"] == int((now + timedelta(hours=24)).timestamp())


def test_refresh_access_token_allows_refresh_within_7_days_of_original_iat() -> None:
    issued_at = datetime(2026, 5, 1, 12, 0, 0, tzinfo=UTC)
    old_token = issue_access_token(subject="hersheys", now=issued_at, jwt_secret_key=JWT_SECRET)

    refresh_time = issued_at + timedelta(days=6, hours=23)
    new_token = refresh_access_token(old_token, now=refresh_time, jwt_secret_key=JWT_SECRET)
    new_payload = decode_token(new_token, jwt_secret_key=JWT_SECRET, verify_exp=False)

    assert new_payload["sub"] == "hersheys"
    assert new_payload["iat"] == int(refresh_time.timestamp())


def test_refresh_access_token_denies_refresh_at_or_after_7_days() -> None:
    issued_at = datetime(2026, 5, 1, 12, 0, 0, tzinfo=UTC)
    old_token = issue_access_token(subject="hersheys", now=issued_at, jwt_secret_key=JWT_SECRET)

    refresh_time = issued_at + timedelta(days=7)
    with pytest.raises(ValueError, match="refresh window"):
        refresh_access_token(old_token, now=refresh_time, jwt_secret_key=JWT_SECRET)
