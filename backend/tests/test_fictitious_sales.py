import uuid
from datetime import date, timedelta

from app.services.fictitious_sales import build_fictitious_sales


def test_build_fictitious_sales_is_deterministic() -> None:
    image_id = str(uuid.UUID("12345678-1234-5678-1234-567812345678"))
    first = build_fictitious_sales(image_id=image_id)
    second = build_fictitious_sales(image_id=image_id)

    assert first == second


def test_build_fictitious_sales_structure() -> None:
    payload = build_fictitious_sales(image_id=str(uuid.uuid4()))

    assert payload["product"]["brand"] == "Hershey's"
    assert payload["pricing"]["currency"] == "MXN"
    assert len(payload["series30d"]) == 30
    assert len(payload["topStores"]) == 5


def test_build_fictitious_sales_series_dates_are_stable_and_contiguous() -> None:
    image_id = str(uuid.UUID("12345678-1234-5678-1234-567812345678"))
    payload = build_fictitious_sales(image_id=image_id)

    first_day = date.fromisoformat(payload["series30d"][0]["date"])
    last_day = date.fromisoformat(payload["series30d"][-1]["date"])
    expected_end = date(2026, 1, 1) + timedelta(days=uuid.UUID(image_id).int % 365)

    assert last_day == expected_end
    assert first_day == expected_end - timedelta(days=29)
    assert (last_day - first_day).days == 29
