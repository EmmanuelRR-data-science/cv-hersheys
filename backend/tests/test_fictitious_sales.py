import uuid

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
